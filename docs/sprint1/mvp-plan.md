# Sprint 1 MVP 实施计划

日期：2026-10-29
状态：已实施（见文末「实施结果」）
前置文档：`docs/sprint1/design.md`（本计划在其范围内裁剪出最小闭环）

## 1. 现状

- 仓库只有 `AGENTS.md`、`CLAUDE.md`、`CONTRIBUTING.md` 与 `docs/sprint1/design.md`，`apps/`、`packages/`、`plugins/`、`infra/`、`scripts/` 均为空目录。
- 尚未初始化 Git，没有任何提交。
- 本机已安装 Docker（29.8.2），但 daemon 未运行；需要用户启动 Docker Desktop。
- seekdb 官方镜像为 `quay.io/oceanbase/seekdb`，MySQL 协议端口 2881，通过 `ROOT_PASSWORD` 环境变量设置 root 密码，初始化约需 2-3 分钟。

## 2. MVP 目标

跑通「数据库 → 后端 → 前端」全链路的最小闭环：

```text
创建学习计划 → 导入 Markdown 教材并发布 → 生成笔记与卡片 → FSRS 复习 → 全文检索
```

前端只做可用的最简界面（纯 React + 少量原生 CSS），不做视觉装饰。

## 3. 范围与简化决策

参考 DeepSeek Harness（dsh）的微内核/插件化哲学：内核只负责插槽契约、生命周期与数据流转，具体能力一律以插件挂载。与 dsh 的差异：本仓库首版不引入 Cordis 运行时、不做动态加载或热更新，插件是编译期由组合入口装配的仓库内受信任模块（依据 `AGENTS.md` 技术边界）。

插件与内核的划分：

- 插件槽位（内核只知契约，不知实现）：语言包（`language-en`、`language-ja`）、导入器（`importer-markdown`）、复习调度器（`scheduler-fsrs`，默认实现 `ReviewScheduler` 接口）。未来可替换或新增：其他语言、epwing/PDF 导入器、SM-2 或调参调度器、Embedding Provider。
- 微内核职责（不做成插件）：事务边界（发布与复习的单事务）、认证与 ownerId 注入、参数化 SQL 执行层（插件只提供配置与纯函数，不产生 SQL）、Content AST 格式与安全渲染、HTTP 契约与 PluginRegistry 生命周期。

包含：

1. Git 初始化：`.gitignore`、`main` 基线提交（仅现有文档）、功能分支 `feat/minimal-mvp`。
2. pnpm workspace 与 TypeScript 基础配置（`apps/api`、`apps/web`、`packages/contracts`、`packages/domain`、`packages/plugin-sdk`、`packages/storage`、`plugins/language-en`、`plugins/language-ja`、`plugins/importer-markdown`、`plugins/scheduler-fsrs`）。
3. `infra/seekdb/docker-compose.yml`：seekdb 容器（端口 2881，数据卷持久化，密码走 `.env`，`.env` 不入库）。
4. 版本化 SQL 迁移：`learning_plans`、`source_documents`、`source_blocks`、`note_types`、`notes`、`cards`、`card_scheduling_states`、`review_logs`、`search_documents`（含全文索引）。迁移记录表存于库内。
5. 后端（Hono + mysql2/Drizzle）：`GET /v1/health`、`POST/GET /v1/plans`、`POST /v1/plans/{id}/archive`、`POST /v1/imports/markdown`、`GET /v1/imports/{draftId}`、`POST /v1/imports/{draftId}/publish`、`POST /v1/reviews`、`POST /v1/search`。
6. Markdown 导入插件（最简）：标题/段落 → Content AST 块，不做 Ruby/Annotation 高级节点。
7. FSRS 复习：ts-fsrs 调度，复习在单事务内锁定状态、追加 ReviewLog、写回新状态。
8. 前端（Vite + React）：单页最简界面——创建/查看计划、粘贴 Markdown 导入、复习一张卡片、搜索框。

不包含（后续迭代）：

- Embedding Worker 与向量检索。检索只走全文（`MATCH ... AGAINST` 参数化），向量列不建、向量状态不伪造。
- 完整认证。MVP 单用户：`ownerId` 由 API 从环境变量 `DEV_OWNER_ID` 注入，路由不接受客户端声明的 owner。这是对设计文档「所有业务端点需要认证」的临时简化，代码在服务端注入点收敛，后续替换为会话中间件。
- 分页（列表接口先返回全量）、归档列表、NoteType 管理界面（NoteType 由语言包插件提供）。
- Material UI（MUI）。前端先用原生 CSS，后续迭代再引入，属于对设计文档第 2 节「Web: Material UI」的延迟，不改变其他边界。

## 4. 实施步骤

1. Git：`git init` → 写 `.gitignore`（node_modules、dist、.env、.DS_Store 等）→ `main` 基线提交 → 切 `feat/minimal-mvp`。
2. Workspace：根 `package.json`（pnpm workspace）、`tsconfig.base.json`、各包 `package.json` 与 TS 配置。
3. `infra/seekdb/docker-compose.yml` + `.env.example`；用户启动 Docker Desktop 后拉起容器并验证 `mysql` 协议连通。
4. `packages/contracts`：通用契约与 DTO 类型（按设计文档第 6、9 节）。
5. `packages/domain`：LearningPlan、Import、Review、Search 服务接口与 FSRS 调度器（ts-fsrs）。
6. `packages/storage`：迁移 SQL、Drizzle schema、mysql2 连接池、仓储实现（全文检索用手写参数化 SQL）。
7. `plugins/importer-markdown`：最简解析器，产出 ImportDraft。
8. 语言包以默认插件形式提供（`plugins/language-en`、`plugins/language-ja`）：各含最小 NoteType 与检索配置（英语 space 分词、日语 ngram），实现 `LanguagePack` 接口。英语、日语不是应用内的硬编码分支，业务代码只依赖 `PluginRegistry`；语言包与导入器都由组合入口（`apps/api` 装配处）注册。NoteType 种子数据由语言包提供，不写入通用迁移。
9. `apps/api`：Hono 路由 + 组合入口装配存储与插件；开发模式用 `tsx watch`。FSRS 复习：`plugins/scheduler-fsrs` 实现 `ReviewScheduler` 端口（ts-fsrs），复习事务（锁定状态 → 调用调度器 → 追加 ReviewLog → 写回新状态）在内核仓储中单事务完成，`schedulerVersion` 随状态持久化。
10. `apps/web`：Vite + React 最简页面，dev server 代理 API。
11. 端到端验证（见第 5 节）并更新本文档记录实际改动与遗留问题。

## 5. 验证计划

- 真实 seekdb（Docker 容器）执行迁移，不使用内存替身。
- `curl` 逐个验证 API 端点的正常与错误路径（无 owner 越权、发布 revision 校验）。
- 浏览器实际操作：创建计划 → 导入并发布 → 卡片出现 → 提交复习评分 → 看到新到期时间 → 搜索命中教材原文。
- 复习并发正确性以单事务实现保证，不做压测。

## 6. 风险与待确认

- seekdb 对 Drizzle MySQL 方言的兼容范围需实测（设计文档第 15 节验证项 2）；若不兼容，普通 CRUD 降级为 mysql2 手写参数化 SQL，并在文档记录。
- 全文索引 DDL 与分词器（IK/jieba）语法需以 seekdb 实际文档为准，实施时验证英日样例。
- Docker Desktop 未运行时步骤 3 会阻塞，届时需要用户启动。

## 7. 实施结果（2026-10-29）

### 实际改动

- Git：`main` 基线提交（文档），功能分支 `feat/minimal-mvp`。
- pnpm workspace：`apps/api`、`apps/web`、`packages/{contracts,domain,plugin-sdk,storage}`、`plugins/{language-en,language-ja,importer-markdown,scheduler-fsrs}`，全部通过 `tsc --noEmit`。
- seekdb：OrbStack + `infra/seekdb/docker-compose.yml`（镜像 `quay.io/oceanbase/seekdb`，端口 2881）。迁移 `0001_init` 已应用，11 张表。
- 插件：语言包 en/ja（含最小 NoteType 与检索配置）、Markdown 导入器、FSRS 调度器（ts-fsrs 4.7），全部经 `DefaultPluginRegistry` 由 `apps/api/src/main.ts` 组合入口注册，业务代码无语言硬编码分支。
- API：`/v1` 全部端点可用；发布、复习均单事务（FOR UPDATE + ReviewLog 只追加）。
- Web：React + Vite 最简单页，dev 代理到 8787。

### 验证记录

- 真实 seekdb 执行迁移并跑通全链路：创建计划 → Markdown 导入（2 笔记）→ 发布（同事务写业务表 + SearchDocument）→ FSRS 复习（真实 stability/difficulty/dueAt 落库）→ 全文检索命中教材块与笔记。
- 浏览器实测英/日流程与 404 错误路径。
- 日文检索修复：seekdb FULLTEXT 默认 `space` parser `min_token_size=3` 会丢弃单字 CJK 与假名。最终 DDL：`original_text` 用 `space` parser（min_token_size=1），`normalized_text` 用 `ngram` parser（ngram_token_size=1）；查询按是否 ASCII 选择 MATCH 列。已在容器上以 ALTER 验证并回写迁移文件。

### 与计划的偏离

- **未使用 Drizzle**：仓储全部为 mysql2 手写参数化 SQL。原因：发布/复习事务与 FULLTEXT/JSON 列交互直接用 SQL 更可控，Drizzle 增益有限。属于计划风险项 1 的预登记降级路径，不改变模块边界。
- 全文检索切换 MATCH 列的判定基于查询文本是否纯 ASCII（而非语言包配置），语言包 `searchConfig` 暂未接入该决策。后续应让 LanguagePack.normalizeText/searchConfig 参与检索列选择。（已在第 8 节修复）

### 遗留问题

- Embedding Worker 与向量检索未实现（按计划不含）。
- `ownerId` 仍为 `DEV_OWNER_ID` 环境变量单用户注入。
- 前端无路由/持久化，刷新后需重建计划选择。（已在第 8 节修复）
- `EmbeddingJobRepository` 接口已定义但实现为空占位（无调用方）。
- Drizzle 依赖仍在 storage 的 package.json 中但未使用，待下一迭代决定移除或启用。

## 8. 前端与语言插件升级实施结果（2026-10-29）

本节记录经用户审批的「前端成熟化 + 语言插件化」迭代的实际改动，设计契约见 `docs/sprint1/design.md` 第 12 节。第 3 节中「不包含 Material UI」的延迟项本次已完成。

### 实际改动

- 契约（`packages/contracts`）：`LanguageCode` 开放为 string（服务端 PluginRegistry 校验）；新增 `LanguageDescriptor`、`LearningPlanStatsDto`、`SourceDocumentSummaryDto`、`DueCardDto`。
- 语言插件：`plugins/language-{en,ja}` 入口移至 `src/server/`，`src/web/` 槽位预留；补充 `displayName`（英语/日语）；`PluginRegistry` 新增 `listLanguages()`。
- 领域（`packages/domain`）：LearningPlanService 新增 `list`/`getStats`，创建计划经语言插件校验；ImportService 导入前校验计划存在与语言匹配、发布前校验 NoteType 属于语言插件；SearchService 经语言插件规范化查询并下传 `fullTextParser`；ReviewService 到期卡片返回 `DueCardDto`。
- 存储（`packages/storage`）：新增 `listActiveByOwner`、`getStats`（真实连续天数、14 天节奏、保持率，全部来自 cards/card_scheduling_states/review_logs）、`listSourceDocuments`；发布事务用 `LanguagePack.normalizeText` 写 `normalized_text`；检索按 `searchConfig.fullTextParser` 选择 MATCH 列（space→original_text、ngram→normalized_text），替代第 7 节记录的 ASCII 启发式；due-cards 查询修复为 JOIN notes 取 noteTypeId 并按 `due_at` 过滤。
- API（`apps/api`）：新增 `GET /v1/languages`、`GET /v1/plans`、`GET /v1/plans/{id}/stats`、`GET /v1/plans/{id}/source-documents`；语言参数从 `z.enum(["en","ja"])` 放宽为 BCP-47 形态校验。
- Web（`apps/web`）：MUI v6 + React Router v6 + Emotion；微内核 AppShell 与 `WebPluginRegistry`（注册期校验插件/路由/侧边栏/头部动作 id 冲突与 sidebar→route 引用）；受控贡献点 route/sidebar/headerAction 由内置插件 `multi-lang.builtin.learning` 消费，贡献五个页面（今日学习、记忆复习、教材工坊、混合检索、学习统计）；`WorkspaceContext` 从 `/v1/languages` 与 `/v1/plans` 取数，activePlan 持久化到 localStorage；贡献点带 `language` 字段时按当前计划语言过滤并有路由守卫；主题为 Noto Serif/Sans SC 可变字体 + 纸面质感。核心代码无英语/日语硬编码分支，语言选项完全来自服务端 Registry。

### 验证记录（真实 seekdb，无 mock）

- 浏览器全链路：创建日语计划「日语 N4 核心词汇」→ Markdown《海と水》导入 → 草稿预览（2 笔记、warnings 展示）→ 发布（教材工坊列表出现 2 段/2 笔记/2 卡片）→ 复习两轮完成（评分 good，FSRS 下次到期 11 月 2 日）→ 检索「海」并勾选笔记类型，命中相关度 0.409、来源修订 1 → 统计页与 API 数字一致（累计复习 4、保持率 100%、连续 1 天、14 天柱状图）。
- 移动端抽屉导航（学习/内容/工具分组）、计划切换器、无计划欢迎页、键盘快捷键提示均实测。
- `pnpm -r typecheck` 与 storage 包 `tsc --noEmit` 通过。

### 验证中发现并修复的问题

- **时间基准漂移**：应用写入的是 UTC 字面量（`toISOString()`），而 seekdb 会话 `time_zone=+08:00`、Node 进程时区为 EDT。后果：stats 用 `NOW(3)` 判断到期比 due-cards 提前 8 小时（stats 显示 2 张到期而复习队列为空）；mysql2 按进程时区解读读出值，API 时间戳偏移 4 小时。修复：连接池统一 `timezone: "Z"`（`packages/storage/src/connection.ts`），stats 到期判断改用 `UTC_TIMESTAMP(3)`（`packages/storage/src/storage.ts`）。修复后 stats 与 due-cards 口径一致，页面显示真实本地时间。
- 教材工坊发布成功后 `notifyDataChanged` 触发草稿状态被误清空：拆分为计划切换重置与数据加载两个 effect。

### 遗留问题

- Embedding Worker 与向量检索仍未实现，`search_documents.embedding_status` 保持 `pending`，混合检索只覆盖全文。
- `ownerId` 仍为 `DEV_OWNER_ID` 单用户注入，无认证中间件。
- 语言插件 `src/web/` 槽位已预留、贡献点机制可用，但英/日暂无语言专属页面注册（现有五页为通用学习流程，属内置插件贡献）；待出现真实语言专属 UI 需求再补，不预造空实现。
- Drizzle 依赖仍未使用，待决定移除或启用。

## 9. 评审复现修复（2026-10-29）

### 问题

按 README 在全新环境执行 `pnpm migrate` 时，seekdb 中只有容器初始化后的默认库，`multi_lang` 尚不存在，连接直接报 `ER_BAD_DB_ERROR: Unknown database 'multi_lang'`，后续 API 与 Web 无法启动。原迁移脚本假设数据库已手动创建，但运行说明没有这一步。

### 修复

- `packages/storage/src/migrate.ts`：迁移前先连接服务器（不指定数据库），校验库名后执行 `CREATE DATABASE IF NOT EXISTS ... CHARACTER SET utf8mb4`；随后再创建带数据库的连接执行迁移。
- 迁移连接增加重试：seekdb 未就绪时最多等待约 120 秒（40 次 × 3 秒），连接超时 5 秒；权限错误等不可重试错误立即失败并提示检查 `.env`。
- `packages/storage/src/connection.ts`：连接池与连接增加 `connectTimeout: 5000`，避免干净环境里长时间挂起。
- `pnpm-workspace.yaml`：允许 `esbuild` 构建脚本，避免 pnpm 10 在干净安装时忽略 postinstall。

### 干净环境验证

- 从公开仓库 `main` 克隆到 `/tmp`，使用全新数据库 `multi_lang_clean`。
- `pnpm install` 成功；`pnpm migrate` 自动建库并输出 `applied: 0001_init`。
- 干净 API 启动后，完整执行：创建计划 → 导入《海と水》→ 发布 → 检索「海」（3 条命中，来源修订 1）→ 复习评分 → 统计（累计复习 1、保持率 100%、连续 1 天）。
- 干净 Web 连接干净 API 后，今日学习、教材与统计页均读取到真实数据。
- `pnpm --filter @multi-lang/web build` 通过。

### 说明

第 8 节验证样例使用两行表格，因此为 2 笔记/2 卡片；本次干净复现只粘贴了一行表格，因此为 1 笔记/1 卡片，两者都是真实导入结果。
