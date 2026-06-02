# 生产物理数据库拆分设计

## 目标

将 Omni 从已通过本地 `local-schema` 验证的服务级 schema isolation，推进到生产拓扑中的五个独立 PostgreSQL 实例。每个业务服务只连接自己拥有的数据库，跨服务业务协作继续通过 internal API 完成。

本设计只定义生产物理拆库方案，不执行迁移，不复用 `sql/local/*`，不引入 MQ、outbox、CDC 或在线双写。

## 已批准方向

采用一次性停机拆库方案：

- 五个业务服务对应五个独立 PostgreSQL 实例。
- 停机窗口内完成备份、导出、导入、配置切换和验收。
- 目标数据库不重建 cross-owner FK。
- same-owner FK 在目标服务数据库内保留。
- 验收失败时回滚到原共享库拓扑。

本设计已获得用户批准作为后续实施计划的输入，但批准设计不等于允许立即实施生产拆库。实施前仍需单独产出实施计划并再次确认。

## 目标拓扑

| 服务 | PostgreSQL 实例 | 数据库 | 数据归属 |
|:---|:---|:---|:---|
| `java-user` | `pg-user` | `omni_user` | 用户、认证、主办方申请 |
| `java-ticket` | `pg-ticket` | `omni_ticket` | 活动、场馆、场次、票档、座位、库存 |
| `java-order` | `pg-order` | `omni_order` | 订单、订单座位、订单快照 |
| `java-payment` | `pg-payment` | `omni_payment` | 支付、退款 |
| `java-notification` | `pg-notification` | `omni_notification` | 通知 |

`java-gateway` 不拥有业务数据库，也不直接连接上述数据库。

## 服务通信

数据库拆分后，运行时跨服务业务协作保持现有同步 internal API 模式：

- `java-ticket` 调用 `java-user` internal API 校验用户角色和状态。
- `java-order` 调用 `java-user` internal API 校验下单用户。
- `java-order` 调用 `java-ticket` internal API 完成报价、库存、座位锁定、确认售出和释放。
- `java-payment` 调用 `java-order` internal API 获取订单和更新订单状态。
- `java-payment` 调用 `java-user` internal API 校验退款审核人角色。
- `java-payment` 调用 `java-ticket` internal API 校验主办方退款审核权限。
- `java-notification` 只保存 copied id，不直接访问 user/order/ticket 数据库。

所有新增或已有 internal endpoint 必须继续要求 `X-Internal-Token`。

## 表归属

### `java-user` / `omni_user`

- `user`
- `user_auth`
- `sms_code`
- `organizer_application`

### `java-ticket` / `omni_ticket`

- `category`
- `artist`
- `tour`
- `station`
- `activity`
- `venue`
- `venue_application`
- `session`
- `ticket_type`
- `ticket_type_area`
- `session_seat`
- `venue_area`
- `venue_seat`
- `reservation`
- `seat`
- `stock_log`
- `venue_seat_layout_template`
- `venue_seat_layout_template_section`
- `venue_default_layout`
- `venue_default_layout_section`
- `activity_seat_layout`
- `activity_seat_layout_section`
- `session_seat_layout`
- `session_seat_layout_section`
- `seat_block`
- `seat_override`
- `ticket_group`
- `layout_section`

### `java-order` / `omni_order`

- `order`
- `order_seat`
- `order_snapshot`

### `java-payment` / `omni_payment`

- `payment`
- `refund_request`

### `java-notification` / `omni_notification`

- `notification`

## 外键策略

目标数据库中不创建 cross-owner FK。跨服务引用列保留为 copied id 或业务引用，由 internal API 在运行时校验。

不保留的典型 cross-owner FK：

- `venue_application.applicant_id -> user.id`
- `venue_application.reviewer_id -> user.id`
- `activity.organizer_id -> user.id`
- `order.user_id -> user.id`
- `order.session_id -> session.id`
- `order.ticket_type_id -> ticket_type.id`
- `order_seat.session_seat_id -> session_seat.id`
- `session_seat.order_id -> order.id`
- `payment.order_id -> order.id`
- `refund_request.order_id -> order.id`
- `refund_request.user_id -> user.id`
- `refund_request.reviewer_id -> user.id`
- `notification.user_id -> user.id`
- `notification.order_id -> order.id`
- `stock_log.order_id -> order.id`

same-owner FK 可以在目标库内保留，例如：

- `user_auth -> user`
- `organizer_application -> user`
- `session -> activity / venue`
- `ticket_type -> session`
- `session_seat -> session / ticket_type / venue / venue_area / venue_seat`
- `order_seat -> order`
- `order_snapshot -> order`
- `refund_request.payment_id -> payment`

`review`、`moment` 等已移除功能的遗留表不得重新进入运行时路径。如果源数据库中仍存在这些表，实施计划必须明确排除它们，或把它们归入单独的清理/归档步骤。

## 迁移策略

第一版生产物理拆库使用受控停机窗口。

1. 公告维护窗口，并冻结前端、网关和后端任务的写入入口。
2. 停止前端和后端服务，或先阻断外部流量再停止服务。
3. 对当前共享生产数据库创建完整备份。
4. 在非生产环境验证备份可恢复。
5. 准备五个 PostgreSQL 实例，并创建目标数据库。
6. 使用生产拆库迁移脚本创建目标 schema 和表。
7. 按服务归属从共享数据库导出各服务拥有的表数据。
8. 将每个服务的数据导入对应目标数据库。
9. 在目标数据库中重建索引、sequence、same-owner FK 和 same-owner 约束。
10. 执行导入后的行数和 sequence 检查。
11. 将服务 datasource 配置切换到新实例。
12. 启动服务并运行迁移后验收。
13. 只有验收通过后才重新开放流量。

第一次迁移期间，源共享数据库不得执行破坏性结构变更。这样可以保持回滚路径简单、可验证。

## 配置策略

不要直接把默认 `application.yml` 改写为拆库配置。生产拆库应通过环境级配置启用。

每个服务优先使用以下运行时环境变量：

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `OMNI_INTERNAL_TOKEN`

如果需要文件化配置，可以为每个服务新增专用 `prod-split` profile，例如 `application-prod-split.yml`。切换期间五个业务服务必须使用同一种部署模式，不允许混用：任何服务都不能在其他服务已迁到拆分数据库后继续写旧共享库。

## 生产 SQL 策略

生产拆库 SQL 必须位于 `sql/local/*` 之外，例如放在 `sql/production-split/`。

生产 SQL 必须按服务归属拆分：

- `sql/production-split/user/`
- `sql/production-split/ticket/`
- `sql/production-split/order/`
- `sql/production-split/payment/`
- `sql/production-split/notification/`

每个生产迁移文件顶部必须包含 owner 注释。生产脚本不得引用 `sql/local/20260520_drop_cross_owner_fks_local_only.sql` 或 `sql/local/20260520_move_tables_to_service_schemas_local_only.sql`。

## 验证

### 迁移前

从仓库根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-local-schema-profiles.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-local-schema-sql.ps1
```

至少在 staging 环境预演一次完整流程，覆盖五个独立 PostgreSQL 实例上的导出、导入、启动和冒烟测试。

### 导入后

- 对比每张迁移表的行数。
- 确认每张表的 sequence 当前值大于或等于该表主键最大值。
- 确认每个目标数据库内的 same-owner FK 和索引存在。
- 确认目标数据库中不存在 cross-owner FK。
- 确认每个服务账号不能连接其他服务数据库。

### 运行时冒烟测试

- 用户登录成功。
- 活动列表和详情成功。
- 场次和票档选择成功。
- 订单创建成功。
- 支付二维码或页面支付创建成功。
- 支付同步可将订单标记为已支付。
- 订单详情和订单列表成功。
- 通知发送和通知列表成功。
- 管理端活动管理可加载。
- 管理端场次管理可加载。
- 管理端订单查看可加载。

## 回滚策略

重新开放流量前的回滚路径如下：

1. 停止已连接拆分数据库的服务。
2. 恢复旧 datasource 配置。
3. 让服务重新连接原共享数据库并启动。
4. 验证登录、票务浏览、订单列表和管理端。

重新开放流量后的回滚不能自动完成，因为拆分数据库中可能已经产生新写入。第一版迁移应通过“验收完成后才开放流量”来避免这个问题。如果开放流量后仍必须回滚，团队需要把拆分数据库中的新增写入人工对账回共享库，或选择前滚修复。

## 风险与缓解措施

| 风险 | 缓解措施 |
|:---|:---|
| 目标库缺表或 sequence 异常 | staging 预演，并执行行数和 sequence 检查 |
| 服务误连旧共享库 | 开放流量前执行 datasource 审计和运行时连接检查 |
| 目标库误建 cross-owner FK | 生产 SQL 静态审查，并在导入后检查 FK |
| 运行时路径仍依赖跨服务数据库访问 | 执行 `scripts/check-service-boundaries.ps1` 和完整冒烟测试 |
| 验证未完成就开放流量 | 重新开放流量前要求明确的 cutover checklist 批准 |
| 拆分库产生新写入后需要回滚 | 优先在开放流量前回滚；开放后只能人工对账或前滚修复 |

## 不在范围内

- 在线双写迁移。
- 基于 CDC 的复制迁移。
- 引入 MQ 或 outbox。
- 蓝绿数据库切换。
- 重新引入跨服务 Mapper、Entity、XML mapper、SQL join 或数据库 FK。
- 在 staging 或 production 使用 `sql/local/*`。
- 清理已移除功能的遗留表，除非另有独立清理设计并获批。

## 实施计划进入条件

只有在本设计完成 review 并再次确认后，才能进入实施计划。第一版实施计划应产出生产拆库 SQL、datasource profile 或部署配置、预演脚本、验证脚本和操作员 cutover checklist。
