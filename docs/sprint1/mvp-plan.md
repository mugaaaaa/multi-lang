# Sprint 1 MVP 实施计划

日期：2026-10-29
状态：待用户审批
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
- Ant Design。前端先用原生 CSS，后续迭代再引入，属于对设计文档第 2 节「Web: Ant Design」的延迟，不改变其他边界。

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
