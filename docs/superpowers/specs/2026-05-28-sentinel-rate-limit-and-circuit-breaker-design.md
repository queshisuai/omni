# Sentinel 热点分层限流与熔断设计

## 背景

当前分支已完成两类基础能力：

1. `java-order` 内部创建订单入口已有 Sentinel 最小接入。
2. `java-gateway` 已开始接入 Sentinel Gateway，用于入口级限流。

后续不应按“每个板块、每个服务”全量铺 Sentinel。全量铺开会增加规则维护成本，也可能误伤低频正常业务。正确方向是按风险和流量热点分层：入口先粗粒度限流，核心服务方法细粒度保护，跨服务和外部依赖才做熔断。

## 目标

1. Gateway 做粗粒度限流，优先保护高并发、容易被刷、影响核心链路的入口。
2. 核心服务方法做细粒度限流，只覆盖订单创建、抢票预扣、支付同步等热点动作。
3. 熔断只用于跨服务调用和外部支付渠道调用，不给普通本服务内部方法机械加熔断。
4. 支持 QPS 限流、并发线程数限制、慢调用熔断和统一降级返回。
5. Sentinel 规则加载不覆盖其它来源已有规则。
6. 保持现有业务状态机和微服务边界不变。

## 非目标

1. 不全量保护普通 CRUD、低频配置接口、后台详情页和小流量管理员接口。
2. 不把 Sentinel Dashboard 作为本轮必需运行依赖。
3. 不建设动态规则平台或 Dashboard/Nacos 推送链路。
4. 不把限流或熔断失败包装为业务成功。
5. 不新增跨服务 Mapper、Entity、XML mapper 或 SQL join。

## 分层策略

### 第一优先级：必须加

| 类型 | 接口 / 资源 | 保护方式 |
|:---|:---|:---|
| 抢票入口 | `/api/grab/**` | Gateway QPS + 并发控制 |
| 创建订单 | `/api/order/create`、`/api/order/create-with-seats`、内部创建订单 | Gateway QPS + service 方法限流 |
| 支付回调/同步 | `/api/payment/alipay/notify`、`/api/payment/alipay/sync/**` | Gateway QPS + service 方法限流 + 支付渠道熔断 |
| 登录/验证码 | `/api/user/login`、`/api/user/send-code` | Gateway QPS + service 方法限流 |
| 热门票务查询 | 活动详情、场次、座位图查询 | Gateway QPS，必要时 service 方法限流 |

这些接口要么高并发，要么容易被刷，要么失败会影响购票主链路。

### 第二优先级：建议加

| 类型 | 接口 / 资源 | 保护方式 |
|:---|:---|:---|
| 管理端批量列表 | 大列表查询 | Gateway QPS 或慢调用保护 |
| 活动搜索 | 搜索接口 | Gateway QPS |
| 订单列表 | 用户订单列表 | Gateway QPS |
| 退款申请/审核 | 退款申请、审核 | Gateway QPS + 依赖熔断 |
| 文件上传 | 头像、票务图片、证明材料 | Gateway QPS + 文件大小限制 |

这些不需要全部做熔断，但适合做限流、慢调用保护或并发控制。

### 第三优先级：暂不做

- 普通 CRUD 管理接口。
- 低频配置接口。
- 后台详情页。
- 只给管理员使用的小流量接口。

这些先依赖权限、分页、参数校验和数据库索引。

## Gateway 粗粒度限流

第一版 Gateway 只保护热点路径：

- `gateway-api-grab`：`/api/grab/**`
- `gateway-api-order-create`：`/api/order/create`、`/api/order/create-with-seats`
- `gateway-api-payment-critical`：`/api/payment/alipay/sync/**`、`/api/payment/alipay/notify`
- `gateway-api-user-auth`：`/api/user/login`、`/api/user/send-code`
- `gateway-api-ticket-hot-read`：`/api/ticket/activities/**`、`/api/ticket/sessions/**`、`/api/ticket/**/seats/**` 或当前项目实际座位图路径

限流响应统一：

```json
{
  "code": 429,
  "message": "系统繁忙，请稍后重试",
  "data": null
}
```

Gateway 命中限流时不继续转发后端。

## 核心服务细粒度限流

### `java-order`

保留并完善：

- `order-internal-create`
- `order-internal-create-with-seats`
- `order-internal-mark-paid`

这些资源保护订单创建和支付状态变更。

### `java-ticket`

只保护库存/座位核心写链路和座位图热点读链路：

- `ticket-sales-lock-stock`
- `ticket-sales-lock-seats`
- `ticket-sales-confirm-sold`
- `ticket-seat-map-read`

报价、释放等可先由 Gateway 和调用方重试控制，不作为第一轮必加。

### `java-payment`

只保护支付关键入口：

- `payment-alipay-sync`
- `payment-alipay-notify`
- `payment-refund-apply`

退款审核属于第二优先级，可后续加。

### `java-user`

只保护容易被刷的入口：

- `user-login-password`
- `user-send-code`

### `grab-service`

`grab-service` 是 NestJS，不直接使用 Sentinel Java 注解。本轮通过 Gateway 的 `/api/grab/**` 粗粒度限流保护入口；抢票内部仍由现有 Redis Lua 准入、幂等和库存预扣保护。

## 熔断范围

熔断主要用于跨服务调用和外部依赖，不用于普通本服务内部方法。

第一轮建议覆盖：

| 调用方 | 被保护依赖 | 资源名 | 降级语义 |
|:---|:---|:---|:---|
| `java-order` | `java-user` 用户校验 | `order-user-validate` | 用户服务暂不可用 |
| `java-order` | `java-ticket` 库存/座位锁定 | `order-ticket-sales` | 票务服务暂不可用 |
| `java-payment` | `java-order` 订单查询/更新 | `payment-order-client` | 订单服务暂不可用 |
| `java-payment` | 支付宝同步/退款 API | `payment-alipay-channel` | 支付渠道暂不可用，请稍后重试 |

熔断策略：

- 慢调用熔断：慢调用阈值 1000ms。
- 异常比例熔断：异常比例 50%。
- 最小请求数：5。
- 熔断时长：10s。

支付、退款和订单状态变更场景严禁 fallback 返回成功对象。降级只能返回失败、抛出业务异常，或保持待重试状态。

## 规则加载原则

各服务本地默认规则必须合并已有 Sentinel 规则：

1. 读取 `FlowRuleManager.getRules()` / `DegradeRuleManager.getRules()` 当前规则。
2. 移除本服务本配置类负责的同名资源规则。
3. 添加本配置类新规则。
4. 再调用 `loadRules`。

这样避免覆盖 Dashboard、Nacos datasource、其它配置类或未来扩展规则。

## 错误响应约定

| 场景 | code | message |
|:---|:---|:---|
| 限流 | 429 | 系统繁忙，请稍后重试 |
| 通用熔断 | 503 | 服务暂不可用，请稍后重试 |
| 用户服务熔断 | 503 | 用户服务暂不可用，请稍后重试 |
| 票务服务熔断 | 503 | 票务服务暂不可用，请稍后重试 |
| 订单服务熔断 | 503 | 订单服务暂不可用，请稍后重试 |
| 支付渠道熔断 | 503 | 支付渠道暂不可用，请稍后重试 |

## 验收标准

1. Gateway 热点路径限流命中后返回 429 JSON，且不转发到后端。
2. 订单创建、支付标记、票务锁库存/锁座、支付同步、登录/验证码等核心资源有方法级限流测试。
3. 跨服务和支付宝依赖有熔断规则或 fallback 测试。
4. Sentinel 规则加载不会清空其它资源规则。
5. 正常路径仍调用原 service/client，返回原业务结果。
6. `scripts/verify-microservice-boundaries.ps1` 通过。
7. 未新增 runtime artifact、私有上传文件、dump、backup 或 node/pnpm 产物。
