import { formatSentence } from './Communicator.utils';

describe('formatSentence (TDD)', () => {
  describe('Ciclo 1: Junção básica de tokens e defensividade', () => {
    test('TDD01: deve concatenar os rótulos dos cartões com espaços simples', () => {
      const tiles = [{ label: 'Eu' }, { label: 'quero' }, { label: 'água' }];
      expect(formatSentence(tiles)).toBe('Eu quero água');
    });

    test('TDD02: deve retornar string vazia para entradas nulas, indefinidas ou vazias', () => {
      expect(formatSentence(null)).toBe('');
      expect(formatSentence(undefined)).toBe('');
      expect(formatSentence([])).toBe('');
      expect(formatSentence([{ label: '' }, { other: 123 }])).toBe('');
    });

    test('TDD03: deve ignorar itens nulos ou sem propriedade label no array', () => {
      const tiles = [
        { label: 'Bom' },
        null,
        { otherProp: '123' },
        { label: 'dia' }
      ];
      expect(formatSentence(tiles)).toBe('Bom dia');
    });
  });

  describe('Ciclo 2: Normalização de pontuação e espaçamento', () => {
    test('TDD04: não deve conter espaço antes do ponto final', () => {
      const tiles = [
        { label: 'Eu' },
        { label: 'quero' },
        { label: 'água' },
        { label: '.' }
      ];
      expect(formatSentence(tiles)).toBe('Eu quero água.');
    });

    test('TDD05: deve ajustar múltiplos sinais de pontuação (vírgula e interrogação)', () => {
      const tiles = [
        { label: 'Olá' },
        { label: ',' },
        { label: 'tudo bem' },
        { label: '?' }
      ];
      expect(formatSentence(tiles)).toBe('Olá, tudo bem?');
    });

    test('TDD06: deve remover espaços em excesso das extremidades', () => {
      const tiles = [{ label: '  Sim  ' }, { label: 'por favor  ' }];
      expect(formatSentence(tiles)).toBe('Sim por favor');
    });
  });

  describe('Ciclo 3: Vocalização personalizada, filtro de tiles especiais e capitalização', () => {
    test('TDD07: deve priorizar a propriedade vocalization sobre o label', () => {
      const tiles = [
        { label: 'vc', vocalization: 'você' },
        { label: 'está' },
        { label: 'bem', vocalization: 'ótimo' },
        { label: '?' }
      ];
      expect(formatSentence(tiles)).toBe('Você está ótimo?');
    });

    test('TDD08: deve ignorar tiles especiais de sistema como type: "live"', () => {
      const tiles = [
        { label: 'Olá' },
        { type: 'live', id: 'cursor_123', label: '' },
        { label: 'amigo' }
      ];
      expect(formatSentence(tiles)).toBe('Olá amigo');
    });

    test('TDD09: deve capitalizar a primeira letra da sentença', () => {
      const tiles = [{ label: 'boa' }, { label: 'noite' }, { label: '.' }];
      expect(formatSentence(tiles)).toBe('Boa noite.');
    });
  });
});
