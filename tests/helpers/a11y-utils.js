import fs from 'fs';
import path from 'path';

export const WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa'
];

export const LEVEL_A_TAGS = ['wcag2a', 'wcag21a'];

const UNLOCK_CLICKS = 4;

export function createEvidenceWriter(subdir) {
  const dir = path.join(process.cwd(), 'test-evidence', subdir);
  const ensureDir = () => fs.mkdirSync(dir, { recursive: true });
  return {
    dir,
    saveJson(id, data) {
      ensureDir();
      fs.writeFileSync(
        path.join(dir, `${id}.json`),
        JSON.stringify(data, null, 2)
      );
    },
    saveText(fileName, text) {
      ensureDir();
      fs.writeFileSync(path.join(dir, fileName), text);
    },
    async screenshot(page, name) {
      ensureDir();
      await page.screenshot({ path: path.join(dir, `${name}.png`) });
    },
    async screenshotLastTile(page, name, tileText) {
      ensureDir();
      const tiles = tileText
        ? page.locator('button.Tile', { hasText: tileText })
        : page.locator('button.Tile');
      await tiles
        .last()
        .scrollIntoViewIfNeeded()
        .catch(() => {});
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(dir, `${name}.png`) });
    }
  };
}

export function summarizeAxe(results) {
  const violationsByImpact = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0
  };
  results.violations.forEach((violation) => {
    violationsByImpact[violation.impact] += 1;
  });
  return {
    violationsByImpact,
    violations: results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      level: violation.tags.some((tag) => LEVEL_A_TAGS.includes(tag))
        ? 'A'
        : 'AA',
      help: violation.help,
      nodes: violation.nodes.length,
      example: violation.nodes[0] && violation.nodes[0].html.slice(0, 160)
    })),
    incomplete: results.incomplete.map((item) => ({
      id: item.id,
      nodes: item.nodes.length
    })),
    passes: results.passes.length
  };
}

export async function dismissTour(
  page,
  { timeout = 4000, required = false } = {}
) {
  const closeTour = page.getByText('Close Tour');
  const shown = await closeTour.waitFor({ state: 'visible', timeout }).then(
    () => true,
    () => false
  );
  if (!shown) {
    if (required) {
      throw new Error('The welcome tour did not show up');
    }
    return false;
  }
  await closeTour.click();
  await closeTour.waitFor({ state: 'hidden' });
  return true;
}

export async function openBoard(page, { closeTour = true } = {}) {
  await page.goto('/board/root', { waitUntil: 'networkidle' });
  if (closeTour) {
    await dismissTour(page, { timeout: 15000, required: true });
  } else {
    await page
      .getByText('Close Tour')
      .waitFor({ state: 'visible', timeout: 15000 });
  }
}

export async function unlockBoard(page) {
  const unlock = page.getByRole('button', { name: 'Unlock' }).first();
  for (let i = 0; i < UNLOCK_CLICKS; i++) {
    await unlock.click();
  }
}

export async function enterEditMode(page) {
  await openBoard(page);
  await unlockBoard(page);
  await page.getByRole('button', { name: /continue editing/i }).click();
  await dismissTour(page, { timeout: 15000, required: true });
}

export async function openCreateTile(page, viewport) {
  if (viewport) {
    await page.setViewportSize(viewport);
  }
  await enterEditMode(page);
  await page
    .locator('button:has-text("Add Tile"), [aria-label="Add Tile"]')
    .first()
    .click();
  await page.locator('input#label').waitFor({ state: 'visible' });
  await page.waitForTimeout(600);
}
