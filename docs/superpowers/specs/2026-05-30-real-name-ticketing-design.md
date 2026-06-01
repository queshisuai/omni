# 实名购票核心版设计

## 背景

当前购票链路只围绕用户、场次、票档、座位和数量创建订单，不满足真实演出票务里的实名制要求。参考主流票务平台流程，本设计增加“实名观演人”能力：购票前选择或新增观演人，下单时每张票绑定一个观演人，同一场次同一证件不得重复购票，订单和后台可查看对应实名信息。

本设计只覆盖核心版：实名购票、每票绑定观演人、同场次证件去重、订单和后台展示。暂不接入公安实名认证、人脸核验、入场闸机核验或外部实名服务。

## 目标

- 用户可维护常用实名观演人。
- 实名制活动下单前必须选择足够数量的观演人。
- 每张票绑定一个观演人，带座订单可绑定到具体座位。
- 同一场次同一证件号只能占用一张有效票。
- 订单创建后观演人信息不可修改。
- 用户、主办方后台、平台后台按权限查看实名信息。
- 遵守现有微服务边界，不新增跨服务数据库访问或外键。

## 非目标

- 不做公安实名认证或人脸核验。
- 不做入场核验设备或验票 App。
- 不做完整证件号大面积列表裸露。
- 不恢复评价、动态或社交系统。
- 不把 `omni_ticket` 作为当前运行库。

## 业务流程

### 活动详情页提示

当活动需要实名制时，用户进入活动详情页后展示实名制提示：

- 本项目需要实名制购票及入场。
- 观演人需本人携带购票时填写的证件验证入场。
- 购票完成后观演人信息不可更改。

弹窗按钮：

- `预选实名观演人`：打开观演人选择弹层。
- `知道了`：关闭弹窗，用户仍可在活动页继续选择。

### 预选实名观演人

活动详情页增加“抢票实名观演人”模块：

- 显示当前已预选人数。
- 最多预选 6 位实名观演人。
- 支持 `去预选` 或 `去设置`。
- 抢票或下单时按预选顺序取前 N 位观演人绑定到票。

选择弹层内容：

- 标题：`选择实名观演人`。
- 提示：票数变动或库存不足时，将按排序顺序选择观演人。
- 列表展示观演人姓名、证件类型和脱敏证件号。
- 支持多选，最多 6 人。
- 底部按钮：`新增观演人`、`确定`。

### 下单校验

实名制活动下单必须满足：

- 购买 1 张票必须绑定 1 个观演人。
- 购买 N 张票必须绑定 N 个不同观演人。
- 同一请求内证件号不能重复。
- 同一场次下，未取消、未退款的有效订单不能存在相同证件号。
- 订单创建成功后，订单实名信息不可修改。

### 抢票链路

抢票请求也必须携带预选观演人：

```json
{
  "sessionId": 1,
  "ticketTypeId": 2,
  "quantity": 2,
  "attendeeIds": [11, 12],
  "idempotencyKey": "客户端幂等键"
}
```

`grab-service` 只负责携带 `attendeeIds` 继续调用 order internal API。order 服务仍是实名规则的最终校验者，防止抢票服务绕过观演人数量、归属和同场次证件去重规则。

## 数据归属和表设计

### user 服务：常用实名观演人

新增 user-owned 表 `user_attendee`，归 `java-user` 和 `omni_user` 所有。

建议字段：

| 字段 | 说明 |
|:---|:---|
| `id` | 主键 |
| `user_id` | 所属用户 |
| `real_name` | 观演人姓名 |
| `id_type` | 证件类型，核心版先支持 `ID_CARD` |
| `id_no_hash` | 证件号标准化后的 hash，用于去重和匹配 |
| `id_no_mask` | 脱敏证件号，用于展示 |
| `id_no_encrypted` | 加密证件号，核心版可为空，等有明确加密方案后再写入 |
| `phone` | 手机号，可选 |
| `is_default` | 默认观演人标记，可选 |
| `create_time` | 创建时间 |
| `update_time` | 更新时间 |

约束建议：

- 同一用户下，同一 `id_type + id_no_hash` 只能存在一条有效观演人记录；使用 `status = 1` 的部分唯一索引，允许删除后重新添加。
- 证件号进入数据库前先标准化，例如去空格、统一大小写。
- 对外列表默认展示 `real_name`、`id_type`、`id_no_mask`，不展示完整证件号。
- 核心版不把标准化证件号明文写入 `id_no_encrypted`；如果后续需要入场核验，再补加密密钥、轮换、审计和查看权限设计。

### order 服务：订单实名快照

新增 order-owned 表 `order_attendee`，归 `java-order` 和 `omni_order` 所有。

建议字段：

| 字段 | 说明 |
|:---|:---|
| `id` | 主键 |
| `order_id` | 订单 id |
| `order_seat_id` | 有座票关联到 `order_seat`，无座票可为空 |
| `session_id` | 场次 id |
| `ticket_type_id` | 票档 id |
| `attendee_user_profile_id` | 来源 `user_attendee.id`，只复制 id，不建跨库外键 |
| `real_name` | 下单时观演人姓名快照 |
| `id_type` | 证件类型快照 |
| `id_no_hash` | 证件号 hash 快照 |
| `id_no_mask` | 脱敏证件号快照 |
| `id_no_encrypted` | 加密证件号快照，核心版可为空 |
| `phone` | 手机号快照，可选 |
| `status` | 正常、已退款 |
| `create_time` | 创建时间 |
| `update_time` | 更新时间 |

索引建议：

- `(order_id)`：订单详情展示。
- `(order_seat_id)`：部分退款或座位级展示。
- `(session_id, id_type, id_no_hash)`：同场次证件去重。
- `(session_id, id_type, id_no_hash) WHERE status = 1`：数据库级唯一保护，防止两个并发下单同时通过应用层检查。

`order_attendee` 保存的是不可变订单快照。用户后续修改常用观演人，不影响历史订单。

## 接口设计

### user 对外接口

用户侧新增接口：

- `GET /api/user/attendees`：查询我的观演人列表。
- `POST /api/user/attendees`：新增观演人。
- `PUT /api/user/attendees/{id}`：编辑观演人。
- `DELETE /api/user/attendees/{id}`：删除观演人。

所有接口从 `Authorization` JWT 解析当前用户，不能信任前端传入 `userId`。

### user internal API

order 服务通过内部接口解析观演人快照：

```text
POST /api/user/internal/attendees/resolve
Header: X-Internal-Token
```

请求：

```json
{
  "userId": 2004,
  "attendeeIds": [1, 2]
}
```

响应示例使用占位值，不写真实姓名或真实证件片段：

```json
[
  {
    "id": 1,
    "realName": "观演人姓名",
    "idType": "ID_CARD",
    "idNoHash": "证件号哈希值",
    "idNoMask": "证件号脱敏值",
    "phone": null
  }
]
```

该接口必须校验：

- `X-Internal-Token` 正确。
- 所有 `attendeeIds` 都属于请求里的 `userId`。
- 返回顺序与请求 `attendeeIds` 顺序一致，便于 order 服务按票或座位绑定。

### order 下单接口

`CreateOrderRequest` 和 `LockSeatsRequest` 增加：

```json
{
  "attendeeIds": [1, 2]
}
```

普通下单流程：

```text
校验购票数量
校验用户存在
解析实名观演人
校验观演人数等于购票数量
校验请求内证件不重复
票务报价
校验同场次证件未重复购票
校验活动限购
创建订单
锁库存
写 order_snapshot
写 order_attendee
```

带座下单流程：

```text
校验购票数量或座位数量
校验用户存在
解析实名观演人
校验观演人数等于座位数量或购票数量
票务报价
校验同场次证件未重复购票
锁座
创建 order
创建 order_seat
按座位顺序创建 order_attendee
写 order_snapshot
```

有座票绑定规则：

```text
order_seat[0] -> attendee[0]
order_seat[1] -> attendee[1]
```

随机分配座位时，以 ticket 服务返回的 `lockedSeatIds` 顺序绑定观演人。

### 后台订单接口

后台订单列表和详情需要带出实名观演人信息：

- 平台管理员：可查看全平台订单实名信息。
- 主办方：只能查看自己活动产生的订单实名信息。
- 普通用户：只能查看自己订单实名信息。

主办方权限必须由后端从 `Authorization` JWT 解析当前用户，并基于活动归属过滤，不能信任前端传入 `userId`、`organizerId` 或活动归属字段。

## 隐私和权限

### C 端用户侧

用户可以查看自己订单的实名信息：

- 姓名可显示。
- 证件类型可显示。
- 证件号默认脱敏展示。
- 已购票订单不允许修改观演人。

### 主办方后台

主办方后台可以查看自己活动订单的实名观演人信息：

- 观演人姓名。
- 证件类型。
- 脱敏证件号。
- 手机号，如果有。
- 对应订单、场次、票档、座位。

主办方不能查看其他主办方活动的实名信息。

### 平台管理员后台

平台管理员可以查看全平台订单的实名观演人信息，默认同样展示脱敏证件号。

### 完整证件号

核心版不在订单列表直接展示完整证件号。如果需要支持查看完整证件号，应单独设计“查看完整证件”能力：

- 仅平台管理员和活动归属主办方可用。
- 后端再次校验 JWT 权限。
- 记录查看日志。
- 前端默认隐藏，点击后短时展示。

## 退款和取消

- 未支付订单取消后，`order_attendee` 不再占用同场次实名名额。
- 全额退款后，订单下所有 `order_attendee` 标记为已退款，不再占用实名名额。
- 部分退款时，按 `order_seat_id` 或选中的票记录更新对应 `order_attendee.status`。
- 同场次证件去重只统计状态仍有效的实名票。

## 前端改造点

- [activity page](../../../frontend/src/app/activity/[id]/page.tsx)：实名制提示、预选观演人模块、下单前校验。
- [api.ts](../../../frontend/src/lib/api.ts)：下单和抢票请求增加 `attendeeIds`。
- 新增用户观演人管理页面或弹层组件。
- [orders page](../../../frontend/src/app/orders/page.tsx)：订单详情展示实名观演人。
- [console orders page](../../../frontend/src/app/console/orders/page.tsx)：后台订单展示实名观演人，遵守权限过滤。

## 后端改造点

- `java-user`：新增 `user_attendee` 实体、Mapper、Service、Controller、internal resolve 接口。
- `java-order`：新增 `order_attendee` 实体、Mapper、Service 辅助方法，扩展下单请求 DTO。
- [OrderService.java](../../../java/java-order/src/main/java/com/omni/order/service/OrderService.java)：普通下单和带座下单接入实名校验与快照写入。
- `nestjs/grab-service`：抢票请求 DTO、Redis 幂等 payload、order client 转发 `attendeeIds`。
- SQL：分别在 `sql/production-split/user` 和 `sql/production-split/order` 增加生产拆库迁移脚本，并同步本地或 Docker 初始化资产。

## 验收标准

后端验收：

- 创建订单时，观演人数必须等于票数。
- 同一请求内重复证件会被拒绝。
- 同一场次同一证件已有有效票时再次购票会被拒绝。
- 已取消、已全额退款或对应票已部分退款后，实名占用释放。
- 主办方只能查看自己活动订单实名信息。
- 平台管理员可查看全部订单实名信息。
- 普通用户不能查看别人的订单实名信息。
- 抢票服务传入 `attendeeIds` 后，order 服务仍执行最终校验。
- 微服务边界检查通过，不新增跨服务 Mapper、Entity、XML mapper 或跨库 join。

前端验收：

- 实名制活动进入详情页出现实名提示。
- 未选择足够观演人不能下单或抢票。
- 购买 N 张票必须选择 N 个观演人。
- 抢票预选观演人按顺序绑定。
- 用户订单详情正确展示自己的实名信息。
- 主办方后台只展示自己活动订单实名信息。
- 平台后台展示全平台订单实名信息。
- 身份证号默认脱敏展示。

验证命令建议：

```powershell
cd frontend
pnpm typecheck
node --test src/lib/*.test.ts
```

```powershell
cd java
mvn -pl java-user,java-order,java-ticket -Dtest=OrderServiceTest,OrderSeatServiceTest,OrderControllerPublicAuthTest test
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```
