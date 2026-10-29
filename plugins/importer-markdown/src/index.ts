import { randomUUID } from "node:crypto";
import type {
  ContentBlock,
  ImportDraft,
  LanguageCode,
  ParagraphBlock,
  HeadingBlock,
} from "@multi-lang/contracts";
import type { ImportSource, MaterialImporter, PluginManifest } from "@multi-lang/plugin-sdk";

const manifest: PluginManifest & { kind: "importer" } = {
  id: "multi-lang.importer.markdown",
  version: "0.1.0",
  apiVersion: 1,
  kind: "importer",
};

export class MarkdownImporter implements MaterialImporter {
  readonly manifest = manifest;

  canHandle(source: ImportSource): boolean {
    return (
      source.mediaType === "text/markdown" ||
      source.filename.toLowerCase().endsWith(".md") ||
      source.filename.toLowerCase().endsWith(".markdown")
    );
  }

  async parse(
    ownerId: string,
    language: LanguageCode,
    source: ImportSource,
  ): Promise<ImportDraft> {
    const lines = source.content.split(/\r?\n/);
    const blocks: ContentBlock[] = [];
    const notes: ImportDraft["notes"] = [];

    let currentParagraph: string[] = [];

    const flushParagraph = () => {
      if (currentParagraph.length === 0) return;
      const text = currentParagraph.join("\n").trim();
      if (text.length > 0) {
        const block: ParagraphBlock = {
          id: randomUUID(),
          type: "paragraph",
          children: [{ type: "text", text }],
        };
        blocks.push(block);
      }
      currentParagraph = [];
    };

    for (const rawLine of lines) {
      const headingMatch = /^(#{1,3})\s+(.*)$/.exec(rawLine);
      if (headingMatch) {
        flushParagraph();
        const level = headingMatch[1]!.length as 1 | 2 | 3;
        const block: HeadingBlock = {
          id: randomUUID(),
          type: "heading",
          level,
          children: [{ type: "text", text: headingMatch[2]!.trim() }],
        };
        blocks.push(block);
        continue;
      }

      // | front | back | 形式的行为笔记行
      const tableMatch = /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/.exec(rawLine);
      if (tableMatch && !/^\|[\s:-]+\|$/.test(rawLine.trim())) {
        flushParagraph();
        notes.push({
          noteTypeId: `multi-lang.note-type.basic.${language}`,
          fields: {
            front: tableMatch[1]!,
            back: tableMatch[2]!,
          },
          locator: blocks.length > 0
            ? { blockId: blocks[blocks.length - 1]!.id }
            : undefined,
        });
        continue;
      }

      if (rawLine.trim().length === 0) {
        flushParagraph();
        continue;
      }
      currentParagraph.push(rawLine);
    }
    flushParagraph();

    const title = blocks.find((b) => b.type === "heading");
    return {
      id: randomUUID(),
      ownerId,
      language,
      title:
        title && title.type === "heading"
          ? plainText(title.children)
          : source.filename.replace(/\.(md|markdown)$/i, ""),
      blocks,
      notes,
      warnings:
        notes.length === 0
          ? [
              {
                code: "no_notes",
                message: "未识别到 |front|back| 笔记行,发布后不会生成卡片",
              },
            ]
          : [],
    };
  }
}

function plainText(nodes: Array<{ type: string; text?: string }>): string {
  return nodes
    .map((n) => (n.type === "text" ? n.text ?? "" : ""))
    .join("");
}

export const markdownImporter = new MarkdownImporter();
