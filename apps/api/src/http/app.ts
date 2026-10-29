import { z } from "zod";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

const languageSchema = z
  .string()
  .min(1)
  .max(35)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i);

const createPlanSchema = z.object({
  title: z.string().trim().min(1).max(200),
  language: languageSchema,
  description: z.string().max(2000).optional(),
});

const importMarkdownSchema = z.object({
  planId: z.string().uuid(),
  language: languageSchema,
  filename: z.string().min(1).max(200),
  content: z.string().min(1),
});

const publishSchema = z.object({
  planId: z.string().uuid(),
  expectedDraftRevision: z.number().int().min(1),
});

const reviewSchema = z.object({
  cardId: z.string().uuid(),
  rating: z.enum(["again", "hard", "good", "easy"]),
  durationMs: z.number().int().min(0).optional(),
});

const searchSchema = z.object({
  planId: z.string().uuid(),
  query: z.string().min(1).max(500),
  language: languageSchema.optional(),
  kinds: z
    .array(z.enum(["source_block", "note", "example"]))
    .optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export {
  createPlanSchema,
  importMarkdownSchema,
  publishSchema,
  reviewSchema,
  searchSchema,
};

type Vars = { requestId: string };

export function createApp<
  Services extends {
    plans: {
      create: (
        ownerId: string,
        input: z.infer<typeof createPlanSchema>,
      ) => Promise<unknown>;
      get: (ownerId: string, planId: string) => Promise<unknown>;
      list: (ownerId: string) => Promise<unknown>;
      getStats: (ownerId: string, planId: string) => Promise<unknown>;
      archive: (ownerId: string, planId: string) => Promise<void>;
    };
    imports: {
      createMarkdownDraft: (
        ownerId: string,
        planId: string,
        language: string,
        filename: string,
        content: string,
      ) => Promise<unknown>;
      getDraft: (ownerId: string, draftId: string) => Promise<unknown>;
      listSourceDocuments: (ownerId: string, planId: string) => Promise<unknown>;
      publish: (
        ownerId: string,
        input: {
          planId: string;
          draftId: string;
          expectedDraftRevision: number;
        },
      ) => Promise<unknown>;
    };
    reviews: {
      review: (
        ownerId: string,
        input: z.infer<typeof reviewSchema>,
      ) => Promise<unknown>;
      listDueCards: (
        ownerId: string,
        planId: string,
        limit: number,
      ) => Promise<unknown>;
    };
    search: {
      search: (
        ownerId: string,
        input: z.infer<typeof searchSchema>,
      ) => Promise<unknown>;
    };
    languages: {
      list: () => unknown;
    };
    health: () => Promise<{ status: "ok" | "unavailable" }>;
  },
>(services: Services, getOwnerId: () => string) {
  const app = new Hono<{ Variables: Vars }>();

  app.onError((err, c) => {
    const requestId = c.get("requestId") || randomUUID();
    if (err instanceof Error && "code" in err) {
      const code = (err as Error & { code: string }).code;
      return c.json(
        {
          error: { code, message: err.message },
          requestId,
        },
        statusForCode(code),
      );
    }
    console.error(err);
    return c.json(
      {
        error: { code: "internal_error", message: "服务器内部错误" },
        requestId,
      },
      500,
    );
  });

  app.use("*", async (c, next) => {
    c.set("requestId", randomUUID());
    await next();
  });

  app.get("/v1/health", async (c) => {
    const health = await services.health();
    return c.json(
      { data: health, requestId: randomUUID() },
      health.status === "ok" ? 200 : 503,
    );
  });

  app.get("/v1/languages", async (c) => {
    const languages = await services.languages.list();
    return c.json({ data: languages, requestId: randomUUID() });
  });

  app.post("/v1/plans", zValidator("json", createPlanSchema), async (c) => {
    const plan = await services.plans.create(getOwnerId(), c.req.valid("json"));
    return c.json({ data: plan, requestId: randomUUID() }, 201);
  });

  app.get("/v1/plans", async (c) => {
    const plans = await services.plans.list(getOwnerId());
    return c.json({ data: plans, requestId: randomUUID() });
  });

  app.get("/v1/plans/:planId/stats", async (c) => {
    const stats = await services.plans.getStats(getOwnerId(), c.req.param("planId"));
    return c.json({ data: stats, requestId: randomUUID() });
  });

  app.get("/v1/plans/:planId/source-documents", async (c) => {
    const documents = await services.imports.listSourceDocuments(
      getOwnerId(),
      c.req.param("planId"),
    );
    return c.json({ data: documents, requestId: randomUUID() });
  });

  app.get("/v1/plans/:planId", async (c) => {
    const plan = await services.plans.get(getOwnerId(), c.req.param("planId"));
    return c.json({ data: plan, requestId: randomUUID() });
  });

  app.post("/v1/plans/:planId/archive", async (c) => {
    await services.plans.archive(getOwnerId(), c.req.param("planId"));
    return c.json({ data: null, requestId: randomUUID() });
  });

  app.post(
    "/v1/imports/markdown",
    zValidator("json", importMarkdownSchema),
    async (c) => {
      const body = c.req.valid("json");
      const draft = await services.imports.createMarkdownDraft(
        getOwnerId(),
        body.planId,
        body.language,
        body.filename,
        body.content,
      );
      return c.json({ data: draft, requestId: randomUUID() }, 201);
    },
  );

  app.get("/v1/imports/:draftId", async (c) => {
    const draft = await services.imports.getDraft(
      getOwnerId(),
      c.req.param("draftId"),
    );
    return c.json({ data: draft, requestId: randomUUID() });
  });

  app.post(
    "/v1/imports/:draftId/publish",
    zValidator("json", publishSchema),
    async (c) => {
      const body = c.req.valid("json");
      const result = await services.imports.publish(getOwnerId(), {
        planId: body.planId,
        draftId: c.req.param("draftId"),
        expectedDraftRevision: body.expectedDraftRevision,
      });
      return c.json({ data: result, requestId: randomUUID() }, 201);
    },
  );

  app.post("/v1/reviews", zValidator("json", reviewSchema), async (c) => {
    const result = await services.reviews.review(
      getOwnerId(),
      c.req.valid("json"),
    );
    return c.json({ data: result, requestId: randomUUID() });
  });

  app.get("/v1/plans/:planId/due-cards", async (c) => {
    const limit = Math.min(
      50,
      Math.max(1, Number(c.req.query("limit") ?? 20)),
    );
    const cards = await services.reviews.listDueCards(
      getOwnerId(),
      c.req.param("planId"),
      limit,
    );
    return c.json({ data: cards, requestId: randomUUID() });
  });

  app.post("/v1/search", zValidator("json", searchSchema), async (c) => {
    const results = await services.search.search(
      getOwnerId(),
      c.req.valid("json"),
    );
    return c.json({ data: results, requestId: randomUUID() });
  });

  return app;
}

function statusForCode(code: string): 400 | 404 | 409 | 503 {
  switch (code) {
    case "plan_not_found":
    case "draft_not_found":
    case "card_not_found":
      return 404;
    case "draft_revision_conflict":
      return 409;
    case "storage_unavailable":
      return 503;
    default:
      return 400;
  }
}
