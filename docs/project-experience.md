# 项目经历：Omni 万象抢票平台

---

## 项目概述

**Omni** 是一款类大麦网风格的通用在线票务平台，采用微服务架构 + 物理拆库设计，支持演唱会、体育赛事、戏剧等各类活动的全流程票务管理。系统采用 **"B 端主导、C 端参与"** 模式——主办方通过后台管理活动、场次与票档，普通用户在前台浏览、选座、下单和支付。项目涵盖高并发抢票、座位图编辑、分布式事务、智能客服等核心能力。

- **项目定位**：生产级在线票务系统
- **技术栈**：Spring Cloud Alibaba / Next.js 16 / NestJS / PostgreSQL / Redis
- **我的角色**：Agent 开发工程师 · 全栈开发

---

## 技术栈

| 层级 | 技术 |
|:---|:---|
| 后端框架 | Spring Boot 2.7.18 + Spring Cloud Alibaba 2021.0.5.0 |
| API 网关 | Spring Cloud Gateway + Netty + Sentinel 限流 |
| 数据库 | PostgreSQL 17（6 库物理隔离） |
| ORM | MyBatis-Plus 3.5.3.1 |
| 注册/配置中心 | Nacos 2.4.3 |
| 分布式事务 | Seata 1.6.1 AT 模式 |
| 缓存/高并发 | Redis 7 + Lua 脚本 |
| 抢票服务 | NestJS 10 + Redis + RabbitMQ |
| 前端 | Next.js 16.2.1 + React 19.2.4 + Tailwind CSS 4 + shadcn/ui |
| AI 客服 | Ollama + Qwen2.5:7b 本地大模型 + 内嵌 FAQ 知识库 |
| 消息队列 | RabbitMQ |
| 构建 | Maven / pnpm |

---

## 核心贡献

### 1. 智能客服 Agent 系统（AI Customer Service Agent）

**职责**：独立设计并实现基于大模型的智能客服 Agent，打通从用户提问到语义理解、知识库匹配、大模型生成、人工兜底的全链路。

**实现细节**：

- **三层兜底架构**：本地 FAQ 关键词索引 → Ollama 本地大模型（Qwen2.5:7b）→ 默认回复，确保任何问题都有响应
- **流式 SSE 推送**：后端通过 `Consumer<String>` 逐字推送回答碎片，前端解析 `event`/`data` 字段，支持 `thinking`、`delta`、`done`、`error` 事件类型，实现类 ChatGPT 打字机效果
- **会话状态机**：设计 `OPEN → WAITING_AGENT → ASSIGNED → CLOSE_REQUESTED → CLOSED` 五态流转模型，支持 AI 自动接待、人工转接、升级、认领、超时自动关闭
- **Ollama 集成**：实现兼容 OpenAI API 格式和 Ollama 原生格式两种响应解析器，支持流式（SSE）和非流式调用，内置 `<think>` 标签过滤
- **可观测性**：所有会话状态变更写入审计表 `support_conversation_audit`，支持全链路追溯
- **客服工作台**：前端开发完整的客服 SPA，包含队列筛选、会话管理、快速回复、标签管理、转接/升级、备注、操作审计

**技术亮点**：通过本地 FAQ 索引兜底 + Ollama 本地部署，实现零外部 API 依赖的智能问答系统，响应首包时间 < 500ms（FAQ 命中时）。

---

### 2. SeatCraft 座位图编辑器（全栈）

**职责**：前后端协作开发可视化座位图编辑器，支撑从场馆模板设计到 C 端选座购票的全流程。

**实现细节**：

- **SVG 画布引擎**（`SeatCanvas.tsx`，955 行）：基于 `react-zoom-pan-pinch` 实现缩放平移，支持网格、弧形、站立区、多边形四种座位块类型，7 种拖拽交互（块拖拽、旋转、缩放、座位微调、多段线编辑、画布平移、框选）
- **三种交互模式**：设计模式（B 端模板编辑）、选座模式（C 端购票选座）、票档绑定模式
- **版本管理**：支持场馆默认布局 → 活动/场次草稿 → 版本发布/回滚的完整生命周期
- **后端 API**：设计 `SeatController` 提供座位图查询、占座状态同步接口，通过 `OrderInternalClient` 查询已锁定/已售座位
- **后端实体与持久化**：`SessionSeatLayout`、`SessionSeat`、`SeatBlock`、`SeatOverride` 等核心实体，MyBatis-Plus 查询

**技术亮点**：纯 SVG 渲染实现高性能座位编辑，无第三方可视化库依赖；前端拖拽交互与后端 SeatCraft 版本化管理深度配合，支撑场馆模板复用和活动级定制。

---

### 3. 全栈业务功能开发

**职责**：参与 C 端和 B 端多个核心业务模块的全栈开发工作。

**实现模块**：

| 模块 | 技术栈 | 贡献内容 |
|:---|:---|:---|
| 活动列表与详情 | Next.js + Java Ticket Service | 活动浏览、分类筛选、搜索引擎集成 |
| 订单系统 | Java Order Service + frontend | 订单创建、状态流转、超时释放、订单快照 |
| 实名购票 | Java User Service + frontend | 实名观演人 CRUD、下单时观演人快照 |
| 支付集成 | Java Payment Service + frontend | 支付宝沙盒 QR Pay / Page Pay、同步/异步回调 |
| 电子票与验票 | Java Order Service + frontend | 电子票生成、入场码、验票记录 |
| 后台订单管理 | Console + Java Ticket Service | 平台/主办方权限隔离的订单查看、筛选、分页 |
| RBAC 权限 | Java User Service + frontend | 角色-用户-权限三级管理、接口权限校验 |
| 退款审核 | Java Payment + Order + Ticket | 退款申请、权限校验、Seata 分布式事务 |
| 候补排队 | NestJS + frontend | 候补加入/取消、库存释放后自动生成订单 |

---

### 4. 高并发抢票系统（后端）

**职责**：参与 NestJS 抢票服务的架构设计与实现，支撑高并发场景下的库存安全和用户体验。

**实现细节**：

- **Redis Lua 原子操作**：库存扣减、用户幂等、用户 hold、座位 hold 全部通过 Lua 脚本保证原子性
- **FIFO 排队**：使用 Redis `INCR` 生成序列号 + List 队列实现公平排队，支持排名实时查询
- **异步 Worker**：每 500ms 轮询队列，支持 inflight 追踪、失败自动恢复、订单创建失败时回滚 Redis 库存
- **请求状态机**：`QUEUED → WAITING → TRYING_TICKET_TYPE → LOCKING → ORDER_CREATING → ORDER_CREATED`，失败时进入 `SOLD_OUT / LIMITED / FAILED / PENDING_RECOVERY`
- **组队抢票**：支持小队创建/加入/统一锁票/成员支付同步
- **Gateway Sentinel 限流**：抢票接口 QPS 20，配合 Redis 层保证系统稳定

---

## 架构设计亮点

### 微服务物理隔离

六个业务服务各自拥有独立 PostgreSQL 数据库（`omni_user` / `omni_ticket_split` / `omni_order` / `omni_payment` / `omni_notification` / `omni_grab`），通过 `prod-split` profile 管理。严格禁止跨服务 Mapper、Entity 或 SQL JOIN，服务间通过 OpenFeign + internal token 通信。

### 分布式事务保障

订单、票务、支付核心写链路接入 Seata AT 模式，事务组 `omni_tx_group`，覆盖创建订单、取消订单、退款标记、支付确认等跨服务写流程。支付宝退款、Redis、通知等外部副作用通过补偿机制处理。

### API 网关统一入口

Spring Cloud Gateway 集中管理路由、鉴权、限流。Sentinel 规则覆盖抢票（QPS 20）、下单（QPS 50）、支付（QPS 30）、登录（QPS 40）、热点读（QPS 120）等关键资源。前端通过 Next.js 路由代理解决跨域，`API_PROXY_TARGET` 支持环境化配置。

---

## 项目成果

- 实现从活动发布 → 用户浏览 → 选座下单 → 支付出票 → 验票入场的完整票务闭环
- AI 客服 FAQ 命中率覆盖常见场景，Ollama 本地推理无需外部 API
- SeatCraft 座位图编辑器支撑多场馆多活动的可视化座位管理
- 抢票系统通过 Redis Lua + FIFO 排队 + 异步 Worker 架构支撑高并发场景
- 5 个 Java 微服务 + 1 个 NestJS 服务全部独立部署、物理数据库隔离
