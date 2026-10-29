import type { LanguageCode } from "./common.js";

export interface ContentDocument {
  version: 1;
  language: LanguageCode;
  blocks: ContentBlock[];
}

export type ContentBlock = HeadingBlock | ParagraphBlock;

export interface HeadingBlock {
  id: string;
  type: "heading";
  level: 1 | 2 | 3;
  children: InlineNode[];
}

export interface ParagraphBlock {
  id: string;
  type: "paragraph";
  children: InlineNode[];
}

export type InlineNode =
  | TextNode
  | RubyNode
  | FieldRefNode
  | AnnotationNode
  | LineBreakNode;

export interface TextNode {
  type: "text";
  text: string;
  language?: LanguageCode;
}

export interface RubyNode {
  type: "ruby";
  base: string;
  reading: string;
}

export interface FieldRefNode {
  type: "field-ref";
  field: string;
}

export interface AnnotationNode {
  type: "annotation";
  kind: "translation" | "transliteration" | "note";
  children: InlineNode[];
}

export interface LineBreakNode {
  type: "line-break";
}

export function extractPlainText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return node.text;
        case "ruby":
          return node.base;
        case "annotation":
          return extractPlainText(node.children);
        default:
          return "";
      }
    })
    .join("");
}
