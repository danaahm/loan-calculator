export type LanguageCode = "en";

export interface LanguageOption {
  code: LanguageCode;
  /** Name of the language in English, for reference in code and docs. */
  label: string;
  /** Name of the language as its own speakers write it, shown in the picker. */
  endonym: string;
}

export const FALLBACK_LANGUAGE: LanguageCode = "en";

/**
 * Every language the app can render. Adding one means adding a catalogue in
 * `locales/`, registering it in `translate.ts`, and adding a row here.
 */
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", endonym: "English" },
];

export const isSupportedLanguage = (value: unknown): value is LanguageCode =>
  typeof value === "string" &&
  SUPPORTED_LANGUAGES.some((language) => language.code === value);

export const languageOption = (code: LanguageCode): LanguageOption =>
  SUPPORTED_LANGUAGES.find((language) => language.code === code) ??
  SUPPORTED_LANGUAGES[0];
