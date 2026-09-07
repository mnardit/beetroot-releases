import { describe, it, expect } from "vitest";
import {
  createTranslator,
  en,
  getTranslation,
  loadLanguage,
  type TranslationDictionary,
} from "../i18n";

describe("i18n", () => {
  it("falls back per key when a loaded dictionary is incomplete", () => {
    const partial: TranslationDictionary = { cancel: "Отмена" };
    const t = createTranslator("ru", partial);
    expect(t("cancel")).toBe("Отмена");
    expect(t("settings.title")).toBe(en["settings.title"]);
    expect(getTranslation("settings.title")).toBe(en["settings.title"]);
  });

  it("interpolates English fallback parameters for incomplete translations", () => {
    const t = createTranslator("ru", { cancel: "Отмена" });
    expect(t("footer.selected", { count: 7 })).toBe(
      createTranslator("en")("footer.selected", { count: 7 }),
    );
  });

  it("returns English translations by default", () => {
    const t = createTranslator("en");
    expect(t("settings.title")).toBe("Settings");
    expect(t("cancel")).toBe("Cancel");
  });

  it("returns Russian translations with loaded dict", async () => {
    const dict = await loadLanguage("ru");
    const t = createTranslator("ru", dict);
    expect(t("settings.title")).toBe("Настройки");
    expect(t("cancel")).toBe("Отмена");
  });

  it("falls back to English when no dict provided", () => {
    const t = createTranslator("ru");
    expect(t("settings.title")).toBe("Settings");
  });

  it("interpolates parameters", () => {
    const t = createTranslator("en");
    expect(t("footer.selected", { count: 3 })).toBe("3 selected \u00B7 Ctrl+Click to toggle");
  });

  it("interpolates parameters in Russian", async () => {
    const dict = await loadLanguage("ru");
    const t = createTranslator("ru", dict);
    expect(t("toast.deletedItems", { count: 5 })).toBe("Удалено 5 элементов");
  });

  it("returns key placeholder for missing params", () => {
    const t = createTranslator("en");
    // Missing 'count' param — should leave {count} in output
    expect(t("footer.selected")).toContain("{count}");
  });

  it("loadLanguage returns en dict synchronously", async () => {
    const dict = await loadLanguage("en");
    expect(dict.cancel).toBe("Cancel");
  });

  it("loadLanguage loads non-en languages", async () => {
    const dict = await loadLanguage("de");
    expect(dict.cancel).toBe("Abbrechen");
  });
});
