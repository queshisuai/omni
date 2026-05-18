# Admin 演出管理与座位票务系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 分阶段完善 B 端活动/场次/场馆管理，并把票务流程升级为区域票档、完整座位图、锁座和真实库存扣减。

**Architecture:** 先修复入口和状态一致性，再完善 B 端管理体验；随后新增场馆申请、座位模板、场次座位快照、票档区域绑定和锁座购票。每个阶段保持可独立验证、可独立提交，避免一次性改完整个票务系统。

**Tech Stack:** Java 11、Spring Boot 2.7、MyBatis-Plus、PostgreSQL、Next.js 16、React 19、TypeScript、Tailwind CSS、支付宝沙盒支付/退款。

---

## 重要执行约束

- 不主动提交；只有用户明确要求提交时才执行 `git commit`。
- 每个任务结束后只做 `git status`、`git diff --stat`、测试验证，形成可提交检查点。
- 当前工作区已有未提交修复：入驻审核页显示已取消资格。Task 1 需要纳入并完成验证。
- 不读取或输出 `java/java-payment/src/main/resources/application.yml` 中的支付宝私钥内容。
- 后端修改后需要重新构建对应模块，运行服务时还需要重启对应服务。
- 所有新后端行为优先按 TDD：先写失败测试，再实现，再验证通过。

---

## File Structure

### 已有文件重点修改

- `frontend/src/components/Header.tsx`：前台 Header 用户菜单新增后台入口。
- `frontend/src/app/merchant/page.tsx`：修复取消资格后仍可直接进后台的问题，并允许重新申请。
- `frontend/src/app/console/organizer-applications/page.tsx`：展示用户维度主办方状态，已取消资格时禁用取消按钮。
- `frontend/src/app/console/activities/page.tsx`：完善活动列表、筛选、分页、创建/编辑入口和状态操作。
- `frontend/src/app/console/sessions/page.tsx`：完善场次列表、筛选、时间校验和场馆选择。
- `frontend/src/app/console/venue/page.tsx`：admin 公共场馆管理、organizer 场馆申请入口。
- `frontend/src/app/activity/[id]/page.tsx`：接入座位图、手动选座、自动分配和锁座下单。
- `frontend/src/lib/api.ts`：新增后台管理、场馆申请、座位、锁座 API。
- `frontend/src/types/api.ts`：新增场馆申请、座位区域、座位、锁座、订单座位类型。
- `java/java-user/src/main/java/com/omni/user/dto/OrganizerApplicationResponse.java`：返回 `role` 和 `organizerStatus`。
- `java/java-user/src/main/java/com/omni/user/service/OrganizerApplicationService.java`：入驻审核列表返回用户维度状态。
- `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`：活动/场次/场馆管理扩展。
- `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java`：活动上下架和取消资格相关编排保持复用。
- `java/java-ticket/src/main/java/com/omni/ticket/entity/Venue.java`：补充场馆公共库字段如状态/容量已存在则复用。
- `java/java-order/src/main/java/com/omni/order/service/OrderService.java`：锁座订单、支付成功扣库存、取消释放座位。
- `java/java-payment/src/main/java/com/omni/payment/service/AlipayService.java`：支付成功后触发订单座位售出逻辑。
- `sql/init.sql`：新增表结构并修正注释。
- `sql/seed.sql`：重写合理演示数据。

### 后端新增文件

- `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueApplication.java`：场馆申请实体。
- `java/java-ticket/src/main/java/com/omni/ticket/mapper/VenueApplicationMapper.java`：场馆申请 Mapper。
- `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationRequest.java`：提交场馆申请请求。
- `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationReviewRequest.java`：审核场馆申请请求。
- `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationResponse.java`：场馆申请响应。
- `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`：场馆申请业务。
- `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueArea.java`：场馆座位区域模板。
- `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueSeat.java`：场馆座位模板。
- `java/java-ticket/src/main/java/com/omni/ticket/entity/SessionSeat.java`：场次座位售卖快照。
- `java/java-ticket/src/main/java/com/omni/ticket/entity/TicketTypeArea.java`：票档与区域绑定关系。
- `java/java-ticket/src/main/java/com/omni/ticket/service/SeatTemplateService.java`：生成场馆座位模板。
- `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatService.java`：生成场次座位快照。
- `java/java-ticket/src/main/java/com/omni/ticket/controller/SeatController.java`：活动详情页座位图查询。
- `java/java-order/src/main/java/com/omni/order/entity/OrderSeat.java`：订单座位关联。
- `java/java-order/src/main/java/com/omni/order/mapper/OrderSeatMapper.java`：订单座位 Mapper。
- `java/java-order/src/main/java/com/omni/order/dto/LockSeatsRequest.java`：锁座下单请求。
- `java/java-order/src/main/java/com/omni/order/dto/OrderSeatResponse.java`：订单座位响应。

### 前端新增文件

- `frontend/src/components/SeatMap.tsx`：仿大麦/影院座位图，支持缩放、拖拽、选座。
- `frontend/src/app/console/venue/applications/page.tsx`：admin 场馆申请审核页。
- `frontend/src/app/console/venue/apply/page.tsx`：organizer 场馆申请页。

### 测试文件

- `java/java-user/src/test/java/com/omni/user/service/OrganizerApplicationServiceTest.java`
- `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationServiceTest.java`
- `java/java-ticket/src/test/java/com/omni/ticket/service/SeatTemplateServiceTest.java`
- `java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatServiceTest.java`
- `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java`

---

## Task 1: 商户状态一致性与 Header 后台入口

**目标：** 修复取消资格后入驻审核页和商户入驻页状态不一致，并在 Header 用户菜单为 admin/organizer 增加进入后台入口。

**Files:**
- Modify: `java/java-user/src/main/java/com/omni/user/dto/OrganizerApplicationResponse.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/OrganizerApplicationService.java`
- Test: `java/java-user/src/test/java/com/omni/user/service/OrganizerApplicationServiceTest.java`
- Modify: `frontend/src/app/console/organizer-applications/page.tsx`
- Modify: `frontend/src/app/merchant/page.tsx`
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: 保留当前未提交修复并检查状态**

Run:

```powershell
git status --short
```

Expected: 能看到 `OrganizerApplicationResponse`、`OrganizerApplicationService`、入驻审核页、类型文件和新增测试处于未提交状态。

- [ ] **Step 2: 完成后端响应字段测试**

测试需要证明 `listForAdmin()` 返回申请状态时，也返回用户当前 `role` 和 `organizerStatus`。

Run:

```powershell
mvn test -pl java-user -am "-Dtest=OrganizerApplicationServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false"
```

Expected: `Tests run: 1, Failures: 0, Errors: 0`。

- [ ] **Step 3: 完成商户入驻页取消资格逻辑**

在 `frontend/src/app/merchant/page.tsx` 中处理：

```ts
const isCancelledOrganizer = userInfo?.organizerStatus === 3 && userInfo?.role === 'user'
```

要求：

- `isCancelledOrganizer` 时显示“主办方资格已取消，可重新提交入驻申请”。
- 不显示“当前账号可直接进入商户后台”。
- 允许重新提交入驻申请，提交后进入待审核。

- [ ] **Step 4: 完成 Header 后台入口**

在 `frontend/src/components/Header.tsx` 的登录用户菜单中增加：

```tsx
{(user?.role === 'admin' || user?.role === 'organizer') && (
  <button onClick={() => router.push('/console')}>进入后台</button>
)}
```

要求：

- 普通 user 不显示。
- admin/organizer 显示。
- 退出登录和个人中心入口不受影响。

- [ ] **Step 5: 验证**

Run:

```powershell
mvn test -pl java-user -am
```

Expected: `BUILD SUCCESS`。

Run:

```powershell
pnpm run typecheck
```

Workdir: `frontend`

Expected: `tsc --noEmit` 成功。

- [ ] **Step 6: 可提交检查点**

Run:

```powershell
git status --short
git diff --stat
```

Expected: 仅包含 Task 1 相关文件。不要提交，等待用户明确要求。

---

## Task 2: 活动管理基础体验完善

**目标：** 完善 B 端活动列表、筛选、分页、表单校验和上架前完整性检查。

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/ActivityAdminServiceTest.java`
- Modify: `frontend/src/app/console/activities/page.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: 写失败测试：上架前必须有场次和票档**

在 `ActivityAdminServiceTest` 增加测试：活动没有有效场次或可售票档时，上架应失败。

Run:

```powershell
mvn test -pl java-ticket -am "-Dtest=ActivityAdminServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false"
```

Expected: 测试因缺少上架完整性校验失败。

- [ ] **Step 2: 实现后端上架完整性校验**

在活动状态更新逻辑中，当 `status=1` 时校验：

- 活动存在。
- 至少一个 `session.status=1`。
- 至少一个关联 `ticket_type.status=1`。
- 后续座位模型完成后，再增加至少一个可售座位校验。

- [ ] **Step 3: 扩展活动列表参数**

`listAdminActivities` 增加可选参数：

```java
@RequestParam(required = false) String keyword
@RequestParam(required = false) Integer status
```

规则：

- `keyword` 模糊匹配活动名称。
- `status` 过滤活动状态。
- organizer 仍只能看自己活动。

- [ ] **Step 4: 前端活动列表改造**

`frontend/src/app/console/activities/page.tsx` 增加：

- 搜索框。
- 状态筛选。
- 分页控件。
- 加载、空态、错误重试。
- admin 文案：“平台演出管理”。
- organizer 文案：“我的演出管理”。

- [ ] **Step 5: 验证**

Run:

```powershell
mvn test -pl java-ticket -am
```

Expected: `BUILD SUCCESS`。

Run:

```powershell
pnpm run typecheck
```

Workdir: `frontend`

Expected: 通过。

---

## Task 3: 场次管理基础体验完善

**目标：** 完善场次列表、筛选、时间校验、场馆选择和冲突检查。

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Create/Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionAdminService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionAdminServiceTest.java`
- Modify: `frontend/src/app/console/sessions/page.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: 写失败测试：结束时间必须晚于开始时间**

新增 `SessionAdminServiceTest`，创建场次时 `endTime <= startTime` 应失败。

Run:

```powershell
mvn test -pl java-ticket -am "-Dtest=SessionAdminServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false"
```

Expected: 编译或测试失败，因为服务尚未实现。

- [ ] **Step 2: 写失败测试：同场馆时间冲突拒绝**

同一场馆已有未下架场次，时间区间重叠时，新场次创建失败。

Expected error: `同一场馆该时间段已有场次`。

- [ ] **Step 3: 实现 `SessionAdminService`**

职责：

- 校验用户角色。
- organizer 只能管理自己活动下场次。
- 校验时间。
- 校验场馆存在且启用。
- 校验场馆时间冲突。
- 创建/编辑场次。

- [ ] **Step 4: 前端场次管理改造**

`frontend/src/app/console/sessions/page.tsx` 增加：

- 活动筛选。
- 场馆筛选。
- 状态筛选。
- 时间排序。
- 创建/编辑表单校验。
- 显示票档数、总座位数、已售数、余票数；座位模型未完成前显示票档库存统计。

- [ ] **Step 5: 验证**

Run:

```powershell
mvn test -pl java-ticket -am
pnpm run typecheck
```

Expected: 后端测试和前端类型检查通过。

---

## Task 4: 场馆申请审核闭环

**目标：** organizer 可提交完整场馆申请，admin 可审核并选择创建新公共场馆或关联已有公共场馆。

**Files:**
- Modify: `sql/init.sql`
- Add: `sql/20260518_create_venue_application.sql`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueApplication.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/mapper/VenueApplicationMapper.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationReviewRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationServiceTest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Create: `frontend/src/app/console/venue/apply/page.tsx`
- Create: `frontend/src/app/console/venue/applications/page.tsx`
- Modify: `frontend/src/app/console/layout.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: 写 SQL**

新增表 `venue_application`：

```sql
CREATE TABLE venue_application (
    id BIGSERIAL PRIMARY KEY,
    applicant_id BIGINT NOT NULL REFERENCES "user"(id),
    venue_id BIGINT REFERENCES venue(id),
    venue_name VARCHAR(100) NOT NULL,
    city VARCHAR(50) NOT NULL,
    address VARCHAR(255) NOT NULL,
    capacity INTEGER,
    contact_name VARCHAR(50) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    qualification_no VARCHAR(100),
    business_scope TEXT,
    description TEXT,
    status SMALLINT DEFAULT 0,
    reviewer_id BIGINT REFERENCES "user"(id),
    review_note TEXT,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    review_time TIMESTAMP
);
```

状态：`0=待审核 1=已通过 2=已驳回`。

- [ ] **Step 2: 写失败测试：organizer 提交申请**

测试 organizer 提交完整资料后，生成待审核申请。

Run:

```powershell
mvn test -pl java-ticket -am "-Dtest=VenueApplicationServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false"
```

Expected: 编译失败或测试失败，因为实体和服务尚未存在。

- [ ] **Step 3: 实现提交/我的申请/admin 列表**

实现接口：

- `POST /api/ticket/admin/venue-applications`
- `GET /api/ticket/admin/venue-applications/my?userId=`
- `GET /api/ticket/admin/venue-applications?userId=&status=`

权限：

- organizer/admin 可提交。
- admin 可看全部。
- organizer 只能看自己的。

- [ ] **Step 4: 写失败测试：审核通过创建新场馆**

admin 审核通过并选择 `mode=create` 时：

- 创建 `venue`。
- 将 `venue_application.status=1`。
- 写入 `venue_id`。

- [ ] **Step 5: 写失败测试：审核通过关联已有场馆**

admin 审核通过并选择 `mode=link`、传入 `venueId` 时：

- 不创建新 `venue`。
- 将申请关联到已有 `venue`。

- [ ] **Step 6: 前端页面**

新增：

- organizer 场馆申请页。
- admin 场馆申请审核页。
- 通过时选择“创建新场馆”或“关联已有场馆”。
- 驳回必须填写原因。

- [ ] **Step 7: 验证**

Run:

```powershell
mvn test -pl java-ticket -am
pnpm run typecheck
```

Expected: 通过。

---

## Task 5: 场馆座位模板

**目标：** admin 可为公共场馆配置区域，并自动生成场馆座位模板。

**Files:**
- Modify: `sql/init.sql`
- Add: `sql/20260518_create_venue_seat_template.sql`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueArea.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueSeat.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/mapper/VenueAreaMapper.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/mapper/VenueSeatMapper.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatTemplateService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatTemplateServiceTest.java`
- Modify: `frontend/src/app/console/venue/page.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: 写 SQL**

新增 `venue_area` 和 `venue_seat`。

`venue_area` 字段：`venue_id`、`name`、`row_count`、`seats_per_row`、`row_start`、`seat_start`、`color`、`sort`、`status`。

`venue_seat` 字段：`venue_id`、`area_id`、`row_no`、`seat_no`、`seat_label`、`x`、`y`、`status`。

- [ ] **Step 2: 写失败测试：区域生成座位**

输入区域：`rowCount=2`、`seatsPerRow=3`，应生成 6 个座位。

Run:

```powershell
mvn test -pl java-ticket -am "-Dtest=SeatTemplateServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false"
```

Expected: 失败，因为服务尚未实现。

- [ ] **Step 3: 实现座位生成**

`SeatTemplateService` 提供：

- 创建区域。
- 根据区域生成座位。
- 更新区域时可选择重新生成座位。
- 已被场次使用的区域不允许破坏性重建。

- [ ] **Step 4: 前端场馆座位模板表单**

admin 在场馆管理页可配置：

- 区域名称。
- 排数。
- 每排座位数。
- 起始排号。
- 起始座号。
- 颜色。
- 排序。

- [ ] **Step 5: 验证**

Run:

```powershell
mvn test -pl java-ticket -am
pnpm run typecheck
```

Expected: 通过。

---

## Task 6: 场次座位快照

**目标：** 创建场次后，从场馆座位模板复制生成场次座位售卖快照。

**Files:**
- Modify: `sql/init.sql`
- Add: `sql/20260518_create_session_seat.sql`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/SessionSeat.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/mapper/SessionSeatMapper.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatServiceTest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionAdminService.java`

- [ ] **Step 1: 写 SQL**

新增 `session_seat`：

- `id`
- `session_id`
- `venue_id`
- `area_id`
- `venue_seat_id`
- `row_no`
- `seat_no`
- `seat_label`
- `status`
- `lock_expire_time`
- `order_id`
- `ticket_type_id`
- `create_time`
- `update_time`

- [ ] **Step 2: 写失败测试：创建场次生成座位快照**

给定场馆有 6 个启用座位，创建场次后生成 6 个 `session_seat`。

- [ ] **Step 3: 实现 `SessionSeatService.generateForSession`**

规则：

- 只复制启用的场馆座位。
- 同一场次只生成一次。
- 如果场次已有座位快照，不重复生成。

- [ ] **Step 4: 接入场次创建**

`SessionAdminService.createSession` 成功后调用 `generateForSession(sessionId)`。

- [ ] **Step 5: 验证**

Run:

```powershell
mvn test -pl java-ticket -am
```

Expected: 通过。

---

## Task 7: 票档绑定区域与库存自动计算

**目标：** 票档绑定座位区域，库存由绑定区域的场次座位数量自动计算。

**Files:**
- Modify: `sql/init.sql`
- Add: `sql/20260518_create_ticket_type_area.sql`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/TicketTypeArea.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/mapper/TicketTypeAreaMapper.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `frontend/src/app/console/sessions/page.tsx`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 写 SQL**

新增 `ticket_type_area`：

- `ticket_type_id`
- `session_id`
- `area_id`

唯一约束：同一 `session_id + area_id` 只能绑定一个票档。

- [ ] **Step 2: 写失败测试：同一区域不能绑定多个票档**

创建两个票档都绑定同一区域时，第二个应失败。

- [ ] **Step 3: 实现票档创建库存计算**

创建票档时：

- 传入 `areaIds`。
- 统计这些区域下 `session_seat.status=AVAILABLE` 的数量。
- 设置 `ticket_type.total_stock`。
- 设置 `ticket_type.remain_stock`。
- 写入 `ticket_type_area`。

- [ ] **Step 4: 前端票档表单改造**

票档表单显示该场次可用区域，用户选择区域后自动显示预计库存。库存不可手动超过区域座位数。

- [ ] **Step 5: 验证**

Run:

```powershell
mvn test -pl java-ticket -am
pnpm run typecheck
```

Expected: 通过。

---

## Task 8: 座位图查询与前端 SeatMap

**目标：** C 端活动详情页根据票档展示可选座位图，支持缩放、拖拽、手动选座和自动分配。

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/controller/SeatController.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/SeatMapResponse.java`
- Modify: `frontend/src/components/SeatMap.tsx`
- Modify: `frontend/src/app/activity/[id]/page.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: 写后端座位图接口**

新增：

```http
GET /api/ticket/sessions/{sessionId}/ticket-types/{ticketTypeId}/seats
```

返回：区域、座位、状态、舞台方向文案、票档价格。

- [ ] **Step 2: 前端 SeatMap 组件**

`SeatMap` props：

```ts
type SeatMapProps = {
  seats: SessionSeatVO[]
  maxSelectable: number
  selectedSeatIds: number[]
  onChange: (seatIds: number[]) => void
}
```

功能：

- 可选座位点击选中。
- 已售、锁定、不可售不可选。
- 支持缩放和拖拽。
- 顶部展示舞台方向。

- [ ] **Step 3: 自动分配**

在前端先实现自动分配：优先同一区域同一排连续座位；找不到连续座位时按区域排序选可用座位。

- [ ] **Step 4: 活动详情页接入**

选择场次和票档后加载座位图。用户可手动选座或自动分配。

- [ ] **Step 5: 验证**

Run:

```powershell
mvn test -pl java-ticket -am
pnpm run typecheck
```

Expected: 通过。

---

## Task 9: 锁座下单与支付成功扣库存

**目标：** 下单时锁定具体座位 15 分钟，支付成功后座位售出并扣减票档库存。

**Files:**
- Modify: `sql/init.sql`
- Add: `sql/20260518_create_order_seat.sql`
- Create: `java/java-order/src/main/java/com/omni/order/entity/OrderSeat.java`
- Create: `java/java-order/src/main/java/com/omni/order/mapper/OrderSeatMapper.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/LockSeatsRequest.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/AlipayService.java`
- Modify: `frontend/src/app/activity/[id]/page.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: 写 SQL**

新增 `order_seat`，记录订单和座位关系。

- [ ] **Step 2: 写失败测试：锁座成功**

给定座位状态为 `AVAILABLE`，调用锁座下单后：

- 创建待支付订单。
- 写入 `order_seat`。
- 座位状态改为 `LOCKED`。
- `lock_expire_time = now + 15 minutes`。

- [ ] **Step 3: 写失败测试：已锁/已售座位不可锁**

座位状态不是 `AVAILABLE` 时，下单失败。

- [ ] **Step 4: 实现锁座下单接口**

新增：

```http
POST /api/order/create-with-seats
```

请求：`userId`、`sessionId`、`ticketTypeId`、`seatIds`。

订单金额由后端根据票档价格和座位数计算。

- [ ] **Step 5: 支付成功扣库存**

`OrderService.markPaid` 增加：

- 将订单座位从 `LOCKED` 改为 `SOLD`。
- 将对应 `session_seat` 改为 `SOLD`。
- 扣减 `ticket_type.remain_stock`。

- [ ] **Step 6: 前端接入**

活动详情页确认订单时调用 `create-with-seats`，不再只传数量和票档。

- [ ] **Step 7: 验证**

Run:

```powershell
mvn test -pl java-order,java-payment -am
pnpm run typecheck
```

Expected: 通过。

---

## Task 10: 取消/超时释放座位与退款座位恢复

**目标：** 取消订单、超时未支付、退款成功后正确处理座位和库存。

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java`

- [ ] **Step 1: 写失败测试：取消订单释放锁座**

待支付订单取消后：

- `order.status=3`。
- `order_seat.status=CANCELLED`。
- `session_seat.status=AVAILABLE`。

- [ ] **Step 2: 写失败测试：超时锁座释放**

锁座超过 15 分钟且未支付时，释放座位。

- [ ] **Step 3: 实现释放逻辑**

新增 `releaseExpiredLocks()`，第一阶段可由接口触发：

```http
POST /api/order/internal/release-expired-locks
```

后续可接定时任务。

- [ ] **Step 4: 写失败测试：退款后按开演时间恢复**

规则：

- 距离开演大于 24 小时且活动/场次/票档未下架：恢复为可售。
- 小于等于 24 小时：改为 `REFUNDED_CLOSED`。
- 下架退款：改为 `REFUNDED_CLOSED`。

- [ ] **Step 5: 接入退款成功**

`markRefunded` 或退款成功后的订单内部接口触发座位处理。

- [ ] **Step 6: 验证**

Run:

```powershell
mvn test -pl java-order,java-payment -am
```

Expected: 通过。

---

## Task 11: 重写合理种子数据

**目标：** 替换不合理模拟数据，提供中等规模、城市覆盖合理、场馆/场次/票档/座位匹配的演示数据。

**Files:**
- Modify: `sql/seed.sql`
- Optional Add: `sql/20260518_seed_realistic_events.sql`

- [ ] **Step 1: 定义城市和场馆**

覆盖城市：北京、上海、广州、深圳、成都、杭州、南京、武汉、西安、重庆。

每个城市 1 到 2 个场馆。每个场馆包含合理容量和区域。

- [ ] **Step 2: 生成场馆区域和座位模板数据**

每个场馆至少包含：VIP 区、A 区、B 区或看台区。

- [ ] **Step 3: 生成活动和未来场次**

每类演出 3 到 5 个活动，每个活动 1 到 3 个未来场次。

要求：

- 不使用过去时间。
- 同一场馆时间不冲突。
- 城市与场馆匹配。

- [ ] **Step 4: 生成票档和区域绑定**

票档示例：

- VIP：绑定 VIP 区。
- A 区票：绑定 A 区。
- 普通票：绑定 B 区或看台区。

- [ ] **Step 5: 验证 SQL 可执行**

在本地 PostgreSQL 可用时执行种子脚本；如果本地数据库不可用，至少通过人工检查外键顺序和字段匹配。

Run:

```powershell
mvn clean package -pl java-user,java-ticket,java-order,java-payment -am -DskipTests
pnpm run typecheck
```

Expected: 构建和类型检查通过。

---

## Task 12: 端到端验证清单

**目标：** 完整验证后台管理、座位购票、支付、退款、状态展示。

**Files:**
- No code changes expected.

- [ ] **Step 1: 后端构建**

Run:

```powershell
mvn clean package -pl java-user,java-ticket,java-order,java-payment -am -DskipTests
```

Expected: `BUILD SUCCESS`。

- [ ] **Step 2: 前端类型检查**

Run in `frontend`:

```powershell
pnpm run typecheck
```

Expected: `tsc --noEmit` 成功。

- [ ] **Step 3: 手工验证场景**

验证：

- admin/organizer 在 Header 看到进入后台。
- 已取消资格用户在商户入驻页可重新申请。
- admin 创建或编辑场馆区域并生成座位。
- organizer 提交场馆申请，admin 审核通过并创建/关联公共场馆。
- admin 创建活动、场次、票档并绑定区域。
- 用户手动选座下单。
- 用户自动分配座位下单。
- 支付成功后座位变已售，库存扣减。
- 取消订单释放座位。
- 退款成功后按开演时间判断是否重新可售。
- 活动下架退款不重新可售。

---

## Self-Review Checklist

- [ ] 每个设计需求都至少映射到一个 Task。
- [ ] 每个 Task 都可独立验证。
- [ ] 每个 Task 都是可提交检查点，但不自动提交。
- [ ] 没有把完整座位图和库存扣减挤在单个任务里。
- [ ] 没有使用未定义的状态名或 DTO 名称。
- [ ] 没有把用户可重新申请和直接进入后台混淆。
- [ ] 支付、取消、退款都覆盖座位和库存流转。
