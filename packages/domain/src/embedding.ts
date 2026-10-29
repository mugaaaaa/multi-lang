import type { ISODateTime } from "@multi-lang/contracts";

export interface EmbeddingJob {
  id: string;
  documentId: string;
  sourceRevision: number;
  text: string;
  model: string;
}

export interface EmbeddingResult {
  vector: number[];
  model: string;
  modelVersion: string;
}
