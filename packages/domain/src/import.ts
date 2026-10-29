import type {
  ImportDraft,
  LanguageCode,
  PublishImportInput,
  PublishImportResult,
  SourceDocumentSummaryDto,
} from "@multi-lang/contracts";
import type { LanguagePack, MaterialImporter } from "@multi-lang/plugin-sdk";
import type { ContentRepository, Storage } from "./storage.js";
import {
  DomainError,
  draftNotFound,
  draftRevisionConflict,
  planNotFound,
} from "./services.js";

export interface ImportService {
  createMarkdownDraft(
    ownerId: string,
    planId: string,
    language: LanguageCode,
    filename: string,
    content: string,
  ): Promise<ImportDraft & { revision: number }>;
  getDraft(
    ownerId: string,
    draftId: string,
  ): Promise<(ImportDraft & { revision: number }) | null>;
  listSourceDocuments(
    ownerId: string,
    planId: string,
  ): Promise<SourceDocumentSummaryDto[]>;
  publish(
    ownerId: string,
    input: PublishImportInput,
  ): Promise<PublishImportResult>;
}

export class DefaultImportService implements ImportService {
  constructor(
    private readonly storage: Storage,
    private readonly content: ContentRepository,
    private readonly languagePack: (language: LanguageCode) => LanguagePack,
    private readonly markdownImporter: MaterialImporter,
  ) {}

  async createMarkdownDraft(
    ownerId: string,
    planId: string,
    language: LanguageCode,
    filename: string,
    content: string,
  ): Promise<ImportDraft & { revision: number }> {
    const plan = await this.storage.unitOfWork.execute((repos) =>
      repos.plans.findById(ownerId, planId),
    );
    if (!plan) throw planNotFound(planId);
    if (plan.language !== language) throw planLanguageMismatch();
    const pack = this.languagePack(language);
    const draft = await this.markdownImporter.parse(ownerId, language, {
      filename,
      mediaType: "text/markdown",
      content,
    });
    validateNoteTypes(pack, draft);
    const saved = await this.content.saveDraft(draft);
    return { ...draft, ...saved };
  }

  async getDraft(
    ownerId: string,
    draftId: string,
  ): Promise<(ImportDraft & { revision: number }) | null> {
    return this.content.getDraft(ownerId, draftId);
  }

  listSourceDocuments(ownerId: string, planId: string) {
    return this.content.listSourceDocuments(ownerId, planId);
  }

  async publish(
    ownerId: string,
    input: PublishImportInput,
  ): Promise<PublishImportResult> {
    const draft = await this.content.getDraft(ownerId, input.draftId);
    if (!draft) throw draftNotFound(input.draftId);
    if (draft.revision !== input.expectedDraftRevision) {
      throw draftRevisionConflict();
    }
    const pack = this.languagePack(draft.language);
    validateNoteTypes(pack, draft);

    // 发布事务:业务表与 SearchDocument 文本同一事务提交
    return this.storage.unitOfWork.execute((repos) =>
      repos.content.publishDraft({
        ...input,
        ownerId,
        normalizeText: pack.normalizeText,
      }),
    );
  }
}

function planLanguageMismatch() {
  return new DomainError("plan_language_mismatch", "教材语言必须与学习计划一致");
}

function validateNoteTypes(pack: LanguagePack, draft: ImportDraft) {
  const noteTypeIds = new Set(pack.noteTypes.map((noteType) => noteType.id));
  for (const note of draft.notes) {
    if (!noteTypeIds.has(note.noteTypeId)) {
      throw new DomainError(
        "note_type_not_registered",
        `笔记类型未在当前语言插件注册: ${note.noteTypeId}`,
      );
    }
  }
}
