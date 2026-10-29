import type { ISODateTime, LanguageCode, ReviewRating } from "./common.js";
import type { SourceLocator } from "./notetypes.js";

export interface CreateLearningPlanInput {
  title: string;
  language: LanguageCode;
  description?: string;
}

export interface LearningPlanDto {
  id: string;
  title: string;
  language: LanguageCode;
  status: "active" | "archived";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PublishImportInput {
  planId: string;
  draftId: string;
  expectedDraftRevision: number;
}

export interface PublishImportResult {
  sourceDocumentId: string;
  sourceRevision: number;
  noteIds: string[];
  cardIds: string[];
}

export interface ReviewCardInput {
  cardId: string;
  rating: ReviewRating;
  durationMs?: number;
}

export interface CardSchedulingDto {
  cardId: string;
  state: "new" | "learning" | "review" | "relearning";
  dueAt: ISODateTime;
  stability: number;
  difficulty: number;
  schedulerVersion: string;
}

export interface ReviewCardResult {
  reviewLogId: string;
  scheduling: CardSchedulingDto;
}

export interface DueCardDto {
  cardId: string;
  noteTypeId: string;
  front: string;
  back: string;
  scheduling: {
    state: CardSchedulingDto["state"];
    dueAt: ISODateTime;
  } | null;
}

export interface SearchDocumentInput {
  documentId: string;
  ownerId: string;
  planId: string;
  language: LanguageCode;
  kind: "source_block" | "note" | "example";
  sourceId: string;
  sourceRevision: number;
  title: string | null;
  originalText: string;
  normalizedText: string;
  readingText: string | null;
  translationText: string | null;
}

export interface SearchInput {
  planId: string;
  query: string;
  language?: LanguageCode;
  kinds?: Array<"source_block" | "note" | "example">;
  limit?: number;
}

export interface SearchResultItem {
  documentId: string;
  kind: "source_block" | "note" | "example";
  title: string | null;
  snippet: string;
  score: number;
  source: {
    sourceId: string;
    sourceRevision: number;
    locator?: SourceLocator;
  };
}

export interface LearningPlanStatsDto {
  totalCards: number;
  dueCards: number;
  newCards: number;
  reviewedToday: number;
  totalReviews: number;
  successRate: number | null;
  streakDays: number;
  lastReviewedAt: ISODateTime | null;
  daily: Array<{
    date: string;
    reviews: number;
    successful: number;
  }>;
}

export interface SourceDocumentSummaryDto {
  id: string;
  title: string;
  language: LanguageCode;
  currentRevision: number;
  blockCount: number;
  noteCount: number;
  cardCount: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
