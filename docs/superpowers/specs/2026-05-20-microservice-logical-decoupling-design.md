# Microservice Logical Decoupling Design

## Goal

将当前 Spring Cloud 多服务项目从“共享数据库上的微服务外形”推进到“逻辑边界清晰的微服务”。本阶段不物理拆库，不引入消息队列，不重写业务流程；先消除跨服务 Mapper、跨服务 Join 和跨服务直接写表，让服务之间通过 internal API 与快照协作。

该设计必须保护 beta5 已完成链路：Tour/Station 演出工作台、VenueApplication、SeatCraft 站区化、自动票档库存、发布购买闭环、订单回收站和 B 端订单权限。

## Current Coupling

- `java-ticket` 通过 `UserRefMapper` 直接读取用户表，用于 admin/organizer 权限判断。
- `java-order` 通过 `TicketTypeMapper`、`SessionSeatMapper` 直接读取和更新票务表，包括 `ticket_type`、`session_seat`、`session`、`activity`。
- `java-order` 的订单列表 SQL 直接 Join `session`、`activity`、`venue`、`ticket_type`，历史订单展示依赖票务表实时存在。
- 所有迁移集中在 `sql/*.sql`，尚未体现服务数据所有权。
- 已有部分 internal API，例如 `java-ticket -> java-order` 和 `java-payment -> java-order`，但还没有统一边界规则。

## Target Boundary

### java-user

拥有用户、角色、登录注册、主办方申请与用户状态。其他服务不能直接读用户表，只能调用用户 internal API 获取最小授权信息。

### java-ticket

拥有 Tour、Station、Activity、Venue、VenueApplication、Session、SeatCraft、TicketType、SessionSeat 和库存。其他服务不能直接读写票务表；下单、取消、支付确认、退款恢复涉及库存时必须调用 ticket internal API。

### java-order

拥有 Order、OrderSeat、订单状态、用户侧回收站和订单展示快照。订单服务不直接读取票务表，也不直接读取用户表。订单展示依赖订单快照，不依赖票务实时 Join。

### java-payment

拥有支付单、支付宝交易状态、退款同步和支付状态确认。支付服务只通过订单 internal API 推动订单状态变化，不直接更新订单表。

### java-notification

拥有通知模板、通知记录、短信或站内信发送状态。其他服务通过 API 或后续事件触发通知，不直接写通知表。

### java-gateway

只负责路由、认证入口、跨域和限流，不拥有业务数据。

## Non-Goals

- 本阶段不物理拆库。
- 本阶段不拆 PostgreSQL schema。
- 本阶段不引入 Kafka、RabbitMQ 或 Redis Stream。
- 本阶段不重写前端页面。
- 本阶段不改变 C 端购买交互。
- 本阶段不新增默认 `INTERNAL_API_TOKEN` fallback。
- 本阶段不做无关代码大重构。

## Architecture

采用逻辑解耦优先策略：服务仍连接同一个 PostgreSQL 实例，但代码层禁止跨服务表访问。每个跨服务需求用 internal API 替代，历史展示数据用快照替代实时 Join。

核心调用关系：

```text
frontend -> gateway -> user/ticket/order/payment

ticket -> user internal API       权限与角色校验
order  -> ticket internal API     票价、可售状态、锁库存、锁座、确认售出、释放库存
ticket -> order internal API      B 端按 sessionIds 查询订单
payment -> order internal API     支付成功、退款成功更新订单
order -> payment internal API     取消订单前确认支付状态
```

服务间 DTO 使用独立 request/response，不复用对方 entity。internal API 必须带 `X-Internal-Token`，服务端拒绝空 token 或不匹配 token。

## Data Ownership Rules

- `java-user` 之外禁止使用 `UserMapper` 或 `UserRefMapper` 访问用户数据。
- `java-ticket` 之外禁止使用 `TicketTypeMapper`、`SessionSeatMapper` 访问票务库存数据。
- `java-order` 之外禁止直接写 `order` 和 `order_seat`。
- `java-payment` 之外禁止直接写支付交易表。
- 新 SQL 迁移必须在文件头标注 owner service。
- 订单历史展示字段必须来自订单快照，不从票务表实时 Join。

## Phase A: Boundary Freeze

先增加边界文档和测试约束，不改变业务行为。目标是让后续每个 PR 都有明确判断标准：某个服务是否直接访问了另一个服务的数据。

验收标准：

- 文档列出服务数据所有权和禁止依赖。
- 明确现有豁免点：`UserRefMapper`、订单侧票务 Mapper 和订单列表 Join 将在后续阶段移除。
- 不破坏现有测试。

## Phase B: ticket-user Decoupling

`java-user` 增加用户 internal API，返回权限判断所需的最小信息：`id`、`phone`、`role`、`status`。`java-ticket` 新增 `UserInternalClient`，用该 client 替换 `UserRefMapper`。

主要替换点：

- `AdminController`
- `TourStationService`
- `VenueApplicationService`
- `VenueDefaultLayoutService`
- `ActivitySeatLayoutService`
- `SessionSeatLayoutService`
- `OrderAdminQueryService`

验收标准：

- `java-ticket` 生产代码不再引用 `UserRefMapper`。
- admin/organizer 权限测试仍通过。
- 用户服务 internal API 拒绝无 token 请求。
- `mvn test -pl java-user -am` 通过。
- `mvn test -pl java-ticket -am` 通过。

## Phase C: order-ticket Inventory Decoupling

`java-ticket` 暴露库存 internal API，`java-order` 不再直接读写 `ticket_type` 和 `session_seat`。

建议 internal API：

- `POST /api/ticket/internal/sales/quote`：返回票档价格、票档名、活动名、场次时间、场馆名和可售状态。
- `POST /api/ticket/internal/sales/lock-stock`：锁定无座位票档库存。
- `POST /api/ticket/internal/sales/lock-seats`：锁定指定座位。
- `POST /api/ticket/internal/sales/confirm-sold`：订单支付成功后确认售出。
- `POST /api/ticket/internal/sales/release`：订单取消或锁过期后释放库存或座位。
- `POST /api/ticket/internal/sales/refund`：退款完成后恢复可售或标记不可售。

`java-order` 创建订单时先请求 quote，再锁库存或座位，最后保存订单。订单金额只使用 ticket internal API 返回的后端可信价格。

验收标准：

- `java-order` 生产代码不再注入 `TicketTypeMapper` 和 `SessionSeatMapper`。
- 下单、取消、过期释放、支付确认、退款恢复测试覆盖 internal API 调用。
- `mvn test -pl java-ticket -am` 通过。
- `mvn test -pl java-order -am` 通过。

## Phase D: Order Snapshot

订单服务增加订单展示快照，避免订单列表 Join 票务表。

建议字段可以直接扩展 `order` 表，也可以新增 `order_snapshot` 表。为了小步落地，优先扩展 `order` 表，字段包括：

- `activity_id`
- `activity_name`
- `activity_poster`
- `session_time`
- `venue_name`
- `ticket_name`
- `unit_price`
- `seat_labels`
- `tour_id`
- `station_id`

历史订单迁移可以用一次性 SQL 从当前票务表补齐。新订单创建时由 `quote` 响应填充快照。

验收标准：

- 用户订单列表只查询订单服务自有表。
- 历史订单展示字段可迁移补齐。
- 票务表活动名或票档名后续变化不影响历史订单展示。
- `/orders` 前端不需要结构性改动。

## Phase E: Payment Boundary

支付服务继续通过订单 internal API 更新订单状态。订单取消前继续调用支付 internal API 确认支付状态，避免取消已支付订单。

验收标准：

- `java-payment` 不直接访问订单表。
- 支付成功只通过 `POST /api/order/internal/{id}/paid`。
- 退款成功只通过 `POST /api/order/internal/{id}/refunded`。
- internal token 为空时拒绝跨服务状态更新。

## Phase F: Contract Tests And Guardrails

增加契约测试和轻量规则检查，防止重新引入跨服务表访问。

建议检查项：

- `java-ticket` 生产代码不得引用 `UserRefMapper`。
- `java-order` 生产代码不得引用 `TicketTypeMapper`、`SessionSeatMapper`。
- `OrderMapper` 订单列表方法不得 Join `activity`、`session`、`venue`、`ticket_type`。
- internal controller 必须校验 `X-Internal-Token`。

## Rollout Strategy

推荐顺序：

1. Phase A + Phase B：先移除 `ticket -> user table` 直接依赖，风险最低。
2. Phase C：新增 ticket 库存 internal API，但先保留订单旧路径做测试对照。
3. Phase D：订单快照迁移并切换订单列表查询。
4. Phase E：收敛支付边界。
5. Phase F：加入长期防回退检查。

每个阶段必须可独立编译、测试和回滚。不要在一个阶段同时修改用户权限、库存扣减、支付状态和前端交互。

## Error Handling

- internal API 令牌缺失或不匹配返回 403。
- 用户不存在或状态不可用时，ticket 返回无权限或业务错误。
- quote 或锁库存失败时，order 不创建订单。
- order 创建失败后，如库存已锁定，需要调用 ticket release；如果 release 失败，记录日志并由后续补偿任务处理。
- 支付成功确认售出失败时，订单不能静默成功，必须记录错误并可重试。
- 取消订单前支付状态不确定时，保持当前策略：拒绝取消并提示稍后刷新。

## Testing

每阶段最少验证：

```powershell
mvn test -pl java-user -am
mvn test -pl java-ticket -am
mvn test -pl java-order -am
pnpm run typecheck
```

如果阶段不涉及某个模块，可跳过该模块但需要在结果中说明原因。

关键测试用例：

- organizer 只能管理自己的 Tour/Station/Activity。
- admin 可以管理全部资源。
- ticket 权限判断通过 user internal API 完成。
- order 创建订单只使用 ticket quote 返回的价格。
- 无座位票下单扣减 ticket 库存。
- 选座票下单锁定 ticket 座位。
- 取消待支付订单释放库存或座位。
- 支付成功确认库存或座位售出。
- 订单列表来自订单快照。

## Success Criteria

- 当前 beta5 购买发布闭环保持可用。
- `java-ticket` 不再直接访问用户表。
- `java-order` 不再直接访问票务库存表。
- 用户订单列表不再 Join 票务表。
- 所有跨服务状态变化都有 internal API 和 token 校验。
- 后续可以在不大改业务代码的前提下继续推进 schema 隔离或物理拆库。

## Self Review

- 无占位符或未定事项。
- 范围聚焦逻辑解耦，不包含物理拆库和消息队列。
- 阶段顺序从低风险到高风险，保护现有 beta5 闭环。
- 每个阶段都有明确验收标准和验证命令。
