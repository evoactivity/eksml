/**
 * Standard HTML void elements that are self-closing and never have children.
 * Used as the default for `selfClosingTags` when `html: true`.
 */
export const HTML_VOID_ELEMENTS = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
];

/**
 * HTML elements whose content is raw text (not parsed as markup).
 * Used as the default for `rawContentTags` when `html: true`.
 */
export const HTML_RAW_CONTENT_TAGS = ['script', 'style'];
