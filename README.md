# 🎫 Omni 万象抢票平台

> 类大麦网风格的通用票务平台，为演唱会、体育赛事、戏剧等各类活动提供一站式票务解决方案。

**Omni** 是一套面向真实业务的在线票务系统。项目以 **"B端主导、C端参与"** 的双层模式运作——主办方通过后台管理活动、场次与票档，普通用户则在前台浏览、选座、下单和支付。系统采用微服务架构，前后端分离，适合学习和二次开发。

---

## 📑 目录

- [核心功能](#-核心功能)
- [技术栈](#-技术栈)
- [项目结构](#-项目结构)
- [环境要求](#-环境要求)
- [快速开始](#-快速开始)
- [使用指南](#-使用指南)
- [配置说明](#-配置说明)
- [常见问题 FAQ](#-常见问题-faq)
- [贡献指南](#-贡献指南)
- [许可证](#-许可证)
- [致谢](#-致谢)

---

## ✨ 核心功能

### 👤 用户端（C 端）

| 功能 | 说明 |
|:---|:---|
| 用户注册/登录 | 支持密码登录和短信验证码登录 |
| 活动浏览 | 首页轮播、分类筛选、关键词搜索 |
| 活动详情 | 查看活动介绍、艺人阵容、场次与票档 |
| 在线选座 | 基于 SeatCraft 画布的可视化座位图选座 |
| 下单购票 | 选择场次与票档后创建订单 |
| 支付宝支付 | 支付宝沙盒环境扫码支付 |
| 订单管理 | 查看历史订单、待支付订单及订单状态 |
| 个人信息 | 修改密码、更新个人资料 |

### 🏢 管理端（B 端）

| 功能 | 说明 |
|:---|:---|
| 数据概览 | B端首页展示关键业务数据汇总 |
| 活动管理 | 创建/编辑/上架/下架/删除活动 |
| 场次管理 | 为活动创建多个演出场次 |
| 票档管理 | 设定票价、库存及区域绑定 |
| 座位图设计 | SeatCraft 可视化座位布局编辑器 |
| 场馆管理 | 场馆创建、座位模板管理、区域划分 |
| 订单查看 | 查看所有订单及其支付状态 |
| 退款审核 | 处理用户退款申请 |
| 主办方申请 | 用户可申请成为主办方，管理员审批 |
| 场馆申请 | 主办方可申请新场馆，管理员审批 |

### 🔔 通知系统

- 订单支付成功通知
- 活动状态变更通知（取消/延期等风险处置）
- 退款进度通知

### ⚡ 抢票核心（预留）

- 基于 NestJS + Redis Lua 原子扣减的高并发抢票模块

---

## 🛠 技术栈

| 层级 | 技术选型 | 版本 |
|:---|:---|:---|
| **后端框架** | Spring Boot + Spring Cloud Alibaba | Boot 2.7.18 / Cloud 2021.0.8 / Alibaba 2021.0.5.0 |
| **API 网关** | Spring Cloud Gateway + Netty | — |
| **数据库** | PostgreSQL | 最新稳定版 |
| **ORM** | MyBatis-Plus | 3.5.3.1 |
| **连接池** | Druid | 1.2.18 |
| **认证** | JWT | jjwt 0.11.5 |
| **注册中心** | Nacos | 2.4.3 |
| **服务调用** | OpenFeign | — |
| **前端框架** | Next.js + React | Next 16.2.1 / React 19.2.4 |
| **UI 组件库** | shadcn/ui + Tailwind CSS 4 | — |
| **抢票服务** | NestJS + Redis | 预留 |
| **构建工具** | Maven（后端）/ pnpm（前端） | — |

---

## 📁 项目结构

```
Omni/
├── java/                          # ☕ Java 微服务集群
│   ├── java-common/               #   公共模块（统一响应、异常、JWT）
│   ├── java-gateway/              #   API 网关（端口 8088）
│   ├── java-user/                 #   用户服务（端口 8081）
│   ├── java-ticket/               #   票务服务（端口 8082）
│   ├── java-order/                #   订单服务（端口 8083）
│   ├── java-payment/              #   支付服务（端口 8084）
│   └── java-notification/         #   通知服务（端口 8085）
│
├── frontend/                      # 🌐 Next.js 前端（端口 3000）
│   ├── src/
│   │   ├── app/                   #   页面路由（App Router）
│   │   ├── components/            #   通用组件与 SeatCraft 选座组件
│   │   ├── lib/                   #   工具库（API 封装、认证、工具函数）
│   │   └── types/                 #   TypeScript 类型定义
│   └── public/                    #   静态资源
│
├── nestjs/grab-service/           # ⚡ NestJS 抢票核心（端口 3001，预留）
│
├── sql/                           # 🗄️ 数据库脚本
│   ├── init.sql                   #   历史共享库初始化
│   ├── seed.sql                   #   测试种子数据
│   ├── local/                     #   本地开发用 disposable 数据库 SQL
│   ├── migrations/shared/         #   历史共享库增量迁移归档
│   └── production-split/          #   生产物理拆库迁移资产
│
├── scripts/                       # 🔧 运维脚本（边界检查、拆库导出导入、运行时验证）
├── docs/                          # 📚 设计文档与运维手册
├── start-project.ps1              # 🚀 一键启动脚本
└── CLAUDE.md                      #   开发者运行手册
```

---

## 📋 环境要求

在开始之前，请确保你的开发环境满足以下条件：

| 依赖项 | 最低版本 | 说明 |
|:---|:---|:---|
| **JDK** | 11+ | 后端 Java 运行环境 |
| **Maven** | 3.8+ | Java 项目构建工具 |
| **Node.js** | 24+ | 前端运行环境 |
| **pnpm** | 最新版 | 前端包管理器 |
| **PostgreSQL** | 14+ | 主数据库 |
| **Nacos** | 2.4.3 | 注册中心/配置中心 |
| **PowerShell** | 5+ | 运行启动脚本 |

> 💡 **提示**：Nacos 建议安装在 `C:\nacos\` 目录。若安装在其他位置，请自行修改启动命令。

---

## 🚀 快速开始

### 第一步：安装基础环境

1. **安装 JDK 11**（可从 [Adoptium](https://adoptium.net/) 下载）
2. **安装 Maven**（可从 [Maven 官网](https://maven.apache.org/download.cgi) 下载）
3. **安装 Node.js 24+**（可从 [Node.js 官网](https://nodejs.org/) 下载）
4. **安装 pnpm**：
   ```powershell
   npm install -g pnpm
   ```
5. **安装 PostgreSQL**（可从 [PostgreSQL 官网](https://www.postgresql.org/download/) 下载）
6. **安装并启动 Nacos**：
   ```powershell
   C:\nacos\bin\startup.cmd -m standalone
   ```

### 第二步：初始化数据库

使用 PostgreSQL 客户端（如 pgAdmin 或 `psql`）创建五个业务数据库：

```sql
CREATE DATABASE omni_user;
CREATE DATABASE omni_ticket_split;
CREATE DATABASE omni_order;
CREATE DATABASE omni_payment;
CREATE DATABASE omni_notification;
```

> 📌 数据库连接信息：主机 `localhost`、端口 `5432`、用户 `postgres`、密码 `123456`。

### 第三步：安装项目依赖

**安装前端依赖：**

```powershell
cd frontend
pnpm install
```

**编译公共模块并安装后端依赖：**

```powershell
cd java
mvn clean install -pl java-common
```

### 第四步：一键启动（推荐）

项目提供了一键启动脚本，自动完成服务检查与启动：

```powershell
powershell -ExecutionPolicy Bypass -File start-project.ps1
```

该脚本会自动：
- 检查 PostgreSQL 和 Nacos 是否已在运行
- 以 `prod-split` 模式启动五个业务服务
- 为每个服务注入其专属数据库的数据源配置
- 启动前端开发服务器

启动完成后，访问以下地址：

| 入口 | 地址 |
|:---|:---|
| 🖥️ 用户前台 | [http://localhost:3000](http://localhost:3000) |
| 🏢 管理后台 | [http://localhost:3000/console](http://localhost:3000/console) |
| 🔌 API 网关 | [http://localhost:8088](http://localhost:8088) |

### 第四步（备选）：手动启动

如果不想使用启动脚本，也可以逐个启动服务。以用户服务为例：

```powershell
cd java\java-user
mvn spring-boot:run -Dspring-boot.run.profiles=prod-split -Dspring-boot.run.arguments="--spring.datasource.url=jdbc:postgresql://localhost:5432/omni_user --spring.datasource.username=postgres --spring.datasource.password=123456 --internal.api.token=omni-local-internal-token"
```

> ⚠️ 五个业务服务必须统一使用 `prod-split` profile，不可混用默认 profile。

启动前端：

```powershell
cd frontend
pnpm dev
```

---

## 📖 使用指南

### 服务端口一览

| 服务名称 | 端口 | 职能 |
|:---|:---|:---|
| Nacos | 8848 | 服务注册与配置中心 |
| java-gateway | 8088 | API 网关，统一入口 |
| java-user | 8081 | 用户注册、登录、资料管理 |
| java-ticket | 8082 | 活动管理、场次、票档、座位图 |
| java-order | 8083 | 订单创建、状态管理、超时取消 |
| java-payment | 8084 | 支付处理、支付宝对接、退款 |
| java-notification | 8085 | 异步通知推送 |
| Frontend | 3000 | Next.js 前端应用 |
| Grab Service | 3001 | 抢票核心（预留开发中） |

### 数据库拓扑

每个业务服务拥有独立的数据库，实现物理隔离：

| 服务 | 专属数据库 |
|:---|:---|
| `java-user` | `omni_user` |
| `java-ticket` | `omni_ticket_split` |
| `java-order` | `omni_order` |
| `java-payment` | `omni_payment` |
| `java-notification` | `omni_notification` |

### 测试账号

| 手机号 | 密码 | 角色 | 用户 ID | 能做什么 |
|:---|:---|:---|:---|:---|
| `13800000001` | `123456` | admin（平台管理员） | 2002 | 管理后台全部功能、审批主办方和场馆申请 |
| `13800000002` | `123456` | organizer（主办方） | 2003 | 创建管理活动、设置场次和票档、查看订单 |
| `13900000001` | `123456` | user（普通用户） | 2004 | 浏览活动、购票下单、查看订单 |

### 用户端操作流程

完整的购票流程如下：

```
注册/登录 → 浏览首页/搜索活动 → 查看活动详情
    → 选择场次与票档/选座 → 确认下单
    → 支付宝扫码支付 → 支付结果确认
    → 查看订单详情
```

### 关键 API 接口

以下是常用的 C 端 API，所有请求通过网关 `http://localhost:8088` 访问：

| 接口说明 | 方法 | 路径 |
|:---|:---|:---|
| 密码登录 | `POST` | `/api/user/login` |
| 活动列表 | `GET` | `/api/ticket/activities` |
| 活动详情 | `GET` | `/api/ticket/activities/{id}` |
| 场次座位图 | `GET` | `/api/ticket/sessions/{id}/seat-map` |
| 创建订单 | `POST` | `/api/order/create` |
| 带选座下单 | `POST` | `/api/order/create-with-seats` |
| 支付宝扫码支付 | `POST` | `/api/payment/alipay/qr-pay` |
| 支付结果同步 | `GET` | `/api/payment/alipay/sync/{orderId}` |
| 我的订单 | `GET` | `/api/order/user/{userId}` |

**登录示例（PowerShell）：**

```powershell
curl.exe --% -s -m 10 -X POST http://localhost:8088/api/user/login -H "Content-Type: application/json" -d "{\"loginType\":\"password\",\"account\":\"13900000001\",\"password\":\"123456\"}"
```

> 💡 在 PowerShell 中调用 `curl.exe` 时，务必使用 `--%` 参数，避免 JSON 引号被 PowerShell 转义导致服务器返回 500 错误。

### 订单状态说明

| 状态码 | 后端常量 | 含义 |
|:---|:---|:---|
| `1` | `STATUS_PENDING` | 待支付：订单已创建，等待用户付款 |
| `2` | `STATUS_PAID` | 已支付：付款成功，出票完成 |
| `3` | `STATUS_CANCELLED` | 已取消：用户或系统取消订单 |
| `4` | `STATUS_REFUNDED` | 已退款：订单已退款处理完毕 |

---

## ⚙️ 配置说明

### 数据库连接

所有服务的数据库连接配置通过启动参数注入，不使用默认的 `application.yml` 中的静态配置：

```powershell
--spring.datasource.url=jdbc:postgresql://localhost:5432/omni_user
--spring.datasource.username=postgres
--spring.datasource.password=123456
```

### 服务间认证

微服务之间通过 internal API 通信，所有内部接口需要在请求头中携带 Token：

```
X-Internal-Token: omni-local-internal-token
```

配置项 `internal.api.token` 或环境变量 `INTERNAL_API_TOKEN` 控制该值。

### 前端 API 超时

前端统一请求封装 `request<T>()` 的超时时间在 `frontend/src/lib/api.ts` 中配置，当前默认值为 **800ms**。

### Profile 说明

| Profile | 用途 | 适用场景 |
|:---|:---|:---|
| `prod-split`（推荐） | 五库物理隔离 | 日常开发联调 |
| `local-schema` | 本地 disposable 数据库 | 快速实验，禁止用于生产 |
| 默认（无 profile） | 历史共享库 `omni_ticket` | 仅兼容旧阶段，不推荐使用 |

> ⚠️ **重要**：不要将默认 `application.yml` 修改为 local-schema 或生产专用配置，推荐统一使用 `prod-split` profile。

---

## ❓ 常见问题 FAQ

<details>
<summary><strong>Q: 服务启动后连接到错误的数据库（omni_ticket）怎么办？</strong></summary>

**原因**：启动时使用了默认 profile，导致连回了历史共享库。

**解决**：确保每个服务都使用 `prod-split` profile 启动，并显式传入五库数据源配置。推荐使用一键启动脚本 `start-project.ps1`。
</details>

<details>
<summary><strong>Q: Internal API 返回 403 Forbidden 怎么办？</strong></summary>

**原因**：内部调用缺少 `X-Internal-Token` 或 Token 值不一致。

**解决**：确保所有服务使用相同的 internal token。本地开发推荐值为 `omni-local-internal-token`。
</details>

<details>
<summary><strong>Q: 在 PowerShell 中使用 curl 调用 API 返回 500 错误？</strong></summary>

**原因**：PowerShell 会改写 JSON 中的双引号，导致请求体格式错误。

**解决**：使用 `curl.exe --%` 调用来阻止 PowerShell 转义。
</details>

<details>
<summary><strong>Q: 访问 API 网关返回 503 Service Unavailable？</strong></summary>

**原因**：后端服务未注册到 Nacos 或未启动成功。

**解决**：检查 Nacos 控制台（http://localhost:8848/nacos）确认所有服务实例已注册，再检查各服务启动日志。
</details>

<details>
<summary><strong>Q: 下单时提示用户不存在？</strong></summary>

**原因**：`java-order` 创建订单前会通过 `java-user` 的 internal API 校验用户是否存在。

**解决**：确保使用的下单用户是测试账号中已存在的用户（如 `13900000001`）。
</details>

<details>
<summary><strong>Q: 修改 java-common 后出现 NoSuchMethodError？</strong></summary>

**原因**：公共模块更新后未重新安装，其他服务使用了旧的 class。

**解决**：先执行 `mvn clean install -pl java-common -am`，然后重启所有相关服务。
</details>

<details>
<summary><strong>Q: 支付同步后订单仍为待支付状态？</strong></summary>

**原因**：支付宝沙盒环境中的交易未实际完成支付，或回调未触发。

**解决**：确保在支付宝沙盒中完成扫码支付，然后调用 `/api/payment/alipay/sync/{orderId}` 同步支付状态。
</details>

<details>
<summary><strong>Q: SeatCraft 座位图编辑器无法加载？</strong></summary>

**原因**：场馆未创建座位图模板。

**解决**：在管理后台为场馆创建默认座位图模板，活动创建时会从模板复制座位布局。
</details>

---

## 🤝 贡献指南

我们欢迎任何形式的贡献！在参与之前，请阅读以下指引。

### 代码规范

- **后端**：遵循 MyBatis-Plus 编码规范，优先使用 `LambdaQueryWrapper` 构建查询
- **前端**：使用 `src/lib/api.ts` 中的 `request<T>()` 统一请求封装
- **命名**：遵循前端 TypeScript + 后端 Java 驼峰命名规范
- **注释**：所有函数、复杂逻辑及类/模块必须有中文注释

### 开发流程

1. **Fork** 本仓库
2. 创建特性分支：`git checkout -b feature/你的功能描述`
3. 编写代码并自测
4. **关键检查**：任何涉及服务边界的改动后，必须运行：
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
   ```
5. 确保前端类型检查通过：
   ```powershell
   cd frontend
   pnpm typecheck
   ```
6. 提交代码并发起 Pull Request

### 重要约束

- ❌ **禁止**新增跨服务的 Mapper、Entity 或 SQL JOIN 查询
- ❌ **禁止**恢复已删除的评价系统和动态系统
- ❌ **禁止**将 `sql/local/*` 目录的 SQL 用于 staging / production 环境
- ✅ 所有新增 internal API 必须校验 `X-Internal-Token`

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 🙏 致谢

Omni 万象抢票平台的诞生离不开以下优秀开源项目：

- [Spring Cloud Alibaba](https://github.com/alibaba/spring-cloud-alibaba) — 微服务基础设施
- [Nacos](https://github.com/alibaba/nacos) — 服务注册与配置中心
- [MyBatis-Plus](https://github.com/baomidou/mybatis-plus) — 强大的 ORM 增强工具
- [Next.js](https://github.com/vercel/next.js) — React 全栈框架
- [shadcn/ui](https://ui.shadcn.com/) — 高质量 UI 组件库
- [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) — 实用优先的 CSS 框架
- [PostgreSQL](https://www.postgresql.org/) — 强大的开源关系型数据库
- [Alipay Sandbox](https://open.alipay.com/) — 支付宝沙盒支付环境

**特别感谢**所有参与项目开发和测试的贡献者们！
