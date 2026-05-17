# 个人中心与账号信息完善计划

## 目标

在支付流程已完成的基础上，补齐 C 端与 B 端个人中心能力。C 端用户中心聚焦个人资料、账号安全、订单、退款；B 端个人中心聚焦商户主体信息、运营账号、安全设置、后台快捷入口、经营概览。主办方申请与后台入口不放入 C 端个人中心，统一收敛到首页底部“商户入驻”流程。

## 范围

- 新增 C 端个人中心页面与账号设置页面。
- 新增 B 端个人中心页面与商户账号设置页面。
- 完善用户资料查看与编辑能力。
- 完善商户主体信息、主办方名称、联系人信息展示与维护。
- 增加账号安全信息展示与密码修改能力。
- 将订单、退款整合进统一个人中心导航。
- 完善首页底部“商户入驻”入口，在商户入驻流程中提供主办方申请与后台入口。
- 商户入驻改为 admin 审核制，不再自动通过。
- 新增 admin 入驻审核页面 `/console/organizer-applications`，仅 admin 可见。
- 不引入评价/动态系统，继续遵守项目现有约定。
- 不处理头像文件上传到对象存储，本期可支持头像 URL 或默认头像。

## 当前状态

- 支付宝支付流程已完成。
- 用户当前可登录、注册、查看订单、申请退款。
- 前端已有 `/orders`，但缺少统一个人中心。
- 前端已有 `/console` 后台布局和概览页，但缺少 B 端个人中心。
- 后端 `java-user` 已有 `/api/user/info?userId=` 和 `/api/user/organizer/apply`。
- 当前 `applyOrganizer` 是沙盒自动通过，需改造为申请表 + admin 审核。
- `User` 实体已有 `phone`、`nickname`、`email`、`avatar`、`role`、`organizerStatus`、`organizerName`、`createTime`、`updateTime` 字段。

## 阶段

### 阶段 1：现状梳理与接口设计

状态：进行中

- 梳理当前用户接口、前端认证存储、订单/退款接口。
- 确认新增接口 DTO 与返回字段，避免直接把 `password` 返回给前端。
- 明确个人中心页面信息架构。

### 阶段 2：后端用户与商户入驻接口补齐

状态：待开始

- 新增安全的用户信息 VO，替代直接返回 `User` 实体。
- 新增更新个人资料接口：昵称、邮箱、头像。
- 新增修改密码接口：旧密码、新密码、确认密码。
- 保留主办方申请接口，并在首页底部“商户入驻”中复用。
- 新增或复用商户资料更新能力：主办方名称、联系人昵称、邮箱、头像。
- 新增 `organizer_application` 入驻申请表。
- 新增商户入驻申请提交/更新接口。
- 新增我的入驻申请查询接口。
- 新增 admin 入驻申请列表、通过、驳回接口。
- 审核通过后更新 `user.role=organizer`、`organizer_status=1`、`organizer_name`。
- 对手机号、邮箱、密码做基础校验。

### 阶段 3：C 端个人中心框架

状态：待开始

- 新增 `/profile` 页面，作为个人中心首页。
- 设计用户卡片、账号概览、订单统计、退款统计、角色信息。
- 增加快捷入口：我的订单、退款记录、账号设置。
- 未登录访问时跳转 `/login`。

### 阶段 4：C 端账号设置与安全页面

状态：待开始

- 新增 `/account` 或 `/profile/account` 页面。
- 支持编辑昵称、邮箱、头像 URL。
- 支持修改密码。
- 更新成功后同步 `localStorage` 用户信息。
- 清晰展示保存中、成功、失败状态。

### 阶段 5：B 端个人中心与商户资料

状态：待开始

- 新增 `/console/profile` 页面，挂在 B 端后台侧边栏。
- 展示当前登录账号、角色、手机号、邮箱、头像、创建时间、最近更新时间。
- organizer 展示主办方名称、入驻状态、当前可管理活动数量、退款待审核数量。
- admin 展示平台管理员身份、平台管理范围、进入各管理模块快捷入口。
- admin 侧边栏新增 `/console/organizer-applications` 入驻审核入口。
- 支持编辑 B 端账号基础资料：昵称、邮箱、头像。
- 支持编辑 organizer 的商户资料：主办方名称。
- C 端个人中心和 B 端个人中心共用后端安全用户资料接口，前端页面分开。

### 阶段 6：B 端账号安全

状态：待开始

- 在 `/console/profile` 或 `/console/account` 中提供修改密码能力。
- 显示登录账号安全提示：手机号、角色、密码更新时间占位。
- 后续可扩展操作日志、登录日志，本期不新增表。
- 修改密码成功后提示重新登录或保持当前会话，具体实现与 C 端保持一致。

### 阶段 7：订单与退款整合

状态：待开始

- 保留 `/orders` 页面作为订单详情列表。
- 在个人中心显示最近订单与退款申请摘要。
- 退款记录可从个人中心跳转到订单页对应信息，或新增独立退款区域。
- 避免退款接口失败影响个人中心主信息展示。
- B 端个人中心展示退款待审核摘要，并跳转 `/console/refunds`。

### 阶段 8：首页底部商户入驻完善

状态：待开始

- 在首页底部完善“商户入驻”模块。
- 普通用户可从商户入驻入口发起主办方申请，申请字段包含主办方名称、主体类型、联系人姓名、联系电话、联系邮箱、营业执照号、经营范围、申请说明。
- 待审核时用户可修改申请。
- 驳回后用户可查看驳回原因并重新提交。
- 已是 organizer/admin 的用户可从商户入驻入口进入后台。
- C 端个人中心不展示主办方申请和后台入口。
- 商户入驻页或弹窗需说明平台规则、入驻收益、审核/开通状态。
- 商户入驻成功后引导进入 `/console/profile` 完善商户资料。

### 阶段 9：验证与收尾

状态：待开始

- 后端执行 `mvn clean package -pl java-user -am -DskipTests`。
- 前端执行 `npm run typecheck` 或 `pnpm typecheck`。
- 若全局类型检查仍受既有 `VenueEntity.capacity` 阻塞，单独记录为已知问题。
- 手动验证普通用户、organizer、admin 三类账号展示。

## 页面结构建议

- `/profile`：个人中心首页。
- `/profile/account`：账号资料与安全设置。
- `/orders`：我的订单，保留现有支付/退款入口。
- 首页底部“商户入驻”：主办方申请与后台入口统一入口。
- `/console`：organizer/admin 后台页面，入口不放在 C 端个人中心。
- `/console/profile`：B 端个人中心，展示商户/管理员账号资料与经营概览。
- `/console/organizer-applications`：admin 入驻审核页。
- `/console/account`：可选，如安全设置从 B 端个人中心拆出时使用。

## 后端接口建议

- `GET /api/user/me?userId={userId}`：返回安全用户资料。
- `PUT /api/user/profile`：更新昵称、邮箱、头像。
- `PUT /api/user/organizer/profile`：更新主办方名称等商户资料，或复用 `PUT /api/user/profile` 支持 `organizerName`。
- `PUT /api/user/password`：修改密码。
- `POST /api/user/organizer/applications`：提交或更新入驻申请。
- `GET /api/user/organizer/applications/my?userId={userId}`：查询我的入驻申请。
- `GET /api/user/organizer/applications/admin`：admin 查询入驻申请列表。
- `POST /api/user/organizer/applications/{id}/approve`：admin 审核通过。
- `POST /api/user/organizer/applications/{id}/reject`：admin 驳回。
- 现有 `GET /api/user/info` 可保留，但前端新页面优先使用安全 VO 接口。

## 数据库变更

- 用户资料与 B 端个人中心复用 `user` 表已有字段。
- 商户入驻审核新增 `organizer_application` 表。
- 如后续需要收货人/实名观演人/常用联系人，再新增独立表。

## 验收标准

- 登录后可进入个人中心，看到手机号、昵称、角色、注册时间、订单摘要。
- 用户可修改昵称、邮箱、头像 URL。
- 用户可修改密码，旧密码错误时给出明确提示。
- C 端个人中心不展示主办方申请和后台入口。
- B 端 `/console/profile` 可查看并编辑后台账号基础资料。
- organizer 可在 B 端个人中心查看并编辑主办方名称。
- admin 可在 B 端个人中心看到平台管理员身份和后台快捷入口。
- 首页底部“商户入驻”可展示主办方申请入口。
- 入驻申请需经过 admin 审核，通过后才成为 organizer。
- 待审核申请允许用户修改；驳回后允许重新提交。
- admin 可在 `/console/organizer-applications` 查看、通过、驳回入驻申请。
- organizer/admin 可从“商户入驻”进入后台。
- 订单与退款信息入口清晰，不破坏现有支付/退款流程。
- 后端构建通过。
- 前端新增代码无新增类型错误。
