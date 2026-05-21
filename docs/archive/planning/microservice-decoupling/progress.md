# 真正微服务低耦合推进进度

## 2026-05-20

- 已完成 H1/H2/H3/I1/I2/J1/J2/K1/K2。
- 新增服务边界脚本：`scripts/check-service-boundaries.ps1`。
- 新增跨 owner FK 脚本：`scripts/check-cross-owner-fks.ps1`。
- 新增一键验收脚本：`scripts/verify-microservice-boundaries.ps1`。
- 新增本地 FK 删除候选：`sql/local/20260520_drop_cross_owner_fks_local_only.sql`。
- 新增 schema isolation runbook：`docs/microservices/schema-isolation-runbook.md`。
- 新增 order/payment local schema profile。
- 最近一次一键验证通过：Service boundary guard PASS、Cross-owner FK inventory PASS、Java boundary tests PASS。
- 已完成 L1/L2：为 `java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification` 准备 local schema profile，并新增 `scripts/check-local-schema-profiles.ps1`。
- 已完成 M1：增强 `scripts/check-service-boundaries.ps1`，覆盖 `*.java` 与 `*.xml`。用临时 XML mapper 先验证旧脚本漏抓，再增强脚本并确认可抓到，随后删除临时文件并通过一键验证。
- 已完成 M2：在 service boundary、schema isolation runbook、cross-service FK 文档中补充生产迁移安全声明和物理拆库硬门禁。
- 已完成 N1：新增本地 schema 搬表候选 SQL、受保护执行脚本、local schema SQL 静态安全检查，并纳入一键验证脚本。
- 已完成 N2：在执行前备份本地 `omni_ticket`，备份文件为 `C:\Users\Administrator\Desktop\omni\backups\omni_ticket_before_schema_isolation_20260520-184757.dump`，大小 `250006` 字节。
- 已执行本地 disposable schema isolation：cross-owner FK drop SQL 和 service schema move SQL 均执行完成；`IF EXISTS` 忽略当前本地库不存在的 `venue_seat_layout_template`、`venue_seat_layout_template_section`、`layout_section`、`order_snapshot`。
- 当前本地 schema 表数量：`notification_service=1`、`order_service=2`、`payment_service=2`、`ticket_service=27`、`user_service=4`。
- 已重新运行 `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`，Maven Reactor `BUILD SUCCESS`，最终输出 `All microservice boundary checks passed.`。
- 已在用户手动启动全部服务后检查运行端口：Nacos `8848`、user `8081`、ticket `8082`、order `8083`、payment `8084`、notification `8085` 均可连接。
- 已重新运行边界守护：`check-service-boundaries.ps1`、`check-local-schema-profiles.ps1`、`check-local-schema-sql.ps1`、`check-cross-owner-fks.ps1` 均通过。
- 已确认当前本地数据库实际 service schema 中无跨 owner FK 查询结果；但 `sql/init.sql` 等正式建表 SQL 仍保留 22 个已知 cross-owner FK，属于共享数据库部署阶段例外。
- 已运行完整 `scripts/verify-microservice-boundaries.ps1`，最终 `BUILD SUCCESS` 且输出 `All microservice boundary checks passed.`。
- 运行时抽查 internal API 直接调用当前返回 500，原因需要进一步查服务日志；当前可证明代码/数据库边界守护通过，但不能据此宣称完整业务流已在运行态通过。
- 已停止混用 profile 的业务服务进程，并统一以 `local-schema` profile 重启 user/ticket/order/payment/notification；五个业务服务日志均显示 active profile 为 `local-schema`，端口 `8081`-`8085` 均可连接。
- 已补齐 disposable local DB 中缺失的 `order_service.order_snapshot` 表及索引，解决下单写订单快照时 `relation "order_snapshot" does not exist` 的运行时阻塞。
- 已验证 local-schema 运行态关键链路：用户 internal API、票务 quote internal API、订单 paid-count internal API、支付 sync internal API 均返回 `code=200`。
- 已验证 local-schema 业务链路：用户登录成功、创建订单成功、支付 QR 创建成功、支付同步成功、订单详情查询成功、通知发送与列表查询成功。
- 已确认联调写入位置：`order_service.order` 中订单 `10` 存在，`order_service.order_snapshot`、`payment_service.payment`、`notification_service.notification` 均有对应记录。
- 已重新运行完整 `scripts/verify-microservice-boundaries.ps1`，最终仍为 `BUILD SUCCESS`，输出 `All microservice boundary checks passed.`。

## 待办

- 后续若进入生产迁移设计，需要把 `order_snapshot` 纳入正式 schema owner/migration 方案，并继续遵守 Production Migration Safety Gate。
- 当前仍不做生产物理拆库，不修改默认 `application.yml`，不把 `sql/local/*` 接入生产迁移链路。
