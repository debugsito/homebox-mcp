/**
 * Removes common Spanish articles and possessives from search queries.
 * This helps the LLM normalize queries before searching.
 */
const ARTICLES_AND_PRONOUNS = [
  'el', 'la', 'los', 'las',
  'un', 'una', 'unos', 'unas',
  'mi', 'mis', 'tu', 'tus',
  'su', 'sus', 'nuestro', 'nuestra', 'nuestros', 'nuestras',
];

const REGEX = new RegExp(`^(${ARTICLES_AND_PRONOUNS.join('|')})\\s+`, 'gi');

/**
 * Normalize a search query by removing leading articles/pronouns.
 * 
 * Examples:
 *   "el hdmi"        => "hdmi"
 *   "mis llaves"     => "llaves"
 *   "mi rtx 3060"    => "rtx 3060"
 *   "la laptop hp"   => "laptop hp"
 */
export function normalizeSearchQuery(query: string): string {
  return query.replace(REGEX, '').trim();
}
