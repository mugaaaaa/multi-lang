import type { ISODateTime, LanguageCode } from "./common.js";
import type { ContentBlock, ContentDocument } from "./content.js";

export type { ContentDocument };

export type NoteFieldValue = string | string[] | ContentDocument;

export interface NoteFieldDefinition {
  key: string;
  label: string;
  valueType: "text" | "text-list" | "content";
  required: boolean;
}

export interface CardTemplateDefinition {
  id: string;
  name: string;
  front: ContentDocument;
  back: ContentDocument;
}

export interface NoteTypeDefinition {
  id: string;
  version: number;
  language: LanguageCode;
  fields: NoteFieldDefinition[];
  cardTemplates: CardTemplateDefinition[];
}

export interface SourceLocator {
  documentId?: string;
  blockId?: string;
  page?: number;
}

export interface ImportDraftNote {
  noteTypeId: string;
  fields: Record<string, NoteFieldValue>;
  locator?: SourceLocator;
}

export interface ImportDraftWarning {
  code: string;
  message: string;
  locator?: SourceLocator;
}

export interface ImportDraft {
  id: string;
  ownerId: string;
  language: LanguageCode;
  title: string;
  blocks: ContentBlock[];
  notes: ImportDraftNote[];
  warnings: ImportDraftWarning[];
}
