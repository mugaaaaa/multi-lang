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
      { key: "front", label: "表", valueType: "text", required: true },
      { key: "back", label: "裏", valueType: "text", required: true },
    ],
    cardTemplates: [
      {
        id: "basic",
        name: `${name} 基礎カード`,
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

function makeJapanesePack(): LanguagePack {
  const manifest: PluginManifest & { kind: "language" } = {
    id: "multi-lang.language.ja",
    version: "0.1.0",
    apiVersion: 1,
    kind: "language",
  };
  return {
    manifest,
    language: "ja",
    displayName: "日语",
    noteTypes: [basicNoteType("ja", "日语")],
    searchConfig: { fullTextParser: "ngram", ngramTokenSize: 2 },
    normalizeText: (text) =>
      text.replace(/[\s\u3000]+/g, "").replace(/[\u3001\u3002\uFF01\uFF1F]/g, ""),
  };
}

export const japaneseLanguagePack = makeJapanesePack();
