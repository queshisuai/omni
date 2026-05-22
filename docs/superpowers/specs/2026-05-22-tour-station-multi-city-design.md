# 巡演 IP 与多城市站点设计

## 背景

当前系统已有 `tour`、`station`、`activity.tour_id`、`activity.station_id`、`activity.venue_application_id` 基础能力。后端 `TourStationService.publishStation()` 已能在站点发布时校验场地申请、创建 `activity`、创建 `session`、复制 SeatCraft 并生成真实座位库存。

现有缺口主要在产品流和接口组织：后台仍偏向一次性创建 `Tour + Station + 场地申请` 的线性向导，缺少“先创建 Tour，后续在 Tour 详情里不断新增城市 Station”的完整闭环；C 端 Tour 详情页已有站点切换雏形，但缺少场馆、票价区间、售卖状态等联动信息。

## 已确认决策

采用方案 B：`Tour` 作为 C 端主入口和巡演 IP，`Station` 作为城市站点和审批单元，`Activity` 继续作为每个 Station 的售票承载实体。

后台交互调整为：先创建 Tour，再在 Tour 详情里不断新增 Station。每个 Station 单独绑定新的或已有的 `venue_application_id`，场地申请审核通过后才能发布该站。

巡演不是所有城市同一时间演出。主办方可以先公布本轮 Tour 将会去哪些城市，但除当前已官宣、已排期或已开售的城市外，其他城市站点默认只表达“该城市在巡演计划内”，不展示演出时间、场馆、票价或购买入口。

## 目标

- 让主办方只创建一次巡演 IP，然后持续添加多城市站点。
- 每个城市站点独立提交场地和审核资料，审核通过后才能排期和发布。
- 支持先公开巡演城市清单，但未官宣城市只显示“未公布”。
- C 端以 Tour 页面展示巡演整体信息，通过横向站点标签切换城市站点。
- 复用现有 activity、session、ticket_type、session_seat、order、payment 链路，避免重写售票核心。
- 保持微服务边界不变，order/payment 不直接读取 ticket 内部表。

## 非目标

- 不把 Station 直接升级为订单和库存的主实体。
- 不移除或废弃 activity 售票链路。
- 不引入 MQ、outbox、CDC 或跨服务直连。
- 不恢复已删除的评价/动态系统。
- 不做生产迁移 cutover，只设计本地和代码层改造。

## 数据模型

### Tour

`Tour` 是巡演 IP / 演出项目父实体。

保存稳定信息：

- `title`：巡演标题，例如“伍佰 ROCK STAR 2 巡回演唱会”。
- `artist_id` / 后续多艺人阵容关系：巡演主艺人和阵容。
- `category_id`：演出分类。
- `poster`：Tour 主海报。
- `description`：Tour 统一简介。
- `organizer_id`：主办方。
- `review_status`：Tour 级草稿/审核状态。
- `status`：软删除/有效状态。

### Station

`Station` 是 Tour 下的城市站点，也是场地审批单元。

保存城市差异：

- `tour_id`：所属 Tour。
- `city`：城市。
- `station_name`：站点名，例如“西安站”。
- `poster`：站点可选海报，未填时继承 Tour 海报。
- `description`：站点补充说明，未填时继承 Tour 简介。
- `venue_application_id`：该站场地申请。
- `publish_status`：站点发布状态。
- `status`：软删除/有效状态。

建议将 `publish_status` 语义明确为：

- `draft`：站点草稿。
- `city_announced`：城市已在巡演计划中公开，但演出时间、场馆、票价尚未公布。
- `venue_pending`：已提交场地申请，等待审核。
- `venue_rejected`：场地申请被拒。
- `venue_approved`：场地已通过，等待 SeatCraft、票档或排期。
- `publishing`：发布处理中。
- `published`：已发布，可在 C 端展示为可售或待售。
- `risk_suspended`：风险停票。
- `cancelled`：站点取消。

### Activity

`Activity` 保留为 Station 的售票实例，不再作为后台“每城重新创建完整活动”的入口。

每个 Station 默认最多对应一个主 Activity。Activity 继续承载：

- `tour_id`。
- `station_id`。
- `venue_application_id`。
- activity SeatCraft 快照。
- 票档配置。
- `seat_map_visibility`。
- C 端购买页入口。
- 订单快照中的 activity 信息来源。

Station 发布时：

- 如果该 Station 尚无 Activity，则创建 Activity。
- 如果该 Station 已有 Activity，则复用并更新必要展示字段，避免重复生成多个售票实例。

### Session

`Session` 仍代表具体演出场次。

同一个 Station / Activity 下可以有多个 Session。每个 Session 独立拥有真实 `session_seat` 座位池和库存锁定状态。

### VenueApplication

`VenueApplication` 继续承载场地和审核资料：

- 场馆名称、城市、地址、联系人。
- `valid_from` / `valid_to` 场地使用权有效期。
- `proof_note` / `proof_file_url` 审批资料。
- `layout_snapshot` SeatCraft 设计快照。
- `status` 审核状态。
- `venue_id` 审核通过后绑定的场馆。

Station 必须绑定一个审核通过且拥有 `venue_id` 的 `venue_application_id` 后才能发布。

## 后台流程

### 创建 Tour

入口：`/console/tours/new`

职责只保留 Tour 基本信息：

- 巡演名称。
- 主海报。
- 简介。
- 分类。
- 艺人阵容。

保存后进入 `/console/tours/{tourId}`。

### Tour 详情管理

入口：`/console/tours/{tourId}`

展示：

- Tour 基本信息。
- 站点总数、已发布站点数、待审核站点数。
- Station 列表。

每个 Station 卡片展示：

- 城市和站点名。
- 场地申请状态。
- 场馆名和城市。
- 场次数量。
- 票价区间。
- 库存摘要。
- 发布状态。

操作：

- 新增城市站点。
- 编辑站点资料。
- 提交或查看场地申请。
- 进入 SeatCraft。
- 配置票档。
- 排期。
- 发布站点。
- 停票或恢复申请。

### 新增 Station

入口：`/console/tours/{tourId}/stations/new`

流程：

1. 填写城市和站点名。
2. 可选择“仅公布城市”，此时 Station 进入 `city_announced`，C 端只显示城市未公布。
3. 可选择一个已有已通过场地申请，或提交新的场地申请。
4. 如果选择已有已通过场地申请，Station 可进入 `venue_approved`。
5. 如果提交新的场地申请，Station 进入 `venue_pending`。
6. 新申请审核通过后，Station 进入 `venue_approved`。

### 发布 Station

发布前置条件：

- Station 有效且属于当前 Tour。
- 当前用户是 admin 或 Tour 所属 organizer。
- Station 绑定的 `venue_application_id` 存在。
- 场地申请审核通过，且 `venue_id` 不为空。
- 场次时间在 `valid_from` / `valid_to` 内。
- 同一场馆时间段没有冲突场次。
- SeatCraft 和票档已配置完整。
- 真实座位库存可以生成或已存在。

发布动作：

1. Station 进入 `publishing`。
2. 创建或复用该 Station 的 Activity。
3. 从场地申请复制 SeatCraft 到 Activity。
4. 创建或追加 Session。
5. 从 Activity 复制 SeatCraft 到 Session。
6. 生成真实 `session_seat`。
7. 重算票档库存。
8. Station 进入 `published`。
9. Activity 进入 `published`。

## C 端流程

入口：`/tour/{tourId}`

Tour 页面展示：

- Tour 主海报。
- Tour 标题。
- Tour 简介。
- 艺人阵容。
- 横向滚动 Station 标签。

Station 标签展示：

- 城市。
- 站点名。
- 简短状态，例如“未公布”“即将开抢”“售票中”“已售罄”。

点击 Station 后联动展示：

- 城市。
- 场馆名；未官宣城市不展示。
- 场馆地址；未官宣城市不展示。
- 演出日期和时间；未官宣城市不展示。
- 票价区间；未官宣城市不展示。
- 售卖状态。
- 操作按钮。

操作按钮规则：

- 可售：跳转 `/activity/{activityId}`。
- 城市已公布但时间未公布：显示“时间未公布”。
- 未开售：显示“即将开抢”。
- 无可售场次：显示“待定”。
- 风险停票：显示“暂时停止售票”。
- 已取消：显示“已取消”。

购买页仍复用 `/activity/{activityId}`，不重写订单/支付链路。

## 接口设计

### 后台接口

保留：

- `POST /api/ticket/admin/tours/draft`
- `GET /api/ticket/admin/tours`
- `POST /api/ticket/admin/tours/{tourId}/stations/draft`
- `POST /api/ticket/admin/stations/{stationId}/publish`

建议新增：

- `GET /api/ticket/admin/tours/{tourId}`
  - 返回后台 Tour 详情。
  - 包含 Tour、Stations、VenueApplication 状态、Activity、Sessions、票价区间、库存摘要。

- `PUT /api/ticket/admin/tours/{tourId}`
  - 编辑 Tour 基本信息。

- `PUT /api/ticket/admin/stations/{stationId}`
  - 编辑 Station 基本信息。

- `POST /api/ticket/admin/stations/{stationId}/venue-application`
  - 给已有 Station 绑定新场地申请或已有场地申请。

- `POST /api/ticket/admin/stations/{stationId}/sessions`
  - 给已通过场地申请的 Station 追加场次。

### C 端接口

增强：

- `GET /api/ticket/tours/{id}`

返回结构建议：

```json
{
  "tour": {},
  "stations": [],
  "stationDetails": [
    {
      "station": {},
      "activity": {},
      "sessions": [],
      "venueName": "",
      "venueAddress": "",
      "priceMin": 280,
      "priceMax": 980,
      "saleStatus": "on_sale",
      "saleStatusText": "售票中",
      "primaryAction": "buy"
    }
  ]
}
```

## 售卖状态计算

建议 C 端接口由后端返回站点聚合状态，前端只展示。

状态规则：

- Station 非 `published`：`coming_soon` / `即将公布`。
- Station `city_announced`：`unannounced` / `未公布`，不返回场馆、时间、票价和购买入口。
- Station `risk_suspended`：`suspended` / `暂时停止售票`。
- Activity 不存在：`coming_soon` / `即将公布`。
- 无有效 Session：`to_be_scheduled` / `待定`。
- 有 Session 但无可售票档：`coming_soon` / `即将开抢`。
- 所有可售票档库存为 0：`sold_out` / `已售罄`。
- 有可售票档且库存大于 0：`on_sale` / `售票中`。

## 测试策略

后端测试：

- 创建 Tour 草稿。
- 在已有 Tour 下创建多个 Station。
- Station 绑定待审核场地申请时不能发布。
- Station 绑定被拒场地申请时不能发布。
- Station 绑定已通过场地申请后可以发布。
- 发布时生成或复用 Activity，不重复创建多个 Activity。
- 发布时生成 Session 和真实 `session_seat`。
- 同一场馆重叠时间段不能发布。
- C 端 Tour detail 返回站点聚合信息。

前端验证：

- `/console/tours/new` 只创建 Tour。
- `/console/tours/{id}` 能展示站点列表和状态。
- 新增 Station 后能回到 Tour 详情看到站点。
- C 端 `/tour/{id}` 能横向切换站点。
- 站点切换后时间、地点、票价区间、售卖状态、购买按钮联动。

边界验证：

- 运行 `scripts/verify-microservice-boundaries.ps1`。
- 后端只在 ticket 服务内读取 ticket owner 表。
- order/payment 继续通过已有 API 获取订单和支付信息。

## 风险与缓解

- 风险：重复发布 Station 生成多个 Activity。
  - 缓解：发布时按 `station_id` 查询已有有效 Activity，存在则复用。

- 风险：C 端仍从 activity 列表进入，削弱 Tour 主入口。
  - 缓解：后续活动列表对带 `tour_id` 的 activity 可聚合或跳转 Tour 页面。

- 风险：站点状态和场地申请状态不同步。
  - 缓解：Tour 详情聚合时实时读取 VenueApplication 状态，并将 Station 状态作为流程快照。

- 风险：多场次追加和库存生成重复。
  - 缓解：Session 创建独立接口必须检查场馆时间冲突和 session seat 是否已生成。

## 实施顺序建议

1. 增强后端 Tour admin detail 和 C 端 tour detail 聚合返回。
2. 调整 `/console/tours/new` 为只创建 Tour。
3. 新增 `/console/tours/{id}` Tour 详情管理页。
4. 新增在已有 Tour 下创建 Station 的页面或表单。
5. 强化 Station 发布为创建或复用 Activity。
6. 增强 C 端 `/tour/{id}` 站点横向切换和联动展示。
7. 增加多城市巡演 seed demo。
