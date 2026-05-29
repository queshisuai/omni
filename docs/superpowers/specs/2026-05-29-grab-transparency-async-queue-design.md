# 抢票透明度层与真实异步排队设计

## 背景

当前 `grab-service` 已经具备抢票准入、Redis 库存 fail-closed、幂等复用、请求状态查询、取消和超时补偿能力。现有链路仍偏同步：用户提交 `POST /api/grab/requests` 后，服务会立即进行 Redis 准入并调用订单 internal API 创建订单。这个模型可以保证第一版正确性，但无法稳定展示“排队位置、正在尝试哪个票档、自动降级过程、库存快照和最终结果”。

本设计新增一层“抢票透明度层”：它不暴露数据库真实锁竞争，也不承诺库存数字绝对实时，而是把抢票请求状态机、队列位置、库存快照和降级尝试过程稳定呈现给用户。用户提交后只入队并获得稳定 `requestId`，前端通过轮询查询进度；后台 worker 从队列消费请求并按授权尝试票档。

## 目标

1. 用户提交抢票后立即获得稳定 `requestId`、`queueSeq` 和初始排队状态。
2. 刷新页面后可通过 `requestId` 恢复进度，不重新排队。
3. 后台 worker 按 Redis 队列真实异步处理请求，队列序号单调递增，已处理数量持续推进。
4. 前端可展示排队位置、当前处理阶段、票档尝试列表、可见库存提示和最终结果。
5. 支持同一场次内按用户授权进行多票档自动降级。
6. 自动降级成功的订单明确保存并展示实际匹配票档。
7. 库存展示只作为可见快照，最终仍以锁票和订单创建结果为准，不能导致超卖。
8. 请求不会永久卡住；超时、worker 异常或订单创建失败后进入 `FAILED` 或 `EXPIRED`。

## 非目标

1. 不引入 SSE 或 WebSocket；第一版使用 1 秒轮询。
2. 不做复杂 ETA 精准预测，只做保守估算或返回空值。
3. 不做跨日期、跨城市、跨场馆、跨活动的替代方案。
4. 不做个性化库存预测或全站大屏。
5. 不把订单、支付、退款逻辑迁入 `grab-service`。
6. 不让 `grab-service` 直接访问 ticket/order/user 数据库。
7. 不支持显式选座请求自动降级；用户选中的座位只属于当前票档授权。

## 总体方案

选择真实异步排队方案：

1. `POST /api/grab/requests` 只做校验、幂等复用、创建请求、分配排队序号并入队。
2. `GET /api/grab/requests/{requestId}/progress` 返回当前请求的展示状态。
3. `GrabWorkerService` 在 `grab-service` 进程内消费 Redis 队列，按请求状态机推进。
4. `GET /api/grab/sessions/{sessionId}/stock-visible` 返回可见库存快照。
5. 前端提交后进入抢票进度弹层，每 1 秒轮询 progress，终态后停止。

第一版 worker 与 `grab-service` 同进程部署，不新增 MQ，也不拆独立 worker 服务。Redis list 负责排队，PostgreSQL `grab_request` 负责可恢复状态和审计。

## 数据模型

沿用 `omni_grab.grab_request`，扩展字段而不是新建 `grab_progress` 表。原因是当前请求表已经是抢票请求事实源，第一版保持单表可降低恢复和幂等复杂度。

新增字段：

```text
request_type varchar(32) not null default 'NORMAL_GRAB'
queue_seq bigint
requested_ticket_types jsonb not null default '[]'::jsonb
allow_auto_downgrade boolean not null default false
current_ticket_type_id bigint
current_attempt_index integer not null default 0
matched_ticket_type_id bigint
progress_status varchar(32) not null default 'QUEUED'
progress_message varchar(512)
attempts_snapshot jsonb not null default '[]'::jsonb
processing_started_at timestamptz
completed_at timestamptz
worker_claimed_at timestamptz
worker_id varchar(128)
```

`requested_ticket_types` 保存用户授权的同场次票档偏好：

```json
[
  { "ticketTypeId": 1, "name": "A档", "maxPrice": 1280 },
  { "ticketTypeId": 2, "name": "B档", "maxPrice": 980 }
]
```

`attempts_snapshot` 保存展示用尝试过程：

```json
[
  { "ticketTypeId": 1, "name": "A档", "status": "SOLD_OUT", "message": "A档已售罄" },
  { "ticketTypeId": 2, "name": "B档", "status": "TRYING", "message": "正在尝试B档" }
]
```

状态约束新增：

```text
QUEUED
WAITING
TRYING_TICKET_TYPE
LOCKING
ORDER_CREATING
ORDER_CREATED
SOLD_OUT
DOWNGRADING
FAILED
LIMITED
EXPIRED
```

兼容现有字段：

- 现有 `status` 保留，用于老接口和内部生命周期兼容。
- 对外 progress 使用 `progress_status`。
- `ORDER_CREATED` 时 `order_id` 和 `matched_ticket_type_id` 必须同时写入。
- 旧的 `ticket_type_id` 表示用户提交的第一优先级票档；实际成交以 `matched_ticket_type_id` 为准。

## Redis 队列与进度

使用以下 key：

```text
grab:queue:{sessionId}
grab:queue:seq:{sessionId}
grab:queue:processed:{sessionId}
grab:queue:inflight:{sessionId}
grab:active-sessions
grab:req:{requestId}
grab:stock:{sessionId}:{ticketTypeId}
grab:idempotency:{userId}:{idempotencyKey}
grab:user-hold:{userId}:{sessionId}:{ticketTypeId}
grab:seat-hold:{seatId}
```

入队流程：

```text
queueSeq = INCR grab:queue:seq:{sessionId}
LPUSH or RPUSH grab:queue:{sessionId} requestId
SADD grab:active-sessions sessionId
HSET grab:req:{requestId} queueSeq/sessionId/userId/status
```

队列方向固定为 `RPUSH` 入队、`LPOP` 出队，保证 FIFO。

排队位置展示：

```text
queueRank = max(queueSeq - processedSeq - 1, 0)
```

这里的 `queueRank` 表示“当前请求队列前方数量”，不是全站真实人数。worker 每完成一个请求，无论成功、售罄、限购还是失败，都推进 `grab:queue:processed:{sessionId}` 到已处理请求的 `queueSeq`。如果请求被跳过或恢复处理，也要保证 processed 不倒退。

## 提交接口

接口保持：

```text
POST /api/grab/requests
```

兼容旧请求：

```json
{
  "sessionId": 101,
  "ticketTypeId": 1,
  "quantity": 2,
  "seatIds": [],
  "allocateRandom": true,
  "idempotencyKey": "xxx"
}
```

新增多票档请求：

```json
{
  "sessionId": 101,
  "quantity": 2,
  "ticketTypePreferences": [
    { "ticketTypeId": 1, "name": "A档", "maxPrice": 1280 },
    { "ticketTypeId": 2, "name": "B档", "maxPrice": 980 }
  ],
  "allowAutoDowngrade": true,
  "idempotencyKey": "xxx"
}
```

提交校验：

- `sessionId`、`quantity`、`idempotencyKey` 必填且合法。
- `ticketTypePreferences` 为空时，用旧字段 `ticketTypeId` 构造单票档偏好。
- 多票档必须属于同一 `sessionId`，由 ticket internal API 校验。
- `allowAutoDowngrade=false` 时只允许一个有效尝试票档。
- 显式 `seatIds` 请求只允许单票档，不允许自动降级。
- 不允许自动升价；每个偏好必须带 `maxPrice`，旧单票档请求的 `maxPrice` 可由当前票档价或前端传入值生成。

提交响应：

```json
{
  "requestId": "GRAB...",
  "status": "QUEUED",
  "queueSeq": 1234,
  "queueRank": 1233,
  "estimatedWaitSeconds": null,
  "message": "你前面还有 1233 人"
}
```

## 进度接口

新增：

```text
GET /api/grab/requests/{requestId}/progress
```

响应：

```json
{
  "requestId": "GRAB...",
  "sessionId": 101,
  "status": "WAITING",
  "queueSeq": 1234,
  "queueRank": 234,
  "estimatedWaitSeconds": 62,
  "currentTicketTypeId": 2,
  "currentAttemptIndex": 1,
  "requestedTicketTypes": [
    { "ticketTypeId": 1, "name": "A档", "maxPrice": 1280 },
    { "ticketTypeId": 2, "name": "B档", "maxPrice": 980 }
  ],
  "attempts": [
    { "ticketTypeId": 1, "name": "A档", "status": "SOLD_OUT", "message": "A档已售罄" },
    { "ticketTypeId": 2, "name": "B档", "status": "TRYING", "message": "正在尝试B档" }
  ],
  "visibleStock": {
    "ticketTypeId": 2,
    "visibleStock": 87,
    "level": "AVAILABLE",
    "snapshotTime": "2026-05-29T20:00:00"
  },
  "message": "A档已售罄，正在尝试B档",
  "orderId": null,
  "matchedTicketTypeId": null,
  "updateTime": "2026-05-29T20:00:00"
}
```

权限规则：

- 用户只能查询自己的 `requestId`。
- 不存在返回 404。
- 其他用户请求返回 403。

## Worker 状态机

`GrabWorkerService` 周期性扫描 `grab:active-sessions`，每个 session 按 FIFO 弹出 requestId。第一版可单进程顺序处理；多实例部署时用 Redis claim key 或 DB 条件更新避免重复处理。

处理步骤：

```text
QUEUED
  -> WAITING
  -> TRYING_TICKET_TYPE
  -> LOCKING
  -> ORDER_CREATING
  -> ORDER_CREATED
```

失败分支：

```text
LOCKING 售罄
  -> allowAutoDowngrade 且还有下一档: DOWNGRADING -> TRYING_TICKET_TYPE
  -> 无下一档: SOLD_OUT

LOCKING 限购或座位冲突
  -> LIMITED

ORDER_CREATING 失败
  -> release Redis hold
  -> 价格超授权: FAILED
  -> 限购: LIMITED
  -> 库存/票务售罄: 尝试降级或 SOLD_OUT
  -> 其他错误: FAILED

超时
  -> EXPIRED 或 FAILED
```

worker 必须在每个阶段写入 `progress_status`、`progress_message`、`current_ticket_type_id`、`current_attempt_index` 和 `attempts_snapshot`，确保前端刷新后状态不丢。

超时策略：

- 请求入队后超过 `requestTtlSeconds` 未开始处理，标记 `EXPIRED`。
- worker claim 后超过 `processingTtlSeconds` 未终态，由补偿任务释放 Redis hold 并标记 `FAILED`。
- 已创建订单的请求不释放 Redis hold；后续订单超时释放由 order/ticket 链路负责。

## 自动降级与授权

第一版只支持：

```text
同一场次内，多票档从高优先级到低优先级降级
```

不支持：

```text
跨日期
跨城市
跨场馆
跨活动
显式选座后的自动换档
```

授权规则：

- 用户必须提前勾选“允许自动尝试后续档位”。
- 前端必须展示票档顺序和价格。
- `ticketTypePreferences` 中的顺序就是尝试顺序。
- 不允许自动升价。每个票档 quote 后，订单服务必须校验 `unitPrice <= maxPrice`。
- 订单页必须展示实际票档，即 `matchedTicketTypeId` 对应快照。

订单创建变更：

- grab-service 调用 order internal API 时传入 `authorizedMaxUnitPrice` 和 `grabRequestId`。
- `java-order` quote 后校验授权价格。
- `java-order` 订单快照或扩展字段记录 `grabRequestId`、`requestedTicketTypeId`、`matchedTicketTypeId` 和 `autoDowngraded`。
- 若订单服务无法扩展订单实体字段，第一版优先扩展 `order_snapshot`，因为订单展示已依赖 order-owned 快照。

## 可见库存接口

新增：

```text
GET /api/grab/sessions/{sessionId}/stock-visible
```

响应：

```json
{
  "sessionId": 101,
  "ticketTypes": [
    { "ticketTypeId": 1, "name": "A档", "visibleStock": 0, "level": "SOLD_OUT" },
    { "ticketTypeId": 2, "name": "B档", "visibleStock": 87, "level": "AVAILABLE" }
  ],
  "snapshotTime": "2026-05-29T20:00:00"
}
```

库存来源优先级：

```text
Redis 预占库存 > ticket internal API remainStock 快照 > UNKNOWN
```

`level`：

```text
AVAILABLE
LOW
HOT
SOLD_OUT
UNKNOWN
```

文案要求：

- 使用“约”“库存变化较快，以锁票结果为准”。
- 不写“实时剩余”“保证有票”。
- Redis stock 缺失时返回 `UNKNOWN`，不自动使用 DB 快照作为锁票依据。

## 前端体验

活动详情页确认弹层增加：

- 多票档偏好列表。
- 自动尝试后续低价票档 checkbox。
- 顺序和价格授权说明。
- 显式选座时隐藏自动降级选项。

提交后展示抢票进度弹层：

```text
1. 当前状态：排队中 / 正在锁票 / 已生成订单
2. 排队信息：你前面还有 N 人
3. 档位尝试列表：A档 已售罄、B档 尝试中、C档 待尝试
4. 库存提示：当前档位剩余约 N 张，库存变化较快，以锁票结果为准
```

按钮：

- `取消抢票`：仅在未创建订单前可用。
- `查看订单`：`ORDER_CREATED` 后可用。
- `加入候补`：失败后展示。若现有 `reservation` 语义确认等价候补，则接入；否则第一版只保留入口并提示当前场次可关注。

轮询：

- 抢票中每 1 秒请求一次 progress。
- `ORDER_CREATED`、`SOLD_OUT`、`LIMITED`、`FAILED`、`EXPIRED` 后停止。
- 前端保存最近 `requestId`，刷新后优先恢复未终态请求。

## 测试策略

### grab-service

1. submit 只入队，不立即调用 order-client。
2. 同一 `idempotencyKey` 返回同一 `requestId` 和 `queueSeq`。
3. 同一活跃抢票意图复用已有请求，不重新排队。
4. queue seq 单调递增。
5. progress 接口只允许本人查询。
6. worker 成功处理单票档请求并创建订单。
7. A 档售罄且授权降级时尝试 B 档，B 档成功后写 `matchedTicketTypeId`。
8. 未授权降级时 A 档售罄直接 `SOLD_OUT`。
9. 显式选座请求携带多票档偏好时拒绝。
10. worker 订单创建失败会释放 Redis hold。
11. 超时补偿将非终态请求标记 `FAILED` 或 `EXPIRED`。
12. stock-visible 在 Redis stock 存在、缺失和 DB 快照可用时返回正确 level。

### java-order

1. internal create 支持授权价格字段。
2. quote 单价高于授权价时拒绝创建订单。
3. 自动降级成功时订单快照记录实际票档。
4. 普通下单、选座下单、支付确认、退款链路保持现有行为。

### frontend

1. 提交后展示 `requestId` 和排队信息。
2. 轮询终态后停止。
3. 刷新页面后恢复未终态请求。
4. 自动降级授权 checkbox 会影响提交 payload。
5. 显式选座时不展示自动降级。
6. 降级成功订单展示实际票档。

### 集成与并发

1. 多人并发提交时 `queueSeq` 单调递增。
2. worker 持续推进 `processedSeq`。
3. 1000 并发抢 100 张时，订单创建数不超过 100。
4. Redis stock 不出现负数。
5. 服务重启后，DB 中未终态请求可被补偿或重新入队处理。

## 风险与缓解

- 风险：单进程 worker 重启会中断处理。缓解：DB 记录 worker claim 和超时补偿，启动时扫描未终态请求恢复。
- 风险：Redis 队列和 DB 状态不一致。缓解：submit 先写 DB 再入队；worker 找不到 DB 记录时丢弃队列项；补偿任务扫描 DB 兜底。
- 风险：库存快照被用户理解为实时承诺。缓解：接口和前端文案统一使用“约”和“以锁票结果为准”。
- 风险：自动降级创建更高价订单。缓解：前后端都传 `maxPrice`，订单服务 quote 后强校验。
- 风险：显式选座自动换档导致授权不清。缓解：第一版禁止选座请求自动降级。
- 风险：worker 多实例重复消费。缓解：第一版可按单实例运行；多实例时必须用 Redis claim 或 DB 条件更新保障单请求只处理一次。

## 验收标准

1. 用户提交抢票后能看到稳定的 `requestId`、`queueSeq` 和排队位置。
2. 刷新页面后进度不丢失。
3. A 档售罄时，系统能按授权自动尝试 B 档。
4. 自动降级成功的订单明确显示实际票档。
5. 库存显示不会导致超卖，最终仍以锁票结果为准。
6. 进度状态不会卡死，超时后变 `FAILED` 或 `EXPIRED`。
7. 多人并发时，排队序号单调递增，已处理数量持续推进。
8. 不新增跨服务数据库访问，不破坏现有 order/ticket/payment 边界。

## 实施顺序

1. 扩展 `grab_request` migration、类型和 repository。
2. 将 `POST /api/grab/requests` 改为只入队并返回排队信息。
3. 新增 progress 查询接口。
4. 实现 `GrabWorkerService` 队列消费和状态推进。
5. 支持 `ticketTypePreferences`、降级授权和按票档顺序尝试。
6. 新增可见库存接口。
7. 扩展 order internal create 的价格授权与订单快照字段。
8. 前端活动页展示授权、进度、库存和降级过程。
9. 失败后接入或预留“加入候补”入口。

## 自检

- 设计采用真实异步排队，符合已确认的 A 方案。
- 第一版没有引入 SSE、WebSocket、MQ 或跨场次替代。
- 自动降级仅限同一场次且必须提前授权。
- 库存展示是快照，不参与最终锁票正确性判断。
- `grab-service` 仍不直接访问 ticket/order/user 数据库。
- 订单实际票档由订单侧快照承载，满足订单页展示要求。
