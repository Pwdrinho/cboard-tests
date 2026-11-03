/**
 * Utilitário de formatação de sentenças para a barra de comunicação (TTS)
 */

const PUNCTUATION_REGEX = /\s+([.,!?;:])/g;

/**
 * Extrai o texto a ser falado de um cartão/símbolo, priorizando vocalization sobre label.
 * Ignora cartões internos de sistema como o cursor 'live'.
 */
const extractTileText = (tile) => {
  if (!tile || tile.type === 'live') {
    return '';
  }
  const text = tile.vocalization || tile.label || '';
  return typeof text === 'string' ? text.trim() : '';
};

/**
 * Remove espaços indevidos que precedem pontuações clássicas.
 */
const normalizePunctuation = (text) =>
  text.replace(PUNCTUATION_REGEX, '$1').trim();

/**
 * Capitaliza o primeiro caractere da sentença.
 */
const capitalize = (text) => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Converte a sequência de cartões selecionados na barra de comunicação
 * em uma sentença de texto fluida, pontuada e formatada para o TTS.
 *
 * @param {Array<Object>} tiles - Array de cartões acumulados no output
 * @returns {string} Sentença pronta para vocalização e exibição
 */
export const formatSentence = (tiles) => {
  if (!Array.isArray(tiles) || tiles.length === 0) {
    return '';
  }

  const rawTokens = tiles
    .map(extractTileText)
    .filter((token) => token.length > 0);

  if (rawTokens.length === 0) {
    return '';
  }

  const sentence = normalizePunctuation(rawTokens.join(' '));
  return capitalize(sentence);
};
