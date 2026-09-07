import { describe, expect, it } from "vitest";
import { en, LANGUAGES, loadLanguage, type TranslationKey } from "../i18n";

function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();
}

describe("locale audit", () => {
  for (const { id: value } of LANGUAGES) {
    if (value === "en") continue;
    it(`${value}: reports missing keys and validates translated parameters`, async () => {
      const dictionary = await loadLanguage(value);
      const keys = Object.keys(en) as TranslationKey[];
      const missing = keys.filter((key) => dictionary[key] === undefined);
      if (missing.length) console.warn(`${value}: English fallback for ${missing.join(", ")}`);
      for (const [key, translated] of Object.entries(dictionary)) {
        expect(Object.prototype.hasOwnProperty.call(en, key), `${value}: unknown key ${key}`).toBe(
          true,
        );
        expect(placeholders(translated), `${value}: parameters in ${key}`).toEqual(
          placeholders(en[key as TranslationKey]),
        );
      }
    });
  }
});
