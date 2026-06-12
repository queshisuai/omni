# 生产环境变量注入清单

> 2026-06-09 阶段 10 清单。本文只列变量名、注入位置和生产要求，不保存任何真实密钥、账号、token、DSN 或私钥内容。

## 使用规则

- 生产 Java Gateway 和业务服务必须使用 `prod-split` profile；每个业务服务进程单独注入自己的 datasource URL，避免五库串库。
- 敏感变量必须来自部署平台、密钥管理器或 CI/CD secret，不允许写入仓库、镜像、启动脚本或聊天记录。
- `docker-compose.production.example.yml` 当前只覆盖基础设施、`grab-service` 和 `frontend` 的生产示例；Java 五个业务服务由进程管理器或容器平台按本文清单注入。
- `scripts/check-production-runtime-defaults.ps1` 是当前静态守护入口；生产发布前应运行该脚本或完整 `scripts/verify-microservice-boundaries.ps1`。

## 全局变量

| 变量 | 注入位置 | 生产要求 |
|:---|:---|:---|
| `SPRING_PROFILES_ACTIVE` | `java-gateway`、`java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification` | 必须为 `prod-split` 或等价显式 profile。 |
| `SPRING_DATASOURCE_URL` | 五个连接数据库的 Java 服务 | 必填；每个服务指向各自物理库，不共用 `omni_ticket`。 |
| `SPRING_DATASOURCE_USERNAME` | 五个连接数据库的 Java 服务 | 必填；建议按服务拆分最小权限账号。 |
| `SPRING_DATASOURCE_PASSWORD` | 五个连接数据库的 Java 服务 | 必填；不得使用本地默认密码。 |
| `INTERNAL_API_TOKEN` | `java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification`、`grab-service` | 必填；所有 internal API 调用方和被调用方必须一致。 |
| `JWT_SECRET` | `java-order`、`java-notification`、`grab-service` | 必填；长度应满足 HS256 key 要求，不得使用本地演示密钥。 |
| `GRAB_SERVICE_URL` | `java-user` | 必填；平台运营摘要和客服上下文通过该地址读取抢票/候补上下文，生产不能回退到 `localhost`。 |
| `NACOS_HOST` | Java Gateway、需要注册发现的 Java 服务、Seata 配置 | 生产必须显式声明；本地 fallback 只用于开发。 |
| `NACOS_PORT` | Java Gateway、需要注册发现的 Java 服务、Seata 配置 | 生产必须显式声明，默认通常为 `8848`。 |
| `GATEWAY_GRAB_SERVICE_URI` | `java-gateway` | 必填；生产 `/api/grab/**` 路由目标，不得使用本地 `localhost:3001`。 |
| `GATEWAY_WAITLIST_SERVICE_URI` | `java-gateway` | 必填；生产 `/api/waitlist/**` 路由目标，不得使用本地 `localhost:3001`。 |

## Java 服务

| 服务 | 必填变量 | 说明 |
|:---|:---|:---|
| `java-gateway` | `SPRING_PROFILES_ACTIVE`、`NACOS_HOST`、`NACOS_PORT`、`GATEWAY_GRAB_SERVICE_URI`、`GATEWAY_WAITLIST_SERVICE_URI` | 网关不连接业务库；生产建议同时显式注入 Gateway timeout 和 Sentinel dashboard 变量。 |
| `java-user` | `SPRING_PROFILES_ACTIVE`、`SPRING_DATASOURCE_URL`、`SPRING_DATASOURCE_USERNAME`、`SPRING_DATASOURCE_PASSWORD`、`INTERNAL_API_TOKEN`、`GRAB_SERVICE_URL`、`NACOS_HOST`、`NACOS_PORT`、`RABBITMQ_HOST`、`RABBITMQ_PORT`、`RABBITMQ_USER`、`RABBITMQ_PASSWORD` | datasource 指向 `omni_user`；本地短信 mock 开关不得在生产开启，抢票/候补上下文地址必须显式注入。 |
| `java-ticket` | `SPRING_PROFILES_ACTIVE`、`SPRING_DATASOURCE_URL`、`SPRING_DATASOURCE_USERNAME`、`SPRING_DATASOURCE_PASSWORD`、`INTERNAL_API_TOKEN`、`SEATA_ENABLED`、`NACOS_HOST`、`NACOS_PORT`、`OMNI_SEARCH_PROVIDER`、`OMNI_SEARCH_REQUIRE_ES`、`RABBITMQ_HOST`、`RABBITMQ_PORT`、`RABBITMQ_USER`、`RABBITMQ_PASSWORD` | datasource 指向 `omni_ticket_split`；生产搜索默认应要求 Elasticsearch 可用。 |
| `java-order` | `SPRING_PROFILES_ACTIVE`、`SPRING_DATASOURCE_URL`、`SPRING_DATASOURCE_USERNAME`、`SPRING_DATASOURCE_PASSWORD`、`INTERNAL_API_TOKEN`、`JWT_SECRET`、`SEATA_ENABLED`、`NACOS_HOST`、`NACOS_PORT`、`RABBITMQ_HOST`、`RABBITMQ_PORT`、`RABBITMQ_USER`、`RABBITMQ_PASSWORD` | datasource 指向 `omni_order`；公共订单接口依赖 JWT。 |
| `java-payment` | `SPRING_PROFILES_ACTIVE`、`SPRING_DATASOURCE_URL`、`SPRING_DATASOURCE_USERNAME`、`SPRING_DATASOURCE_PASSWORD`、`INTERNAL_API_TOKEN`、`ALIPAY_GATEWAY_URL`、`ALIPAY_APP_ID`、`ALIPAY_MERCHANT_PRIVATE_KEY`、`ALIPAY_PUBLIC_KEY`、`ALIPAY_RETURN_URL`、`ALIPAY_NOTIFY_URL`、`SEATA_ENABLED`、`NACOS_HOST`、`NACOS_PORT`、`RABBITMQ_HOST`、`RABBITMQ_PORT`、`RABBITMQ_USER`、`RABBITMQ_PASSWORD` | datasource 指向 `omni_payment`；`prod-split` 已强制关闭 QR mock 和自动确认，退款通知事件使用 RabbitMQ。 |
| `java-notification` | `SPRING_PROFILES_ACTIVE`、`SPRING_DATASOURCE_URL`、`SPRING_DATASOURCE_USERNAME`、`SPRING_DATASOURCE_PASSWORD`、`INTERNAL_API_TOKEN`、`JWT_SECRET`、`NACOS_HOST`、`NACOS_PORT`、`RABBITMQ_HOST`、`RABBITMQ_PORT`、`RABBITMQ_USER`、`RABBITMQ_PASSWORD` | datasource 指向 `omni_notification`；internal 通知接口必须校验 `X-Internal-Token`。 |

## Alipay

| 变量 | 注入位置 | 生产要求 |
|:---|:---|:---|
| `ALIPAY_GATEWAY_URL` | `java-payment` | 必填；生产不能继承 sandbox gateway。 |
| `ALIPAY_APP_ID` | `java-payment` | 必填；不得使用本地 sandbox appId。 |
| `ALIPAY_MERCHANT_PRIVATE_KEY` | `java-payment` | 必填；通过密钥管理注入，不进入仓库或镜像。 |
| `ALIPAY_PUBLIC_KEY` | `java-payment` | 必填；通过密钥管理注入。 |
| `ALIPAY_RETURN_URL` | `java-payment` | 必填；必须是生产前端回跳地址。 |
| `ALIPAY_NOTIFY_URL` | `java-payment` | 必填；必须是公网可达的生产回调地址。 |

## Seata 和搜索

| 变量 | 注入位置 | 生产要求 |
|:---|:---|:---|
| `SEATA_ENABLED` | `java-ticket`、`java-order`、`java-payment` | 生产必须显式声明；启用时同时确认 Seata registry/config 已指向生产 Nacos。 |
| `OMNI_SEARCH_PROVIDER` | `java-ticket` | 生产建议固定为 `elasticsearch`。 |
| `OMNI_SEARCH_REQUIRE_ES` | `java-ticket` | 生产应为 `true`，避免搜索静默降级。 |

## RabbitMQ

| 变量 | 注入位置 | 生产要求 |
|:---|:---|:---|
| `RABBITMQ_HOST` | `java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification`、`grab-service` | 必填；生产不能回退到 `localhost`。 |
| `RABBITMQ_PORT` | `java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification`、`grab-service` | 必填；生产应按实际 broker 端口注入。 |
| `RABBITMQ_USER` | RabbitMQ、`java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification`、`grab-service` | 必填；不得使用本地默认账号。 |
| `RABBITMQ_PASSWORD` | RabbitMQ、`java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification`、`grab-service` | 必填；不得使用本地默认密码。 |

## Redis

| 变量 | 注入位置 | 生产要求 |
|:---|:---|:---|
| `REDIS_HOST` | `grab-service` | 必填；生产不能回退到 `localhost`。 |
| `REDIS_PORT` | `grab-service` | 必填；生产应按实际 Redis 端口注入。 |

## Grab Service

| 变量 | 注入位置 | 生产要求 |
|:---|:---|:---|
| `GRAB_SERVICE_IMAGE` | `docker-compose.production.example.yml` 或部署平台 | 必填；指向已构建镜像。 |
| `GRAB_SERVICE_HOST` | `grab-service` | 必填；容器内生产监听地址应为 `0.0.0.0`，不得回退到 `127.0.0.1`。 |
| `GRAB_DB_HOST` | `grab-service` | 必填；生产数据库地址。 |
| `GRAB_DB_PORT` | `grab-service` | 必填；生产数据库端口。 |
| `GRAB_DB_NAME` | `grab-service` | 必填；抢票服务库名。 |
| `GRAB_DB_USER` | `grab-service` | 必填；建议最小权限账号。 |
| `GRAB_DB_PASSWORD` | `grab-service` | 必填；不得使用本地默认密码。 |
| `ORDER_SERVICE_URL` | `grab-service` | 必填；服务间 internal 调用优先指向内部 `java-order` 服务地址，不建议走 Gateway。 |
| `TICKET_SERVICE_URL` | `grab-service` | 必填；服务间 internal 调用优先指向内部 `java-ticket` 服务地址，抢票可见库存、组队锁座和释放锁均依赖 ticket internal API。 |
| `NOTIFICATION_SERVICE_URL` | `grab-service` | 必填；抢票和候补通知发送链路使用。 |

## Frontend 和 SaaS 开关

| 变量 | 注入位置 | 生产要求 |
|:---|:---|:---|
| `FRONTEND_IMAGE` | `docker-compose.production.example.yml` 或部署平台 | 必填；指向已构建镜像。 |
| `API_PROXY_TARGET` | `frontend` | 必填；Next.js API 代理目标。 |
| `NEXT_PUBLIC_API_URL` | `frontend` | 必填；浏览器端 API base URL。 |
| `NEXT_PUBLIC_SENTRY_ENABLED` | `frontend` | 必填；默认应为 `false`，启用需配套 DSN 和脱敏验收。 |
| `NEXT_PUBLIC_SENTRY_DSN` | `frontend` | 启用 Sentry 时必填；禁用态留空。 |
| `SENTRY_SERVER_ENABLED` | `frontend server runtime` | 可选；启用前必须确认 server 端脱敏策略生效。 |
| `SENTRY_EDGE_ENABLED` | `frontend edge runtime` | 可选；启用前必须确认 edge 端脱敏策略生效。 |
| `SENTRY_DSN` | `frontend server/edge runtime` | server/edge Sentry 启用时必填。 |
| `SENTRY_AUTH_TOKEN` | CI/CD 或构建环境 | 仅 source map 上传时需要；不得进入 runtime 环境或日志。 |
| `NEXT_PUBLIC_POSTHOG_ENABLED` | `frontend` | 必填；默认应为 `false`，启用需产品分析需求和 SDK transport 授权。 |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | `frontend` | PostHog 启用时必填；禁用态留空。 |
| `NEXT_PUBLIC_POSTHOG_HOST` | `frontend` | PostHog 启用时必填；禁用态留空。 |

## 发布前检查

1. 每个 Java 服务使用 `prod-split` 并确认 datasource URL 指向对应物理库。
2. 运行 `powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1`。
3. 运行 `powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1`。
4. 确认禁用态 Sentry / PostHog 不产生外部网络请求。
5. 确认 Alipay `return-url` 和 `notify-url` 指向生产域名，且回调公网可达。
