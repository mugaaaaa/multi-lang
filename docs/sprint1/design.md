# Sprint 1：多语言学习工作台技术与接口设计

日期：2026-10-29  
状态：第一版设计；前端与语言插件扩展已实施（实施结果见 `docs/sprint1/mvp-plan.md` 第 8 节）
范围：英语、日语；seekdb 单库；Web 优先

## 1. 目标与范围

Sprint 1 的核心闭环：

```text
英语/日语教材导入
→ 人工校订
→ 学习计划、笔记与卡片
→ seekdb 混合检索
→ FSRS 复习
→ 真实进度统计
```

首版不做其他语言、公开插件市场、通用热更新、PowerContext、Electron 或移动端。只保留后续扩展所需的稳定边界。

## 2. 技术决策

| 层 | 决策 |
|---|---|
| 语言与包管理 | TypeScript、Node.js 22+、pnpm workspace |
| Web | React、Vite、Material UI（MUI）、React Router、CSS Modules |
| API | Hono、Zod、zod-openapi |
| 唯一数据库 | seekdb 服务端，通过 `mysql2/promise` 连接 |
| 普通数据访问 | Drizzle ORM（MySQL 方言），先验证与 seekdb 的兼容范围 |
| seekdb 专有 SQL | 手写参数化 SQL，控制全文、向量、混合检索和专有 DDL |
| 数据迁移 | 版本化 SQL 文件与数据库内迁移记录 |
| 复习调度 | ts-fsrs；状态与 RevLog 持久化到 seekdb |
| 内容格式 | 版本化 JSON AST；Markdown 只作为导入格式 |
| 部署 | Qoder Sites Web/Functions，外部 seekdb 与 Embedding Worker |

不引入 PostgreSQL、独立 MySQL、pgvector、跨库 Outbox、Prisma、Next.js 或 Cordis 运行时。

## 3. 单库架构

```text
React Web
   │ HTTPS / OpenAPI
   ▼
Hono API / 模块化单体
   │ mysql2 / MySQL 协议
   ▼
seekdb
├── 用户、计划、教材、笔记、卡片
├── FSRS 状态与 ReviewLog
├── SearchDocument、全文与向量索引
└── Embedding 持久任务状态
   ▲
   │ 读取待处理文档，写回向量
Embedding Worker
```

核心约束：

1. seekdb 是业务事实和检索索引的唯一数据库。
2. Web 不直接访问数据库。
3. 业务文本与 SearchDocument 文本在同一事务中发布。
4. Embedding 可以异步，但任务状态必须持久化。
5. `owner_id` 必须来自服务端认证上下文，不能接受客户端声明的数据范围。
6. SearchDocument 可以从业务表重建，但不需要第二数据库作为恢复来源。

## 4. 目录结构

```text
multi-lang/
├── AGENTS.md
├── CLAUDE.md
├── CONTRIBUTING.md
├── apps/
│   ├── web/src/
│   │   ├── features/
│   │   ├── extensions/
│   │   └── lib/
│   ├── api/src/
│   │   ├── modules/
│   │   └── http/
│   └── worker/src/
├── packages/
│   ├── contracts/src/
│   ├── domain/src/
│   ├── content/src/
│   ├── plugin-sdk/src/
│   └── storage/
│       ├── src/repositories/
│       ├── src/search/
│       └── migrations/
├── plugins/
│   ├── language-en/src/
│   │   ├── server/
│   │   └── web/
│   ├── language-ja/src/
│   │   ├── server/
│   │   └── web/
│   └── importer-markdown/src/
├── infra/
│   ├── seekdb/
│   └── deployment/
├── docs/sprint1/
└── scripts/
```

依赖方向：

```text
apps/* → packages/*
plugins/* → plugin-sdk + content + contracts
storage → domain 定义的端口
api/worker → storage 与 plugins 的组合
web → contracts + content
```

禁止反向依赖。`domain` 不导入 Web、HTTP 或数据库框架；插件不直接写数据库。`plugins/*/server` 不依赖 React 或 MUI，`plugins/*/web` 不依赖 Hono、mysql2 或 storage；两类入口只共享插件 manifest 与纯类型。语言插件没有实际 Web 贡献时不得创建空 `web` 入口。

## 5. 核心数据实体

| 实体 | 关键字段与职责 |
|---|---|
| `LearningPlan` | `id`、`ownerId`、`language`、`title`、状态、时间戳 |
| `SourceDocument` | 教材来源、计划、语言、当前 revision |
| `SourceBlock` | 教材块、顺序、JSON AST、来源定位、revision |
| `NoteType` | 字段定义、卡片模板、语言、版本 |
| `Note` | 知识字段、NoteType 版本、可选 SourceBlock 引用 |
| `Card` | Note 与 CardTemplate 的对应学习单元 |
| `CardSchedulingState` | FSRS 当前状态、到期时间、调度器版本 |
| `ReviewLog` | 只追加的真实评分、时间、前后状态与耗时 |
| `SearchDocument` | 检索文本、过滤字段、来源 revision、向量与任务状态 |

业务主键、所有者、revision 和时间字段必须显式保存。复习进度不经过向量检索。

## 6. 通用契约

以下接口是第一版逻辑契约；实现时可以拆分为对应包内的 TypeScript 文件，但不得改变其职责边界。

```ts
type LanguageCode = string;
type ISODateTime = string;
type ReviewRating = "again" | "hard" | "good" | "easy";

type EmbeddingStatus = "pending" | "processing" | "ready" | "failed";

interface ApiSuccess<T> {
  data: T;
  requestId: string;
}

interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId: string;
}

interface PageRequest {
  cursor?: string;
  limit?: number;
}

interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}
```

规则：

- `LanguageCode` 是开放的稳定标识，不在核心联合类型中枚举语言；首版只注册 `en`、`ja`，请求中的语言代码必须由服务端 PluginRegistry 校验。
- 时间在线路中使用 ISO 8601 字符串，在领域中使用明确的时间类型。
- ID 在 API 中使用字符串，不向客户端暴露数据库自增内部键。
- 错误 `message` 面向用户，不返回 SQL、凭据或内部堆栈。
- 写操作由服务端生成 `requestId`；需要重试的写操作另带幂等键。

## 7. 内容 AST 接口

```ts
interface ContentDocument {
  version: 1;
  language: LanguageCode;
  blocks: ContentBlock[];
}

type ContentBlock = HeadingBlock | ParagraphBlock;

interface HeadingBlock {
  id: string;
  type: "heading";
  level: 1 | 2 | 3;
  children: InlineNode[];
}

interface ParagraphBlock {
  id: string;
  type: "paragraph";
  children: InlineNode[];
}

type InlineNode =
  | TextNode
  | RubyNode
  | FieldRefNode
  | AnnotationNode
  | LineBreakNode;

interface TextNode {
  type: "text";
  text: string;
  language?: LanguageCode;
}

interface RubyNode {
  type: "ruby";
  base: string;
  reading: string;
}

interface FieldRefNode {
  type: "field-ref";
  field: string;
}

interface AnnotationNode {
  type: "annotation";
  kind: "translation" | "transliteration" | "note";
  children: InlineNode[];
}

interface LineBreakNode {
  type: "line-break";
}
```

首版 AST 只服务英语、日语教材、注音、对照和模板字段引用。新增节点必须提升内容格式版本或保持旧解析器可安全拒绝，不能把任意 HTML 注入 AST。

## 8. NoteType 与导入接口

```ts
type NoteFieldValue = string | string[] | ContentDocument;

interface NoteFieldDefinition {
  key: string;
  label: string;
  valueType: "text" | "text-list" | "content";
  required: boolean;
}

interface CardTemplateDefinition {
  id: string;
  name: string;
  front: ContentDocument;
  back: ContentDocument;
}

interface NoteTypeDefinition {
  id: string;
  version: number;
  language: LanguageCode;
  fields: NoteFieldDefinition[];
  cardTemplates: CardTemplateDefinition[];
}

interface SourceLocator {
  documentId?: string;
  blockId?: string;
  page?: number;
}

interface ImportDraft {
  id: string;
  ownerId: string;
  language: LanguageCode;
  title: string;
  blocks: ContentBlock[];
  notes: Array<{
    noteTypeId: string;
    fields: Record<string, NoteFieldValue>;
    locator?: SourceLocator;
  }>;
  warnings: Array<{
    code: string;
    message: string;
    locator?: SourceLocator;
  }>;
}
```

Importer 只能生成草稿。发布由核心服务执行，并在发布前重新校验 NoteType、AST、所有者和来源引用。

## 9. 领域服务接口

```ts
interface CreateLearningPlanInput {
  title: string;
  language: LanguageCode;
  description?: string;
}

interface LearningPlanDto {
  id: string;
  title: string;
  language: LanguageCode;
  status: "active" | "archived";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface LearningPlanService {
  create(ownerId: string, input: CreateLearningPlanInput): Promise<LearningPlanDto>;
  get(ownerId: string, planId: string): Promise<LearningPlanDto>;
  archive(ownerId: string, planId: string): Promise<void>;
}

interface PublishImportInput {
  planId: string;
  draftId: string;
  expectedDraftRevision: number;
}

interface PublishImportResult {
  sourceDocumentId: string;
  sourceRevision: number;
  noteIds: string[];
  cardIds: string[];
}

interface ImportService {
  publish(ownerId: string, input: PublishImportInput): Promise<PublishImportResult>;
}

interface ReviewCardInput {
  cardId: string;
  rating: ReviewRating;
  durationMs?: number;
}

interface CardSchedulingDto {
  cardId: string;
  state: "new" | "learning" | "review" | "relearning";
  dueAt: ISODateTime;
  stability: number;
  difficulty: number;
  schedulerVersion: string;
}

interface ReviewCardResult {
  reviewLogId: string;
  scheduling: CardSchedulingDto;
}

interface ReviewService {
  review(ownerId: string, input: ReviewCardInput): Promise<ReviewCardResult>;
}

interface SearchInput {
  planId: string;
  query: string;
  language?: LanguageCode;
  kinds?: Array<"source_block" | "note" | "example">;
  limit?: number;
}

interface SearchResultItem {
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

interface SearchService {
  search(ownerId: string, input: SearchInput): Promise<SearchResultItem[]>;
}
```

`ReviewService.review` 必须在一个事务内读取并锁定卡片调度状态、调用调度器、追加 ReviewLog 并保存新状态。禁止在路由中拆开这些步骤。

## 10. 存储端口

```ts
interface LearningPlanRepository {
  findById(ownerId: string, planId: string): Promise<LearningPlanDto | null>;
  insert(plan: LearningPlanDto & { ownerId: string }): Promise<void>;
  archive(ownerId: string, planId: string, updatedAt: ISODateTime): Promise<void>;
}

interface ContentRepository {
  getDraftRevision(ownerId: string, draftId: string): Promise<number | null>;
  publishDraft(input: PublishImportInput & { ownerId: string }): Promise<PublishImportResult>;
}

interface ReviewRepository {
  getSchedulingForUpdate(ownerId: string, cardId: string): Promise<CardSchedulingDto | null>;
  appendReviewAndUpdateScheduling(
    ownerId: string,
    input: ReviewCardInput,
    next: CardSchedulingDto,
  ): Promise<ReviewCardResult>;
}

interface SearchRepository {
  upsertDocuments(documents: SearchDocumentInput[]): Promise<void>;
  removeDocuments(documentIds: string[]): Promise<void>;
  search(ownerId: string, input: SearchInput): Promise<SearchResultItem[]>;
}

interface SearchDocumentInput {
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

interface EmbeddingJobRepository {
  claimNext(workerId: string): Promise<EmbeddingJob | null>;
  markReady(jobId: string, result: EmbeddingResult): Promise<void>;
  markFailed(jobId: string, errorCode: string, retryAt: ISODateTime): Promise<void>;
}

interface EmbeddingJob {
  id: string;
  documentId: string;
  sourceRevision: number;
  text: string;
  model: string;
}

interface EmbeddingResult {
  vector: number[];
  model: string;
  modelVersion: string;
}

interface Repositories {
  plans: LearningPlanRepository;
  content: ContentRepository;
  reviews: ReviewRepository;
  search: SearchRepository;
  embeddingJobs: EmbeddingJobRepository;
}

interface UnitOfWork {
  execute<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}

interface Storage {
  unitOfWork: UnitOfWork;
  search: SearchRepository;
  embeddingJobs: EmbeddingJobRepository;
  checkHealth(): Promise<{ status: "ok" | "unavailable" }>;
  close(): Promise<void>;
}
```

具体 SQL、连接池和 Drizzle 对象不得泄露到领域接口。`ContentRepository.publishDraft` 与 `SearchRepository.upsertDocuments` 在同一发布事务中协作；Embedding 只在提交后由 Worker 处理。

## 11. 调度与 Embedding 接口

```ts
interface ReviewScheduler {
  readonly version: string;
  schedule(
    current: CardSchedulingDto | null,
    rating: ReviewRating,
    reviewedAt: ISODateTime,
  ): CardSchedulingDto;
}

interface EmbeddingProvider {
  readonly model: string;
  readonly modelVersion: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}
```

Worker 在写回向量前必须校验：数组长度等于 Provider 维度、每个分量为有限数值、任务 revision 仍与当前文档一致。失败任务持久化错误码和下次重试时间，不伪造向量。

## 12. 插件接口与语言扩展

### 12.1 微内核边界与装配方式

首版插件都是仓库内受信任模块，在构建期可见，并由组合入口在进程启动时注册；不支持远程加载、任意第三方代码或热更新。语言插件可以包含 `server` 与 `web` 两类入口，但不是每个语言插件都必须同时实现两类入口。

- API 组合入口注册语言包、导入器和调度器，再创建领域服务与 HTTP 路由。
- Worker 只装配其实际需要的 server 能力，不引入 React 或 Web 插件入口。
- Web 组合入口注册内置通用页面和实际存在的插件 Web 贡献，再渲染应用壳。
- `server` 入口不得依赖 React/MUI，`web` 入口不得依赖 Hono、mysql2、storage 或 Node 内置模块。
- 插件注册失败、语言代码重复、贡献 ID 重复或路由冲突必须在启动时暴露，不能静默覆盖。

内核保留学习计划、教材与草稿、发布事务、NoteType 校验与持久化、卡片、复习、进度、检索编排、存储、认证和通用学习页面。语言插件只提供语言元数据、语言相关的纯函数与配置、NoteType/卡片模板，以及确有需求的语言专属 Web 页面或动作。

核心代码不得通过 `if language === "ja"`、`switch (language)` 或英语/日语专属组件分支实现语言差异。通用流程通过 Registry 查找能力；未注册的语言返回明确的“不支持该语言”错误，不得回退为另一种语言。

### 12.2 Server 语言插件契约

```ts
interface PluginManifest {
  id: string;
  version: string;
  apiVersion: 1;
  kind: "language" | "importer";
}

interface LanguageDescriptor {
  language: LanguageCode;
  displayName: string;
}

interface LanguageSearchConfig {
  fullTextParser: "space" | "ngram";
  ngramTokenSize?: number;
}

interface LanguagePack {
  manifest: PluginManifest & { kind: "language" };
  language: LanguageCode;
  displayName: string;
  noteTypes: NoteTypeDefinition[];
  searchConfig: LanguageSearchConfig;
  normalizeText(
    text: string,
    field: "original" | "reading" | "translation",
  ): string;
}

interface ImportSource {
  filename: string;
  mediaType: string;
  content: string;
}

interface MaterialImporter {
  manifest: PluginManifest & { kind: "importer" };
  canHandle(source: ImportSource): boolean;
  parse(ownerId: string, language: LanguageCode, source: ImportSource): Promise<ImportDraft>;
}

interface PluginRegistration {
  dispose(): void;
}

interface PluginRegistry {
  registerLanguagePack(pack: LanguagePack): PluginRegistration;
  registerImporter(importer: MaterialImporter): PluginRegistration;
  getLanguagePack(language: LanguageCode): LanguagePack;
  listLanguages(): LanguageDescriptor[];
  listImporters(): MaterialImporter[];
}
```

`listLanguages` 是创建学习计划时可用语言的服务端事实来源，API 据此返回语言列表，Web 不维护另一份硬编码选项。`LanguagePack` 只提供规范化和检索配置，不返回 SQL、表名、连接对象或仓储实现；全文列选择、parser 配置映射、参数化查询和权限过滤由核心检索模块完成，不能退化为按 ASCII 或语言代码写死分支。

语言包提供的 NoteType 经核心校验后同步为种子数据，插件不直接执行迁移或写数据库。发布草稿时，核心必须重新确认语言包、NoteType 版本和 AST 有效；语言包缺失不能让草稿绕过校验。

教材格式解析与语言处理保持正交：Markdown 导入器负责通用结构，语言包负责语言规范化与 NoteType；首版不为 LanguagePack 增加空导入钩子。确有需要时，语言专属文件格式或解析规则由独立 Importer 插件提供，不能写进核心 HTTP 路由或通用 Markdown 解析器的语言分支。

### 12.3 Web 插件贡献契约

Web 微内核由 `AppShell`、MUI `ThemeProvider`、路由容器和 `WebPluginRegistry` 组成。`AppShell` 独占侧边栏、顶部栏、主内容出口、全局错误反馈和响应式布局；插件只能向下列受控贡献点注册内容，不能查询或修改宿主 DOM，也不能注入全局 CSS。

```ts
interface PluginRouteContribution {
  id: string;
  path: string;
  component: LazyExoticComponent<ComponentType>;
}

interface SidebarItemContribution {
  id: string;
  routeId: string;
  label: string;
  icon?: ReactNode;
  section: "learning" | "content" | "tools";
  order: number;
}

interface HeaderActionContribution {
  id: string;
  order: number;
  component: ComponentType;
}

interface WebContributionManifest {
  id: string;
  version: string;
  apiVersion: 1;
  kind: "builtin" | PluginManifest["kind"];
}

interface WebPluginContribution {
  manifest: WebContributionManifest;
  language?: LanguageCode;
  routes?: PluginRouteContribution[];
  sidebarItems?: SidebarItemContribution[];
  headerActions?: HeaderActionContribution[];
}

interface LanguageWebPlugin extends WebPluginContribution {
  manifest: WebContributionManifest & { kind: "language" };
  language: LanguageCode;
}

interface WebPluginRegistry {
  register(plugin: WebPluginContribution): PluginRegistration;
  list(): WebPluginContribution[];
}
```

首版只开放完整页面路由、侧边栏入口和顶部动作三类贡献点，不预留任意 slot、弹窗或面板扩展。侧边栏入口必须引用已注册路由，顶部动作以组件形式渲染；插件页面通过宿主注入的 API Client 访问 `/v1`，不自行处理认证、`ownerId` 或数据库访问。Registry 保留每项贡献与插件及语言代码的关联，AppShell 按当前学习计划过滤语言专属导航和动作，并在路由入口校验语言上下文。

通用今日学习、教材、复习、检索和统计页面作为 `builtin` Web 贡献模块走同一注册机制，但不因此把事务、认证等核心服务插件化。语言插件只有在存在真实语言专属页面或动作时才提供 `web` 入口，不得为英语、日语复制整套通用学习页面。

MUI 由 Web 宿主统一安装和配置，插件将 React 与 MUI 视为宿主提供的 peer dependency，复用同一实例和 Theme。宿主提供设计令牌、基础布局和反馈组件；插件不得创建独立 `ThemeProvider`、自带另一套组件库或覆盖宿主全局样式。

### 12.4 英语、日语默认语言插件

| 默认插件 | Server 首版职责 | Web 边界 |
|---|---|---|
| `plugins/language-en` | 注册 `en` 与显示名；提供英语 NoteType/卡片模板；执行小写化、空白规范化；提供 `space` 全文检索配置 | 语言专属页面或动作存在时由本插件注册；通用学习页留在内核 |
| `plugins/language-ja` | 注册 `ja` 与显示名；提供日语 NoteType/卡片模板；分别规范化原文、读音和译文；提供 `ngram` 全文检索配置 | 日语专属页面或动作存在时由本插件注册；读音/Ruby 的安全 AST 渲染仍由内核执行 |

语言代码、显示名、NoteType、规范化函数和检索配置必须随插件一起注册，不能在 API 路由、React 页面或 SQL 仓储中另存一份语言映射。新增语言时首先增加独立语言插件并在组合入口注册；只有需要新通用能力时才提升插件 API 版本，不修改既有语言插件的内部实现来绕过契约。

当前 MVP 中的 `SAMPLE_EN`、`SAMPLE_JA` 和固定语言选项属于临时单页实现，不进入目标架构。成熟界面使用真实教材导入与空状态，语言选项来自 `GET /v1/languages`；示例文本不新增为通用插件扩展点。

### 12.5 一次语言能力的完整调用链

1. API 启动时注册 `language-en/server`、`language-ja/server`，Web 启动时注册内置页面及实际存在的语言 Web 贡献。
2. Web 通过 `GET /v1/languages` 获取可创建计划的语言，不在前端枚举英语、日语。
3. 创建计划、发布草稿和生成检索文档时，核心按 `language` 从 Registry 获取语言包并调用其配置或纯函数。
4. 检索模块根据语言包配置选择全文策略，数据库仍只由 storage 访问，业务文本与检索文档仍在同一事务发布。
5. 用户进入语言专属路由时，AppShell 渲染该插件已注册的懒加载页面；没有专属页面时继续使用通用学习页面，不生成空页面或占位入口。
6. 移除某个默认语言插件的装配后，其他语言和核心流程仍可运行；针对该语言的写请求必须返回明确错误，而不是发生隐式降级。

## 13. HTTP API 第一版

| 方法与路径 | 用途 | 主要请求/结果 |
|---|---|---|
| `GET /v1/languages` | 列出当前服务端已注册语言 | → `LanguageDescriptor[]` |
| `POST /v1/plans` | 创建学习计划 | `CreateLearningPlanInput` → `LearningPlanDto` |
| `GET /v1/plans/{planId}` | 查看计划 | → `LearningPlanDto` |
| `POST /v1/plans/{planId}/archive` | 归档计划 | → 空结果 |
| `POST /v1/imports/markdown` | 解析 Markdown 草稿 | 文件/文本 → `ImportDraft` |
| `GET /v1/imports/{draftId}` | 查看草稿与警告 | → `ImportDraft` |
| `POST /v1/imports/{draftId}/publish` | 校订后发布 | `PublishImportInput` → `PublishImportResult` |
| `POST /v1/reviews` | 提交一次真实复习 | `ReviewCardInput` → `ReviewCardResult` |
| `POST /v1/search` | 混合检索 | `SearchInput` → `SearchResultItem[]` |
| `GET /v1/health` | 服务健康检查 | → 有限健康状态，不暴露连接细节 |

所有业务端点需要认证。`ownerId` 不出现在创建、搜索或复习请求体中，而是由服务端根据会话注入。列表接口后续统一使用 `PageRequest`/`PageResult`，不为不同模块发明不同分页格式。

## 14. 一致性与安全要求

- 发布教材时，业务表、SearchDocument 文本和 pending 任务状态在同一 seekdb 事务中提交。
- 同一文档旧 revision 不得覆盖新 revision。
- Worker 并发认领任务必须通过数据库状态保证，不依赖单机内存锁。
- 权限过滤使用服务端认证上下文；返回检索结果前复核当前业务可见性。
- 所有 SQL 使用参数化输入，全文查询表达式和排序白名单不得直接拼接用户输入。
- AST 渲染不执行任意 HTML、脚本或插件提供的 DOM 操作。
- Secrets 只存在服务端环境，不进入 Web 公共变量、文档或仓库。
- 测试替身不得进入生产配置，运行中不得遗留 mock 数据。

## 15. 实施前验证与验收

实施开始后首先验证：

1. Sites Functions 的 Node/Hono 适配与外部 seekdb 网络连接。
2. Drizzle MySQL 方言对 seekdb 常规 CRUD 的兼容范围。
3. 英语、日语全文 parser、ngram 与混合检索的真实样例质量。
4. Embedding 模型、维度、成本和英日双语效果。
5. Worker 并发认领、重试和 revision 防覆盖行为。

Sprint 1 业务验收至少覆盖：

- 创建英语或日语计划并导入真实教材；
- 语言选项完全来自服务端 Registry，核心流程不存在英语或日语硬编码分支；
- 语言插件可以在不修改 AppShell 的情况下注册页面、侧边栏入口或顶部动作；
- 校订后生成笔记与卡片；
- 提交复习并看到真实下次到期时间与进度；
- 通过原文、释义和日语读音找到有出处的教材或笔记；
- 停止 Worker 时全文检索仍真实可用，向量状态不伪造；
- 重建 SearchDocument 后结果可从业务数据恢复。

## 16. 本次目录与文档范围

本次只建立目录和文档，不初始化 Git，不生成 Node workspace、依赖清单、配置文件或 TypeScript 实现。后续开始 Sprint 1 实施时，先依据本文件拆分具体任务并交用户审批。

本次前端与语言插件扩展已按第 12 节契约实施：语言列表 API、开放语言代码、Web Registry 与语言插件 `server/web` 入口均已落地，实际改动范围、验证记录与遗留问题见 `docs/sprint1/mvp-plan.md` 第 8 节「前端与语言插件升级实施结果」。
