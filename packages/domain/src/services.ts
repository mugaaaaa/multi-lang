import type {
  CreateLearningPlanInput,
  DueCardDto,
  LearningPlanDto,
  LearningPlanStatsDto,
  ReviewCardInput,
  ReviewCardResult,
  SearchInput,
  SearchResultItem,
} from "@multi-lang/contracts";

export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const planNotFound = (planId: string) =>
  new DomainError("plan_not_found", `学习计划不存在: ${planId}`);

export const draftNotFound = (draftId: string) =>
  new DomainError("draft_not_found", `导入草稿不存在: ${draftId}`);

export const draftRevisionConflict = () =>
  new DomainError("draft_revision_conflict", "草稿已被修改,请刷新后重试");

export const cardNotFound = (cardId: string) =>
  new DomainError("card_not_found", `卡片不存在: ${cardId}`);

export interface LearningPlanService {
  create(
    ownerId: string,
    input: CreateLearningPlanInput,
  ): Promise<LearningPlanDto>;
  get(ownerId: string, planId: string): Promise<LearningPlanDto>;
  list(ownerId: string): Promise<LearningPlanDto[]>;
  getStats(ownerId: string, planId: string): Promise<LearningPlanStatsDto>;
  archive(ownerId: string, planId: string): Promise<void>;
}

export interface ReviewService {
  review(ownerId: string, input: ReviewCardInput): Promise<ReviewCardResult>;
  listDueCards(
    ownerId: string,
    planId: string,
    limit: number,
  ): Promise<DueCardDto[]>;
}

export interface SearchService {
  search(ownerId: string, input: SearchInput): Promise<SearchResultItem[]>;
}
