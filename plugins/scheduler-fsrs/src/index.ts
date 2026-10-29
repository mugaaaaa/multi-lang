import type {
  CardSchedulingDto,
  ISODateTime,
  ReviewRating,
} from "@multi-lang/contracts";
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
} from "ts-fsrs";
import type { PluginManifest, ReviewScheduler } from "@multi-lang/plugin-sdk";

const SCHEDULER_VERSION = "fsrs-default-1";

const manifest: PluginManifest & { kind: "scheduler" } = {
  id: "multi-lang.scheduler.fsrs",
  version: "0.1.0",
  apiVersion: 1,
  kind: "scheduler",
};

const ratingMap: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const stateToTsFsrs: Record<CardSchedulingDto["state"], State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

const stateFromTsFsrs: Record<State, CardSchedulingDto["state"]> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

function toCard(current: CardSchedulingDto | null, now: Date): Card {
  if (!current) return createEmptyCard(now);
  const lastReview = new Date(current.dueAt);
  const elapsedMs = now.getTime() - lastReview.getTime();
  return {
    due: lastReview,
    stability: current.stability,
    difficulty: current.difficulty,
    elapsed_days: Math.max(0, Math.floor(elapsedMs / 86400000)),
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: stateToTsFsrs[current.state],
    last_review: current.state === "new" ? undefined : lastReview,
  };
}

export class FsrsScheduler implements ReviewScheduler {
  readonly manifest = manifest;
  readonly version = SCHEDULER_VERSION;
  private readonly fsrs = fsrs(generatorParameters());

  schedule(
    current: CardSchedulingDto | null,
    rating: ReviewRating,
    reviewedAt: ISODateTime,
  ): CardSchedulingDto {
    const now = new Date(reviewedAt);
    const card = toCard(current, now);
    const { card: next } = this.fsrs.next(card, now, ratingMap[rating]);

    return {
      cardId: current?.cardId ?? "",
      state: stateFromTsFsrs[next.state],
      dueAt: next.due.toISOString(),
      stability: next.stability,
      difficulty: next.difficulty,
      schedulerVersion: SCHEDULER_VERSION,
    };
  }
}

export const fsrsScheduler = new FsrsScheduler();
