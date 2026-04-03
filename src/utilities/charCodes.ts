/**
 * Shared character code constants used across the parser, streaming parser,
 * writer, and converters.
 *
 * Using named constants instead of magic numbers improves readability and
 * catches typos at compile time. The SCREAMING_CASE convention follows the
 * standard practice for numeric constants.
 */

// --- Brackets and delimiters ---
export const LT = 60; // <
export const GT = 62; // >
export const SLASH = 47; // /
export const BANG = 33; // !
export const QUESTION = 63; // ?
export const EQ = 61; // =
export const LBRACKET = 91; // [
export const RBRACKET = 93; // ]

// --- Quotes ---
export const SQUOTE = 39; // '
export const DQUOTE = 34; // "

// --- Whitespace ---
export const TAB = 9;
export const LF = 10;
export const CR = 13;
export const SPACE = 32;

// --- Punctuation ---
export const DASH = 45; // -
export const UNDERSCORE = 95; // _
export const COLON = 58; // :
export const DOLLAR = 36; // $

// --- CDATA signature characters: <![CDATA[ ---
export const UPPER_C = 67;
export const UPPER_D = 68;
export const UPPER_A = 65;
export const UPPER_T = 84;
