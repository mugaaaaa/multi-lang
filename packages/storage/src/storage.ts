import { randomUUID } from "node:crypto";
import type mysql from "mysql2/promise";
import type {
  CardSchedulingDto,
  ImportDraft,
  LearningPlanDto,
  LearningPlanStatsDto,
  PublishImportInput,
  PublishImportResult,
  ReviewCardInput,
  ReviewCardResult,
  SearchDocumentInput,
  SearchInput,
  SearchResultItem,
  SourceDocumentSummaryDto,
} from "@multi-lang/contracts";
import type {
  DueCardView,
  Repositories,
  Storage,
  UnitOfWork,
} from "@multi-lang/domain";
import { cardNotFound, draftNotFound, DomainError } from "@multi-lang/domain";

type Row = Record<string, unknown>;
type Exec = (sql: string, params?: unknown[]) => Promise<Row[]>;

export interface StorageRepositories extends Repositories {
  listDueCards: (
    ownerId: string,
    planId: string,
    limit: number,
  ) => Promise<DueCardView[]>;
}

function parseJsonColumn(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function createRepositories(exec: Exec): StorageRepositories {
  const plans = {
    async findById(ownerId: string, planId: string) {
      const rows = await exec(
        "SELECT id, title, language, status, created_at, updated_at FROM learning_plans WHERE owner_id = ? AND id = ?",
        [ownerId, planId],
      );
      const row = rows[0];
      return row ? toPlanDto(row) : null;
    },
    async listActiveByOwner(ownerId: string) {
      const rows = await exec(
        "SELECT id, title, language, status, created_at, updated_at FROM learning_plans WHERE owner_id = ? AND status = 'active' ORDER BY updated_at DESC",
        [ownerId],
      );
      return rows.map(toPlanDto);
    },
    async getStats(ownerId: string, planId: string) {
      return readPlanStats(exec, ownerId, planId);
    },
    async insert(plan: LearningPlanDto & { ownerId: string }) {
      await exec(
        "INSERT INTO learning_plans (id, owner_id, language, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          plan.id,
          plan.ownerId,
          plan.language,
          plan.title,
          plan.status,
          plan.createdAt,
          plan.updatedAt,
        ],
      );
    },
    async archive(ownerId: string, planId: string, updatedAt: string) {
      await exec(
        "UPDATE learning_plans SET status = 'archived', updated_at = ? WHERE owner_id = ? AND id = ? AND status = 'active'",
        [updatedAt, ownerId, planId],
      );
    },
  };

  const content = {
    async saveDraft(draft: ImportDraft): Promise<{ revision: number }> {
      const now = new Date().toISOString();
      await exec(
        "INSERT INTO import_drafts (id, owner_id, language, title, revision, draft_json, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)",
        [
          draft.id,
          draft.ownerId,
          draft.language,
          draft.title,
          JSON.stringify(draft),
          now,
          now,
        ],
      );
      return { revision: 1 };
    },
    async getDraft(ownerId: string, draftId: string) {
      const rows = await exec(
        "SELECT revision, draft_json FROM import_drafts WHERE owner_id = ? AND id = ?",
        [ownerId, draftId],
      );
      const row = rows[0];
      if (!row) return null;
      return {
        ...(parseJsonColumn(row.draft_json) as ImportDraft),
        revision: Number(row.revision),
      };
    },
    async listSourceDocuments(ownerId: string, planId: string) {
      const rows = await exec(
        `SELECT d.id, d.title, d.language, d.current_revision, d.created_at, d.updated_at,
                (SELECT COUNT(*) FROM source_blocks b WHERE b.document_id = d.id) AS block_count,
                (SELECT COUNT(*) FROM notes n WHERE n.source_document_id = d.id) AS note_count,
                (SELECT COUNT(*) FROM cards c JOIN notes n ON n.id = c.note_id WHERE n.source_document_id = d.id) AS card_count
         FROM source_documents d
         WHERE d.owner_id = ? AND d.plan_id = ?
         ORDER BY d.updated_at DESC
         LIMIT 50`,
        [ownerId, planId],
      );
      return rows.map(
        (row): SourceDocumentSummaryDto => ({
          id: String(row.id),
          title: String(row.title),
          language: String(row.language),
          currentRevision: Number(row.current_revision),
          blockCount: Number(row.block_count),
          noteCount: Number(row.note_count),
          cardCount: Number(row.card_count),
          createdAt: isoString(row.created_at),
          updatedAt: isoString(row.updated_at),
        }),
      );
    },
    async publishDraft(
      input: PublishImportInput & {
        ownerId: string;
        normalizeText: (
          text: string,
          field: "original" | "reading" | "translation",
        ) => string;
      },
    ): Promise<PublishImportResult> {
      const draftRows = await exec(
        "SELECT draft_json, revision FROM import_drafts WHERE owner_id = ? AND id = ? FOR UPDATE",
        [input.ownerId, input.draftId],
      );
      const draftRow = draftRows[0];
      if (!draftRow) throw draftNotFound(input.draftId);
      if (Number(draftRow.revision) !== input.expectedDraftRevision) {
        throw new DomainError(
          "draft_revision_conflict",
          "草稿已被修改,请刷新后重试",
        );
      }
      const draft = parseJsonColumn(draftRow.draft_json) as ImportDraft;

      const planRows = await exec(
        "SELECT id, language FROM learning_plans WHERE owner_id = ? AND id = ? AND status = 'active'",
        [input.ownerId, input.planId],
      );
      if (planRows.length === 0) {
        throw new DomainError(
          "plan_not_found",
          `学习计划不存在: ${input.planId}`,
        );
      }
      if (String(planRows[0]!.language) !== draft.language) {
        throw new DomainError(
          "plan_language_mismatch",
          "教材语言必须与学习计划一致",
        );
      }

      const now = new Date().toISOString();
      const sourceDocumentId = randomUUID();

      await exec(
        "INSERT INTO source_documents (id, owner_id, plan_id, language, title, current_revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
        [
          sourceDocumentId,
          input.ownerId,
          input.planId,
          draft.language,
          draft.title,
          now,
          now,
        ],
      );

      const noteIds: string[] = [];
      const cardIds: string[] = [];
      const searchDocs: SearchDocumentInput[] = [];

      for (let i = 0; i < draft.blocks.length; i++) {
        const block = draft.blocks[i]!;
        const plain = plainTextOfBlock(block);
        await exec(
          "INSERT INTO source_blocks (id, document_id, owner_id, revision, block_order, kind, content_json, plain_text) VALUES (?, ?, ?, 1, ?, ?, ?, ?)",
          [
            block.id,
            sourceDocumentId,
            input.ownerId,
            i,
            block.type === "heading" ? "heading" : "paragraph",
            JSON.stringify(block),
            plain,
          ],
        );
        searchDocs.push({
          documentId: `block:${block.id}`,
          ownerId: input.ownerId,
          planId: input.planId,
          language: draft.language,
          kind: "source_block",
          sourceId: sourceDocumentId,
          sourceRevision: 1,
          title: draft.title,
          originalText: plain,
          normalizedText: input.normalizeText(plain, "original"),
          readingText: null,
          translationText: null,
        });
      }

      for (const noteDraft of draft.notes) {
        const noteId = randomUUID();
        noteIds.push(noteId);
        await exec(
          "INSERT INTO notes (id, owner_id, plan_id, note_type_id, note_type_version, fields_json, source_document_id, source_block_id, created_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)",
          [
            noteId,
            input.ownerId,
            input.planId,
            noteDraft.noteTypeId,
            JSON.stringify(noteDraft.fields),
            sourceDocumentId,
            noteDraft.locator?.blockId ?? null,
            now,
          ],
        );

        const front = String(
          (noteDraft.fields as Record<string, unknown>).front ?? "",
        );
        const back = String(
          (noteDraft.fields as Record<string, unknown>).back ?? "",
        );
        const cardId = randomUUID();
        cardIds.push(cardId);
        await exec(
          "INSERT INTO cards (id, owner_id, note_id, plan_id, template_id, front_text, back_text, created_at) VALUES (?, ?, ?, ?, 'basic', ?, ?, ?)",
          [cardId, input.ownerId, noteId, input.planId, front, back, now],
        );
        await exec(
          "INSERT INTO card_scheduling_states (card_id, owner_id, state, due_at, stability, difficulty, scheduler_version, updated_at) VALUES (?, ?, 'new', ?, 0, 0, '', ?)",
          [cardId, input.ownerId, now, now],
        );

        searchDocs.push({
          documentId: `note:${noteId}`,
          ownerId: input.ownerId,
          planId: input.planId,
          language: draft.language,
          kind: "note",
          sourceId: sourceDocumentId,
          sourceRevision: 1,
          title: front,
          originalText: `${front} ${back}`,
          normalizedText: input.normalizeText(`${front} ${back}`, "original"),
          readingText: null,
          translationText: null,
        });
      }

      for (const doc of searchDocs) {
        await exec(
          "INSERT INTO search_documents (id, owner_id, plan_id, language, kind, source_id, source_revision, title, original_text, normalized_text, reading_text, translation_text, embedding_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?) ON DUPLICATE KEY UPDATE source_revision = VALUES(source_revision), original_text = VALUES(original_text), normalized_text = VALUES(normalized_text), updated_at = VALUES(updated_at)",
          [
            doc.documentId,
            doc.ownerId,
            doc.planId,
            doc.language,
            doc.kind,
            doc.sourceId,
            doc.sourceRevision,
            doc.title,
            doc.originalText,
            doc.normalizedText,
            doc.readingText,
            doc.translationText,
            now,
            now,
          ],
        );
      }

      await exec(
        "UPDATE import_drafts SET published = 1, updated_at = ? WHERE id = ? AND revision = ?",
        [now, input.draftId, input.expectedDraftRevision],
      );

      return { sourceDocumentId, sourceRevision: 1, noteIds, cardIds };
    },
  };

  const reviews = {
    async getSchedulingForUpdate(ownerId: string, cardId: string) {
      const rows = await exec(
        "SELECT card_id, state, due_at, stability, difficulty, scheduler_version FROM card_scheduling_states WHERE owner_id = ? AND card_id = ? FOR UPDATE",
        [ownerId, cardId],
      );
      const row = rows[0];
      if (!row) {
        const cardRows = await exec(
          "SELECT id FROM cards WHERE owner_id = ? AND id = ?",
          [ownerId, cardId],
        );
        if (cardRows.length === 0) throw cardNotFound(cardId);
        return null;
      }
      return toSchedulingDto(row);
    },
    async appendReviewAndUpdateScheduling(
      ownerId: string,
      input: ReviewCardInput,
      next: CardSchedulingDto,
    ): Promise<ReviewCardResult> {
      const rows = await exec(
        "SELECT state, due_at FROM card_scheduling_states WHERE owner_id = ? AND card_id = ? FOR UPDATE",
        [ownerId, input.cardId],
      );
      const prev = rows[0];
      if (!prev) throw cardNotFound(input.cardId);

      const reviewLogId = randomUUID();
      const reviewedAt = new Date().toISOString();
      await exec(
        "INSERT INTO review_logs (id, owner_id, card_id, rating, reviewed_at, duration_ms, prev_state, next_state, prev_due_at, next_due_at, stability, difficulty, scheduler_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          reviewLogId,
          ownerId,
          input.cardId,
          input.rating,
          reviewedAt,
          input.durationMs ?? null,
          String(prev.state),
          next.state,
          prev.due_at ?? null,
          next.dueAt,
          next.stability,
          next.difficulty,
          next.schedulerVersion,
        ],
      );
      await exec(
        "UPDATE card_scheduling_states SET state = ?, due_at = ?, stability = ?, difficulty = ?, scheduler_version = ?, updated_at = ? WHERE owner_id = ? AND card_id = ?",
        [
          next.state,
          next.dueAt,
          next.stability,
          next.difficulty,
          next.schedulerVersion,
          reviewedAt,
          ownerId,
          input.cardId,
        ],
      );
      return { reviewLogId, scheduling: next };
    },
  };

  const search = {
    async upsertDocuments(documents: SearchDocumentInput[]) {
      void documents;
    },
    async removeDocuments(documentIds: string[]) {
      void documentIds;
    },
    async search(
      ownerId: string,
      input: SearchInput & { fullTextParser: "space" | "ngram" },
    ) {
      const kinds =
        input.kinds && input.kinds.length > 0
          ? input.kinds
          : ["source_block", "note", "example"];
      const placeholders = kinds.map(() => "?").join(", ");
      const matchColumn =
        input.fullTextParser === "ngram" ? "normalized_text" : "original_text";
      const sql = `
        SELECT id, kind, title, original_text, source_id, source_revision,
               MATCH(${matchColumn}) AGAINST (? IN NATURAL LANGUAGE MODE) AS score
        FROM search_documents
        WHERE owner_id = ? AND plan_id = ? AND language = ? AND kind IN (${placeholders})
        ORDER BY score DESC
        LIMIT ?`;
      const rows = await exec(sql, [
        input.query,
        ownerId,
        input.planId,
        input.language,
        ...kinds,
        input.limit ?? 20,
      ]);
      return rows
        .filter((r) => Number(r.score) > 0)
        .map((r) => ({
          documentId: String(r.id),
          kind: r.kind as SearchResultItem["kind"],
          title: r.title ? String(r.title) : null,
          snippet: String(r.original_text).slice(0, 200),
          score: Number(r.score),
          source: {
            sourceId: String(r.source_id),
            sourceRevision: Number(r.source_revision),
          },
        }));
    },
  };

  const embeddingJobs = {
    async claimNext() {
      return null;
    },
    async markReady() {},
    async markFailed() {},
  };

  const listDueCards = async (
    ownerId: string,
    planId: string,
    limit: number,
  ): Promise<DueCardView[]> => {
    const rows = await exec(
      `SELECT c.id, c.front_text, c.back_text, n.note_type_id, s.state, s.due_at
       FROM cards c
       JOIN notes n ON n.id = c.note_id AND n.owner_id = c.owner_id
       LEFT JOIN card_scheduling_states s ON s.card_id = c.id AND s.owner_id = c.owner_id
       WHERE c.owner_id = ? AND c.plan_id = ?
         AND (s.due_at IS NULL OR s.due_at <= ?)
       ORDER BY COALESCE(s.due_at, c.created_at) ASC
       LIMIT ?`,
      [ownerId, planId, new Date().toISOString(), limit],
    );
    return rows.map((r) => ({
      cardId: String(r.id),
      noteTypeId: String(r.note_type_id),
      front: String(r.front_text),
      back: String(r.back_text),
      scheduling:
        r.state != null
          ? {
              state: r.state as NonNullable<DueCardView["scheduling"]>["state"],
              dueAt: isoString(r.due_at),
            }
          : null,
    }));
  };

  return { plans, content, reviews, search, embeddingJobs, listDueCards };
}

export class MySqlStorage implements Storage {
  readonly unitOfWork: UnitOfWork;
  readonly search: Repositories["search"];
  readonly embeddingJobs: Repositories["embeddingJobs"];
  readonly listDueCards: StorageRepositories["listDueCards"];

  constructor(private readonly pool: mysql.Pool) {
    const poolExec: Exec = async (sql, params) => {
      const [rows] = await pool.query(sql, params);
      return rows as Row[];
    };
    const poolRepos = createRepositories(poolExec);
    this.search = poolRepos.search;
    this.embeddingJobs = poolRepos.embeddingJobs;
    this.listDueCards = poolRepos.listDueCards;
    this.unitOfWork = {
      execute: async <T>(work: (repos: Repositories) => Promise<T>) => {
        const conn = await pool.getConnection();
        const connExec: Exec = async (sql, params) => {
          const [rows] = await conn.query(sql, params);
          return rows as Row[];
        };
        try {
          await conn.beginTransaction();
          const result = await work(createRepositories(connExec));
          await conn.commit();
          return result;
        } catch (err) {
          await conn.rollback();
          throw err;
        } finally {
          conn.release();
        }
      },
    };
  }

  async checkHealth(): Promise<{ status: "ok" | "unavailable" }> {
    try {
      await this.pool.query("SELECT 1");
      return { status: "ok" };
    } catch {
      return { status: "unavailable" };
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async query(sql: string, params?: unknown[]): Promise<Row[]> {
    const [rows] = await this.pool.query(sql, params);
    return rows as Row[];
  }
}

async function readPlanStats(
  exec: Exec,
  ownerId: string,
  planId: string,
): Promise<LearningPlanStatsDto> {
  const [cardRows, reviewRows, dailyRows, reviewDateRows] = await Promise.all([
    exec(
      `SELECT COUNT(*) AS total_cards,
              COALESCE(SUM(CASE WHEN s.due_at IS NULL OR s.due_at <= UTC_TIMESTAMP(3) THEN 1 ELSE 0 END), 0) AS due_cards,
              COALESCE(SUM(CASE WHEN s.state IS NULL OR s.state = 'new' THEN 1 ELSE 0 END), 0) AS new_cards
       FROM cards c
       LEFT JOIN card_scheduling_states s ON s.card_id = c.id AND s.owner_id = c.owner_id
       WHERE c.owner_id = ? AND c.plan_id = ?`,
      [ownerId, planId],
    ),
    exec(
      `SELECT COUNT(*) AS total_reviews,
              COALESCE(SUM(CASE WHEN r.rating <> 'again' THEN 1 ELSE 0 END), 0) AS successful_reviews,
              COALESCE(SUM(CASE WHEN DATE(r.reviewed_at) = UTC_DATE() THEN 1 ELSE 0 END), 0) AS reviewed_today,
              MAX(r.reviewed_at) AS last_reviewed_at
       FROM review_logs r
       JOIN cards c ON c.id = r.card_id AND c.owner_id = r.owner_id
       WHERE r.owner_id = ? AND c.plan_id = ?`,
      [ownerId, planId],
    ),
    exec(
      `SELECT DATE(r.reviewed_at) AS review_date,
              COUNT(*) AS reviews,
              COALESCE(SUM(CASE WHEN r.rating <> 'again' THEN 1 ELSE 0 END), 0) AS successful
       FROM review_logs r
       JOIN cards c ON c.id = r.card_id AND c.owner_id = r.owner_id
       WHERE r.owner_id = ? AND c.plan_id = ?
         AND r.reviewed_at >= UTC_DATE() - INTERVAL 13 DAY
       GROUP BY DATE(r.reviewed_at)
       ORDER BY review_date ASC`,
      [ownerId, planId],
    ),
    exec(
      `SELECT DISTINCT DATE(r.reviewed_at) AS review_date
       FROM review_logs r
       JOIN cards c ON c.id = r.card_id AND c.owner_id = r.owner_id
       WHERE r.owner_id = ? AND c.plan_id = ?
       ORDER BY review_date DESC
       LIMIT 400`,
      [ownerId, planId],
    ),
  ]);

  const cards = cardRows[0]!;
  const reviews = reviewRows[0]!;
  const totalReviews = Number(reviews.total_reviews);
  const reviewDates = new Set(reviewDateRows.map((row) => isoDate(row.review_date)));
  const cursor = new Date();
  if (!reviewDates.has(isoDate(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streakDays = 0;
  while (reviewDates.has(isoDate(cursor))) {
    streakDays += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return {
    totalCards: Number(cards.total_cards),
    dueCards: Number(cards.due_cards),
    newCards: Number(cards.new_cards),
    reviewedToday: Number(reviews.reviewed_today),
    totalReviews,
    successRate:
      totalReviews > 0
        ? Number(reviews.successful_reviews) / totalReviews
        : null,
    streakDays,
    lastReviewedAt: reviews.last_reviewed_at
      ? isoString(reviews.last_reviewed_at)
      : null,
    daily: dailyRows.map((row) => ({
      date: isoDate(row.review_date),
      reviews: Number(row.reviews),
      successful: Number(row.successful),
    })),
  };
}

function toPlanDto(row: Row): LearningPlanDto {
  return {
    id: String(row.id),
    title: String(row.title),
    language: row.language as LearningPlanDto["language"],
    status: row.status as LearningPlanDto["status"],
    createdAt: isoString(row.created_at),
    updatedAt: isoString(row.updated_at),
  };
}

function toSchedulingDto(row: Row): CardSchedulingDto {
  return {
    cardId: String(row.card_id),
    state: row.state as CardSchedulingDto["state"],
    dueAt: isoString(row.due_at),
    stability: Number(row.stability),
    difficulty: Number(row.difficulty),
    schedulerVersion: String(row.scheduler_version),
  };
}

function isoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function isoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text)
    ? text.slice(0, 10)
    : new Date(text).toISOString().slice(0, 10);
}

function plainTextOfBlock(block: {
  type: string;
  children?: unknown;
}): string {
  const children = (block.children ?? []) as Array<{
    type: string;
    text?: string;
  }>;
  return children
    .map((child) => (child.type === "text" ? child.text ?? "" : ""))
    .join("");
}
