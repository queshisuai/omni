open# 本地素材上传与头像功能 — 实施计划

## 审计结论

经过全量代码审计，**核心上传基础设施已全部实现**，存在 4 个前端集成缺口和若干优化项。

---

## ✅ 已实现清单

### 后端

| 模块 | 状态 | 文件 |
|------|------|------|
| `POST /api/user/assets/avatar` | ✅ | `UserController.java:110` |
| `UserAssetService.uploadAvatar()` — 魔数/2MB/SHA256/失败清理 | ✅ | `UserAssetService.java:50` |
| `POST /api/ticket/admin/assets` | ✅ | `AdminController.java:178` |
| `TicketAssetService.upload()` — bizType校验/5MB/魔数/SHA256 | ✅ | `TicketAssetService.java:46` |
| `UserAsset` Entity + Mapper | ✅ | `user/entity/`, `user/mapper/` |
| `TicketAsset` Entity + Mapper | ✅ | `ticket/entity/`, `ticket/mapper/` |
| 登录返回 `avatar` | ✅ | `UserService.java:101` |
| 静态映射 `/uploads/user/**` → `file:<root>/user/` | ✅ | `UploadStaticResourceConfig.java` |
| 静态映射 `/uploads/ticket/**` → `file:<root>/ticket/` | ✅ | `UploadStaticResourceConfig.java` (ticket) |
| Gateway 路由 `uploads/user/**` + `uploads/ticket/**` | ✅ | `application.yml:34-41` |
| `user_asset` DDL + `manifest.json` | ✅ | `sql/production-split/user/` |
| `ticket_asset` DDL + `manifest.json` | ✅ | `sql/production-split/ticket/` |

### 前端

| 模块 | 状态 | 文件 |
|------|------|------|
| `uploadUserAvatar(file)` | ✅ | `api.ts:138` |
| `uploadTicketAsset({userId,bizType,file})` | ✅ | `api.ts:302` |
| `LocalFileUpload` 组件 | ✅ | `components/LocalFileUpload.tsx` |
| 个人资料页头像上传 | ✅ | `profile/account/page.tsx:89` |
| Tour新建页海报上传 | ✅ | `console/tours/new/page.tsx:83` |
| 登录态同步 `avatar` 到 localStorage | ✅ | `LoginForm.tsx` |
| `updateStoredUser()` 事件同步 | ✅ | `auth.ts` |
| `next.config.ts` 代理 `/uploads/` | ✅ | `next.config.ts` |

### SQL/迁移

| 模块 | 状态 | 文件 |
|------|------|------|
| `user_asset` 建表 | ✅ | `sql/production-split/user/20260522_user_asset_upload.sql` |
| `ticket_asset` 建表 | ✅ | `sql/production-split/ticket/20260522_ticket_asset_upload.sql` |
| `activity.per_user_limit` 限购字段 | ✅ | `sql/production-split/ticket/20260522_activity_purchase_limit.sql` |
| 部分退款 `refund_request` 字段 | ✅ | `sql/production-split/payment/20260522_partial_refund.sql` |

### 文档

| 模块 | 状态 | 文件 |
|------|------|------|
| 总体设计文档 | ✅ | `docs/superpowers/specs/2026-05-22-local-asset-upload-refund-limit-design.md` |

---

## ❌ 待实现工作

### Phase 1 — 前端集成缺口（高优先级）

| # | 任务 | 描述 | 涉及文件 |
|---|------|------|----------|
| 1 | **Header 头像展示** | `Header.tsx` 当前用 `<User>` 图标代替头像，应读取 `getUser().avatar`，若有则显示 32x32 圆形缩略图 `<img>`，fallback 保持图标 | `frontend/src/components/Header.tsx` |
| 2 | **活动新建页海报上传** | 第 267 行纯文本 `<input>` 替换为 `LocalFileUpload` 组件 + `uploadTicketAsset({bizType:'activity-poster'})` | `frontend/src/app/console/activities/new/page.tsx` |
| 3 | **活动编辑页海报上传** | 同上，编辑页海报字段替换为 `LocalFileUpload` | `frontend/src/app/console/activities/[id]/edit/page.tsx` |
| 4 | **个人资料页(C端)头像展示** | `/profile/page.tsx` 的 avatar area 确认从 `UserInfo.avatar` 加载图片 | `frontend/src/app/profile/page.tsx` |

### Phase 2 — 功能扩展（中优先级）

| # | 任务 | 描述 | 涉及文件 |
|---|------|------|----------|
| 5 | **艺人头像上传入口** | console 艺人管理页面增加头像上传 UI，`bizType: 'artist-avatar'` | 需先确认艺人管理页面位置 |
| 6 | **活动海报上传替换** | 活动详情/管理页面中 poster 字段替换 | 多个文件 |
| 7 | **限购下单校验** | `java-order` 下单时通过 ticket internal API 获取 `perUserLimit`，计算已支付+本次<=limit | `java-order` 的 OrderService + ticket internal API |

### Phase 3 — 部分退款（低优先级，设计已覆盖）

| # | 任务 | 描述 |
|---|------|------|
| 8 | Order internal API — `refund-options` + `mark-partial-refunded` | 参考设计文档 |
| 9 | Payment 退款申请支持 `quantity`/`orderSeatIds` | 改造 `applyRefund` |
| 10 | 前端退款弹窗支持选择座位/数量 | 改造退款交互 |

### Phase 4 — SQL 检查脚本同步

| # | 任务 | 描述 |
|---|------|------|
| 11 | `check-production-split-sql.ps1` 确认 `user_asset`/`ticket_asset` 通过检查 | 运行确认 |

---

## ⚠️ 优化建议（可选）

| # | 问题 | 建议 |
|---|------|------|
| A | `UserController` 构造器重载使 `userAssetService` 可为 null | 移除多余构造器，统一用 `@Autowired` |
| B | `multipartRequest` 超时 5s 对大文件可能不足 | 提升到 15s 或根据文件大小动态 |
| C | `isImageUrl()` 只识别 `/uploads/` 开头 URL | 可放宽到支持 `https://` 外链预览 |
| D | ticket `application.yml` 配置 10MB 但 service 限制 5MB | 统一为 service 层限制，yml 放宽到 12MB 防止 Spring 提前拒绝 |
| E | `user_asset` 和 `ticket_asset` 表缺少 `update_time` 字段 | 可选添加，用于审计 |

---

## 实施顺序

```
Phase 1 (当前缺口)
  ├── 1. Header 头像展示         ← 最显性，用户登录后可见
  ├── 2. 活动新建页海报上传        ← 常用 B 端场景
  ├── 3. 活动编辑页海报上传        ← 配套
  └── 4. 个人资料页头像确认        ← 验证即可，通常已通

Phase 2 (功能扩展)
  ├── 5. 艺人头像上传
  ├── 6. 活动海报上传替换
  └── 7. 限购下单校验           ← 依赖 order+ticket internal API

Phase 3 (部分退款)
  └── 8-10 参考设计文档

Phase 4 (检查确认)
  └── 11. SQL 检查脚本验证
```

---

## 验收命令

每阶段完成后运行：

```powershell
# 边界检查
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1

# SQL 安全检查
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1

# 前端类型检查
cd frontend; pnpm typecheck
```

---

## 数据清理纪律

- 测试上传的文件位于 `runtime/uploads/user/` 和 `runtime/uploads/ticket/`
- 测试结束后执行：

```powershell
Remove-Item -LiteralPath "runtime/uploads" -Recurse -Force -ErrorAction SilentlyContinue
```

- 数据库中 `user_asset` 和 `ticket_asset` 表插入的测试行通过 `DELETE FROM user_asset WHERE uploader_id = <test_id>` 清理
- 不需清理 seed 账号 2002/2003/2004 的头像 URL（本地开发环境可重建）
