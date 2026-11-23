import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  WCAG_TAGS,
  LEVEL_A_TAGS,
  createEvidenceWriter,
  summarizeAxe,
  dismissTour,
  openBoard,
  unlockBoard,
  openCreateTile
} from '../helpers/a11y-utils.js';

const evidence = createEvidenceWriter('a11y');

async function runAxe(page, id) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  evidence.saveJson(id, summarizeAxe(results));
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
}

test.describe('Cboard - Accessibility - main screens', () => {
  test('CE-01 Initial board - axe WCAG 2.2 A/AA', async ({ page }) => {
    await openBoard(page);
    await runAxe(page, 'CE-01');
  });

  test('CE-02 Welcome tour dialog - axe WCAG 2.2 A/AA', async ({ page }) => {
    await openBoard(page, { closeTour: false });
    await runAxe(page, 'CE-02');
  });

  test('CE-03 Open folder (food) - axe WCAG 2.2 A/AA', async ({ page }) => {
    await openBoard(page);
    await page.getByRole('button', { name: 'food' }).first().click();
    await page.waitForTimeout(800);
    await runAxe(page, 'CE-03');
  });

  test('CE-04 Communication bar with a phrase - axe WCAG 2.2 A/AA', async ({
    page
  }) => {
    await openBoard(page);
    await page.getByRole('button', { name: 'yes', exact: true }).click();
    await page.getByRole('button', { name: 'no', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();
    await runAxe(page, 'CE-04');
  });

  test('CE-05 Unlock dialog and edit mode - axe WCAG 2.2 A/AA', async ({
    page
  }) => {
    await openBoard(page);
    await unlockBoard(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await runAxe(page, 'CE-05a');

    await page.getByRole('button', { name: /continue editing/i }).click();
    await expect(dialog).toBeHidden();
    await page
      .getByText('Close Tour')
      .waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(800);
    await runAxe(page, 'CE-05b');

    await dismissTour(page, { required: true });
    await page.waitForTimeout(800);
    await runAxe(page, 'CE-05c');
  });

  test('CE-06 Focus order and visible focus indicator (Tab only)', async ({
    page
  }) => {
    await openBoard(page);
    const MAX_TABS = 45;
    const sequence = [];

    for (let i = 0; i < MAX_TABS; i++) {
      await page.keyboard.press('Tab');
      const handle = await page.evaluateHandle(() => document.activeElement);
      const info = await handle.evaluate((el) => {
        if (!el || el === document.body) {
          return null;
        }
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          name: (
            el.getAttribute('aria-label') ||
            el.innerText ||
            el.getAttribute('title') ||
            ''
          )
            .trim()
            .slice(0, 30),
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        };
      });

      if (info) {
        const viewport = page.viewportSize();
        const margin = 6;
        const left = Math.max(0, info.rect.x - margin);
        const top = Math.max(0, info.rect.y - margin);
        const clip = {
          x: left,
          y: top,
          width:
            Math.min(viewport.width, info.rect.x + info.rect.width + margin) -
            left,
          height:
            Math.min(viewport.height, info.rect.y + info.rect.height + margin) -
            top
        };
        if (clip.width > 0 && clip.height > 0) {
          const focused = await page.screenshot({ clip });
          await handle.evaluate((el) => el.blur());
          const blurred = await page.screenshot({ clip });
          info.visibleIndicator = Buffer.compare(focused, blurred) !== 0;
          await handle.evaluate((el) => el.focus({ focusVisible: true }));
        } else {
          info.visibleIndicator = null;
        }
      }
      sequence.push(info);
    }

    const stops = sequence.filter(Boolean);
    const labels = stops.map((stop) => `${stop.tag}|${stop.name}`);
    const uniqueLabels = new Set(labels);
    const withoutVisibleIndicator = stops
      .filter((stop) => stop.visibleIndicator === false)
      .map((stop) => `${stop.tag}|${stop.name}`);
    const notMeasured = stops
      .filter((stop) => stop.visibleIndicator === null)
      .map((stop) => `${stop.tag}|${stop.name}`);
    const cycleClosed = labels.length > uniqueLabels.size;

    evidence.saveJson('CE-06', {
      tabsPressed: MAX_TABS,
      elementsReached: stops.length,
      uniqueElements: uniqueLabels.size,
      focusOnBodyCount: sequence.length - stops.length,
      cycleClosed,
      withoutVisibleIndicator,
      notMeasured,
      sequence: labels
    });

    expect
      .soft(
        cycleClosed,
        'focus goes through all elements and comes back (no trap)'
      )
      .toBe(true);
    expect
      .soft(
        withoutVisibleIndicator,
        'elements without a visible focus indicator'
      )
      .toEqual([]);
  });

  test('CE-07 Build a phrase with "yes" and "food" using the keyboard only', async ({
    page
  }) => {
    await openBoard(page);
    let keyPresses = 0;

    const focusOn = async (label, exact = false) => {
      for (let i = 0; i < 80; i++) {
        const name = await page.evaluate(() => {
          const el = document.activeElement;
          return el
            ? (el.getAttribute('aria-label') || el.innerText || '').trim()
            : '';
        });
        if (exact ? name === label : name.startsWith(label)) {
          return true;
        }
        await page.keyboard.press('Tab');
        keyPresses++;
      }
      return false;
    };

    const reachedYes = await focusOn('yes', true);
    await page.keyboard.press('Enter');
    keyPresses++;
    const clearVisible = await page
      .getByRole('button', { name: 'Clear' })
      .isVisible();

    const reachedFood = await focusOn('food');
    await page.keyboard.press('Enter');
    keyPresses++;
    await page.waitForTimeout(800);
    const folderOpened = await page
      .getByRole('button', { name: 'Go back' })
      .isEnabled();

    evidence.saveJson('CE-07', {
      reachedYes,
      clearVisibleAfterYes: clearVisible,
      reachedFood,
      folderOpened,
      totalKeyPresses: keyPresses
    });

    expect.soft(reachedYes, 'reached "yes" with Tab only').toBe(true);
    expect
      .soft(clearVisible, '"yes" was added to the communication bar')
      .toBe(true);
    expect.soft(reachedFood, 'reached "food" with Tab only').toBe(true);
    expect.soft(folderOpened, 'the "food" folder opened with Enter').toBe(true);
  });

  test('CE-08 "Create tile" screen - axe WCAG 2.2 A/AA', async ({ page }) => {
    await openCreateTile(page);
    await runAxe(page, 'CE-08');
  });
});
