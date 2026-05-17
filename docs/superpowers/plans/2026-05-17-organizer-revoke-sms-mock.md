# 主办方取消资格与短信验证码 Mock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持平台管理员取消主办方资格并联动下架其全部活动，同时让短信登录、找回密码、修改密码在开发/演示环境使用固定验证码 `666666`。

**Architecture:** 后端以 `java-user` 为主完成身份状态、验证码和密码流程改造，`java-ticket` 负责活动/场次/票档下架与订单退款联动。前端在登录、找回密码、账号设置和活动管理中补齐对应交互。主办方资格取消与单活动下架都视为“已同意退款”的强操作，不进入退款申请审核流，而是直接调用现有支付宝退款链路。

**Tech Stack:** Java 11、Spring Boot 2.7、MyBatis-Plus、PostgreSQL、支付宝沙盒退款、Next.js 16、React 19、TypeScript、Tailwind CSS。

---

## File Structure

后端新增文件：
- `java/java-user/src/main/java/com/omni/user/dto/ResetPasswordRequest.java`：忘记密码重置请求。
- `java/java-user/src/main/java/com/omni/user/dto/SmsVerifyRequest.java`：短信验证码校验请求，供登录/重置/改密复用。
- `java/java-ticket/src/main/java/com/omni/ticket/dto/DeactivateOrganizerRequest.java`：取消主办方资格请求。
- `java/java-ticket/src/main/java/com/omni/ticket/dto/DeactivateActivityRequest.java`：活动下架确认请求。
- `java/java-ticket/src/main/java/com/omni/ticket/dto/RefundImpactResponse.java`：下架/取消资格后的退款结果汇总响应。

后端修改文件：
- `java/java-user/src/main/java/com/omni/user/service/UserService.java`：短信登录 Mock、找回密码、修改密码短信校验。
- `java/java-user/src/main/java/com/omni/user/controller/UserController.java`：新增重置密码接口和验证码复用入口。
- `java/java-user/src/main/java/com/omni/user/dto/LoginRequest.java`：确认短信登录请求字段继续沿用 `smsCode`。
- `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`：取消主办方资格、活动下架、批量退款联动。
- `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java`：建议抽出业务编排服务，避免 `AdminController` 继续膨胀。
- `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java`：如现有状态字段不足，补充明确的下架语义。
- `sql/init.sql`：如需要，补充主办方状态字段或状态注释。

前端修改文件：
- `frontend/src/components/LoginForm.tsx`：短信登录继续使用验证码输入。
- `frontend/src/app/forgot-password/page.tsx`：改为真正的重置密码页面。
- `frontend/src/app/profile/account/page.tsx`：修改密码增加短信验证码输入。
- `frontend/src/app/console/activities/page.tsx`：活动下架前二次确认。
- `frontend/src/app/console/profile/page.tsx`：如需补充主办方状态和取消资格后的提示。
- `frontend/src/lib/api.ts`：新增重置密码、取消主办方资格、活动下架、退款结果查询等 API。
- `frontend/src/types/api.ts`：新增请求/响应类型。

---

## Business Rules

- `send-code` 在开发/演示环境固定返回 `666666`。
- 短信登录、找回密码、修改密码都使用同一套验证码校验逻辑。
- 忘记密码页必须真的执行密码重置，不再只是提示页。
- 账号设置页修改密码必须同时满足原密码正确和短信验证码正确。
- admin 可以取消主办方资格，取消后该主办方旗下所有活动、场次、票档下架。
- 主办方也可以下架自己旗下单个活动，但必须先确认“同意全部退款”。
- 活动下架和主办方取消资格都不创建退款申请，不进入退款审核页。
- 对已支付订单，直接调用现有支付宝退款接口。
- 下架后订单页要明确展示“活动已下架”。
- 退款失败时保留失败结果，允许后续补偿处理。

---

## Task 1: 短信验证码 Mock 基础

**Files:**
- Modify: `java/java-user/src/main/java/com/omni/user/service/UserService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/UserController.java`
- Modify: `frontend/src/components/LoginForm.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: 统一验证码语义**

确保登录表单、找回密码表单、修改密码表单都以“验证码”作为输入项，前端字段命名统一为 `smsCode` 或对应重置密码字段，不再依赖临时占位逻辑。

- [ ] **Step 2: 后端 `send-code` 固定返回 Mock 值**

调整 `UserController.sendCode`，在开发/演示环境直接返回字符串 `666666`，并保持现有接口路径不变。

- [ ] **Step 3: 登录校验短信验证码**

在 `UserService.login` 的短信登录分支中，显式校验验证码是否等于 `666666`。不通过时返回“验证码错误”或等价业务错误。

- [ ] **Step 4: 类型与 API 对齐**

在 `frontend/src/lib/api.ts` 和 `frontend/src/types/api.ts` 中保持登录、发码、重置密码、修改密码相关参数结构一致，避免前后端字段漂移。

- [ ] **Step 5: 验证计划**

先跑前端类型检查，确认登录页和 API 签名未破坏已有页面。随后跑 `java-user` 编译，确认短信登录分支可编译通过。

---

## Task 2: 找回密码改造

**Files:**
- Create: `java/java-user/src/main/java/com/omni/user/dto/ResetPasswordRequest.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/UserService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/UserController.java`
- Modify: `frontend/src/app/forgot-password/page.tsx`

- [ ] **Step 1: 定义重置密码请求**

`ResetPasswordRequest` 需要包含 `phone`、`smsCode`、`newPassword`、`confirmPassword`。如果希望更简洁，也可复用现有 `ChangePasswordRequest` 的字段风格，但不能再把找回密码停留在“只发送验证码”的半成品状态。

- [ ] **Step 2: 实现后端重置密码逻辑**

新增 `UserService.resetPassword`：
- 根据手机号查用户。
- 校验验证码为 `666666`。
- 校验新密码和确认密码一致，且长度不少于 6。
- 使用 `passwordEncoder.encode` 更新密码。

- [ ] **Step 3: 暴露重置密码接口**

在 `UserController` 新增 `POST /api/user/password/reset`，请求体为 `ResetPasswordRequest`，返回 `Result<Void>`。

- [ ] **Step 4: 改造前端找回密码页**

把 `/forgot-password` 从“提示页”改成完整表单页：手机号、验证码、新密码、确认密码。提交成功后跳转登录页，并提示用户密码已重置。

- [ ] **Step 5: 验证计划**

先验证前端页面路由和表单字段完整，再验证后端接口能通过固定验证码更新密码。

---

## Task 3: 账号设置修改密码增加短信校验

**Files:**
- Modify: `java/java-user/src/main/java/com/omni/user/dto/ChangePasswordRequest.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/UserService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/UserController.java`
- Modify: `frontend/src/app/profile/account/page.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: 扩展修改密码请求字段**

在 `ChangePasswordRequest` 中增加 `smsCode` 字段，保持原密码、新密码、确认密码不变。

- [ ] **Step 2: 修改后端校验顺序**

`UserService.changePassword` 先校验原密码，再校验短信验证码是否为 `666666`，最后校验新密码一致性和长度。

- [ ] **Step 3: 改造前端账号设置页**

在修改密码表单中增加短信验证码输入框，提交时随表单一起调用 `changePassword`。

- [ ] **Step 4: 类型检查**

跑一次前端 `typecheck`，确认新增字段和表单绑定没有引入类型错误。

---

## Task 4: 单活动下架与真实退款联动

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java`
- Modify: `frontend/src/app/console/activities/page.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: 抽出活动下架业务编排**

在 `ActivityAdminService` 中封装单活动下架逻辑：校验权限、下架活动/场次/票档、查已支付订单、调用支付宝退款、汇总结果。

- [ ] **Step 2: 设计退款同意语义**

单活动下架视为操作人已经同意退款，不创建退款申请，不走审核页。对外只暴露“下架并退款”的结果。

- [ ] **Step 3: 前端增加确认弹窗**

在活动管理页对“下架活动”增加明确确认文案，提醒用户会触发该活动全部已支付订单退款。

- [ ] **Step 4: 退款结果展示**

活动下架后返回退款结果汇总，前端可在提示中展示成功/失败数量，方便演示和排错。

- [ ] **Step 5: 验证计划**

验证活动下架后，该活动不可再出现在前台活动列表和详情页；相关订单显示活动已下架和退款结果。

---

## Task 5: 取消主办方资格与批量下架退款

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/DeactivateOrganizerRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/RefundImpactResponse.java`
- Modify: `sql/init.sql`
- Modify: `frontend/src/app/console/profile/page.tsx`
- Modify: `frontend/src/app/console/organizer-applications/page.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: 定义取消资格请求与响应**

`DeactivateOrganizerRequest` 至少包含 `organizerId`、`reason`、`confirmRefund`。`RefundImpactResponse` 需要返回下架活动数、退款成功数、退款失败数和失败明细。

- [ ] **Step 2: 实现取消主办方资格**

在后端一次业务操作中完成：
- 将用户角色从 `organizer` 改为 `user`
- 标记主办方状态为已取消
- 下架旗下全部活动、场次、票档
- 对关联已支付订单直接调用支付宝退款

- [ ] **Step 3: 下架语义统一**

确保主办方被取消后，前台的活动列表、活动详情页、后台个人中心都能正确体现“该主办方已失去权限”的状态。

- [ ] **Step 4: 管理端入口与提示**

admin 端的审核页或个人中心中增加“取消主办方资格”入口，点击前必须二次确认，提示会触发整批退款。

- [ ] **Step 5: 验证计划**

验证取消主办方资格后，该主办方无法继续访问后台，旗下活动全部下架，历史订单显示活动已下架且退款状态正确。

---

## Task 6: 前端统一交互完善

**Files:**
- Modify: `frontend/src/components/LoginForm.tsx`
- Modify: `frontend/src/app/forgot-password/page.tsx`
- Modify: `frontend/src/app/profile/account/page.tsx`
- Modify: `frontend/src/app/console/activities/page.tsx`
- Modify: `frontend/src/app/console/profile/page.tsx`

- [ ] **Step 1: 统一短信登录体验**

保持短信登录和发码按钮可用，错误提示明确，避免用户误以为是真实短信发送。

- [ ] **Step 2: 统一密码找回/修改体验**

让找回密码页和账号设置页都体现“验证码 Mock”这一演示前提，但不要把它写死成只存在于 UI 的假流程。

- [ ] **Step 3: 下架和取消资格的确认文案**

所有会触发退款的操作都必须先明确提示“同意退款”含义，避免误操作。

---

## Task 7: 端到端验证

**Files:**
- No code changes expected; only verification.

- [ ] **Step 1: 前端类型检查**

Run in `frontend`:

```powershell
npm run typecheck
```

Expected: 0 errors。

- [ ] **Step 2: 后端编译**

Run in `java`:

```powershell
mvn clean package -pl java-user,java-ticket,java-payment -am -DskipTests
```

Expected: `BUILD SUCCESS`。

- [ ] **Step 3: 手工验证场景**

确认以下流程可走通：
- 短信登录验证码 `666666`
- 找回密码验证码 `666666`
- 修改密码验证码 `666666`
- admin 取消主办方资格后后台门禁失效
- 活动下架后订单显示活动已下架并进入退款结果

---

## Self-Review Checklist

- [ ] 每个需求点都能在某个任务中找到对应实现。
- [ ] 没有把“退款申请审核”误写进这次取消资格和下架流程。
- [ ] 找回密码和修改密码都明确包含短信验证码。
- [ ] 所有会触发退款的操作都明确写了“同意退款”的语义。
- [ ] 任务粒度足够小，能按顺序逐步实现和验证。
