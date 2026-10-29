import type {
  LanguageCode,
  NoteTypeDefinition,
} from "@multi-lang/contracts";
import type { LanguagePack, PluginManifest } from "@multi-lang/plugin-sdk";

function basicNoteType(language: LanguageCode, name: string): NoteTypeDefinition {
  return {
    id: `multi-lang.note-type.basic.${language}`,
    version: 1,
    language,
    fields: [
      { key: "front", label: "正面", valueType: "text", required: true },
      { key: "back", label: "背面", valueType: "text", required: true },
    ],
    cardTemplates: [
      {
        id: "basic",
        name: `${name} 基础卡`,
        front: {
          version: 1,
          language,
          blocks: [
            {
              id: "front-block",
              type: "paragraph",
              children: [{ type: "field-ref", field: "front" }],
            },
          ],
        },
        back: {
          version: 1,
          language,
          blocks: [
            {
              id: "back-block",
              type: "paragraph",
              children: [{ type: "field-ref", field: "back" }],
            },
          ],
        },
      },
    ],
  };
}

function makeEnglishPack(): LanguagePack {
  const manifest: PluginManifest & { kind: "language" } = {
    id: "multi-lang.language.en",
    version: "0.1.0",
    apiVersion: 1,
    kind: "language",
  };
  return {
    manifest,
    language: "en",
    displayName: "英语",
    noteTypes: [basicNoteType("en", "英语")],
    searchConfig: { fullTextParser: "space" },
    normalizeText: (text) => text.toLowerCase().replace(/\s+/g, " ").trim(),
  };
}

export const englishLanguagePack = makeEnglishPack();
