# 测试相关文件清理扫描报告

> 扫描日期：2026-06-03  
> 扫描范围：`D:\omni` 全项目（7 个 Java 模块 + NestJS 抢票服务 + Next.js 前端）  
> 扫描分支：`master-Unit-testing`  
> 扫描方法：跨模块 glob 搜索、git 跟踪状态分析、import 依赖验证、源类对应关系检查

---

## 总览

| 类别 | 文件数 | 建议操作 |
|:---|---:|:---|
| A. 构建产物（target/、.next/） | 8 个目录 (100+ 文件) | 执行 `mvn clean` + 删除目录 |
| B. 已生成的测试结果报告 | 1 个目录 (67 文件) | 删除 `unit-test/` 目录 |
| C. 孤立测试文件（测试已不存在的类） | 4 个 .java 文件 | 迁移断言后删除 |
| D. 已暂存删除但未提交 | 3 个 .png 文件 | 提交确认 |
| E. Git 跟踪的生成产物 | 5 个文件 | `git rm --cached` + 删除 |
| **合计可删除** | **~180 文件 / ~80 MB** | — |

---

## 类别 A：构建产物（Build Artifacts）

这些是 Maven/Next.js 的编译输出，随时可重新生成。执行 `mvn clean` 或直接删除目录即可清理。

### A1–A7：Maven `target/` 目录（7 个模块）

所有 Java 模块的 `target/` 目录均已在 `.gitignore` 中（第 75 行：`target/`），但磁盘上仍存在。内含：

- `classes/` — 编译后的 .class 文件
- `test-classes/` — 编译后的测试 .class 文件
- `*.jar` — 打包的 JAR 文件
- `surefire-reports/` — JUnit 测试结果 XML/TXT/dumpstream 文件
- `maven-status/`、`maven-archiver/` — Maven 插件跟踪文件

| # | 路径 | 大小估计 | surefire 报告文件数 |
|---|------|---------|:---:|
| A1 | `java/java-common/target/` | ~5 MB | — |
| A2 | `java/java-gateway/target/` | ~3 MB | 5+ |
| A3 | `java/java-notification/target/` | ~2 MB | 6+ |
| A4 | `java/java-order/target/` | ~5 MB | 20+ |
| A5 | `java/java-payment/target/` | ~3 MB | 8+ |
| A6 | `java/java-ticket/target/` | ~15 MB | 60+ |
| A7 | `java/java-user/target/` | ~3 MB | 12+ |

> **删除命令**：在 `java/` 目录执行 `mvn clean`，或直接删除各模块的 `target/` 目录。

### A8：Next.js 构建输出

| # | 路径 | 大小估计 | 说明 |
|---|------|---------|------|
| A8 | `frontend/.next/` | ~50 MB+ | Next.js 构建缓存、Turbopack 缓存、SSR chunk、source map、开发日志 |

已在 `frontend/.gitignore`（第 7 行）和根 `.gitignore`（第 87 行）中忽略。

> **删除命令**：直接删除 `frontend/.next/` 目录。`next dev` 或 `next build` 会自动重建。

---

## 类别 B：已生成的测试结果报告（Generated Test Reports）

### B1：`unit-test/` 整个目录

| 属性 | 值 |
|:---|:---|
| 路径 | `D:\omni\unit-test/` |
| 子目录数 | 34 个（每个测试模块一个） |
| 文件数 | 67 个 Markdown + 1 个 HTML |
| Git 状态 | **未被跟踪**（`git ls-files unit-test/` 返回空） |
| .gitignore 覆盖 | 否（目录名不在忽略规则中） |

内容清单：
- `test-plan.md` × 32 — 各模块测试计划
- `test-results.md` × 32 — 各模块测试执行结果
- `README.md` — 目录说明
- `test-summary-report.html` — 汇总可视化报告

这些是一次性测试执行快照，不是测试源码。汇总结果已保存在 `test-summary-report.html` 中，原始 Markdown 文件可以删除。

> **删除命令**：删除 `unit-test/` 整个目录。如需保留汇总视图，可单独保留 `test-summary-report.html`。

---

## 类别 C：孤立测试文件（Orphaned Tests）

以下 JUnit 测试文件的名称所暗示的被测类在项目中已不存在。它们实际测试的是 YAML 文件中的字符串常量，存在命名误导、逻辑脆弱、覆盖不一致等问题。

### C1–C4：`LocalSchemaRuntimeConfigTest.java`（4 个副本）

| # | 路径 | 实际测试内容 |
|---|------|------------|
| C1 | `java/java-order/src/test/java/com/omni/order/config/LocalSchemaRuntimeConfigTest.java` | YAML 中 `seata.enabled` 默认值 |
| C2 | `java/java-payment/src/test/java/com/omni/payment/config/LocalSchemaRuntimeConfigTest.java` | 同上（C1 的近乎复制品） |
| C3 | `java/java-ticket/src/test/java/com/omni/ticket/config/LocalSchemaRuntimeConfigTest.java` | 同上 |
| C4 | `java/java-user/src/test/java/com/omni/user/config/LocalSchemaRuntimeConfigTest.java` | YAML 中 `id-no-key` 回退值 + Seata 默认值 |

**问题分析**：

1. **被测类不存在**：`LocalSchemaRuntimeConfig` 类在任何模块的 `src/main/java` 中都不存在。这些测试读的是 YAML 资源文件，不是 Java 类。
2. **极度脆弱**：使用 `new String(bytes)` 对 YAML 文件做精确子串匹配，任何空格重排、注释增删都会导致测试失败。
3. **覆盖不一致**：`java-notification` 模块同样有 `application-local-schema.yml`，却没有对应的测试。`java-user` 的测试只检查了 `local-schema` 文件，漏掉了 `prod-split` 文件。
4. **CI 执行不一致**：`verify-microservice-boundaries.ps1` 中 CI 命令为 `mvn test -pl java-payment,java-ticket,java-order -am`——`java-user` 不在 `-pl` 列表中，其 `LocalSchemaRuntimeConfigTest` 在 CI 中从不执行。
5. **工具误用**：用 JUnit 框架做 YAML 内容校验是对测试框架的误用。已有专用工具 `scripts/check-local-schema-profiles.ps1` 负责验证 YAML 配置。

**建议操作**：

1. 将四个测试覆盖的断言迁移到 `scripts/check-local-schema-profiles.ps1`：
   - Seata 默认值：`local-schema` 下应为 `false`，`prod-split` 下应为 `true`
   - `id-no-key` 回退值检查
2. 删除四个 `LocalSchemaRuntimeConfigTest.java` 文件

---

## 类别 D：已暂存删除但尚未提交的文件

以下文件已在 Git 索引中标记为删除（`git status` 显示 `D` 前缀），但删除操作尚未提交确认。

| # | 文件 | 当前状态 |
|---|------|---------|
| D1 | `verification-grab-paid-order.png` | 已 `git rm`，待 commit |
| D2 | `verification-grab-payment-blocked.png` | 同上 |
| D3 | `verification-orders-grab-payment.png` | 同上 |

> **操作**：在下一次提交中包含这些删除即可。这 3 个文件是抢票验证截图，已在之前的 commit `3c4169b`（"清理冗余文件，节省约50MB仓库空间"）中暂存。

---

## 类别 E：Git 跟踪的生成产物

`graphify-out/` 是代码图谱分析工具的输出目录。虽然已在 `.gitignore` 第 167 行添加，但这些文件是在忽略规则添加之前提交的，因此仍被 Git 跟踪。

| # | 文件 | 类型 |
|---|------|------|
| E1 | `graphify-out/cost.json` | 分析成本数据 |
| E2 | `graphify-out/GRAPH_REPORT.md` | 图谱报告 |
| E3 | `graphify-out/README.md` | 说明文件 |
| E4 | `graphify-out/graph.html` | 可视化图谱 |
| E5 | `graphify-out/graph.json` | 图谱数据 |

> **删除命令**：
> ```bash
> git rm --cached graphify-out/cost.json graphify-out/GRAPH_REPORT.md graphify-out/README.md graphify-out/graph.html graphify-out/graph.json
> # 然后删除 graphify-out/ 目录
> ```
> 之后这些文件将仅存在于 `.gitignore` 规则下，不会被重新跟踪。

---

## 明确保留的文件（不删除）

以下文件在扫描中被识别为"看起来可删除"，但经过仔细分析后确认**应保留**：

### K1：`SocialControllerTest.java` — 架构守卫测试

- **路径**：`java/java-ticket/src/test/java/com/omni/ticket/controller/SocialControllerTest.java`
- **保留原因**：这是**有意编写的架构守卫测试（guard test）**。它通过 `Class.forName()` 断言 `SocialController`、`ReviewMapper`、`MomentMapper`、`Review`、`Moment` 五个已删除的类均抛出 `ClassNotFoundException`——确保这些类不会被意外恢复。
- **证据链**：
  - `scripts/check-service-boundaries.ps1`（第 48-49 行）为其维护了专门的 allow-list 白名单
  - `scripts/verify-microservice-boundaries.ps1`（第 51 行）在 CI 中执行此测试
  - `CLAUDE.md`（第 9 行）和 `AGENTS.md`（第 24 行）明确记录了此架构决策

### K2：`frontend/public/*/.gitkeep`（5 个）

- **路径**：`frontend/public/images/.gitkeep`、`frontend/public/seo/.gitkeep`、`frontend/public/videos/.gitkeep`、`frontend/src/hooks/.gitkeep`、`frontend/src/types/.gitkeep`
- **保留原因**：这些是有意放置的空目录占位文件，用于在 Git 中保留目录结构。

### K3：历史迁移 SQL 文件（2 个）

- **路径**：`sql/local/20260520_move_tables_to_service_schemas_local_only.sql`、`sql/local/20260520_drop_cross_owner_fks_local_only.sql`
- **保留原因**：这两个文件引用已删除的 `review`/`moment` 表，但它们属于历史迁移脚本，记录了数据库架构演进过程，应保留以备审计。

### K4：所有其他测试文件

- 经逐一核实，项目中所有其他 `*Test*.java` 文件（~100 个）都有对应的源类（1:1 匹配），或被现有测试套件引用。
- 所有 24 个前端 `*.test.ts` 文件同样都有对应的 `.ts` 源文件。
- NestJS `grab-service` 中的 37 个 `.spec.ts` 文件属于独立项目，不在本次扫描范围内。

---

## 附录 A：扫描方法说明

| 扫描步骤 | 方法 | 结果 |
|:---|:---|:---|
| 全量测试文件发现 | `Glob: java/**/test/**/*Test*.java` | 找到 107 个 Java 测试文件 |
| 源类对应验证 | 对每个测试文件推导 `src/main/java` 路径，检查源文件是否存在 | 发现 4 个无源类的孤立测试 |
| Import 依赖验证 | Grep 搜索 `ReviewMapper`、`MomentMapper`、`SocialController`、`Review`、`Moment` 等已删除类的 import 引用 | 仅 `SocialControllerTest.java` 引用（有意为之） |
| 构建产物扫描 | Glob 搜索 `target/`、`.next/`、`*.dumpstream`、`TEST-*.xml` | 找到 8 个构建产物目录 |
| Git 跟踪状态检查 | `git ls-files`、`git status --short` | 确认 `unit-test/` 未被跟踪，`graphify-out/` 仍被跟踪 |
| 临时文件搜索 | Glob 搜索 `*.log`、`*.tmp`、`*.dump`、`__pycache__`、`.pytest_cache`、`.DS_Store` | 未发现（项目清洁） |
| 前端测试验证 | Glob 搜索 `frontend/src/**/*.test.ts` | 24 个全部有对应源文件 |
| SQL 引用检查 | Grep 搜索 SQL 文件中对 `review`、`moment`、`social` 表名的引用 | 仅 2 个历史迁移脚本引用 |

## 附录 B：快速清理命令参考

```bash
# 类别 A：清理构建产物
cd D:/omni/java && mvn clean          # 清理所有 Maven target/
rm -rf D:/omni/frontend/.next         # 清理 Next.js 构建缓存

# 类别 B：删除测试结果报告
rm -rf D:/omni/unit-test              # 删除全部测试结果（可选择性保留 test-summary-report.html）

# 类别 C：删除孤立测试文件
rm D:/omni/java/java-order/src/test/java/com/omni/order/config/LocalSchemaRuntimeConfigTest.java
rm D:/omni/java/java-payment/src/test/java/com/omni/payment/config/LocalSchemaRuntimeConfigTest.java
rm D:/omni/java/java-ticket/src/test/java/com/omni/ticket/config/LocalSchemaRuntimeConfigTest.java
rm D:/omni/java/java-user/src/test/java/com/omni/user/config/LocalSchemaRuntimeConfigTest.java

# 类别 E：取消跟踪并删除生成产物
cd D:/omni
git rm --cached graphify-out/cost.json graphify-out/GRAPH_REPORT.md \
  graphify-out/README.md graphify-out/graph.html graphify-out/graph.json
rm -rf graphify-out

# 验证
mvn test -pl java-payment,java-ticket,java-order -am   # 确认测试通过
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
git status
```

---

> **总结**：本次扫描共识别出约 180 个可安全删除的测试相关文件（约 80 MB），涵盖构建产物、生成报告、孤立测试和跟踪异常四类。所有建议删除的文件均不会影响项目构建、测试执行或功能正确性。
