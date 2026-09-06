import en from "./locales/en.json";
import {
  FALLBACK_LANGUAGE,
  isSupportedLanguage,
  type LanguageCode,
} from "./languages";

type CatalogueNode = string | { [key: string]: CatalogueNode };
export type Catalogue = { [key: string]: CatalogueNode };

/**
 * Catalogues are bundled, not fetched: the app must be able to render its own
 * UI offline and on first launch, before any storage read has resolved.
 */
const CATALOGUES: Record<LanguageCode, Catalogue> = {
  en: en as Catalogue,
};

/**
 * The active language lives in a module singleton rather than only in React
 * state because the sentence-building helpers in `utils/` and the notification
 * scheduler are plain modules that cannot call a hook. `LocaleProvider` keeps
 * this in step with its own state and re-renders the tree on change, so the
 * two never disagree during a render.
 */
let activeLanguage: LanguageCode = FALLBACK_LANGUAGE;

export const getActiveLanguage = (): LanguageCode => activeLanguage;

export const setActiveLanguage = (next: unknown): LanguageCode => {
  activeLanguage = isSupportedLanguage(next) ? next : FALLBACK_LANGUAGE;
  return activeLanguage;
};

export type TranslateValues = Record<string, string | number | undefined> & {
  count?: number;
};

const lookup = (catalogue: Catalogue, key: string): string | null => {
  let node: CatalogueNode | undefined = catalogue;
  for (const segment of key.split(".")) {
    if (typeof node !== "object" || node === null) {
      return null;
    }
    node = node[segment];
  }
  return typeof node === "string" ? node : null;
};

/**
 * English needs only one/other, but resolving through `Intl.PluralRules` means
 * a language with few/many categories works as soon as its catalogue supplies
 * the extra forms, with no change here.
 */
const pluralCategory = (count: number): string => {
  try {
    return new Intl.PluralRules(activeLanguage).select(count);
  } catch {
    return count === 1 ? "one" : "other";
  }
};

const interpolate = (template: string, values?: TranslateValues): string => {
  if (!values) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
};

/**
 * Resolve `key` in the active language, falling back to English and then to the
 * key itself, so a missing translation degrades to readable text rather than a
 * blank label. Pass `count` to select a plural form (`key_one`, `key_other`).
 */
export const t = (key: string, values?: TranslateValues): string => {
  const active = CATALOGUES[activeLanguage] ?? CATALOGUES[FALLBACK_LANGUAGE];
  const fallback = CATALOGUES[FALLBACK_LANGUAGE];
  const keys =
    typeof values?.count === "number"
      ? [`${key}_${pluralCategory(values.count)}`, `${key}_other`, key]
      : [key];

  for (const candidate of keys) {
    const hit = lookup(active, candidate) ?? lookup(fallback, candidate);
    if (hit !== null) {
      return interpolate(hit, values);
    }
  }

  return key;
};
