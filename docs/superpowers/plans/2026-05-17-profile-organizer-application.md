# 个人中心与商户入驻审核 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 C 端个人中心、B 端个人中心、首页商户入驻入口，以及 admin 审核制主办方入驻流程。

**Architecture:** 后端集中在 `java-user`：新增安全用户资料 VO、资料更新、改密、商户入驻申请表与审核接口。前端新增 `/profile`、`/profile/account`、`/merchant`、`/console/profile`、`/console/organizer-applications`，并通过 `frontend/src/lib/api.ts` 调用类型化接口。入驻申请用独立表保存完整资料和驳回原因，审核通过时事务性更新申请状态与 `user.role=organizer`。

**Tech Stack:** Java 11、Spring Boot 2.7、MyBatis-Plus、PostgreSQL、Next.js 16、React 19、TypeScript、Tailwind CSS。

---

## File Structure

后端新增文件：
- `sql/migrations/shared/20260517_create_organizer_application.sql`：已有库增量建表脚本。
- `java/java-user/src/main/java/com/omni/user/entity/OrganizerApplication.java`：入驻申请实体。
- `java/java-user/src/main/java/com/omni/user/mapper/OrganizerApplicationMapper.java`：入驻申请 Mapper。
- `java/java-user/src/main/java/com/omni/user/dto/UserInfoResponse.java`：安全用户信息响应，不含 `password`。
- `java/java-user/src/main/java/com/omni/user/dto/UpdateProfileRequest.java`：资料更新请求。
- `java/java-user/src/main/java/com/omni/user/dto/ChangePasswordRequest.java`：修改密码请求。
- `java/java-user/src/main/java/com/omni/user/dto/OrganizerApplicationRequest.java`：入驻申请提交/修改请求。
- `java/java-user/src/main/java/com/omni/user/dto/OrganizerApplicationResponse.java`：入驻申请响应。
- `java/java-user/src/main/java/com/omni/user/dto/OrganizerApplicationReviewRequest.java`：admin 审核请求。
- `java/java-user/src/main/java/com/omni/user/service/OrganizerApplicationService.java`：入驻申请业务。

后端修改文件：
- `sql/init.sql`：新库初始化时创建 `organizer_application` 表和索引。
- `java/java-user/src/main/java/com/omni/user/service/UserService.java`：安全 VO、资料更新、修改密码。
- `java/java-user/src/main/java/com/omni/user/controller/UserController.java`：新增资料与入驻审核接口。

前端新增文件：
- `frontend/src/app/profile/page.tsx`：C 端个人中心首页。
- `frontend/src/app/profile/account/page.tsx`：C 端账号资料与改密。
- `frontend/src/app/merchant/page.tsx`：商户入驻落地页。
- `frontend/src/app/console/profile/page.tsx`：B 端个人中心。
- `frontend/src/app/console/organizer-applications/page.tsx`：admin 入驻审核页。

前端修改文件：
- `frontend/src/types/api.ts`：新增用户资料、入驻申请和审核状态类型。
- `frontend/src/lib/api.ts`：新增资料更新、改密、申请提交/查询/审核 API。
- `frontend/src/lib/auth.ts`：新增 `updateStoredUser`。
- `frontend/src/components/Header.tsx`：下拉菜单跳转到 `/profile`、`/profile/account`。
- `frontend/src/components/Footer.tsx`：商户入驻链接指向 `/merchant`。
- `frontend/src/app/console/layout.tsx`：新增“个人中心”和 admin-only “入驻审核”，场馆管理仅 admin 可见。

---

## Business Rules

- C 端个人中心只展示普通用户能力，不放“主办方申请”和“后台入口”。
- 首页底部“商户入驻”承载主办方申请和后台入口。
- B 端个人中心位于 `/console/profile`，admin 与 organizer 按角色展示不同内容。
- admin 审核入口位于 `/console/organizer-applications`，仅 admin 可见。
- 入驻申请字段：主办方名称、主体类型、联系人姓名、联系电话、联系邮箱、营业执照号、经营范围、申请说明。
- 入驻申请状态：`0=待审核`、`1=已通过`、`2=已驳回`。
- 待审核时用户可修改同一条申请。
- 驳回后用户可查看驳回原因并重新提交，复用同一条申请并将状态改回 `0`。
- 已通过后用户不可再次提交申请，可进入 `/console/profile`。
- 审核通过后在同一事务内更新申请状态与 `user.role=organizer`、`organizer_status=1`、`organizer_name`。
- 审核驳回后更新申请状态为 `2`，同步 `user.organizer_status=2`，不改变 `user.role`。
- `GET /api/user/info` 必须返回安全 VO，不再返回 `User.password`。

---

### Task 1: 数据库表结构

**Files:**
- Create: `sql/migrations/shared/20260517_create_organizer_application.sql`
- Modify: `sql/init.sql`

- [ ] **Step 1: 新增增量 SQL**

Create `sql/migrations/shared/20260517_create_organizer_application.sql`:

```sql
CREATE TABLE IF NOT EXISTS organizer_application (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "user"(id),
    organizer_name VARCHAR(100) NOT NULL,
    subject_type VARCHAR(20) NOT NULL,
    contact_name VARCHAR(50) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    contact_email VARCHAR(100),
    license_no VARCHAR(100),
    business_scope TEXT,
    description TEXT,
    status SMALLINT DEFAULT 0,
    reviewer_id BIGINT REFERENCES "user"(id),
    review_note TEXT,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    review_time TIMESTAMP
);

COMMENT ON TABLE organizer_application IS '商户入驻申请表';
COMMENT ON COLUMN organizer_application.subject_type IS '主体类型：personal=个人 enterprise=企业';
COMMENT ON COLUMN organizer_application.status IS '0=待审核 1=已通过 2=已驳回';

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizer_application_user_id ON organizer_application(user_id);
CREATE INDEX IF NOT EXISTS idx_organizer_application_status ON organizer_application(status);
CREATE INDEX IF NOT EXISTS idx_organizer_application_create_time ON organizer_application(create_time DESC);
```

- [ ] **Step 2: 更新 `sql/init.sql`**

在 `"user"` 表后加入同样的 `organizer_application` 建表语句和索引。`CREATE TABLE` 不使用 `IF NOT EXISTS`，保持初始化脚本风格；索引名与增量 SQL 保持一致。

- [ ] **Step 3: 执行增量 SQL**

Run:

```powershell
psql -U postgres -d omni_ticket -f sql/migrations/shared/20260517_create_organizer_application.sql
```

Expected: 表和索引创建成功；重复执行时只出现 already exists 提示，不报错。

---

### Task 2: 后端 DTO、实体与 Mapper

**Files:**
- Create: `java/java-user/src/main/java/com/omni/user/entity/OrganizerApplication.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/OrganizerApplicationMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/UserInfoResponse.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/UpdateProfileRequest.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/ChangePasswordRequest.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/OrganizerApplicationRequest.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/OrganizerApplicationResponse.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/OrganizerApplicationReviewRequest.java`

- [ ] **Step 1: 创建 `OrganizerApplication` 实体**

字段必须与 SQL 对齐：`id`、`userId`、`organizerName`、`subjectType`、`contactName`、`contactPhone`、`contactEmail`、`licenseNo`、`businessScope`、`description`、`status`、`reviewerId`、`reviewNote`、`createTime`、`updateTime`、`reviewTime`。使用 `@TableName("organizer_application")` 和 `@TableId(type = IdType.AUTO)`。

- [ ] **Step 2: 创建 Mapper**

`OrganizerApplicationMapper` 继承 `BaseMapper<OrganizerApplication>`，使用 `@Mapper`。

- [ ] **Step 3: 创建用户安全响应 DTO**

`UserInfoResponse` 字段：`id`、`phone`、`nickname`、`email`、`avatar`、`status`、`role`、`organizerStatus`、`organizerName`、`createTime`、`updateTime`。不要包含 `password`。

- [ ] **Step 4: 创建资料和密码请求 DTO**

`UpdateProfileRequest` 字段：`userId`、`nickname`、`email`、`avatar`、`organizerName`。

`ChangePasswordRequest` 字段：`userId`、`oldPassword`、`newPassword`、`confirmPassword`。

- [ ] **Step 5: 创建入驻申请 DTO**

`OrganizerApplicationRequest` 字段：`userId`、`organizerName`、`subjectType`、`contactName`、`contactPhone`、`contactEmail`、`licenseNo`、`businessScope`、`description`。

`OrganizerApplicationResponse` 字段与实体一致，额外加 `phone`、`nickname` 用于 admin 列表展示。

`OrganizerApplicationReviewRequest` 字段：`reviewerId`、`reviewNote`。

- [ ] **Step 6: 编译校验**

Run from `java`:

```powershell
mvn clean package -pl java-user -am -DskipTests
```

Expected: `BUILD SUCCESS`。

---

### Task 3: 用户资料后端接口

**Files:**
- Modify: `java/java-user/src/main/java/com/omni/user/service/UserService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/UserController.java`

- [ ] **Step 1: 在 `UserService` 增加安全映射方法**

新增私有方法 `toUserInfoResponse(User user)`，复制公开字段，不复制 `password`。

- [ ] **Step 2: 修改 `getUserInfo` 返回类型**

把 `UserService.getUserInfo(Long userId)` 返回类型改为 `UserInfoResponse`。找不到用户继续抛 `BusinessException(ResultCode.NOT_FOUND, "用户不存在")`。

- [ ] **Step 3: 增加 `updateProfile`**

规则：昵称最长 50；邮箱为空则置空，非空必须包含 `@` 且最长 100；头像最长 255；只有 `admin` 或 `organizer` 才允许更新 `organizerName`。返回 `UserInfoResponse`。

- [ ] **Step 4: 增加 `changePassword`**

规则：旧密码必须匹配；新密码和确认密码一致；新密码长度不少于 6；成功后使用 `passwordEncoder.encode` 更新。

- [ ] **Step 5: 修改 Controller**

`GET /api/user/info` 返回 `Result<UserInfoResponse>`。

新增 `PUT /api/user/profile`，请求体 `UpdateProfileRequest`，返回 `Result<UserInfoResponse>`。

新增 `PUT /api/user/password`，请求体 `ChangePasswordRequest`，返回 `Result<Void>`。

- [ ] **Step 6: 编译校验**

Run from `java`:

```powershell
mvn clean package -pl java-user -am -DskipTests
```

Expected: `BUILD SUCCESS`。

---

### Task 4: 商户入驻后端接口

**Files:**
- Create: `java/java-user/src/main/java/com/omni/user/service/OrganizerApplicationService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/UserController.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/UserService.java`

- [ ] **Step 1: 创建 `OrganizerApplicationService`**

构造注入 `OrganizerApplicationMapper` 和 `UserMapper`。服务方法：`submitOrUpdate`、`getMine`、`listForAdmin`、`approve`、`reject`。

- [ ] **Step 2: 实现提交/修改申请**

按 `userId` 查询用户。用户不存在报“用户不存在”。用户角色已是 `organizer` 或 `admin` 报“当前账号已具备后台权限”。校验 `organizerName`、`subjectType`、`contactName`、`contactPhone` 非空；`subjectType` 只能是 `personal` 或 `enterprise`；邮箱非空必须包含 `@`。

按 `userId` 查询申请：没有则新增 `status=0`；已有且 `status=0` 或 `status=2` 则更新资料、`status=0`、清空 `reviewerId/reviewNote/reviewTime`；已有且 `status=1` 报“入驻申请已通过”。同步更新 `user.organizerStatus=0` 和 `user.organizerName`。

- [ ] **Step 3: 实现查询我的申请**

`getMine(Long userId)` 返回当前用户申请，没有则返回 `null`。

- [ ] **Step 4: 实现 admin 列表**

`listForAdmin(Long reviewerId, Integer status)` 先确认 reviewer 是 `admin`。按状态可选过滤，按 `createTime DESC` 排序。响应中补充申请用户 `phone`、`nickname`。

- [ ] **Step 5: 实现审核通过**

`approve(Long id, Long reviewerId, String reviewNote)` 先确认 reviewer 是 `admin`。申请不存在报“入驻申请不存在”。只有 `status=0` 可通过。事务内更新申请 `status=1`、`reviewerId`、`reviewNote`、`reviewTime`、`updateTime`；更新用户 `role=organizer`、`organizerStatus=1`、`organizerName=application.organizerName`。

- [ ] **Step 6: 实现审核驳回**

`reject(Long id, Long reviewerId, String reviewNote)` 先确认 reviewer 是 `admin`。申请不存在报“入驻申请不存在”。只有 `status=0` 可驳回。`reviewNote` 不能为空。事务内更新申请 `status=2`、审核字段；更新用户 `organizerStatus=2`，不改 `role`。

- [ ] **Step 7: Controller 增加接口**

新增：

```text
POST /api/user/organizer/applications
GET /api/user/organizer/applications/my?userId={userId}
GET /api/user/organizer/applications/admin?reviewerId={reviewerId}&status={status}
POST /api/user/organizer/applications/{id}/approve
POST /api/user/organizer/applications/{id}/reject
```

保留旧 `POST /api/user/organizer/apply` 但改为调用 `submitOrUpdate`，只接收 `userId` 和 `organizerName` 时用默认字段兜底：`subjectType=personal`、`contactName=organizerName`、`contactPhone=user.phone`。这是兼容现有前端旧调用，后续前端改完不再使用。

- [ ] **Step 8: 编译校验**

Run from `java`:

```powershell
mvn clean package -pl java-user -am -DskipTests
```

Expected: `BUILD SUCCESS`。

---

### Task 5: 前端类型与 API

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/auth.ts`

- [ ] **Step 1: 增加类型**

在 `api.ts` 增加：

```ts
export type UserRole = 'user' | 'organizer' | 'admin'
export type OrganizerApplicationStatus = 0 | 1 | 2
export type SubjectType = 'personal' | 'enterprise'

export interface UserInfo {
  id: number
  phone: string
  nickname: string | null
  email: string | null
  avatar: string | null
  status: number
  role: UserRole
  organizerStatus: number | null
  organizerName: string | null
  createTime: string
  updateTime: string | null
}

export interface OrganizerApplicationVO {
  id: number
  userId: number
  phone: string | null
  nickname: string | null
  organizerName: string
  subjectType: SubjectType
  contactName: string
  contactPhone: string
  contactEmail: string | null
  licenseNo: string | null
  businessScope: string | null
  description: string | null
  status: OrganizerApplicationStatus
  reviewerId: number | null
  reviewNote: string | null
  createTime: string
  updateTime: string | null
  reviewTime: string | null
}
```

- [ ] **Step 2: 增加 API 函数**

在 `frontend/src/lib/api.ts` 增加 `updateProfile`、`changePassword`、`submitOrganizerApplication`、`getMyOrganizerApplication`、`listOrganizerApplications`、`approveOrganizerApplication`、`rejectOrganizerApplication`。

- [ ] **Step 3: 更新本地用户工具**

在 `frontend/src/lib/auth.ts` 导出：

```ts
export function updateStoredUser(patch: Partial<StoredUser>) {
  const current = getUser()
  if (!current) return
  setUser({ ...current, ...patch })
}
```

- [ ] **Step 4: 类型检查**

Run from `frontend`:

```powershell
npm run typecheck
```

Expected: 若仍失败，只允许出现既有错误 `src/app/console/venue/page.tsx(86,52): error TS2339: Property 'capacity' does not exist on type 'VenueEntity'.`。

---

### Task 6: C 端个人中心页面

**Files:**
- Create: `frontend/src/app/profile/page.tsx`
- Create: `frontend/src/app/profile/account/page.tsx`
- Modify: `frontend/src/components/Header.tsx`

- [ ] **Step 1: 创建 `/profile`**

页面登录校验：未登录跳 `/login?ru=/profile`。加载 `getUserInfo(user.userId)`。展示手机号、昵称、邮箱、注册时间、订单入口 `/orders`、账号设置入口 `/profile/account`。不要展示后台入口和主办方申请入口。

- [ ] **Step 2: 创建 `/profile/account`**

页面包含资料表单：昵称、邮箱、头像。提交调用 `updateProfile`，成功后调用 `updateStoredUser({ nickname })`。页面包含改密表单：旧密码、新密码、确认密码。提交调用 `changePassword`。

- [ ] **Step 3: 修改 Header 下拉**

已登录时：“个人信息”跳 `/profile`，“账号设置”跳 `/profile/account`，“订单管理”跳 `/orders`。未登录时仍跳 `/login?ru=/`。

- [ ] **Step 4: 类型检查**

Run from `frontend`:

```powershell
npm run typecheck
```

Expected: 只允许既有 `VenueEntity.capacity` 错误。

---

### Task 7: 商户入驻页

**Files:**
- Create: `frontend/src/app/merchant/page.tsx`
- Modify: `frontend/src/components/Footer.tsx`

- [ ] **Step 1: 创建 `/merchant` 页面**

页面规则：未登录时显示登录按钮跳 `/login?ru=/merchant`。`admin` 或 `organizer` 显示“进入商户后台”按钮跳 `/console/profile`。普通用户加载 `getMyOrganizerApplication(userId)`。

- [ ] **Step 2: 实现申请表单**

字段：主办方名称、主体类型、联系人姓名、联系电话、联系邮箱、营业执照号、经营范围、申请说明。待审核和驳回状态都允许编辑并提交。通过状态显示“已通过，可进入后台”。提交调用 `submitOrganizerApplication`。

- [ ] **Step 3: 展示状态**

状态文案：`0=待审核`、`1=已通过`、`2=已驳回`。驳回时展示 `reviewNote`。

- [ ] **Step 4: 修改 Footer**

确保底部“商户入驻”链接为 `/merchant`。如果 `footerLinks` 来自 mock-data 且其中已有商户入驻项，优先在 `Footer.tsx` 渲染时把该项 href 替换为 `/merchant`；不要大范围重写 mock 数据。

- [ ] **Step 5: 类型检查**

Run from `frontend`:

```powershell
npm run typecheck
```

Expected: 只允许既有 `VenueEntity.capacity` 错误。

---

### Task 8: B 端个人中心与菜单权限

**Files:**
- Create: `frontend/src/app/console/profile/page.tsx`
- Modify: `frontend/src/app/console/layout.tsx`

- [ ] **Step 1: 创建 `/console/profile`**

登录校验：只有 `admin` 或 `organizer` 可访问。加载 `getUserInfo(userId)`。

admin 展示：平台管理员身份、手机号、昵称、邮箱、创建时间、快捷入口 `/console/organizer-applications`、`/console/refunds`、`/console/venue`。

organizer 展示：主办方名称、认证状态、账号资料、经营快捷入口 `/console/activities`、`/console/sessions`、`/console/orders`、`/console/refunds`。

- [ ] **Step 2: 支持 B 端资料编辑**

复用 `updateProfile` 修改昵称、邮箱、头像。organizer 可修改 `organizerName`；admin 不展示商户名称输入。

- [ ] **Step 3: 修改侧边栏菜单**

新增“个人中心”链接 `/console/profile`。新增“入驻审核”链接 `/console/organizer-applications`，仅 `role === 'admin'` 展示。`场馆管理` 仅 `role === 'admin'` 展示。活动、场次、订单、退款对 `admin` 和 `organizer` 展示。

- [ ] **Step 4: 类型检查**

Run from `frontend`:

```powershell
npm run typecheck
```

Expected: 只允许既有 `VenueEntity.capacity` 错误。

---

### Task 9: Admin 入驻审核页

**Files:**
- Create: `frontend/src/app/console/organizer-applications/page.tsx`

- [ ] **Step 1: 创建页面骨架**

仅 `admin` 可访问，非 admin 跳 `/console`。默认查询全部申请。提供状态筛选：全部、待审核、已通过、已驳回。

- [ ] **Step 2: 渲染申请列表**

列表字段：申请 ID、用户手机号、昵称、主办方名称、主体类型、联系人、联系电话、邮箱、营业执照号、经营范围、申请说明、状态、申请时间、审核时间、驳回原因。

- [ ] **Step 3: 审核操作**

待审核记录显示“通过”和“驳回”。通过调用 `approveOrganizerApplication(id, reviewerId, reviewNote)`；驳回必须输入原因，调用 `rejectOrganizerApplication(id, reviewerId, reviewNote)`。操作成功后重新加载列表。

- [ ] **Step 4: 类型检查**

Run from `frontend`:

```powershell
npm run typecheck
```

Expected: 只允许既有 `VenueEntity.capacity` 错误。

---

### Task 10: 端到端验证

**Files:**
- No source edits unless verification exposes bugs.

- [ ] **Step 1: 后端编译**

Run from `java`:

```powershell
mvn clean package -pl java-user -am -DskipTests
```

Expected: `BUILD SUCCESS`。

- [ ] **Step 2: 前端类型检查**

Run from `frontend`:

```powershell
npm run typecheck
```

Expected: 只允许既有 `VenueEntity.capacity` 错误；如果已顺手修复该类型，则应完全通过。

- [ ] **Step 3: 手工流程验证**

使用 `13900000001 / 123456` 登录普通用户，打开 `/profile`、`/profile/account`，更新昵称和邮箱，刷新后仍显示新值。

打开 `/merchant`，提交入驻申请，确认状态为待审核；修改一次申请，确认仍是同一条申请并更新资料。

使用 `13800000001 / 123456` 登录 admin，打开 `/console/organizer-applications`，确认能看到申请；先驳回并填写原因。

切回普通用户 `/merchant`，确认显示驳回原因；修改后重新提交。

切回 admin，通过申请。

普通用户重新登录，确认角色变为 organizer，可进入 `/console/profile`。

- [ ] **Step 4: 安全检查**

确认 `GET /api/user/info?userId=2004` 响应不包含 `password` 字段。

确认 C 端 `/profile` 没有后台入口和主办方申请入口。

确认 `/console/organizer-applications` 菜单仅 admin 可见。

确认本次提交不包含支付宝私钥、公钥、`application.yml` 敏感值。

---

## Commit Plan

- Commit 1: `feat: add organizer application schema`
- Commit 2: `feat: add user profile and organizer review APIs`
- Commit 3: `feat: add profile and merchant pages`
- Commit 4: `feat: add organizer application admin review page`

只有用户明确要求提交时才执行 commit。提交前必须检查 `git status`、`git diff`、`git log --oneline -10`。

---

## Self-Review

- Spec coverage: C 端个人中心、B 端个人中心、首页商户入驻、admin 审核、待审核可修改、驳回后重提、安全用户 VO 均有对应任务。
- Placeholder scan: 无 `TBD`、`TODO`、`implement later`。
- Type consistency: 后端 `OrganizerApplicationResponse` 与前端 `OrganizerApplicationVO` 字段保持一致；状态值统一为 `0 | 1 | 2`；主体类型统一为 `personal | enterprise`。
- Known risk: `npm run typecheck` 当前可能仍受既有 `VenueEntity.capacity` 错误阻塞，验证结果需明确说明该错误是否仍存在。
