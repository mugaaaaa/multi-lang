import type { ReviewCardInput, ReviewCardResult } from "@multi-lang/contracts";
import type { ReviewScheduler } from "@multi-lang/plugin-sdk";
import type { DueCardView, ReviewRepository, Storage } from "./storage.js";
import type { ReviewService } from "./services.js";

export class DefaultReviewService implements ReviewService {
  constructor(
    private readonly storage: Storage,
    private readonly scheduler: ReviewScheduler,
    private readonly listDueCardsQuery: (
      ownerId: string,
      planId: string,
      limit: number,
    ) => Promise<DueCardView[]>,
  ) {}

  async review(ownerId: string, input: ReviewCardInput): Promise<ReviewCardResult> {
    return this.storage.unitOfWork.execute(async (repos) => {
      const current = await repos.reviews.getSchedulingForUpdate(
        ownerId,
        input.cardId,
      );
      const next = this.scheduler.schedule(
        current,
        input.rating,
        new Date().toISOString(),
      );
      return repos.reviews.appendReviewAndUpdateScheduling(
        ownerId,
        input,
        next,
      );
    });
  }

  listDueCards(ownerId: string, planId: string, limit: number) {
    return this.listDueCardsQuery(ownerId, planId, limit);
  }
}
