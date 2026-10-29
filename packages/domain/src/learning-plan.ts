import { randomUUID } from "node:crypto";
import type {
  CreateLearningPlanInput,
  LanguageCode,
  LearningPlanDto,
  LearningPlanStatsDto,
} from "@multi-lang/contracts";
import type { LanguagePack } from "@multi-lang/plugin-sdk";
import type { LearningPlanRepository, Storage } from "./storage.js";
import { planNotFound, type LearningPlanService } from "./services.js";

export class DefaultLearningPlanService implements LearningPlanService {
  constructor(
    private readonly storage: Storage,
    private readonly plans: LearningPlanRepository,
    private readonly languagePack: (language: LanguageCode) => LanguagePack,
  ) {}

  async create(
    ownerId: string,
    input: CreateLearningPlanInput,
  ): Promise<LearningPlanDto> {
    this.languagePack(input.language);
    const now = new Date().toISOString();
    const plan: LearningPlanDto & { ownerId: string } = {
      id: randomUUID(),
      ownerId,
      title: input.title,
      language: input.language,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    await this.plans.insert(plan);
    const { ownerId: _ownerId, ...dto } = plan;
    return dto;
  }

  async get(ownerId: string, planId: string): Promise<LearningPlanDto> {
    const plan = await this.plans.findById(ownerId, planId);
    if (!plan) throw planNotFound(planId);
    return plan;
  }

  list(ownerId: string): Promise<LearningPlanDto[]> {
    return this.plans.listActiveByOwner(ownerId);
  }

  async getStats(
    ownerId: string,
    planId: string,
  ): Promise<LearningPlanStatsDto> {
    await this.get(ownerId, planId);
    return this.plans.getStats(ownerId, planId);
  }

  async archive(ownerId: string, planId: string): Promise<void> {
    await this.plans.archive(ownerId, planId, new Date().toISOString());
  }
}
