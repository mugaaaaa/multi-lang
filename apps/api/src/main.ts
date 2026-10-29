import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createApp } from "./http/app.js";
import { createStorage } from "@multi-lang/storage";
import {
  DefaultImportService,
  DefaultLearningPlanService,
  DefaultReviewService,
  DefaultSearchService,
} from "@multi-lang/domain";
import { DefaultPluginRegistry } from "@multi-lang/plugin-sdk/registry";
import { englishLanguagePack } from "@multi-lang/language-en/server";
import { japaneseLanguagePack } from "@multi-lang/language-ja/server";
import { markdownImporter } from "@multi-lang/importer-markdown";
import { fsrsScheduler } from "@multi-lang/scheduler-fsrs";
import { serve } from "@hono/node-server";
import { randomUUID } from "node:crypto";

async function main() {
  // .env 位于仓库根目录
  config({ path: join(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

  // 组合入口:装配具体存储与默认插件
  const registry = new DefaultPluginRegistry();
  registry.registerLanguagePack(englishLanguagePack);
  registry.registerLanguagePack(japaneseLanguagePack);
  registry.registerImporter(markdownImporter);
  registry.registerScheduler(fsrsScheduler);

  const storage = await createStorage();

  const plans = new DefaultLearningPlanService(
    storage,
    {
      findById: (ownerId, planId) =>
        storage.unitOfWork.execute((repos) =>
          repos.plans.findById(ownerId, planId),
        ),
      listActiveByOwner: (ownerId) =>
        storage.unitOfWork.execute((repos) =>
          repos.plans.listActiveByOwner(ownerId),
        ),
      getStats: (ownerId, planId) =>
        storage.unitOfWork.execute((repos) =>
          repos.plans.getStats(ownerId, planId),
        ),
      insert: (plan) =>
        storage.unitOfWork.execute((repos) => repos.plans.insert(plan)),
      archive: (ownerId, planId, updatedAt) =>
        storage.unitOfWork.execute((repos) =>
          repos.plans.archive(ownerId, planId, updatedAt),
        ),
    },
    (language) => registry.getLanguagePack(language),
  );
  const imports = new DefaultImportService(
    storage,
    {
      saveDraft: (draft) =>
        storage.unitOfWork.execute((repos) => repos.content.saveDraft(draft)),
      getDraft: (ownerId, draftId) =>
        storage.unitOfWork.execute((repos) =>
          repos.content.getDraft(ownerId, draftId),
        ),
      listSourceDocuments: (ownerId, planId) =>
        storage.unitOfWork.execute((repos) =>
          repos.content.listSourceDocuments(ownerId, planId),
        ),
      publishDraft: (input) =>
        storage.unitOfWork.execute((repos) =>
          repos.content.publishDraft(input),
        ),
    },
    (language) => registry.getLanguagePack(language),
    markdownImporter,
  );
  const reviews = new DefaultReviewService(
    storage,
    registry.getScheduler(),
    storage.listDueCards,
  );
  const search = new DefaultSearchService(
    storage,
    storage.search,
    (language) => registry.getLanguagePack(language),
  );

  const ownerId = process.env.DEV_OWNER_ID ?? "dev-user";

  const app = createApp(
    {
      plans,
      imports,
      reviews,
      search,
      languages: { list: () => registry.listLanguages() },
      health: () => storage.checkHealth(),
    },
    () => ownerId,
  );

  const port = Number(process.env.PORT ?? 8787);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  });
}

main().catch((err) => {
  console.error("failed to start API:", err);
  process.exit(1);
});
