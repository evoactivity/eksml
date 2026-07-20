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
 *
 * Covers the WHATWG raw text elements (`script`, `style`) and the RCDATA
 * elements (`textarea`, `title`), whose content can never contain child
 * elements.
 */
export const HTML_RAW_CONTENT_TAGS = ['script', 'style', 'textarea', 'title'];
