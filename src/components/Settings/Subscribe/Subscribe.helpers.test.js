import { formatTitle } from './Subscribe.helpers';

describe('formatTitle - projeto funcional inicial', () => {
  test.each([
    ['CP01 texto vazio', '', ''],
    ['CP02 nome sem identificacao', 'Anual', 'Anual'],
    ['CP03 identificacao no fim', 'Anual(Cboard AAC)', 'Anual'],
    ['CP04 identificacao no inicio', '(Cboard AAC)Anual', 'Anual'],
    ['CP05 identificacao no meio', 'Anual(Cboard AAC)Premium', 'AnualPremium'],
    ['CP06 somente identificacao', '(Cboard AAC)', ''],
    ['CP07 identificacao incompleta', '(Cboard AAC', '(Cboard AAC'],
    ['CP08 texto de um caractere', 'A', 'A'],
    ['CP09 capitalizacao diferente', 'Anual(cboard AAC)', 'Anual(cboard AAC)'],
    ['CP10 espacos sem identificacao', ' Anual ', ' Anual ']
  ])('%s', (_scenario, title, expected) => {
    // Arrange: dados de entrada e resultado esperado na tabela.
    // Act
    const result = formatTitle(title);
    // Assert
    expect(result).toBe(expected);
  });
});

describe('formatTitle - complementacao estrutural e caracterizacao', () => {
  test.each([
    ['undefined', undefined],
    ['null', null],
    ['false', false],
    ['zero', 0],
    ['zero negativo', -0],
    ['NaN', NaN]
  ])('CB01 retorna vazio para %s', (_scenario, title) => {
    const result = formatTitle(title);
    expect(result).toBe('');
  });

  test.each([
    ['numero positivo', 42],
    ['true', true],
    ['objeto', {}],
    ['array', []]
  ])(
    'CB02 preserva rejeicao de %s fora do dominio textual',
    (_scenario, title) => {
      const act = () => formatTitle(title);
      expect(act).toThrow(TypeError);
    }
  );
});

describe('formatTitle - melhoria R1 por TDD', () => {
  test('TDD01 remove todas as identificacoes repetidas', () => {
    const title = 'Anual(Cboard AAC)(Cboard AAC)';
    const result = formatTitle(title);
    expect(result).toBe('Anual');
  });
});

describe('formatTitle - melhoria R2 por TDD', () => {
  test('TDD02 apara extremidades quando remove a identificacao', () => {
    const title = '  Anual (Cboard AAC)  ';
    const result = formatTitle(title);
    expect(result).toBe('Anual');
  });
});

describe('formatTitle - verificacao sistematica das melhorias', () => {
  test.each([
    [
      'RF01 identificacoes nas duas extremidades',
      '(Cboard AAC)Anual(Cboard AAC)',
      'Anual'
    ],
    [
      'RF02 preserva espacos internos',
      '  Anual  Premium (Cboard AAC)  ',
      'Anual  Premium'
    ],
    ['RF03 identificacao com espacos sem nome', ' (Cboard AAC) ', ''],
    [
      'RF04 remove tabulacao e quebra nas extremidades',
      '\tAnual(Cboard AAC)\n',
      'Anual'
    ]
  ])('%s', (_scenario, title, expected) => {
    const result = formatTitle(title);
    expect(result).toBe(expected);
  });
});
