/* Two languages, one per address: the site root is Italian, /en/ is English. The language is
 * fixed for the life of the page (switching navigates), so module-level constants such as
 * structure names can be translated once, when the module loads. */
import itBiomes from './biome-names.json';
import enBiomes from './biome-names-en.json';

export type Lang = 'it' | 'en';

const path = typeof location === 'undefined' ? '/' : location.pathname;
const EN_SUFFIX = /en\/(index\.html)?$/;

export const LANG: Lang = EN_SUFFIX.test(path) ? 'en' : 'it';

/** The site root (where index.html and /engine live), whatever the hosting sub-path. */
export const ROOT = path.replace(EN_SUFFIX, '').replace(/index\.html$/, '').replace(/[^/]*$/, '');

/** Pick the string for the current language. */
export const tr = (it: string, en: string) => (LANG === 'en' ? en : it);

/** A public asset under the site root (engine, images, licences). */
export const asset = (p: string) => ROOT + p;

/** The same page in the other language, keeping the query string (seed, position…). */
export function otherLanguageUrl() {
  const target = LANG === 'en' ? ROOT : ROOT + 'en/';
  return target + (typeof location === 'undefined' ? '' : location.search);
}

export const BIOME_NAMES: Record<string, string> = LANG === 'en' ? enBiomes : itBiomes;

/** Thousands separator per language, minus sign as a real minus. */
export function fmt(n: number) {
  const sep = LANG === 'en' ? ',' : '.';
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return (n < 0 ? '−' : '') + s;
}
