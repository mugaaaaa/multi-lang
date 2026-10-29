export type LanguageCode = string;
export type ISODateTime = string;
export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface LanguageDescriptor {
  language: LanguageCode;
  displayName: string;
}

export type EmbeddingStatus = "pending" | "processing" | "ready" | "failed";

export interface ApiSuccess<T> {
  data: T;
  requestId: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId: string;
}

export interface PageRequest {
  cursor?: string;
  limit?: number;
}

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}
