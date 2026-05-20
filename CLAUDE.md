# Omni 万象抢票平台

> 📖 全量文件索引见 [`PROJECT_INDEX.md`](./PROJECT_INDEX.md)

## 项目概述

类大麦网综合票务平台，采用 **"B端主导，C端参与"** 双层模式：
- **B端**：平台管理员（admin）全权限管理 / 主办方（organizer）上传自身演出数据
- **C端**：普通用户浏览活动、购票、查看订单（已移除评价+动态系统）

## 技术栈

| 层级 | 技术 |
|:---|:---|
| 后端框架 | Java Spring Cloud Alibaba 微服务 |
| 数据库 | PostgreSQL |
| 前端 | Next.js 16 + React 19（PC端） |
| 注册中心 | Nacos 2.4.3 |
| ORM | MyBatis-Plus 3.5.3.1 |
| 连接池 | Druid |
| 构建工具 | Maven（Java）/ pnpm（前端） |

## 项目结构

```
Omni/
├── java/                          # Java 微服务（Spring Cloud Alibaba）
│   ├── java-gateway/              # API 网关 :8088（Spring Cloud Gateway + Netty）
│   ├── java-user/                 # 用户服务 :8081（注册/登录/角色）
│   ├── java-ticket/               # 票务服务 :8082（活动/场次/票档）
│   ├── java-order/                # 订单服务 :8083
│   ├── java-payment/              # 支付服务 :8084（沙盒模拟支付）
│   ├── java-notification/         # 通知服务 :8085
│   └── java-common/               # 公共模块（JWT/Result/异常）
├── nestjs/grab-service/           # NestJS 抢票核心 :3001（Redis Lua 原子扣减，待开发）
├── frontend/                      # Next.js 前端 :3000（前端端口由 Next.js 决定）
│   └── src/app/
│       ├── page.tsx               # C端首页
│       ├── activity/[id]/page.tsx # 活动详情（场次+票档选择，无评价/动态）
│       ├── search/page.tsx        # 搜索
│       ├── orders/page.tsx        # 我的订单（真实数据，无 mock 降级）
│       ├── login/register/        # 登录注册（纯后端直连，不支持离线）
│       └── console/               # B端后台
│           ├── layout.tsx          # 后台布局（侧边栏）
│           ├── page.tsx            # 数据概览
│           ├── activities/         # 活动管理（列表+新建3步向导）
│           ├── sessions/           # 场次管理
│           ├── orders/             # 订单查看
│           └── venue/              # 场馆管理
├── sql/
│   ├── init.sql                   # 建表（18张表）
│   └── seed.sql                   # 种子数据
├── design-assets/                 # 设计素材（1.png 等品牌图片）
└── docs/specs/                    # 设计文档
```

## 数据库

- **数据库名**：`omni_ticket`
- **用户**：`postgres` / 密码：`123456`
- **端口**：`5432`
- **注意**：表名无前缀，保留字表名用双引号（如 `"user"`、`"order"`）
- **角色字段**：`user.role` = `user` / `organizer` / `admin`
- **`order` 表外键**：`user_id` 引用 `"user"(id)`，下单必须用数据库中真实存在的用户

## 启动顺序

1. **基础设施**：PostgreSQL + Nacos :8848（`C:\nacos\bin\startup.cmd -m standalone`）
2. **后端服务**：java-gateway → java-user → java-ticket → java-order → java-payment → java-notification
3. **前端**：`cd frontend && pnpm dev`

每个 Java 服务启动命令：`cd java/<模块> && mvn spring-boot:run`

> ⚠️ **重要**：后端代码修改后需重新编译并**重启对应服务**才能生效。编译命令：
> ```bash
> mvn clean package -pl java-<模块> -am -DskipTests
> ```

## 服务端口

| 服务 | 端口 | 说明 |
|:---|:---|:---|
| Nacos | 8848 | 注册中心 + 配置中心（嵌入式 Derby） |
| java-gateway | 8088 | API 网关（Netty/WebFlux，不含 Tomcat） |
| java-user | 8081 | 用户服务 |
| java-ticket | 8082 | 票务服务 |
| java-order | 8083 | 订单服务 |
| java-payment | 8084 | 支付服务（沙盒） |
| java-notification | 8085 | 通知服务 |
| grab-service (NestJS) | 3001 | 抢票核心（Redis Lua 原子扣减，待开发） |

## 用户角色与权限

| 操作 | user | organizer | admin |
|:---|:---:|:---:|:---:|
| 浏览/购票 | ✓ | ✓ | ✓ |
| 查看我的订单 | ✓ | ✓ | ✓ |
| 管理自己的活动 | ✗ | ✓ | ✓ |
| 管理他人活动 | ✗ | ✗ | ✓ |
| 创建/编辑场馆 | ✗ | ✗ | ✓ |

## 测试账号

> 必须使用以下数据库中真实存在的账号登录，否则下单时会触发外键约束错误。

| 手机号 | 密码 | 角色 | 数据库 userId |
|:---|:---|:---|:---|
| 13800000001 | 123456 | admin 平台管理员 | 2002 |
| 13800000002 | 123456 | organizer 主办方 | 2003 |
| 13900000001 | 123456 | user 普通用户 | 2004 |

## 购票完整流程（C端）

```
用户登录 → 浏览/搜索活动 → 活动详情页
→ 选择场次 → 选择票档 → 立即购买
→ 确认订单弹窗 → 确认支付
→ 后端创建订单（java-order: POST /api/order/create）
→ 沙盒支付（java-order: POST /api/order/{id}/pay，自动将订单状态改为已支付）
→ 显示"支付成功"弹窗（含订单号）
→ 可选：继续浏览 或 查看订单（跳转 /orders）
```

## 订单状态码（后端 java-order）

| 状态值 | 含义 | 前端显示 |
|:---|:---|:---|
| 1 | STATUS_PENDING 待支付 | 红色"待支付"，显示"去支付"/"取消订单" |
| 2 | STATUS_PAID 已支付 | 绿色"已支付" |
| 3 | STATUS_CANCELLED 已取消 | 灰色"已取消" |
| 4 | STATUS_REFUNDED 已退款 | 灰色"已退款" |

> ⚠️ 注意：前端订单页的状态映射已与后端对齐（STATUS_PENDING=1，非0）。

## 活动详情页布局（C端）

采用两列布局（仿大麦网官网）：
- **左侧（~2/3 宽）**：活动海报 + 基础信息 + 场次选择 + 票档选择 + 购买按钮（上方）；项目详情/购票须知/观演须知标签栏（下方）
- **右侧（~1/3 宽，固定 300px）**：服务保障说明（不支持退/可选座/自助换票/电子发票）+ 万象APP扫码图片（`/public/1.png`）+ 为你推荐

> 已移除：用户评价（ReviewSection）、动态系统（MomentSection）

## 关键约定

### Java 后端
- 使用 MyBatis-Plus `LambdaQueryWrapper` 构建查询
- 统一响应格式：`Result<T>`（code/message/data），成功 code=200
- JWT Token 包含 userId、phone、role
- java-ticket 中 `UserRefMapper` 用于跨模块查用户角色（避免 Feign 调用）
- AdminController 中 admin 全权限，organizer 仅能操作 `organizer_id = userId` 的数据
- `OrderService` 关键方法：`createOrder()`（含 unitPrice 字段）、`markPaid()`（沙盒支付直接更新状态）
- `ActivityService.listActivities()` 已优化：批量查询替代 N+1 循环（约 181→5 次 DB 查询）
- `CreateOrderRequest` 含 `unitPrice` 字段，前端传入真实票价，后端计算总金额

### 前端
- 使用 `'use client'` 组件 + React hooks
- API 调用统一通过 `@/lib/api.ts` 的 `request<T>()` 封装
- 认证状态通过 `@/lib/auth.ts` 管理（localStorage 存储 token + user）
- **无离线/mock 登录**：后端不可用时登录直接报错
- **订单页无 mock 降级**：连不上后端直接显示"加载订单失败"
- B端 `console/*` 页面使用 ConsoleLayout 侧边栏布局
- 主题色：`#ff1268`（品牌红）
- 前端 API 超时：800ms（`api.ts` request 函数中配置）

### Nacos
- 版本 2.4.3，嵌入式 Derby 存储（非 PostgreSQL）
- 启动命令：`C:\nacos\bin\startup.cmd -m standalone`

### 常见问题

| 问题 | 原因 | 解决 |
|:---|:---|:---|
| 下单报 500（外键约束） | 登录用户的 userId 不在数据库 `user` 表中 | 用上方测试账号重新登录 |
| 支付后订单状态仍"待支付" | java-order 服务未重启，旧代码没有 `markPaid()` | 重新编译并重启 java-order |
| Gateway 503 | 缺少 `spring-cloud-starter-loadbalancer` | 已添加（无需操作） |
| Nacos 启动失败（Java 17） | `-Djava.ext.dirs` 参数不兼容 | 移除该参数 |
| NoSuchMethodError | 修改 java-common 后未重新安装 | `mvn install -pl java-common -am` |
| 前端 API 超时/离线 | 后端未启动或 5 秒冷却期 | 确保全部后端服务已启动 |
