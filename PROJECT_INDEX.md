# Omni 万象抢票平台 - 项目文件索引

> 本文件是项目全量文件地图，供 AI 代理快速定位代码位置。  
> 项目概述、技术栈、启动方式等见 [`CLAUDE.md`](./CLAUDE.md)。

---

## 1. 后端 Java 服务

### 1.1 java-common — 公共模块

| 分类 | 文件 | 路径 |
|:---|:---|:---|
| 配置 | `MybatisPlusConfig` | `java-common/.../config/MybatisPlusConfig.java` |
| | `WebMvcConfig` | `java-common/.../config/WebMvcConfig.java` |
| 异常 | `BusinessException` | `java-common/.../exception/BusinessException.java` |
| | `GlobalExceptionHandler` | `java-common/.../exception/GlobalExceptionHandler.java` |
| 响应 | `Result` | `java-common/.../common/result/Result.java` |
| | `ResultCode` | `java-common/.../common/result/ResultCode.java` |
| 工具 | `JwtUtil` | `java-common/.../common/util/JwtUtil.java` |

### 1.2 java-gateway — API 网关 (:8088)

| 文件 | 路径 |
|:---|:---|
| `GatewayApplication` | `java-gateway/.../GatewayApplication.java` |
| `application.yml` (路由配置) | `java-gateway/src/main/resources/application.yml` |

### 1.3 java-user — 用户服务 (:8081)

| 分类 | 文件 | 路径 |
|:---|:---|:---|
| **控制器** | `UserController` | `java-user/.../controller/UserController.java` |
| | `SupportController` | `java-user/.../controller/SupportController.java` |
| **服务** | `UserService` | `java-user/.../service/UserService.java` |
| | `OrganizerApplicationService` | `java-user/.../service/OrganizerApplicationService.java` |
| | `CustomerSupportService` | `java-user/.../service/CustomerSupportService.java` |
| | `HelpCenterService` | `java-user/.../service/HelpCenterService.java` |
| | `SupportAiService` | `java-user/.../service/SupportAiService.java` |
| | `SupportKnowledgeBase` | `java-user/.../service/SupportKnowledgeBase.java` |
| | `OllamaSupportLocalModelClient` | `java-user/.../service/OllamaSupportLocalModelClient.java` |
| **实体** | `User` | `java-user/.../entity/User.java` |
| | `OrganizerApplication` | `java-user/.../entity/OrganizerApplication.java` |
| **Mapper** | `UserMapper` | `java-user/.../mapper/UserMapper.java` |
| | `OrganizerApplicationMapper` | `java-user/.../mapper/OrganizerApplicationMapper.java` |
| **DTO** (10) | `LoginRequest`, `LoginResponse`, `RegisterRequest`, `UserInfoResponse`, `ChangePasswordRequest`, `ResetPasswordRequest`, `UpdateProfileRequest`, `OrganizerApplicationRequest`, `OrganizerApplicationResponse`, `OrganizerApplicationReviewRequest` | `java-user/.../dto/` |

**API 端点：**
- `POST /api/user/login` — 登录
- `POST /api/user/register` — 注册
- `POST /api/user/logout` — 登出
- `GET /api/user/info` — 用户信息
- `POST /api/user/change-password` — 修改密码
- `POST /api/user/reset-password` — 重置密码
- `POST /api/user/send-sms` — 发送验证码 (Mock: `666666`)
- `PUT /api/user/profile` — 更新资料
- `POST /api/user/organizer/apply` — 申请成为主办方
- `GET /api/user/organizer/my-application` — 查看申请状态
- `POST /api/user/organizer/review` — 审批申请(admin)
- `GET /api/user/help/faqs` — 帮助中心 FAQ，数据来自 `SupportKnowledgeBase`
- `POST /api/user/support/conversations` — 创建客服会话
- `POST /api/user/support/conversations/{id}/messages/stream` — 客服消息 SSE 流式回复

**客服 AI：**
- 前端 `/help` 通过 `frontend/src/lib/api.ts` 的 `sendSupportMessageStream()` 调用 SSE。
- 后端先查 `SupportKnowledgeBase` FAQ/关键词索引，命中后立即分段返回；未命中才调用 `SupportLocalModelClient`。
- 本地模型默认配置在 `java-user/src/main/resources/application.yml`：`OMNI_SUPPORT_AI_LOCAL_ENDPOINT=http://localhost:11434/api/chat`，`OMNI_SUPPORT_AI_LOCAL_MODEL=Qwen2.5:7b`。

### 1.4 java-ticket — 票务服务 (:8082)

#### 控制器 (5)

| 控制器 | 路由前缀 | 说明 |
|:---|:---|:---|
| `ActivityController` | `/api/ticket` | C端活动列表/详情/分类 |
| `AdminController` | `/api/ticket/admin` | B端活动/场次/场馆/座位图/票档 CRUD |
| `SeatController` | `/api/ticket` | C端选座 |
| `ReservationController` | `/api/ticket` | 预约 (弃用) |

#### 服务 (13)

| 服务 | 说明 |
|:---|:---|
| `ActivityService` | C端活动列表/详情 (含批量查询优化) |
| `ActivityAdminService` | B端活动管理/停用/退款 |
| `SessionAdminService` | B端场次管理 |
| `SeatTemplateService` | 旧版场馆座位模板 (venue_area/venue_seat) |
| `SeatCraftTemplateService` | SeatCraft 场馆模板 (仅 admin 可创建) |
| `SeatCraftLayoutGenerator` | 生成 session_seat 快照 |
| `ActivitySeatLayoutService` | 活动座位图: 模板复制/查询/编辑 |
| `SessionSeatLayoutService` | 场次座位图: 复制/票档草稿/库存计算 |
| `SessionSeatService` | 场次座位同步 (venue_session → session_seat) |
| `TicketTypeAreaService` | 票档-区域绑定 |
| `AdminSummaryService` | B端数据概览 |
| `VenueApplicationService` | 场馆申请/审批 |
| `ReservationService` | 预约 (弃用) |

#### 关键实体 (22)

| 实体 | 表名 | 说明 |
|:---|:---|:---|
| `Activity` | `activity` | 活动 |
| `Session` | `session` | 场次 |
| `TicketType` | `ticket_type` | 票档 |
| `Venue` | `venue` | 场馆 |
| `VenueArea` | `venue_area` | 场馆区域 (旧版) |
| `VenueSeat` | `venue_seat` | 场馆座位 (旧版) |
| `VenueApplication` | `venue_application` | 场馆申请 |
| `VenueSeatLayoutTemplate` | `venue_seat_layout_template` | SeatCraft 场馆模板 |
| `VenueSeatLayoutTemplateSection` | `venue_seat_layout_template_section` | 模板分区 |
| `ActivitySeatLayout` | `activity_seat_layout` | 活动座位图 |
| `ActivitySeatLayoutSection` | `activity_seat_layout_section` | 活动座位图分区 |
| `SessionSeatLayout` | `session_seat_layout` | 场次座位图 |
| `SessionSeatLayoutSection` | `session_seat_layout_section` | 场次座位图分区 |
| `SessionSeat` | `session_seat` | 场次座位 (快照) |
| `Category` | `category` | 分类 |
| `Artist` | `artist` | 艺人 |
| `UserRef` | `"user"` | 用户引用 (跨模块) |
| `TicketTypeArea` | `ticket_type_area` | 票档区域关联 |

#### B端 API 端点 (AdminController)

**活动管理：**
- `GET /api/ticket/admin/activities?userId=` — 活动列表
- `POST /api/ticket/admin/activities` — 创建活动
- `PUT /api/ticket/admin/activities/{id}` — 更新活动
- `GET /api/ticket/admin/activities/{id}?userId=` — 活动详情
- `DELETE /api/ticket/admin/activities/{id}?userId=` — 删除活动
- `PUT /api/ticket/admin/activities/{id}/status` — 更新状态
- `POST /api/ticket/admin/activities/{id}/deactivate` — 停用(含退款)

**座位图 (SeatCraft)：**
- `POST /api/ticket/admin/venues/{venueId}/seat-layout-templates/defaults?userId=` — 创建/获取模板
- `GET /api/ticket/admin/venues/{venueId}/seat-layout-templates?userId=` — 列出模板
- `POST /api/ticket/admin/activities/{id}/seat-layout/from-template` — 活动从模板创建座位图
- `GET /api/ticket/admin/activities/{id}/seat-layout?userId=` — 获取活动座位图
- `PUT /api/ticket/admin/activities/{id}/seat-layout` — 更新活动座位图
- `POST /api/ticket/admin/sessions/{id}/seat-layout/from-template` — 场次从模板创建
- `POST /api/ticket/admin/sessions/{id}/seat-layout/from-activity` — 场次从活动复制
- `GET /api/ticket/admin/sessions/{id}/seat-layout?userId=` — 获取场次座位图
- `GET /api/ticket/admin/sessions/{id}/seat-layout/ticket-drafts?userId=` — 场次票档草稿
- `PUT /api/ticket/admin/sessions/{id}/seat-layout` — 更新场次座位图

**场次/票档：**
- `POST /api/ticket/admin/sessions` — 创建场次
- `PUT /api/ticket/admin/sessions/{id}` — 更新场次
- `DELETE /api/ticket/admin/sessions/{id}?userId=` — 删除场次
- `GET /api/ticket/admin/sessions?...` — 场次列表
- `POST /api/ticket/admin/ticket-types` — 创建票档 (含旧版 areaIds 和新版 layoutSectionIds)
- `PUT /api/ticket/admin/ticket-types/{id}` — 更新票档
- `DELETE /api/ticket/admin/ticket-types/{id}?userId=` — 删除票档

**场馆管理：**
- `GET /api/ticket/admin/venues?userId=` — 场馆列表
- `POST /api/ticket/admin/venues` — 创建场馆 (admin only)
- `PUT /api/ticket/admin/venues/{id}` — 更新场馆 (admin only)
- `POST /api/ticket/admin/venues/{id}/areas` — 创建区域 (旧版)
- `POST /api/ticket/admin/venues/{id}/seats` — 创建座位 (旧版)
- `POST /api/ticket/admin/venue-applications` — 场馆申请
- `GET /api/ticket/admin/venue-applications` — 审核列表
- `POST /api/ticket/admin/venue-applications/{id}/review` — 审批

#### C端 API 端点

- `GET /api/ticket/activities?page=&size=&categoryId=` — 活动列表
- `GET /api/ticket/activities/{id}` — 活动详情 (含场次+票档)
- `GET /api/ticket/categories` — 分类列表
- `GET /api/ticket/sessions/{sessionId}/seats` — 选座 (旧版)
- `GET /api/ticket/sessions/{sessionId}/seat-map` — 座位图 (旧版)

### 1.5 java-order — 订单服务 (:8083)

| 分类 | 文件 | 路径 |
|:---|:---|:---|
| **控制器** | `OrderController` | `java-order/.../controller/OrderController.java` |
| **服务** | `OrderService` | `java-order/.../service/OrderService.java` |
| | `SeatLockScheduler` | `java-order/.../service/SeatLockScheduler.java` |
| **实体** | `Order`, `OrderSeat`, `SessionSeat`, `TicketType` | `java-order/.../entity/` |

**API 端点：**
- `POST /api/order/create` — 创建订单
- `GET /api/order/list?userId=` — 订单列表
- `GET /api/order/{id}` — 订单详情
- `POST /api/order/{id}/pay` — 支付 (沙盒直接改状态)
- `POST /api/order/{id}/cancel` — 取消订单
- `POST /api/order/{id}/refund` — 退款申请
- `POST /api/order/lock-seats` — 锁座 (内部/Feign)

**订单状态码：** `1=待支付` `2=已支付` `3=已取消` `4=已退款`

### 1.6 java-payment — 支付服务 (:8084)

| 分类 | 文件 | 路径 |
|:---|:---|:---|
| **控制器** | `PaymentController`, `AlipayController`, `RefundController` | `java-payment/.../controller/` |
| **服务** | `PaymentService`, `AlipayService`, `RefundService` | `java-payment/.../service/` |
| **实体** | `Payment`, `RefundRequest`, `UserRef`, `SessionRef`, `ActivityRef` | `java-payment/.../entity/` |

### 1.7 java-notification — 通知服务 (:8085)

| 分类 | 文件 | 路径 |
|:---|:---|:---|
| **控制器** | `NotificationController` | `java-notification/.../controller/` |
| **服务** | `NotificationService` | `java-notification/.../service/` |
| **实体** | `Notification` | `java-notification/.../entity/` |

---

## 2. 前端 Next.js

### 2.1 C端页面 (`frontend/src/app/`)

| 路由 | 文件 | 说明 |
|:---|:---|:---|
| `/` | `page.tsx` | 首页 (Banner+分类+活动卡片) |
| `/login` | `login/page.tsx` | 登录 (密码/短信) |
| `/register` | `register/page.tsx` | 注册 |
| `/forgot-password` | `forgot-password/page.tsx` | 忘记密码 |
| `/search` | `search/page.tsx` | 搜索活动 |
| `/activity/[id]` | `activity/[id]/page.tsx` | 活动详情 (场次/票档/选座/购买) |
| `/orders` | `orders/page.tsx` | 我的订单 |
| `/profile` | `profile/page.tsx` | 个人中心 |
| `/profile/account` | `profile/account/page.tsx` | 账号设置 |
| `/help` | `help/page.tsx` | 帮助中心、AI 客服、转人工客服 |
| `/merchant` | `merchant/page.tsx` | 我是商家 |
| `/payment/result` | `payment/result/page.tsx` | 支付结果 |

### 2.2 B端后台 (`frontend/src/app/console/`)

| 路由 | 文件 | 说明 |
|:---|:---|:---|
| `/console` | `layout.tsx` | 后台布局 (侧边栏) |
| `/console` | `page.tsx` | 数据概览 (summary) |
| `/console/activities` | `activities/page.tsx` | 活动列表 |
| `/console/activities/new` | `activities/new/page.tsx` | 新建活动 (3步向导) |
| `/console/activities/[id]/edit` | `activities/[id]/edit/page.tsx` | 编辑活动 |
| `/console/activities/[id]/seat-layout` | `activities/[id]/seat-layout/page.tsx` | 编辑座位图 |
| `/console/sessions` | `sessions/page.tsx` | 场次管理 |
| `/console/orders` | `orders/page.tsx` | 订单查看 |
| `/console/venue` | `venue/page.tsx` | 场馆列表 |
| `/console/venue/apply` | `venue/apply/page.tsx` | 申请场馆 |
| `/console/venue/applications` | `venue/applications/page.tsx` | 场馆申请审核 |
| `/console/venue/[id]/seats` | `venue/[id]/seats/page.tsx` | 旧版座位管理 |
| `/console/organizer-applications` | `organizer-applications/page.tsx` | 主办方申请审核 |
| `/console/refunds` | `refunds/page.tsx` | 退款管理 |
| `/console/profile` | `profile/page.tsx` | 主办方资料 |

### 2.3 核心库 (`frontend/src/lib/`)

| 文件 | 说明 |
|:---|:---|
| `api.ts` | API 请求封装 `request<T>()`，超时 800ms，含客服 SSE `sendSupportMessageStream()` |
| `auth.ts` | 认证管理 (localStorage token + user, 含 `getUser()`/`login()`/`logout()`) |
| `utils.ts` | 工具函数 |
| `mock-data.ts` | Mock 数据 (极少使用) |

### 2.4 类型 (`frontend/src/types/`)

| 文件 | 说明 |
|:---|:---|
| `api.ts` | 所有 API 响应类型 (Entity/VO/Request) |
| `damai.ts` | 大麦网风格类型 |

### 2.5 组件 (`frontend/src/components/`)

| 文件 | 说明 |
|:---|:---|
| `Header.tsx` | C端头部导航 |
| `Footer.tsx` | C端底部 |
| `Banner.tsx` | 首页轮播 |
| `CategoryNav.tsx` | 分类导航 |
| `TicketCard.tsx` | 活动卡片 |
| `SectionRow.tsx` | 首页活动区块 |
| `SeatMap.tsx` | C端选座 (旧版, 回退方案) |
| `LoginForm.tsx` | 登录表单 |
| `LoginHeader.tsx` | 登录页头部 |
| `LoginFooter.tsx` | 登录页底部 |
| `RegisterForm.tsx` | 注册表单 |
| `AlipayQrPayModal.tsx` | 支付宝二维码支付弹窗 |

**SeatCraft 组件：**
| 文件 | 说明 |
|:---|:---|
| `seatcraft/SeatCanvas.tsx` | Canvas 座位渲染 |
| `seatcraft/SeatLayoutDesigner.tsx` | B端座位图编辑器 |
| `seatcraft/SeatSelectionMap.tsx` | C端选座交互 |
| `seatcraft/SeatLayoutControls.tsx` | 编辑器控制栏 |
| `seatcraft/layout.ts` | 布局工具函数 |
| `seatcraft/types.ts` | 类型定义 |

---

## 3. SQL 数据库

| 文件 | 说明 |
|:---|:---|
| `init.sql` | 18张建表语句 (`"user"`, `"order"`, `activity`, `session`, `ticket_type`, `venue`, `venue_area`, `venue_seat`, `category`, `artist`, `review`, `moment`, `notification`, `reservation`, `payment`, `refund_request`, `seat`, `ticket_type_area`) |
| `seed.sql` | 种子数据 (测试账号/场馆/分类/活动) |
| `20260517_create_organizer_application.sql` | 主办方申请表 |
| `20260517_create_refund_request.sql` | 退款申请表 |
| `20260518_create_venue_seat_template.sql` | 旧版座位模板 |
| `20260518_create_order_seat.sql` | 订单座位表 |
| `20260518_create_ticket_type_area.sql` | 票档区域表 |
| `20260518_create_session_seat.sql` | 场次座位表 (快照) |
| `20260518_create_venue_application.sql` | 场馆申请表 |
| `20260519_create_seatcraft_layouts.sql` | **SeatCraft 6张新表** (venue_seat_layout_template, venue_seat_layout_template_section, activity_seat_layout, activity_seat_layout_section, session_seat_layout, session_seat_layout_section) + ALTER session_seat + 9索引 |

---

## 4. 其他模块

### 4.1 NestJS 抢票服务 (`nestjs/grab-service/`)
- 端口 :3001，Redis Lua 原子扣减（待开发）
- `src/grab/grab.controller.ts` — 抢票接口
- `src/grab/grab.service.ts` — 抢票逻辑
- `src/grab/redis.service.ts` — Redis Lua 脚本

### 4.2 SeatCraft 独立工具 (`seatcraft/`)
- Vite + React 独立选座图设计工具
- 组件: `SeatMap.tsx`, `Controls.tsx`
- `docs/usage.md` — 使用说明
- `metadata.json` — 组件元数据

### 4.3 设计文档 (`docs/`)

**规格文档 (5):**
| 文件 | 说明 |
|:---|:---|
| `2026-05-12-omni-ticket-design.md` | 总体设计 |
| `2026-05-18-admin-console-fixes-seat-editor-design.md` | 后台+座位编辑器 |
| `2026-05-18-admin-events-seat-ticketing-design.md` | 活动+选座售票 |
| `2026-05-18-alipay-qr-payment-safety-design.md` | 支付宝扫码支付安全 |
| `2026-05-19-seatcraft-layout-integration-design.md` | SeatCraft 集成设计 |

---

## 5. API 调用链速查

### 活动创建流程 (B端)
```
前端 console/activities/new/page.tsx
  → listCategories()                        GET  /api/ticket/categories
  → listAdminVenues(userId)                 GET  /api/ticket/admin/venues?userId=
  → ensureSeatLayoutTemplates(venueId, uid) POST /api/ticket/admin/venues/{id}/seat-layout-templates/defaults?userId=
  → createAdminActivity({...})              POST /api/ticket/admin/activities
  → createActivitySeatLayoutFromTemplate    POST /api/ticket/admin/activities/{id}/seat-layout/from-template
  → createAdminSession({...})               POST /api/ticket/admin/sessions
  → createAdminTicketType({...})            POST /api/ticket/admin/ticket-types
```

### 购票流程 (C端)
```
前端 activity/[id]/page.tsx
  → 活动详情 API                            GET  /api/ticket/activities/{id}
  → 选座 (如有 SeatCraft layout)            GET  /api/ticket/sessions/{id}/seat-map
  → 确认订单 → 创建订单                     POST /api/order/create
  → 立即支付                                POST /api/order/{id}/pay
  → 跳转 /orders
```

---

## 6. 文件统计

| 分类 | 文件数 |
|:---|:---:|
| Java (7模块) | ~187 |
| 前端 (pages/lib/components/types) | ~62 |
| SQL 迁移脚本 | 11 |
| NestJS 抢票 | 9 |
| SeatCraft 工具 | 16 |
| 设计文档 | 14 |
| 根目录 | 9 |
| **总计** | **~313** |
