# Linux B 端部署补充清单

本文用于补充云服务器 B 端 Docker 部署要求，以当前 `prod-split` 五库联调形态为准。B 端没有域名和 HTTPS 时，公网入口先使用 `http://<服务器公网IP>/`。

## 直接结论

- B 端当前 Docker 环境已经有 `elasticsearch` 容器，且 Ticket 服务搜索能力使用 ES。ES 必须纳入部署、健康检查、端口安全和 Ticket 服务启动前置检查。
- 必须部署：Docker Engine / Docker Compose、PostgreSQL、Nacos、Seata、RabbitMQ、Redis、Java 11、Node.js、pnpm、Nginx。
- 抢票相关能力需要 `grab-service`，它依赖 PostgreSQL、Redis、RabbitMQ，并需要与 Java 服务共享 `INTERNAL_API_TOKEN` 和 `JWT_SECRET`。
- 文件上传使用本地磁盘路径，不需要 MinIO、OSS、S3 或 COS。
- Sentinel Dashboard 可选，不是服务启动硬依赖。
- Ollama 本地客服 AI 可选，当前默认指向本机 `http://localhost:11434/api/chat` 的 `Qwen2.5:7b`；不部署时可设置 `OMNI_SUPPORT_AI_LOCAL_ENABLED=false`，系统仍会使用 FAQ/关键词兜底逻辑。

## 必须部署的基础设施

| 组件 | 版本/要求 | 用途 | 公网暴露 |
|:---|:---|:---|:---|
| Docker Engine / Docker Compose | 使用服务器稳定版本 | 运行基础设施和可选服务容器 | 否 |
| PostgreSQL | 建议沿用部署脚本中的 PostgreSQL 17 或服务器可用稳定版 | 六个业务库 | 否 |
| Nacos | 2.4.3 | 服务注册与配置 | 否 |
| Seata | 1.6.1 | `java-ticket`、`java-order`、`java-payment` 分布式事务 | 否 |
| RabbitMQ | 3.13 management 或等价稳定版 | 通知、候补/抢票 MQ | 否 |
| Redis | 7.x | 抢票队列、库存和锁 | 否 |
| Elasticsearch | 以 B 端现有容器版本为准 | Ticket 搜索/索引 | 否 |
| Java | 11 | Java 微服务运行 | 否 |
| Maven | 与 Java 11 兼容 | B 端源码构建时需要 | 否 |
| Node.js | 前端要求 >= 24；`grab-service` 可用 Node 20+ | 前端和 NestJS 构建/运行 | 否 |
| pnpm | 与 Node 24 配套 | 前端构建 | 否 |
| Nginx | 系统稳定版即可 | HTTP 入口反代 | 是，仅 80 |

公网安全组只建议开放：

```text
22/tcp
80/tcp
```

以下端口只允许本机或内网访问，不要直接暴露公网：

```text
3000, 3001, 5432, 5672, 6379, 7091, 8081-8085, 8088, 8091, 8848, 9200, 9300, 9848, 15672
```

## Docker 部署补充

B 端如果使用 Docker 部署基础设施，建议把基础设施容器放进同一个 Docker network，并固定容器名或 compose service 名。当前截图里已看到：

```text
rabbitmq
frontend
redis
nacos
seata-config-init
seata
grab-service
elasticsearch
```

B 端还需要确认是否已有 PostgreSQL 容器；如果没有，需要补充 PostgreSQL。`seata-config-init` 是一次性初始化容器，退出后不需要常驻运行。

地址选择规则：

- Java 服务运行在宿主机，基础设施在 Docker：使用 `127.0.0.1` 加端口映射。
- Java 服务也运行在同一个 Docker Compose 网络：使用服务名，例如 `postgres`、`redis`、`rabbitmq`、`nacos`、`seata`、`elasticsearch`。

Elasticsearch 是 Ticket 服务搜索依赖，只需要内网可达，不要把 `9200`、`9300` 暴露到公网安全组。B 端 AI 可做只读检查：

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}"
curl -fsS http://127.0.0.1:9200/ || true
```

B 端 AI 还需要在实际拉取的代码分支中确认 Ticket 服务读取的 ES 配置名、索引名和初始化方式。常见配置可能是 `SPRING_ELASTICSEARCH_URIS=http://elasticsearch:9200` 或 `ELASTICSEARCH_URIS=http://elasticsearch:9200`，但最终以 Ticket 服务代码和配置文件为准。

## 业务服务清单

| 服务 | 端口 | 部署要求 |
|:---|:---|:---|
| `java-gateway` | 8088 | 不连接业务库，连接 Nacos |
| `java-user` | 8081 | `prod-split`，连接 `omni_user` |
| `java-ticket` | 8082 | `prod-split`，连接 `omni_ticket_split`，启用 Seata，连接 Elasticsearch |
| `java-order` | 8083 | `prod-split`，连接 `omni_order`，启用 Seata |
| `java-payment` | 8084 | `prod-split`，连接 `omni_payment`，启用 Seata，配置支付宝 |
| `java-notification` | 8085 | `prod-split`，连接 `omni_notification`，连接 RabbitMQ |
| `grab-service` | 3001 | 连接 `omni_grab`、Redis、RabbitMQ、网关/internal API |
| `frontend` | 3000 | Next.js standalone，Nginx 反代访问 |

## 数据库清单

B 端至少创建六个 PostgreSQL database：

```text
omni_user
omni_ticket_split
omni_order
omni_payment
omni_notification
omni_grab
```

如果从 A 端迁移现有数据，推荐 A 端分别导出 dump，B 端逐库恢复。不要直接使用 `sql/local/*` 作为生产迁移 SQL。

Seata 需要 `undo_log` 表，当前 `sql/docker-init/010-seata-undo-log.sql` 覆盖：

```text
omni_order
omni_ticket_split
omni_payment
```

## 必填环境变量

所有 Java 服务建议统一放到 `/etc/omni/*.env`，不要把真实值写进 Git。

通用变量：

```bash
SPRING_PROFILES_ACTIVE=prod-split
NACOS_HOST=127.0.0.1
NACOS_PORT=8848
INTERNAL_API_TOKEN=<强随机内部调用token>
JWT_SECRET=<至少32字节强随机JWT密钥>
RABBITMQ_HOST=127.0.0.1
RABBITMQ_PORT=5672
RABBITMQ_USER=<RabbitMQ用户>
RABBITMQ_PASSWORD=<RabbitMQ密码>
SEATA_ENABLED=true
OMNI_UPLOAD_ROOT=/opt/omni/data/uploads
OMNI_PRIVATE_ASSET_ROOT=/opt/omni/data/private-uploads
OMNI_ID_NO_KEY=<实名信息加密密钥>
OMNI_TICKET_ENTRY_CODE_SECRET=<电子票入场码签名密钥>
```

Ticket 服务还需要按实际代码配置 ES 地址。若 Ticket 服务使用 Spring Boot 标准配置，常见写法为：

```bash
SPRING_ELASTICSEARCH_URIS=http://127.0.0.1:9200
```

如果 Ticket 服务也运行在 Docker Compose 网络中，则通常使用：

```bash
SPRING_ELASTICSEARCH_URIS=http://elasticsearch:9200
```

B 端 AI 必须以实际代码配置项为准；如果配置名不同，不要硬套上面的变量名。

各 Java 业务服务单独设置：

```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5432/<对应数据库>
SPRING_DATASOURCE_USERNAME=<数据库用户>
SPRING_DATASOURCE_PASSWORD=<数据库密码>
```

对应关系：

```text
java-user         -> omni_user
java-ticket       -> omni_ticket_split
java-order        -> omni_order
java-payment      -> omni_payment
java-notification -> omni_notification
```

`java-payment` 还需要按实际沙箱或正式环境配置：

```bash
ALIPAY_GATEWAY_URL=<支付宝网关>
ALIPAY_APP_ID=<支付宝应用ID>
ALIPAY_MERCHANT_PRIVATE_KEY=<商户私钥>
ALIPAY_PUBLIC_KEY=<支付宝公钥>
ALIPAY_RETURN_URL=http://<服务器公网IP>/payment/result
ALIPAY_NOTIFY_URL=http://<服务器公网IP>/api/payment/alipay/notify
```

如果只是本地/演示验证，也可以先不依赖异步回调，使用前端同步查询接口完成支付状态同步；但真实支付链路应配置公网可访问的 `ALIPAY_NOTIFY_URL`。

## grab-service 环境变量

```bash
GRAB_SERVICE_PORT=3001
GRAB_DB_HOST=127.0.0.1
GRAB_DB_PORT=5432
GRAB_DB_NAME=omni_grab
GRAB_DB_USER=<数据库用户>
GRAB_DB_PASSWORD=<数据库密码>
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=<如Redis启用密码则填写>
RABBITMQ_HOST=127.0.0.1
RABBITMQ_PORT=5672
RABBITMQ_USER=<RabbitMQ用户>
RABBITMQ_PASSWORD=<RabbitMQ密码>
ORDER_SERVICE_URL=http://127.0.0.1:8083
TICKET_SERVICE_URL=http://127.0.0.1:8082
NOTIFICATION_SERVICE_URL=http://127.0.0.1:8088
API_GATEWAY_URL=http://127.0.0.1:8088
INTERNAL_API_TOKEN=<与Java服务一致>
JWT_SECRET=<与Java服务一致>
```

`grab-service` 调用订单和票务 internal API 时应优先直连 `java-order` 和 `java-ticket`，避免内部链路绕 Gateway 增加耗时和故障面；Gateway 仍作为前端和外部 API 的统一入口。

## frontend 环境变量

推荐同域反代，此时可以不设置 `NEXT_PUBLIC_API_URL`，让浏览器请求相对路径。

服务端代理变量建议设置：

```bash
API_PROXY_TARGET=http://127.0.0.1:8088
```

如果改成前端直接访问网关，可设置：

```bash
NEXT_PUBLIC_API_URL=http://<服务器公网IP>
```

同域 Nginx 反代更简单，优先使用不设置 `NEXT_PUBLIC_API_URL` 的方案。

## 文件存储目录

创建目录：

```bash
mkdir -p /opt/omni/data/uploads /opt/omni/data/private-uploads
```

如果 B 端创建了专用运行用户 `omni`，再设置权限：

```bash
chown -R omni:omni /opt/omni/data
chmod -R 750 /opt/omni/data
```

公开资源由服务提供 `/uploads/user/**` 和 `/uploads/ticket/**`，Nginx 应把 `/uploads/` 转发到 `java-gateway`。

## Nginx HTTP 配置要点

无域名无 HTTPS 时，使用公网 IP 访问：

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:8088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:8088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 其他组件状态

| 组件 | 是否需要 | 说明 |
|:---|:---|:---|
| Elasticsearch / OpenSearch | 必须 | B 端 Docker 已有 `elasticsearch` 容器；Ticket 服务搜索能力依赖 ES |
| Sentinel Dashboard | 可选 | 不部署也不影响服务启动；只影响可视化观测 |
| Ollama | 可选 | 默认使用本机 `Qwen2.5:7b`；`OMNI_SUPPORT_AI_LOCAL_ENABLED=false` 时不需要 |
| MinIO / OSS / S3 / COS | 不需要 | 当前文件上传落本地磁盘 |
| SMTP 邮件服务 | 不需要 | 当前通知服务记录通知/MQ 消息，没有真实 SMTP 发送配置 |
| 短信服务商 | 不需要 | 当前登录验证码仍是本地/模拟逻辑 |
| HTTPS 证书 | 当前不需要 | 有域名后再接入 |

## B 端 AI 需要补充执行的检查

让 B 端 AI 先执行只读检查，再申请安装确认：

```bash
uname -a
cat /etc/os-release
free -h
df -h
ss -lntp
java -version
mvn -version
node -v
pnpm -v
psql --version
nginx -v
redis-server --version
rabbitmq-diagnostics version
docker version
docker compose version
docker ps
curl -fsS http://127.0.0.1:9200/ || true
curl -fsS http://127.0.0.1:9200/_cluster/health?pretty || true
```

如果缺依赖，B 端 AI 应先列出安装来源、下载内容和命令，等确认后再执行。

## 启动顺序

```text
PostgreSQL
Redis
RabbitMQ
Elasticsearch
Nacos
Seata config init
Seata Server
java-user / java-ticket / java-order / java-payment / java-notification
java-gateway
grab-service
frontend
Nginx
```

## 验收命令

```bash
curl -i http://127.0.0.1:8088/api/ticket/activities
curl -i http://127.0.0.1/api/ticket/activities
curl -i http://<服务器公网IP>/api/ticket/activities
curl -fsS http://127.0.0.1:9200/_cluster/health?pretty
```

登录验证：

```bash
curl -s -X POST http://<服务器公网IP>/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"loginType":"password","account":"13900000001","password":"123456"}'
```

数据库连接检查：

```bash
psql -h 127.0.0.1 -p 5432 -U <数据库用户> -d postgres \
  -c "SELECT datname, application_name, state FROM pg_stat_activity WHERE datname LIKE 'omni%' ORDER BY datname, application_name, state;"
```

正常情况下，业务 JDBC 不应连接历史共享库 `omni_ticket`。

## B 端部署提示词补充片段

可把下面片段追加给 B 端 AI：

```text
请按 Docker 部署方式补充检查。B 端当前已有 elasticsearch 容器，Ticket 服务搜索能力依赖 ES，请把 ES 作为必须依赖纳入 Docker 健康检查、Ticket 服务环境变量、启动顺序和端口安全边界，9200/9300 不要开放公网。请在实际代码分支中确认 Ticket 服务读取的 ES 配置名、索引名和初始化方式；常见变量可能是 SPRING_ELASTICSEARCH_URIS=http://elasticsearch:9200，但最终以代码为准。源码真实运行硬依赖是 PostgreSQL、Nacos、Seata、RabbitMQ、Redis、Elasticsearch、Java 11、Node.js、pnpm、Nginx；如果 PostgreSQL 容器不存在，请补充部署。请额外为文件上传准备 /opt/omni/data/uploads 和 /opt/omni/data/private-uploads，并设置 OMNI_UPLOAD_ROOT、OMNI_PRIVATE_ASSET_ROOT。所有 Java 服务和 grab-service 必须共享 INTERNAL_API_TOKEN、JWT_SECRET。不要把 PostgreSQL、Nacos、Seata、RabbitMQ、Redis、Elasticsearch、Java 服务端口暴露到公网，公网只开放 22 和 80。
```
