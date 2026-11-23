import { test } from '@playwright/test';
import { createEvidenceWriter, enterEditMode } from '../helpers/a11y-utils.js';

const evidence = createEvidenceWriter('exploratory');

function makeLog(id) {
  const steps = [];
  return {
    step(action, data, observed) {
      steps.push({
        n: steps.length + 1,
        action,
        data: data === undefined ? null : data,
        observed
      });
    },
    save(extra = {}) {
      evidence.saveJson(id, { id, ...extra, steps });
    }
  };
}

const addTileButton = (page) =>
  page.locator('button:has-text("Add Tile"), [aria-label="Add Tile"]').first();
const labelInput = (page) => page.locator('input#label');
const saveButton = (page) =>
  page.getByRole('button', { name: /save/i }).first();
const backButton = (page) => page.locator('header button').first();
const tileCount = (page) => page.locator('button.Tile').count();

async function openCreateTile(page) {
  await addTileButton(page).click();
  await labelInput(page).waitFor({ state: 'visible' });
}

async function saveState(page) {
  const button = saveButton(page);
  const visible = await button.isVisible().catch(() => false);
  return {
    saveVisible: visible,
    saveDisabled: visible ? await button.isDisabled() : null
  };
}

const isOnCreateScreen = (page) =>
  labelInput(page)
    .isVisible()
    .catch(() => false);

test.describe('Exploratory - Create tile', () => {
  test.beforeEach(async ({ page }) => {
    page.consoleErrors = [];
    const noise =
      /ERR_TUNNEL|Network Error|PayPal|api\.localhost|localization of the unlogged|Error getting voices|Content Security Policy/;
    page.on(
      'console',
      (message) =>
        message.type() === 'error' &&
        !noise.test(message.text()) &&
        page.consoleErrors.push(message.text().slice(0, 200))
    );
    page.on('pageerror', (error) =>
      page.consoleErrors.push(`pageerror: ${error.message.slice(0, 200)}`)
    );
  });

  test('ES-01 Main flow and repetition: create 3 tiles in a row', async ({
    page
  }) => {
    const log = makeLog('ES-01');
    await enterEditMode(page);
    const before = await tileCount(page);
    log.step('Count tiles on the initial board (edit mode)', null, {
      tiles: before
    });
    for (const label of ['water', 'juice', 'milk']) {
      await openCreateTile(page);
      log.step('Open "Create tile"', null, await saveState(page));
      await labelInput(page).fill(label);
      log.step('Fill Label', label, await saveState(page));
      await evidence.screenshot(page, `ES-01-create-screen-${label}`);
      await saveButton(page).click();
      await page.waitForTimeout(1200);
      log.step('Click SAVE', label, {
        url: page.url(),
        tiles: await tileCount(page),
        tileVisibleByText: await page.getByText(label, { exact: true }).count()
      });
    }
    await evidence.screenshotLastTile(page, 'ES-01-after-3-tiles', 'milk');

    const created = page.getByRole('button', { name: 'water' }).first();
    if (await created.count()) {
      await created.click();
      await page.waitForTimeout(500);
      log.step('Click the newly created "water" tile', 'water', {
        clearButtonVisible: await page
          .getByRole('button', { name: 'Clear' })
          .isVisible()
      });
    }
    log.save({
      technique: 'Main flow + repeated operation',
      consoleErrors: page.consoleErrors
    });
  });

  test('ES-02 Data variation: empty, spaces, 1 char, long, accents, emoji, duplicate', async ({
    page
  }) => {
    const log = makeLog('ES-02');
    await enterEditMode(page);
    const cases = [
      ['empty', ''],
      ['spaces only', '   '],
      ['1 character', 'a'],
      ['accents', 'água é pão'],
      ['emoji', '😀 feliz'],
      ['duplicate of an existing tile', 'yes'],
      ['100 characters', 'x'.repeat(100)],
      ['500 characters', 'y'.repeat(500)]
    ];
    for (const [name, value] of cases) {
      // Measured on the board, before opening the create screen
      const before = await tileCount(page);
      await openCreateTile(page);
      await labelInput(page).fill(value);
      const state = await saveState(page);
      await evidence.screenshot(
        page,
        `ES-02-create-screen-${name.replace(/\W+/g, '_')}`
      );
      let after = null;
      let urlAfter = null;
      if (state.saveVisible && !state.saveDisabled) {
        await saveButton(page).click();
        await page.waitForTimeout(1200);
        urlAfter = page.url();
        after = await tileCount(page);
      }
      log.step(
        `Label: ${name}`,
        value.length > 40
          ? `${value.slice(0, 20)}… (${value.length} chars)`
          : value,
        { ...state, urlAfter, tilesBefore: before, tilesAfter: after }
      );
      if (after === null) {
        if (await isOnCreateScreen(page)) {
          await backButton(page).click();
          await page.waitForTimeout(500);
        }
      }
    }
    await evidence.screenshotLastTile(page, 'ES-02-final');
    log.save({
      technique: 'Input data variation / boundary values',
      consoleErrors: page.consoleErrors
    });
  });

  test('ES-03 Interruption: cancel, change type and reload the page', async ({
    page
  }) => {
    const log = makeLog('ES-03');
    await enterEditMode(page);
    const before = await tileCount(page);

    await openCreateTile(page);
    await labelInput(page).fill('cancelled');
    await backButton(page).click();
    await page.waitForTimeout(800);
    log.step(
      'Fill "cancelled" and go back with the arrow (no SAVE)',
      'cancelled',
      {
        url: page.url(),
        confirmDialog: await page.getByRole('dialog').count(),
        tilesBefore: before,
        tilesAfter: await tileCount(page),
        tileExists: await page.getByText('cancelled', { exact: true }).count()
      }
    );

    await openCreateTile(page);
    await labelInput(page).fill('my folder');
    await page.getByLabel('Folder').check();
    await evidence.screenshot(page, 'ES-03-create-screen-folder');
    log.step('Select the Folder type', 'my folder', await saveState(page));
    await saveButton(page).click();
    await page.waitForTimeout(1200);
    log.step('SAVE as Folder', 'my folder', {
      tiles: await tileCount(page),
      exists: await page.getByText('my folder', { exact: true }).count()
    });

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const tourVisible = await page
      .getByText('Close Tour')
      .isVisible()
      .catch(() => false);
    if (tourVisible) {
      await page.getByText('Close Tour').click();
    }
    log.step('Reload the page (F5)', null, {
      tourShownAgain: tourVisible,
      folderTilePersisted: await page
        .getByText('my folder', { exact: true })
        .count(),
      tiles: await tileCount(page)
    });
    await evidence.screenshotLastTile(page, 'ES-03-after-reload', 'my folder');
    log.save({
      technique: 'Interruption / cancel / reload',
      consoleErrors: page.consoleErrors
    });
  });

  test('ES-04 Keyboard and accessible names on the Create tile screen', async ({
    page
  }) => {
    const log = makeLog('ES-04');
    await enterEditMode(page);
    await openCreateTile(page);
    const order = [];
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      order.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          if (!el) {
            return null;
          }
          const name =
            el.getAttribute('aria-label') ||
            el.getAttribute('name') ||
            el.id ||
            (el.innerText || '').trim().slice(0, 25) ||
            '(no name)';
          return `${el.tagName}|${name}`;
        })
      );
    }
    log.step('Walk the screen with Tab (14 times)', null, { order });

    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('button, input, textarea, [role=button]')]
        .filter((el) => el.getBoundingClientRect().width > 0)
        .filter((el) => {
          const name =
            el.getAttribute('aria-label') ||
            el.getAttribute('aria-labelledby') ||
            el.getAttribute('title') ||
            (el.innerText || '').trim() ||
            (el.labels && el.labels.length);
          return !name && el.type !== 'hidden';
        })
        .map((el) => el.outerHTML.slice(0, 140))
    );
    log.step('Visible controls with no apparent accessible name', null, {
      count: unnamed.length,
      unnamed
    });

    await labelInput(page).focus();
    await page.keyboard.type('keyboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    log.step('Type "keyboard" in Label and press Enter', 'keyboard', {
      stillOnCreateScreen: await isOnCreateScreen(page),
      tileExists: await page.getByText('keyboard', { exact: true }).count()
    });
    await evidence.screenshot(page, 'ES-04-keyboard');
    log.save({
      technique:
        'Keyboard exploration + accessible names (persona: keyboard / screen reader user)',
      consoleErrors: page.consoleErrors
    });
  });

  test('ES-05 Malicious input in Label (HTML/script) - basic security', async ({
    page
  }) => {
    const log = makeLog('ES-05');
    await enterEditMode(page);
    const dialogs = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      dialog.dismiss();
    });
    const payloads = [
      '<img src=x onerror=alert(1)>',
      '<script>alert(2)</script>',
      '"><b>bold</b>'
    ];
    for (const payload of payloads) {
      await openCreateTile(page);
      await labelInput(page).fill(payload);
      const state = await saveState(page);
      await evidence.screenshot(
        page,
        `ES-05-create-screen-${payloads.indexOf(payload) + 1}`
      );
      if (state.saveVisible && !state.saveDisabled) {
        await saveButton(page).click();
        await page.waitForTimeout(1200);
      }
      log.step('Create a tile with a payload in Label', payload, {
        ...state,
        alertFired: dialogs.length > 0,
        injectedElement: await page.evaluate(
          () =>
            !!document.querySelector(
              '.Tile b, .Tile img[src="x"], .Tile script'
            )
        ),
        tileWithLiteralText: await page
          .getByText(payload, { exact: true })
          .count()
      });
      if (await isOnCreateScreen(page)) {
        await backButton(page).click();
        await page.waitForTimeout(500);
      }
    }
    await evidence.screenshotLastTile(page, 'ES-05-final');
    log.save({
      technique: 'Malicious input (cross-cutting concern: security)',
      dialogsFired: dialogs,
      consoleErrors: page.consoleErrors
    });
  });
});
