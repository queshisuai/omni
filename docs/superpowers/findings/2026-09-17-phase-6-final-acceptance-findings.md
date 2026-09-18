# Phase ⑥ 发现记录

## 初始事实

- 当前分支为 `master`，工作区存在用户已有未提交改动；本阶段不得回滚、提交、推送、合并或清理这些改动。
- `implementation-notes.md` 已记录 Phase ⑤-5 的真实验收结果，包括 Finder 非空结果、Copilot 超时治理、Java `397/397`、Frontend `62/62`、typecheck、build 和边界检查。
- `implementation-notes.md` 已记录的 P0/P1 为无；P2/P3 需要以本轮重新执行结果复核。
- 代码知识图谱 MCP 工具未暴露，采用本地源码、Git diff、脚本和测试输出完成替代审计。

## 待核对

- 当前运行进程、端口、代码版本和服务健康状态。
- 核心测试与验收脚本的本轮退出码、计数和失败原因。
- AI Finder/Copilot 的真实代码边界、权限与日志内容。
- 论文描述与当前代码实现的一致性，尤其是 RAG 是否为 Copilot 主链路依赖。

## 本轮初始审计

- 当前监听端口包含 `3000`、`8081`、`8082`、`8083`、`8084`、`8085`、`8088`、`8848`、`11434`、`5432`、`6379` 和 `5672`；需进一步读取 PID 命令行确认是否来自当前工作区。
- `implementation-notes.md` 已把 Phase ⑤-5 的 Finder fixture 刷新和 Copilot 专用 35 秒 Gateway/Frontend timeout 记录为已解决事项；本阶段不能继续把它们列为当前问题。
- `docs/microservices/service-boundaries.md` 规定 Java 业务服务仅访问各自 owner 数据，跨服务使用带 `X-Internal-Token` 的 internal API；`java-gateway` 不拥有业务表。
- 生产拆库 manifest 和 SQL 检查脚本已包含 `support_ai_suggestion`，owner 为 `java-user`；需要以本轮脚本输出复核。
- 读取监听 PID 的首次 PowerShell 查询未返回命令行信息，原因待用逐进程筛选方式复核；不据此判断运行版本。
- `verify-prod-split-real-demo-seed.ps1` 当前强制检查 `910028` 使用 `CURRENT_DATE + INTERVAL '365 days ...'`，并校验活动、海报、艺人头像及 Copilot 相关 seed 清理顺序。
- 前端 package 要求 Node `>=24`，质量入口为 `pnpm typecheck`、`pnpm build` 和 `pnpm lint`；Java 父工程使用 Java 11 source/release，Phase ⑤-5 记录 Windows 测试需注入 `jdk.net.unixdomain.tmpdir`。

## 本轮静态检查结果

## 本轮新增发现：activity_artist manifest 遗漏

- 2026-09-17 重新执行 `scripts/verify-production-split-runtime.ps1` 时，`omni_ticket_split` 连通性通过，但 verifier 在 `activity_artist_activity_id_fkey` 处报 `Unknown FK child table 'public.activity_artist'`。
- 数据库只读核对确认 `activity_artist` 存在，且 `activity_id -> activity.id`、`artist_id -> artist.id` 均为 `java-ticket` 同 owner 外键，表有现存数据；源码存在 `ActivityArtist` Entity/Mapper/Service，生产迁移 `20260522_activity_multi_artist_phase1.sql` 负责建表。
- 根因是 `sql/production-split/manifest.json` 未登记 `activity_artist` 及其 `20260522` 两份既有 migration；不是缺 migration、缺表或业务代码问题。
- 已做最小修复：补齐 manifest 表和 migration，补齐 `scripts/check-production-split-sql.ps1` 的 `activity_artist` 列白名单；未新增 migration、未写入数据库。

## 追加发现：ticket manifest 仍遗漏 6 张业务表

- 在补齐 `activity_artist` 后，runtime verifier 继续报 `seat_layout_version_base_version_id_fkey` 的 child table 未知。
- 只读枚举 `omni_ticket_split` 确认遗漏业务表为 `activity_risk_resolution`、`seat_layout_version`、`seat_layout_version_block`、`seat_layout_version_override`、`seat_layout_version_ticket_group`、`seat_layout_version_group_binding`；这些表均有对应 Java entity 或生产建表迁移。
- 已补齐 `java-ticket` manifest 表清单，登记既有 `ticket/20260522_activity_risk_response_phase3.sql`，并将 6 张表的实际列集合加入静态 verifier 白名单；`seat_layout_version` 相关 migration 原已登记。
- `undo_log` 也出现在数据库表枚举中，但属于 Seata 基础设施表，不属于业务表 manifest，保持排除。

## 运行态与边界复核

- `java-gateway` PID `9264` 和 `java-user` PID `35832` 均从 `D:\Project\omni` 的 `target/classes` 启动，参数包含 `--spring.profiles.active=prod-split` 和 `-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime`；启动时间分别为 `2026-09-17 17:52:10`、`2026-09-17 17:51:16`。
- 前端 `http://localhost:3000/` 和客服工作台路由返回 HTTP 200；五个 Java 根路径和 Gateway 根路径返回 HTTP 404，符合未暴露根资源的现状；Nacos 控制台与 Ollama `/api/tags` 返回 HTTP 200。
- `scripts/verify-microservice-boundaries.ps1` 本轮通过，Java boundary tests 子集构建成功；输出中的测试日志含已有测试故意抛出的异常堆栈，但失败计数为 0，不能将其误判为测试失败。
- 当前前端构建产物 `.next` 存在，服务端口 3000 正在使用；需要在本轮 `pnpm build` 后再次确认构建结果。

## 质量回归结果

- Java 全量目标回归：`java-common 30/30`、`java-ai-core 34/34`、`java-user 333/333`，合计 `397/397`，退出码 0。
- Frontend 定向回归：`node --test src/lib/customer-service-workbench.test.ts src/lib/customer-service-copilot.test.ts src/lib/api.test.ts` 为 `62/62`，退出码 0。
- `pnpm typecheck`：退出码 0。
- 全量 `pnpm lint`：退出码 1，5 个 error 均位于本阶段未涉及的既有文件：`src/app/activity/[id]/page.tsx`、`src/app/console/refunds/page.tsx`、`src/components/GlobalDialog.tsx`、`src/components/Header.tsx`；其余为 218 个 warning。新增/修改客服 Copilot 文件未产生 error。
- 全量 lint 的 5 个 error 具体为：`react-hooks/purity` 1 个、`prefer-const` 2 个、`react/no-unescaped-entities` 2 个；本阶段不扩大修复范围。

## 前端构建

- `pnpm build`：退出码 0；Next.js `16.2.1` 编译成功，TypeScript 阶段完成，静态页面 `54/54` 生成完成。

- `scripts/check-service-boundaries.ps1`：通过，ticket/order/payment/notification 未发现跨 owner Mapper、Entity、SQL join 或已移除 social 持久化路径。
- `scripts/check-production-split-sql.ps1`：通过。
- `scripts/check-cross-owner-fks.ps1`：通过；识别 7 个历史 cross-owner FK、131 个 same-owner FK 和 1 个 legacy FK，均符合当前脚本清单。
- `scripts/check-production-runtime-defaults.ps1`：通过；生产 profile 的 token、密码、Nacos、Seata、ES、RabbitMQ、Alipay、Gateway 和前端 proxy 配置均通过守护检查。
- `scripts/verify-prod-split-real-demo-seed.ps1`：通过；活动 120 条，海报不少于 120 张。
- PID 命令行查询因使用 PowerShell 保留变量 `$pid` 首次失败，属于检查命令写法问题，尚未据此判断运行态。

## 追加发现：grab runtime/import 覆盖缺口

- 本轮重新执行 runtime verifier 时，`user`、`ticket`、`order`、`payment`、`notification` 分别通过 25、51、8、1、0 个外键检查，遍历 manifest 中的 `grab` 时失败：`No target host parameter mapped for service key 'grab'`。
- `omni_grab` 只读检查确认存在 4 个同 owner FK：`ticket_team_member.team_id -> ticket_team.id`、`team_grab_request.team_id -> ticket_team.id`、`team_seat_assignment.team_id -> ticket_team.id`、`waitlist_offer.entry_id -> waitlist_entry.id`。
- 已按现有生产拆库资产模式补齐 `verify-production-split-runtime.ps1` 和 `import-production-split.ps1` 的 `GrabHost` 映射，并新增 `sql/production-split/grab/001_same_owner_constraints.sql`；未修改业务数据库。
- `export-production-split.ps1` 新增可选 `SourceDatabaseByService` 映射，保留原有单库默认行为，支持在需要从当前独立 `omni_grab` 导出时显式传入 `grab=omni_grab`。

## 追加发现：Production Split ticket 默认目标库口径偏差

- `sql/production-split/manifest.json` 的 `sourceDatabase=omni_ticket` 符合历史共享库迁移源定义，但 `java-ticket.targetDatabase` 仍为 `omni_ticket`，与当前 `prod-split` 运行规则要求的 `omni_ticket_split` 不一致。
- `scripts/import-production-split.ps1` 默认从 manifest 读取 `targetDatabase`；如果不传 override，会把 ticket artifact 默认导入历史共享库，属于生产资产默认值风险。
- 已做最小修复：manifest 的 ticket `targetDatabase` 改为 `omni_ticket_split`；同步修正生产拆库设计/实施文档的 ticket 目标示例，并在 service boundary 文档补充 `grab` SQL 目录。
- 未修改历史共享库 `sourceDatabase`、业务代码、数据库内容或生产 cutover 行为。
- 修复后 JSON、`check-production-split-sql.ps1`、无 ticket database override 的 runtime verifier 和 `git diff --check` 均通过；runtime verifier 实际检查 `omni_ticket_split`。
