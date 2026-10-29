import type {
  CardSchedulingDto,
  DueCardDto,
  ImportDraft,
  LearningPlanDto,
  LearningPlanStatsDto,
  PublishImportInput,
  PublishImportResult,
  ReviewCardInput,
  ReviewCardResult,
  SearchInput,
  SearchResultItem,
  SearchDocumentInput,
  SourceDocumentSummaryDto,
} from "@multi-lang/contracts";
import type { EmbeddingJob, EmbeddingResult } from "./embedding.js";

export interface LearningPlanRepository {
  findById(
    ownerId: string,
    planId: string,
  ): Promise<LearningPlanDto | null>;
  listActiveByOwner(ownerId: string): Promise<LearningPlanDto[]>;
  getStats(ownerId: string, planId: string): Promise<LearningPlanStatsDto>;
  insert(plan: LearningPlanDto & { ownerId: string }): Promise<void>;
  archive(
    ownerId: string,
    planId: string,
    updatedAt: string,
  ): Promise<void>;
}

export type TextNormalizer = (
  text: string,
  field: "original" | "reading" | "translation",
) => string;

export interface ContentRepository {
  saveDraft(draft: ImportDraft): Promise<{ revision: number }>;
  getDraft(
    ownerId: string,
    draftId: string,
  ): Promise<(ImportDraft & { revision: number }) | null>;
  listSourceDocuments(
    ownerId: string,
    planId: string,
  ): Promise<SourceDocumentSummaryDto[]>;
  publishDraft(
    input: PublishImportInput & {
      ownerId: string;
      normalizeText: TextNormalizer;
    },
  ): Promise<PublishImportResult>;
}

export interface ReviewRepository {
  getSchedulingForUpdate(
    ownerId: string,
    cardId: string,
  ): Promise<CardSchedulingDto | null>;
  appendReviewAndUpdateScheduling(
    ownerId: string,
    input: ReviewCardInput,
    next: CardSchedulingDto,
  ): Promise<ReviewCardResult>;
}

export interface SearchRepository {
  upsertDocuments(documents: SearchDocumentInput[]): Promise<void>;
  removeDocuments(documentIds: string[]): Promise<void>;
  search(
    ownerId: string,
    input: SearchInput & { fullTextParser: "space" | "ngram" },
  ): Promise<SearchResultItem[]>;
}

export interface EmbeddingJobRepository {
  claimNext(workerId: string): Promise<EmbeddingJob | null>;
  markReady(jobId: string, result: EmbeddingResult): Promise<void>;
  markFailed(
    jobId: string,
    errorCode: string,
    retryAt: string,
  ): Promise<void>;
}

export type DueCardView = DueCardDto;

export interface Repositories {
  plans: LearningPlanRepository;
  content: ContentRepository;
  reviews: ReviewRepository;
  search: SearchRepository;
  embeddingJobs: EmbeddingJobRepository;
}

export interface UnitOfWork {
  execute<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}

export interface Storage {
  unitOfWork: UnitOfWork;
  search: SearchRepository;
  embeddingJobs: EmbeddingJobRepository;
  checkHealth(): Promise<{ status: "ok" | "unavailable" }>;
  close(): Promise<void>;
}
