import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  WCAG_TAGS,
  LEVEL_A_TAGS,
  createEvidenceWriter,
  summarizeAxe,
  dismissTour
} from '../helpers/a11y-utils.js';

const evidence = createEvidenceWriter('a11y/secondary-screens');

async function runAxe(page, id) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = summarizeAxe(results);
  evidence.saveJson(id, summary);
  expect
    .soft(
      results.violations
        .filter((v) => v.impact === 'critical')
        .map((v) => v.id),
      `${id}: critical violations`
    )
    .toEqual([]);
  expect
    .soft(
      results.violations
        .filter((v) => v.tags.some((tag) => LEVEL_A_TAGS.includes(tag)))
        .map((v) => v.id),
      `${id}: level A violations`
    )
    .toEqual([]);
  return summary;
}

async function gotoLogin(page) {
  await page.goto('/login-signup', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'LOGIN' }).waitFor();
}

async function gotoSettings(page) {
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await dismissTour(page);
}

const documentWidths = (page) =>
  page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));

test.describe('Cboard - Accessibility - login, settings, scanning and responsiveness', () => {
  test('CE-09 Login/sign up landing screen - axe WCAG 2.2 A/AA', async ({
    page
  }) => {
    await gotoLogin(page);
    await runAxe(page, 'CE-09');
  });

  test('CE-10 Login dialog - axe, initial focus and field names', async ({
    page
  }) => {
    await gotoLogin(page);
    await page.getByRole('button', { name: 'LOGIN' }).click();
    await page.getByRole('dialog').waitFor();
    await page.waitForTimeout(500);

    const focusInsideDialog = await page.evaluate(
      () =>
        !!document.activeElement &&
        !!document.activeElement.closest('[role=dialog]')
    );
    const accessibleNames = {
      email: await page.getByLabel('Email').count(),
      password: await page.getByLabel('Password', { exact: true }).count(),
      togglePasswordVisibility: await page
        .getByRole('button', { name: 'Toggle password visibility' })
        .count()
    };
    const axe = await runAxe(page, 'CE-10');
    evidence.saveJson('CE-10-extra', {
      focusInsideDialog,
      accessibleNames,
      axe
    });

    expect
      .soft(focusInsideDialog, 'initial focus is inside the dialog')
      .toBe(true);
    expect
      .soft(accessibleNames.email, 'email field has an accessible name')
      .toBe(1);
  });

  test('CE-11 Sign up dialog - axe and validation error messages', async ({
    page
  }) => {
    await gotoLogin(page);
    await page.getByRole('button', { name: 'SIGN UP' }).click();
    await page.getByRole('dialog').waitFor();
    await page.waitForTimeout(500);
    const axeEmptyState = await runAxe(page, 'CE-11');

    await page.getByRole('button', { name: 'SIGN ME UP' }).click();
    await page.waitForTimeout(600);
    const afterEmptySubmit = await page.evaluate(() => ({
      invalidFields: document.querySelectorAll('[aria-invalid=true]').length,
      helperTexts: [
        ...document.querySelectorAll('.MuiFormHelperText-root')
      ].map((el) => el.innerText),
      liveRegions: document.querySelectorAll(
        '[role=alert], [aria-live=assertive], [aria-live=polite]'
      ).length,
      dialogStillOpen: !!document.querySelector('[role=dialog]')
    }));
    const axeWithErrors = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    evidence.saveJson('CE-11-extra', {
      axeEmptyState,
      afterEmptySubmit,
      axeWithErrors: summarizeAxe(axeWithErrors)
    });

    expect
      .soft(afterEmptySubmit.invalidFields, 'fields marked with aria-invalid')
      .toBeGreaterThan(0);
    expect
      .soft(afterEmptySubmit.helperTexts.length, 'error message as text')
      .toBeGreaterThan(0);
  });

  test('CE-12 Settings: main screen and sub screens - axe', async ({
    page
  }) => {
    await gotoSettings(page);
    await runAxe(page, 'CE-12-main');

    const subScreens = [
      'Language',
      'Speech',
      'Symbols',
      'Display',
      'Scanning',
      'Navigation and Buttons'
    ];
    for (const name of subScreens) {
      await gotoSettings(page);
      await page.getByText(name, { exact: true }).first().click();
      await page.waitForTimeout(900);
      await runAxe(page, `CE-12-${name.replace(/\W+/g, '_')}`);
    }
  });

  test('CE-13 Scanning mode: enable, visible highlight, select with one key, disable', async ({
    page
  }) => {
    await gotoSettings(page);
    await page.getByText('Scanning', { exact: true }).first().click();
    await page.waitForTimeout(600);
    await page.locator('input[type=checkbox]').first().check({ force: true });
    await page.getByRole('button', { name: /save/i }).first().click();
    await page.waitForTimeout(600);
    await page.goto('/board/root', { waitUntil: 'networkidle' });
    await dismissTour(page);
    await page.waitForTimeout(500);

    const highlightChain = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.scanner__focused')]
          .map((el) => {
            const className =
              (el.className || '')
                .toString()
                .split(' ')
                .find((name) =>
                  /^(Board__|Scroll__|Output__|Tile)/.test(name)
                ) || el.tagName;
            const text = (el.innerText || el.getAttribute('aria-label') || '')
              .trim()
              .slice(0, 10)
              .replace(/\n/g, ' ');
            return `${className}:${text}`;
          })
          .join(' > ')
      );

    const timeline = [];
    const startedAt = Date.now();
    for (let i = 0; i < 6; i++) {
      timeline.push({
        seconds: Math.round((Date.now() - startedAt) / 100) / 10,
        highlighted: await highlightChain()
      });
      await page.waitForTimeout(1000);
    }
    const distinctHighlights = new Set(
      timeline.map((sample) => sample.highlighted).filter(Boolean)
    );

    const highlightHasBorder = await page.evaluate(() => {
      const el = document.querySelector('.scanner__focused');
      const style = el && getComputedStyle(el);
      return (
        !!style &&
        ((style.outlineStyle !== 'none' &&
          parseFloat(style.outlineWidth) > 0) ||
          (style.borderStyle !== 'none' && parseFloat(style.borderWidth) > 0))
      );
    });

    const selectionLog = [];
    let phase = 0;
    let keyPresses = 0;
    const selectionStartedAt = Date.now();
    for (let i = 0; i < 160 && phase < 3; i++) {
      const chain = await highlightChain();
      if (phase === 0 && /Backspace|Output__button/.test(chain)) {
        await page.keyboard.press('Enter');
        keyPresses++;
        phase = 1;
        selectionLog.push(`Enter at: ${chain}`);
      } else if (
        phase === 1 &&
        chain.startsWith('Board__tiles') &&
        !chain.includes('>')
      ) {
        await page.keyboard.press('Enter');
        keyPresses++;
        phase = 2;
        selectionLog.push(`Enter at: ${chain}`);
      } else if (
        phase === 2 &&
        chain.startsWith('Tile') &&
        /:yes/.test(chain)
      ) {
        await page.keyboard.press('Enter');
        keyPresses++;
        phase = 3;
        selectionLog.push(`Enter at: ${chain}`);
      }
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(800);
    const selectedYes = phase === 3;
    const yesAddedToBar = await page
      .getByRole('button', { name: 'Clear' })
      .isVisible()
      .catch(() => false);
    const secondsToSelect =
      Math.round((Date.now() - selectionStartedAt) / 100) / 10;

    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(2500);
    const stillScanning = (await page.locator('.scanner__focused').count()) > 0;

    evidence.saveJson('CE-13', {
      timeline,
      distinctHighlights: [...distinctHighlights],
      highlightHasBorder,
      selectedYes,
      keyPresses,
      selectionLog,
      secondsToSelect,
      yesAddedToBar,
      scanningStoppedAfterFourEscapes: !stillScanning
    });

    expect
      .soft(
        distinctHighlights.size,
        'the highlight goes through more than one group'
      )
      .toBeGreaterThan(1);
    expect
      .soft(highlightHasBorder, 'highlight is visible (border or outline)')
      .toBe(true);
    expect
      .soft(selectedYes && yesAddedToBar, '"yes" selected using scanning only')
      .toBe(true);
    expect.soft(!stillScanning, 'Escape x4 disables scanning').toBe(true);
  });

  const VIEWPORTS = [
    { id: 'desktop-100', width: 1280, height: 800, note: 'desktop, 100%' },
    {
      id: 'zoom-200',
      width: 640,
      height: 400,
      note: '200% zoom (1280x800 / 2)'
    },
    {
      id: 'reflow-320',
      width: 320,
      height: 256,
      note: '400% zoom / 320 px reflow (WCAG 1.4.10)'
    },
    { id: 'tablet-768', width: 768, height: 1024, note: 'tablet, portrait' },
    { id: 'phone-375', width: 375, height: 667, note: 'phone, portrait' },
    {
      id: 'phone-landscape',
      width: 667,
      height: 375,
      note: 'phone, landscape (WCAG 1.3.4)'
    }
  ];

  test('CE-14 Zoom and responsiveness: horizontal scroll and axe in 6 viewports', async ({
    page
  }) => {
    const rows = [];
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height
      });
      const row = {
        viewport: `${viewport.width}x${viewport.height}`,
        note: viewport.note
      };

      await page.goto('/board/root', { waitUntil: 'networkidle' });
      await dismissTour(page);
      await page.waitForTimeout(500);
      row.board = await documentWidths(page);
      const boardResults = await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .analyze();
      row.boardAxeViolationsByImpact =
        summarizeAxe(boardResults).violationsByImpact;

      await page.goto('/settings', { waitUntil: 'networkidle' });
      await dismissTour(page);
      row.settings = await documentWidths(page);

      await page.goto('/login-signup', { waitUntil: 'networkidle' });
      row.login = await documentWidths(page);

      rows.push(row);
      for (const screen of ['board', 'settings', 'login']) {
        expect
          .soft(
            row[screen].scrollWidth <= row[screen].clientWidth,
            `${viewport.id}/${screen}: no horizontal scroll`
          )
          .toBe(true);
      }
    }
    evidence.saveJson('CE-14', rows);
  });

  test('CE-15 Text spacing (WCAG 1.4.12): clipped text on login and settings', async ({
    page
  }) => {
    const spacingCss =
      '*{line-height:1.5 !important;letter-spacing:0.12em !important;word-spacing:0.16em !important} p{margin-bottom:2em !important}';
    const clippedElements = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('button, label, h2, h6, li, p, a, span')]
          .filter((el) => {
            const style = getComputedStyle(el);
            return (
              el.getBoundingClientRect().width > 0 &&
              (style.overflow === 'hidden' ||
                style.textOverflow === 'ellipsis') &&
              (el.scrollWidth > el.clientWidth + 1 ||
                el.scrollHeight > el.clientHeight + 1)
            );
          })
          .map(
            (el) => `${el.tagName}|${(el.innerText || '').trim().slice(0, 30)}`
          )
      );

    const result = {};
    await gotoLogin(page);
    await page.addStyleTag({ content: spacingCss });
    result.login = await clippedElements();
    await page.getByRole('button', { name: 'SIGN UP' }).click();
    await page.getByRole('dialog').waitFor();
    result.signup = await clippedElements();
    await gotoSettings(page);
    await page.addStyleTag({ content: spacingCss });
    result.settings = await clippedElements();
    evidence.saveJson('CE-15', result);

    expect
      .soft(
        result.login.concat(result.signup, result.settings),
        'elements with clipped text'
      )
      .toEqual([]);
  });

  test('CE-16a Accessibility tree of the board (screen reader pre-check)', async ({
    page
  }) => {
    await page.goto('/board/root', { waitUntil: 'networkidle' });
    await dismissTour(page);
    await page.waitForTimeout(500);

    const tree = await page.locator('body').ariaSnapshot();
    evidence.saveText('CE-16a-tree.txt', tree);
    const namedTiles = (tree.match(/- button "(yes|no|food|drinks)"/g) || [])
      .length;
    const unnamedButtons = (tree.match(/- button(?! ")/g) || []).length;
    evidence.saveJson('CE-16a', {
      treeLines: tree.split('\n').length,
      namedTiles,
      unnamedButtons
    });

    expect
      .soft(namedTiles, 'main tiles exposed with a name')
      .toBeGreaterThanOrEqual(4);
    expect.soft(unnamedButtons, 'buttons without a name in the tree').toBe(0);
  });
});
