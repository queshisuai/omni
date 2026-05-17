# 个人中心与账号信息发现记录

## 已确认事实

- 前端认证状态在 `frontend/src/lib/auth.ts` 中通过 `localStorage` 存储：`damai_token` 和 `damai_user`。
- 当前 `StoredUser` 包含 `userId`、`phone`、`nickname`、`role`。
- 前端 API 封装在 `frontend/src/lib/api.ts`，已有 `login`、`register`、`getUserInfo`、`applyOrganizer`、订单、支付、退款接口。
- 当前 `getUserInfo(userId)` 调用 `GET /api/user/info?userId=`。
- 后端 `UserController.getUserInfo` 直接返回 `User` 实体，存在把 `password` 字段序列化给前端的风险，应改用安全 VO 或新增安全接口。
- 后端 `User` 实体已有个人中心所需基础字段：`phone`、`nickname`、`email`、`avatar`、`status`、`role`、`organizerStatus`、`organizerName`、`createTime`、`updateTime`。
- 当前后端没有更新资料和修改密码接口。
- 前端类型 `UserInfo` 已包含 `id`、`phone`、`nickname`、`email`、`avatar`、`status`、`createTime`，还缺少 `role`、`organizerStatus`、`organizerName`、`updateTime`。
- B 端已有 `frontend/src/app/console/layout.tsx`，侧边栏目前包含概览、活动管理、场次管理、订单查看、退款审核、场馆管理，缺少个人中心/商户资料入口。
- B 端概览页 `/console` 当前只显示活动数量，票档数和订单数还是占位 `-`。
- B 端布局底部展示角色和昵称，并提供退出登录，但没有进入账号资料维护页面的入口。
- 用户确认商户入驻需要 admin 审核，不再使用自动通过。
- 入驻申请字段采用较完整商户资料：主办方名称、主体类型、联系人姓名、联系电话、联系邮箱、营业执照号、经营范围、申请说明。
- admin 审核入口放在 B 端后台侧边栏，页面路径 `/console/organizer-applications`，仅 admin 可见。
- 用户确认待审核时可修改申请，驳回后可重新提交。

## 设计判断

- 本期可不改数据库，复用已有 `user` 字段。
- 应避免在个人中心新增复杂实名观演人、地址、发票抬头等能力，除非用户明确要求。
- 个人中心应作为 C 端聚合入口，而不是替换 `/orders`。
- 主办方申请和后台入口不应放在 C 端个人中心，应收敛到首页底部“商户入驻”。
- “商户入驻”应根据用户角色展示不同操作：普通用户申请入驻，organizer/admin 进入后台。
- B 端个人中心应独立于 C 端个人中心，放在 `/console/profile`，服务已入驻商户和管理员。
- B 端个人中心不承载“申请成为主办方”，只承载“已入驻后的资料维护和后台账号管理”。
- organizer 的商户资料本期先复用 `User.organizerName`，不新增商户主体表。
- 商户入驻审核需要新增 `organizer_application` 表，不能只复用 `user.organizerStatus`，否则无法保存较完整申请资料和驳回原因。
- admin 没有商户主体资料，应展示平台管理员身份、账号资料、安全设置和后台快捷入口。
- 修改密码成功后建议退出登录或提示重新登录；为了体验稳定，可先保持登录并提示成功。

## 风险

- `GET /api/user/info` 当前返回实体可能泄露密码哈希，个人中心实现时需要优先规避。
- 如果只依赖前端传 `userId`，存在越权查看/修改他人资料的风险。当前项目已有这种模式，但新增接口最好结合 JWT 校验当前用户。
- 全局前端类型检查已有 `VenueEntity.capacity` 既有错误，可能影响验收输出。
- 如果同时在个人中心和商户入驻展示主办方能力，会造成 C 端信息架构混乱，后续实现需避免重复入口。
- 如果 B 端个人中心和 C 端账号设置共用更新接口，需要明确哪些字段只有 organizer 可更新，例如 `organizerName`。
- B 端侧边栏需要按角色区分部分菜单。当前 `场馆管理` 对 organizer 也展示，但项目约定只有 admin 可创建/编辑场馆，后续实现个人中心时可一并评估菜单权限展示。
- 审核通过需要同时更新申请状态和用户角色，需注意事务一致性。
- 待审核可修改意味着同一用户应只有一个活跃申请，避免重复待审核记录。
