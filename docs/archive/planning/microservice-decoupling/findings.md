# 真正微服务低耦合发现记录

## 已确认事实

- 当前仍是单 PostgreSQL 数据库，但代码边界已通过脚本守护。
- `java-user` 拥有 `user`、`organizer_application`、`user_auth`、`sms_code`。
- `java-ticket` 拥有活动、场馆、场次、票档、座位、库存、SeatCraft 相关表。
- `java-order` 拥有 `order`、`order_seat`、`order_snapshot`。
- `java-payment` 拥有 `payment`、`refund_request`。
- `java-notification` 拥有 `notification`，`userId/orderId` 作为 copied id。
- 跨 owner FK 仍存在于 SQL 中，是共享数据库阶段的部署例外。
- 当前脚本识别 22 个 cross-owner FK、76 个 same-owner FK、7 个 legacy FK。
- `order_snapshot.order_id -> order` 是 same-owner FK，安全保留。
- `java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification` 已有 `application-local-schema.yml`，默认配置不变。
- `scripts/check-local-schema-profiles.ps1` 校验 profile 文件存在和 `currentSchema` 是否匹配预期。
- `scripts/check-service-boundaries.ps1` 现在扫描 `*.java` 与 `*.xml`，可捕获 XML mapper 中的跨服务 `FROM/JOIN` 访问。
- 生产物理拆库已被明确门禁化：未通过 Production Migration Safety Gate 前，不允许生产 FK 删除、默认 schema 切换或多库拆分。
- `sql/local/20260520_move_tables_to_service_schemas_local_only.sql` 只创建服务 schema 并移动表，不删除表/列、不修改数据。
- `scripts/apply-local-schema-isolation.ps1` 有三层保护：显式参数、环境变量、本地主机限制。
- `scripts/check-local-schema-sql.ps1` 静态拦截本地搬表 SQL 中的破坏性或数据修改语句。
- 本地 schema isolation 执行前备份已存在：`C:\Users\Administrator\Desktop\omni\backups\omni_ticket_before_schema_isolation_20260520-184757.dump`，大小 `250006` 字节。
- 本地 schema isolation 已执行完成，当前 service schema 表数量为：`notification_service=1`、`order_service=2`、`payment_service=2`、`ticket_service=27`、`user_service=4`。
- 当前本地库不存在 `order_snapshot`，因此 `order_service` 只移动到 `order` 和 `order_seat` 两张表。
- 2026-05-20 18:55 重新运行一键边界验收，最终输出 `All microservice boundary checks passed.`。
- 2026-05-20 20:11 重新运行一键边界验收，最终仍输出 `All microservice boundary checks passed.`。
- 当前运行进程检查显示大部分手动启动服务是默认 profile，至少一个进程带 `local-schema`；因此当前运行态不是纯 local-schema split 环境。
- 当前数据库实际查询未发现 service schema 之间的跨 owner FK，但正式 SQL inventory 仍包含 22 个已知 cross-owner FK。
- user/ticket/order/payment internal HTTP 接口直接抽查均返回 500，说明运行态链路还没有通过，需要继续看具体服务日志定位。
- 混用 profile 是上一轮运行态 500 的主要环境风险；统一重启后五个业务服务均以 `local-schema` profile 启动并注册。
- 下单链路 500 的直接根因是 disposable local DB 缺少 `order_service.order_snapshot`，已补表并验证创建订单成功。
- 登录 400 的直接原因是请求体字段使用了旧的 `phone`，当前 `LoginRequest` 要求 `account`。
- local-schema 运行态已验证的成功链路包括：用户登录、用户 internal API、票务 quote internal API、订单创建、订单详情、订单 paid-count internal API、支付 QR 创建、支付同步、通知发送和通知列表。
- 联调数据确认写入服务归属 schema：订单写入 `order_service`，支付写入 `payment_service`，通知写入 `notification_service`。

## 设计判断

- 下一步应扩展所有业务服务的 local schema profile，但不启用默认配置。
- 物理拆库前必须先完成 disposable database 的 schema isolation 实测。
- 当前不引入 MQ/outbox，继续通过同步 internal API 稳定边界。
- 跨 owner FK 删除脚本必须保持 local-only，不能进入生产迁移链路。
- 边界守护脚本应继续增强，避免 XML mapper 或注解 SQL 绕过 Java import 检查。

## 风险

- `check-service-boundaries.ps1` 已覆盖 XML mapper；复杂动态 SQL 或分散拼接字符串仍可能需要后续增强。
- local-schema profile 只保证配置存在，不等于服务已在真实 schema split DB 上跑通。
- PostgreSQL 默认 FK constraint 名称可能因历史迁移差异不同，本地 drop 候选执行前必须查 `pg_constraint`。
- 真实物理拆库还需要服务启动、API 联调和数据迁移策略，目前尚未进入该阶段。
- 当前本地 `order_snapshot` 缺失可能影响下单后的订单快照写入，服务 runtime 联调需要优先验证或补齐本地测试表。
- 下一步应启动五个服务的 `local-schema` profile，验证关键业务链路，不应仅依赖静态脚本和单元测试结论。
- 如果服务以默认 profile 启动，会使用默认 datasource URL；在表已移动到 service schema 后，默认 search path 可能找不到表并导致 500。运行态验证必须统一 profile 或恢复默认 public 表布局。
- `order_snapshot` 这类 order-owned same-owner 表必须在 local schema SQL 或正式 migration 中保持同步，否则 schema isolation 环境会启动成功但业务写入失败。
