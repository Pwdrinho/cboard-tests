import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  WCAG_TAGS,
  createEvidenceWriter,
  summarizeAxe,
  openCreateTile
} from '../helpers/a11y-utils.js';

const evidence = createEvidenceWriter('a11y/create-tile');

async function axeBoth(page, id) {
  const full = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const withoutTtsBanner = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude('.MuiAlert-root')
    .analyze();
  evidence.saveJson(id, {
    full: summarizeAxe(full),
    withoutTtsBanner: summarizeAxe(withoutTtsBanner)
  });
  expect
    .soft(
      withoutTtsBanner.violations
        .filter((v) => v.impact === 'critical')
        .map((v) => v.id),
      `${id}: critical violations (without the TTS banner)`
    )
    .toEqual([]);
}

const documentWidths = (page) =>
  page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));

test.describe('Cboard - Accessibility - Create tile', () => {
  test('NF-01 axe-core on Create tile (initial state)', async ({ page }) => {
    await openCreateTile(page);
    await axeBoth(page, 'NF-01');
  });

  test('NF-02 axe-core with Folder type and Label filled', async ({ page }) => {
    await openCreateTile(page);
    await page.locator('input#label').fill('my folder');
    await page.getByLabel('Folder').check();
    await page.waitForTimeout(400);
    await axeBoth(page, 'NF-02');
  });

  test('NF-03 Create a tile using the keyboard only', async ({ page }) => {
    await openCreateTile(page);
    await page.evaluate(
      () => document.activeElement && document.activeElement.blur()
    );
    let keys = 0;
    const describeFocus = () =>
      page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) {
          return '(body)';
        }
        const name =
          el.getAttribute('aria-label') ||
          el.id ||
          el.getAttribute('name') ||
          (el.innerText || '').trim().slice(0, 20) ||
          '(no name)';
        return `${el.tagName}|${name}`;
      });
    const focusPath = [];

    let reachedLabel = false;
    for (let i = 0; i < 20 && !reachedLabel; i++) {
      await page.keyboard.press('Tab');
      keys++;
      const focus = await describeFocus();
      focusPath.push(focus);
      reachedLabel = focus.includes('label');
    }
    if (reachedLabel) {
      await page.keyboard.type('keyboard');
      keys += 'keyboard'.length;
    }

    let reachedSave = false;
    for (let i = 0; i < 60 && !reachedSave; i++) {
      await page.keyboard.press('Tab');
      keys++;
      const focus = await describeFocus();
      focusPath.push(focus);
      reachedSave = /^BUTTON\|.*save/i.test(focus);
    }

    let tileCreated = false;
    if (reachedSave) {
      await page.keyboard.press('Enter');
      keys++;
      await page.waitForTimeout(1200);
      tileCreated =
        (await page.getByText('keyboard', { exact: true }).count()) > 0 &&
        !(await page
          .locator('input#label')
          .isVisible()
          .catch(() => false));
    }

    evidence.saveJson('NF-03', {
      reachedLabel,
      reachedSave,
      tileCreated,
      totalKeys: keys,
      focusPath
    });
    expect.soft(reachedLabel, 'reached Label with Tab only').toBe(true);
    expect.soft(reachedSave, 'reached SAVE with Tab only').toBe(true);
    expect.soft(tileCreated, 'tile created with the keyboard only').toBe(true);
  });

  test('NF-04 Reflow at 320 px width', async ({ page }) => {
    await openCreateTile(page, { width: 320, height: 568 });
    const widths = await documentWidths(page);
    const label = await page.locator('input#label').boundingBox();
    const saveBox = await page
      .getByRole('button', { name: /save/i })
      .first()
      .boundingBox();
    const fitsWidth = (box) =>
      !!box && box.x >= 0 && box.x + box.width <= widths.clientWidth + 1;
    await evidence.screenshot(page, 'NF-04-320px');
    evidence.saveJson('NF-04', {
      ...widths,
      horizontalScroll: widths.scrollWidth > widths.clientWidth,
      labelFitsViewportWidth: fitsWidth(label),
      saveFitsViewportWidth: fitsWidth(saveBox)
    });
    expect
      .soft(
        widths.scrollWidth <= widths.clientWidth,
        'no horizontal scroll at 320 px'
      )
      .toBe(true);
    expect.soft(fitsWidth(label), 'Label fits the width').toBe(true);
    expect.soft(fitsWidth(saveBox), 'SAVE fits the width').toBe(true);
  });

  test('NF-05 200% zoom (640x400 viewport)', async ({ page }) => {
    await openCreateTile(page, { width: 640, height: 400 });
    const widths = await documentWidths(page);
    const label = page.locator('input#label');
    const saveButton = page.getByRole('button', { name: /save/i }).first();
    await evidence.screenshot(page, 'NF-05-200pct');
    evidence.saveJson('NF-05', {
      ...widths,
      horizontalScroll: widths.scrollWidth > widths.clientWidth,
      labelVisible: await label.isVisible(),
      saveVisible: await saveButton.isVisible()
    });
    expect
      .soft(
        widths.scrollWidth <= widths.clientWidth,
        'no horizontal scroll at 200%'
      )
      .toBe(true);
    expect.soft(await label.isVisible(), 'Label visible').toBe(true);
    expect.soft(await saveButton.isVisible(), 'SAVE visible').toBe(true);
  });

  test('NF-06 Target size (>= 24x24 px)', async ({ page }) => {
    await openCreateTile(page);
    const items = await page.evaluate(() => {
      const selector =
        'button, input:not([type=hidden]), textarea, select, [role=button], [role=radio], a[href]';
      return [...document.querySelectorAll(selector)]
        .filter(
          (el) =>
            el.getAttribute('aria-hidden') !== 'true' &&
            el.getAttribute('tabindex') !== '-1'
        )
        .map((el) => {
          let host = el;
          if (el.type === 'radio') {
            host = el.closest('.MuiButtonBase-root') || el.parentElement;
          } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            host = el.closest('.MuiInputBase-root') || el;
          }
          const box = host.getBoundingClientRect();
          return {
            tag: el.tagName,
            type: el.type || '',
            name:
              el.getAttribute('aria-label') ||
              el.getAttribute('name') ||
              el.id ||
              (el.innerText || '').trim().slice(0, 20),
            width: Math.round(box.width),
            height: Math.round(box.height),
            visible: box.width > 0 && box.height > 0
          };
        })
        .filter((item) => item.visible && !/Tile/.test(item.name));
    });
    const tooSmall = items.filter(
      (item) => item.width < 24 || item.height < 24
    );
    evidence.saveJson('NF-06', {
      measured: items.length,
      smallerThan24: tooSmall,
      count: tooSmall.length
    });
    expect.soft(tooSmall, 'targets smaller than 24x24 px').toEqual([]);
  });
});
