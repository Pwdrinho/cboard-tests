// Testes não funcionais de acessibilidade (PTOSS-3, Grupo 07 · Cyberbug 2077)
// CT-01: board inicial bloqueado · CT-02: barra de comunicação preenchida
// Ferramenta: axe-core via @axe-core/playwright, etiquetas WCAG 2.0/2.1/2.2 níveis A e AA.
import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createCboard } from '../page-objects/cboard.js';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const OUT_DIR = path.join('evidencias', 'axe');

// Site avaliado e idioma fixos, para o resultado poder ser reproduzido.
test.use({
  baseURL: process.env.A11Y_BASE_URL || 'https://app.cboard.io',
  locale: 'en-US'
});

async function auditar(page, testInfo, id) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  const resumo = {
    cenario: id,
    url: page.url(),
    projeto: testInfo.project.name,
    data: new Date().toISOString(),
    motor: results.testEngine,
    contagem: {
      violacoes: results.violations.length,
      incompletos: results.incomplete.length,
      aprovados: results.passes.length,
      naoAplicaveis: results.inapplicable.length
    },
    violacoes: results.violations.map((v) => ({
      regra: v.id,
      impacto: v.impact,
      criterios: v.tags.filter((t) => /^wcag\d/.test(t)),
      descricao: v.help,
      ocorrencias: v.nodes.length,
      exemplos: v.nodes.slice(0, 5).map((n) => n.target.join(' '))
    })),
    incompletos: results.incomplete.map((v) => ({
      regra: v.id,
      impacto: v.impact,
      descricao: v.help,
      ocorrencias: v.nodes.length
    }))
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const base = path.join(OUT_DIR, `${id}-${testInfo.project.name}`);
  fs.writeFileSync(`${base}-completo.json`, JSON.stringify(results, null, 2));
  fs.writeFileSync(`${base}-resumo.json`, JSON.stringify(resumo, null, 2));
  await testInfo.attach(`${id}-resumo.json`, {
    body: JSON.stringify(resumo, null, 2),
    contentType: 'application/json'
  });
  await page.screenshot({ path: `${base}.png`, fullPage: true });
  return results;
}

const criticas = (r) => r.violations.filter((v) => v.impact === 'critical');

test.describe('Acessibilidade (axe) - testes não funcionais', () => {
  test('CT-01 board inicial bloqueado: zero violações críticas', async ({ page }, testInfo) => {
    const cboard = createCboard(page);
    await cboard.goto(); // /board/root
    await cboard.dismissOverlays();
    const r = await auditar(page, testInfo, 'CT-01');
    expect.soft(criticas(r).map((v) => v.id)).toEqual([]);
  });

  test('CT-02 barra de comunicação com "yes" e "no": zero violações críticas', async ({ page }, testInfo) => {
    const cboard = createCboard(page);
    await cboard.goto();
    await cboard.dismissOverlays();
    await cboard.clickButton('yes');
    await cboard.clickButton('no');
    await expect(cboard.clearButton).toBeVisible();
    const r = await auditar(page, testInfo, 'CT-02');
    expect.soft(criticas(r).map((v) => v.id)).toEqual([]);
  });
});
