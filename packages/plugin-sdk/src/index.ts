import type { LanguageCode, LanguageDescriptor } from "@multi-lang/contracts";
import type {
  ContentDocument,
  ImportDraft,
  NoteTypeDefinition,
} from "@multi-lang/contracts";

export interface PluginManifest {
  id: string;
  version: string;
  apiVersion: 1;
  kind: "language" | "importer" | "scheduler";
}

export interface LanguageSearchConfig {
  fullTextParser: "space" | "ngram";
  ngramTokenSize?: number;
}

export interface LanguagePack {
  manifest: PluginManifest & { kind: "language" };
  language: LanguageCode;
  displayName: string;
  noteTypes: NoteTypeDefinition[];
  searchConfig: LanguageSearchConfig;
  normalizeText(
    text: string,
    field: "original" | "reading" | "translation",
  ): string;
}

export interface ImportSource {
  filename: string;
  mediaType: string;
  content: string;
}

export interface MaterialImporter {
  manifest: PluginManifest & { kind: "importer" };
  canHandle(source: ImportSource): boolean;
  parse(
    ownerId: string,
    language: LanguageCode,
    source: ImportSource,
  ): Promise<ImportDraft>;
}

export interface ReviewScheduler {
  readonly manifest: PluginManifest & { kind: "scheduler" };
  readonly version: string;
  schedule(
    current: import("@multi-lang/contracts").CardSchedulingDto | null,
    rating: import("@multi-lang/contracts").ReviewRating,
    reviewedAt: import("@multi-lang/contracts").ISODateTime,
  ): import("@multi-lang/contracts").CardSchedulingDto;
}

export interface PluginRegistration {
  dispose(): void;
}

export interface PluginRegistry {
  registerLanguagePack(pack: LanguagePack): PluginRegistration;
  registerImporter(importer: MaterialImporter): PluginRegistration;
  registerScheduler(scheduler: ReviewScheduler): PluginRegistration;
  getLanguagePack(language: LanguageCode): LanguagePack;
  listLanguages(): LanguageDescriptor[];
  getScheduler(): ReviewScheduler;
  listImporters(): MaterialImporter[];
}
