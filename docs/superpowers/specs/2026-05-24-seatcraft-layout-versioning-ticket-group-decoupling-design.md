# SeatCraft 布局版本管理与票档组解耦 P3 设计

## 背景

当前 SeatCraft 的 block、票档组和运行数据耦合较紧：`seat_block.ticket_group_key` 直接绑定 block 到票档组，`ticket_group.source_block_ids` 又反向保存 block 列表。`SeatCraftBlockLayoutService.replaceLayout()` 直接替换 owner 下的 active block、override、ticket group，保存布局会立即影响 materialized 运行数据，缺少 draft / publish / rollback 边界。

P3 采用“兼容式完整方案”：新增版本表和显式 binding 表作为长期权威模型，同时继续 materialize 到现有 `seat_block`、`seat_override`、`ticket_group`，让现有场次座位生成、库存、订单链路继续工作。

## 目标

- 新增 SeatCraft layout version，支持 `draft`、`published`、`archived`。
- 编辑默认写入 draft，不直接改 published 运行数据。
- 发布 draft 时 materialize 到现有运行表。
- 新增 block-ticket-group binding，作为设计器内权威绑定关系。
- 将 `seat_block.ticket_group_key` 和 `ticket_group.source_block_ids` 定义为兼容 materialized 字段。
- 支持回滚到历史版本。
- 所有改动保持在 `java-ticket` 服务边界内。

## 非目标

- P3 不删除旧字段 `seat_block.ticket_group_key`、`ticket_group.source_block_ids`。
- P3 不支持一个 block 同时绑定多个售卖票档；binding 先固定一对一 `primary`。
- 不改订单、支付、用户服务接口。
- 不引入 MQ、outbox、CDC 或异步发布。
- 不改变 C 端下单、锁座、支付状态机。

## 数据模型

### `seat_layout_version`

版本主表，字段包括：

- `id`
- `owner_type`
- `owner_id`
- `version_no`
- `version_status`: `draft | published | archived`
- `name`
- `template_type`
- `stage_title`
- `stage_x`
- `stage_y`
- `canvas_width`
- `canvas_height`
- `base_version_id`
- `published_at`
- `published_by`
- `create_time`
- `update_time`

约束：

- `owner_type IN ('venue', 'venue_application', 'station', 'activity', 'session')`
- `UNIQUE(owner_type, owner_id, version_no)`
- 每个 owner 最多一个 draft。
- 每个 owner 最多一个 current published。旧 published 在新发布或回滚时转为 `archived`。

### `seat_layout_version_block`

版本内 block 快照。字段对应当前 `seat_block`，但父级是 `version_id`，不保存 `ticket_group_key`。

关键字段：

- `version_id`
- `block_key`
- `name`
- `block_type`
- `x/y/rotation/scale`
- `rows/cols/seats_per_row`
- `row_spacing/seat_spacing`
- `inner_radius/arc_start_angle/arc_end_angle`
- `width/height/capacity`
- `polygon_points JSONB`
- `color`
- `sort`
- `status`

约束：`UNIQUE(version_id, block_key)`。

### `seat_layout_version_override`

版本内座位 override 快照。字段对应当前 `seat_override`，父级是 `version_block_id`。

关键字段：`version_block_id`、`row_no`、`seat_no`、`status`、`dx`、`dy`、`custom_label`。

约束：`UNIQUE(version_block_id, row_no, seat_no)`。

### `seat_layout_version_ticket_group`

版本内票档组快照。字段对应当前 `ticket_group`，但不保存 `source_block_ids` 作为权威字段。

关键字段：`version_id`、`group_key`、`name`、`default_price`、`activity_price`、`sort`、`status`。

约束：`UNIQUE(version_id, group_key)`。

### `seat_layout_version_group_binding`

版本内 block 与票档组绑定关系。

字段：

- `version_id`
- `block_key`
- `group_key`
- `binding_role DEFAULT 'primary'`
- `sort`

约束：

- `UNIQUE(version_id, block_key, binding_role)`。
- `binding_role IN ('primary')`。

P3 只支持每个可售 block 一个 primary group。后续可扩展同一 block 多票档或多角色绑定。

## 兼容字段策略

draft 和 published version 的权威绑定关系来自 `seat_layout_version_group_binding`。发布时将 binding materialize 到：

- `seat_block.ticket_group_key`
- `ticket_group.source_block_ids`

运行态服务短期仍读取 materialized active 表。这样 `SessionBlockTicketStockService.generateForSession()` 可以继续按 `seat_block.ticket_group_key` 生成 `TicketType` 和 `SessionSeat`，降低 P3 对售卖链路的冲击。

## API 设计

保留现有读取/保存接口兼容，同时新增版本化接口。

### 读取 draft

```text
GET /api/ticket/admin/seatcraft/{ownerType}/{ownerId}/draft
```

行为：存在 draft 则返回 draft；没有 draft 但有 published，则克隆 published 为 draft 后返回；都没有则返回空。

### 保存 draft

```text
PUT /api/ticket/admin/seatcraft/{ownerType}/{ownerId}/draft
```

行为：只写版本表，不更新 materialized active 表。

### 发布 draft

```text
POST /api/ticket/admin/seatcraft/{ownerType}/{ownerId}/publish
```

行为：校验 draft，归档当前 published，将 draft 标记为 published，并同步 materialize 到现有运行表。

### 回滚版本

```text
POST /api/ticket/admin/seatcraft/{ownerType}/{ownerId}/versions/{versionId}/rollback
```

行为：从历史版本克隆新 draft 或直接发布为 current published。P3 采用“克隆为 draft 后发布”的安全路径，避免误操作直接覆盖运行数据。

### 版本列表

```text
GET /api/ticket/admin/seatcraft/{ownerType}/{ownerId}/versions
```

返回 draft、current published、archived 版本摘要。

## 前端数据模型

`SeatCraftLayoutDraft` 增加：

```ts
bindings?: Array<{
  blockKey: string
  groupKey: string
  bindingRole?: 'primary'
  sort?: number
}>
versionId?: number | null
versionNo?: number | null
versionStatus?: 'draft' | 'published' | 'archived' | null
```

短期兼容：

- 读取旧 payload 时，如果没有 `bindings`，由 `block.ticketGroupKey` 或 `ticketGroup.sourceBlockKeys` 生成 bindings。
- 保存新 draft 时，以 `bindings` 为权威。
- `block.ticketGroupKey` 和 `ticketGroup.sourceBlockKeys` 仍可在前端 payload 中保留，用于兼容旧页面和旧接口，但不作为设计器内唯一事实来源。

## 发布校验

发布前必须校验：

- 至少一个 active block。
- 至少一个 active ticket group。
- 每个非 `standingBlock` / 可售 block 必须有一个 primary group。
- 每个 active group 至少绑定一个 block。
- binding 中的 `blockKey` 和 `groupKey` 都存在于当前 draft。
- `polygonBlock` 必须有合法 `polygonPoints`。
- 票档价格不能为空时按现有规则默认 0，不允许产生 null 导致保存失败。

## Materialize 流程

发布在同一事务内完成：

1. 锁定 owner 的 layout version 行，避免并发发布。
2. 将当前 published 标记为 archived。
3. 将目标 draft 标记为 published，写入 `published_at/published_by`。
4. 禁用 owner 下现有 materialized `seat_block`、`ticket_group`，删除旧 materialized overrides。
5. 将 version blocks upsert 到 `seat_block`。
6. 将 version overrides 写入 `seat_override`。
7. 将 version ticket groups upsert 到 `ticket_group`。
8. 根据 bindings 填充 `seat_block.ticket_group_key` 与 `ticket_group.source_block_ids`。

如果任何步骤失败，事务回滚，published 运行态保持不变。

## 权限与服务边界

- API 仍在 `java-ticket` 的 admin controller 内。
- 权限沿用现有 SeatCraft 管理权限：organizer 只能操作自己的 venue/activity/session，admin 可操作全部。
- 不新增跨服务 Mapper、Entity、XML mapper 或跨库 join。
- 其它服务继续通过已有 ticket internal API 间接受影响。

## 迁移策略

P3 迁移分两步：

1. 新增版本表和 binding 表，不触碰旧表字段。
2. Backfill：为每个 owner 当前 active materialized layout 创建一个 `published` version，并从 `seat_block.ticket_group_key` / `ticket_group.source_block_ids` 推导 bindings。

Backfill 原则：

- 同一 block 以 `seat_block.ticket_group_key` 为主。
- 若 block 缺失 `ticket_group_key`，再从 `ticket_group.source_block_ids` 反推。
- 推导冲突时记录但不自动发布，避免错误绑定进入运行态。

## 测试策略

后端：

- draft 保存不更新 materialized 表。
- publish 会更新 materialized 表和兼容字段。
- rollback 克隆历史版本为 draft。
- binding 校验覆盖缺 block、缺 group、block 未绑定、group 未绑定。
- materialize 失败事务回滚。
- `SessionBlockTicketStockService` 仍可基于 materialized 表生成票种和座位。

前端：

- `toSeatCraftLayoutDraft()` 能从旧字段推导 bindings。
- `toSeatCraftLayoutPayload()` 以 bindings 为权威并保留兼容字段。
- 票档组面板可以独立维护 group 与 block binding。
- typecheck 通过。

边界：

- 运行 `scripts/verify-microservice-boundaries.ps1`。
- 运行 `scripts/check-production-split-sql.ps1`。

## 验收标准

- 新建或编辑 SeatCraft 布局时默认保存 draft，不影响 current published materialized 数据。
- 发布 draft 后，C 端和场次座位生成读取到新布局。
- 未发布 draft 不影响下单和库存。
- 票档组与 block 的权威关系来自 bindings，不再依赖双向字段互相推断。
- 旧 materialized 字段仍被同步，现有生成逻辑继续可用。
- 可以从历史版本回滚并重新发布。
- 微服务边界检查通过。

## 风险

- 短期双写会增加一致性风险，必须把双写限制在 publish/materialize 事务内。
- Backfill 可能遇到旧数据中 block 与 group 双向字段不一致，需要保守处理。
- 版本表会增加数据量，但每个 layout 的 block/group 数量可控。
- 后续 P4 应考虑让运行态直接读取 published version 或发布快照，逐步减少对兼容字段的依赖。
