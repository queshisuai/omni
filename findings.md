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

## 设计判断

- 本期可不改数据库，复用已有 `user` 字段。
- 应避免在个人中心新增复杂实名观演人、地址、发票抬头等能力，除非用户明确要求。
- 个人中心应作为 C 端聚合入口，而不是替换 `/orders`。
- 主办方申请和后台入口不应放在 C 端个人中心，应收敛到首页底部“商户入驻”。
- “商户入驻”应根据用户角色展示不同操作：普通用户申请入驻，organizer/admin 进入后台。
- 修改密码成功后建议退出登录或提示重新登录；为了体验稳定，可先保持登录并提示成功。

## 风险

- `GET /api/user/info` 当前返回实体可能泄露密码哈希，个人中心实现时需要优先规避。
- 如果只依赖前端传 `userId`，存在越权查看/修改他人资料的风险。当前项目已有这种模式，但新增接口最好结合 JWT 校验当前用户。
- 全局前端类型检查已有 `VenueEntity.capacity` 既有错误，可能影响验收输出。
- 如果同时在个人中心和商户入驻展示主办方能力，会造成 C 端信息架构混乱，后续实现需避免重复入口。
