# 活动与巡演站点版本化重构设计

## 背景

当前新建平台活动流程把场地审批资料放在活动基础信息步骤，导致普通活动还未进入场次配置就必须处理场馆材料。巡演流程虽然已有“仅官宣城市”能力，但新增城市站仍要求站点名，且发布时强依赖已通过场地申请，无法完整支持“先公布城市，后补场馆、时间、票档”的业务流程。

本设计统一普通活动和巡演的站点配置模型。普通活动拥有一个默认站点；巡演拥有多个城市站点。城市、场馆、时间、删除、换场馆等核心变更都通过站点配置版本管理，未提交草稿可删除，已提交和已应用记录保留历史，体验对齐 SeatCraft 座位图草稿与历史版本。

## 目标

- 活动基础信息步骤不再上传场地资料。
- 普通活动在设置场次阶段选择城市、输入或选择场馆、填写时间。
- 巡演创建时支持先填写城市清单，场馆和时间可为空。
- 允许新增城市和新增场馆；新增场馆必须上传申请资料。
- 已确定场馆允许申请更换。
- 分级审核城市站删除、场馆更换、改期等核心变更。
- 站点配置变更有历史记录；未提交草稿可以删除。
- 历史场馆座位模板可被检测并提示是否复用。
- 不新增跨服务访问；所有实现保持在 `java-ticket` 服务边界内。

## 非目标

- 不恢复评价/动态系统。
- 不把场馆、订单、用户数据跨服务 join。
- 不在第一期自动处理已有订单的改期、换场馆、取消退款闭环。
- 不删除现有 `activity.venue_application_id` 等旧字段；先兼容迁移。

## 方案选择

采用统一站点版本模型。

- 普通活动等价于一个活动和一个默认站点。
- 巡演等价于一个巡演和多个城市站点。
- 站点配置变更通过版本表记录，包含草稿、审核、通过、驳回、应用状态。
- 审核通过后才应用到正式 `station`、`activity`、`session` 和 SeatCraft 布局。

未采用的方案：

- 普通活动和巡演各做一套流程。该方案短期改动较小，但换场馆、改期、删除审核会长期分裂。
- 只做审核记录而不做配置版本。该方案表少，但无法满足草稿删除、历史记录、版本对比和复制草稿体验。

## 创建流程

### 普通非巡演活动

1. 填写活动基础信息：活动名、分类、艺人、简介、海报、限购、座位图展示策略。
2. 系统创建活动草稿和默认站点草稿。
3. 进入站点配置步骤，选择城市。
4. 输入新场馆或选择已有场馆。
5. 若是新场馆，必须上传场馆申请资料，生成场地申请。
6. 若场馆存在历史座位模板，提示是否复用。
7. 填写时间；时间也可待定。
8. 票档可填写，也可留空表示票档待公布。
9. 未补齐时保存草稿；满足展示条件时可官宣或发布。

### 巡演活动

1. 填写巡演基础信息：巡演名、分类、艺人、简介、主海报、限购策略。
2. 批量填写城市清单。
3. 每个城市生成一个站点草稿。
4. 城市可先官宣，C 端展示城市并显示场馆/时间/票档待定。
5. 每个城市站后续独立补场馆、时间、座位模板、票档。
6. 后续仍可新增城市站点。

## 状态机

### 站点状态

- `draft`：草稿，C 端不可见，可编辑可删除，不需要审核。
- `city_announced`：城市已官宣，C 端可见城市，场馆、时间、票档可待定，删除需要审核。
- `venue_pending`：新场馆或换场馆申请审核中，当前线上配置不变。
- `venue_confirmed`：场馆已确定，可复用或编辑座位图，换场馆需要新版本和审核。
- `scheduled`：场馆和时间已确定，已创建或可创建正式场次，改时间需要审核。
- `published`：已发布售票或开放购买，删除、换场馆、改期、下架需要审核。

### 站点配置版本状态

- `draft`：可编辑、可删除，不影响线上。
- `submitted`：已提交审核，不允许删除，可撤回或等待审核。
- `approved`：审核通过，等待应用或已准备应用。
- `rejected`：审核驳回，保留历史，可复制为新草稿。
- `applied`：已应用到正式站点，保留历史，不可删除。
- `withdrawn`：申请人撤回，保留历史。

## 审核规则

- 草稿站点删除：直接删除。
- 已官宣城市站删除：提交删除申请。
- 已确定场馆但未售票：删除或换场馆需要审核。
- 已发布售票但无订单：删除、换场馆、改期需要高风险审核。
- 已有订单：第一期不自动执行破坏性变更，只创建审核记录并提示管理员先处理订单、退款和通知，再人工确认执行。
- 站点配置草稿删除：允许删除。
- 已提交、已通过、已应用、已撤回、已驳回版本：不允许物理删除，作为历史记录保留。

## 数据模型

### `station` 调整

新增字段：

- `activity_id`：普通活动默认站点绑定的活动 ID。巡演站点可以为空或继续通过 `tour_id` 关联。

说明：

- 普通活动创建草稿时同步创建默认站点。
- 历史普通活动通过迁移补默认站点。
- 不新增 `activity_station` 表，避免模型分裂。

### 新增 `station_config_version`

核心字段：

- `id`
- `station_id`
- `activity_id`
- `tour_id`
- `version_no`
- `change_type`：`create`、`update_city`、`set_venue`、`change_venue`、`set_schedule`、`change_schedule`、`delete_station`
- `status`：`draft`、`submitted`、`approved`、`rejected`、`applied`、`withdrawn`
- `city`
- `station_name`
- `venue_id`
- `venue_application_id`
- `venue_name`
- `venue_address`
- `start_time`
- `end_time`
- `schedule_tba`
- `seat_template_source_type`
- `seat_template_source_id`
- `reason`
- `reviewer_id`
- `review_note`
- `review_time`
- `created_by`
- `created_at`
- `updated_at`
- `applied_at`

约束：

- 版本号按 `station_id` 递增。
- 只有 `draft` 允许物理删除。
- 新场馆申请资料继续复用 `venue_application` 和 `private_asset`。
- 版本表保存“希望应用的新配置”，不直接修改线上正式配置。

## API 设计

### 普通活动

- `POST /api/ticket/admin/activities/draft`：创建活动基础草稿和默认站点。
- `GET /api/ticket/admin/activities/{activityId}/station`：获取默认站点、当前生效配置、版本历史。

### 巡演

- `POST /api/ticket/admin/tours/draft`：创建巡演草稿，支持 `cities` 数组批量创建站点草稿。
- `POST /api/ticket/admin/tours/{tourId}/stations/draft`：新增城市站点，城市必填，站点名为空时默认 `{city}站`。

### 站点配置版本

- `POST /api/ticket/admin/stations/{stationId}/config-versions`：新建配置草稿。
- `PUT /api/ticket/admin/station-config-versions/{versionId}`：编辑草稿。
- `DELETE /api/ticket/admin/station-config-versions/{versionId}`：删除草稿，仅 `draft` 允许。
- `POST /api/ticket/admin/station-config-versions/{versionId}/submit`：提交审核。
- `POST /api/ticket/admin/station-config-versions/{versionId}/withdraw`：撤回审核中申请。

### 审核

- `GET /api/ticket/admin/station-config-versions/reviews`：admin 查询待审核站点配置变更。
- `POST /api/ticket/admin/station-config-versions/{versionId}/approve`：审核通过并应用。
- `POST /api/ticket/admin/station-config-versions/{versionId}/reject`：审核驳回。

## 应用规则

审核通过并应用版本时：

- 更新 `station` 的城市、站点名、场馆申请等字段。
- 普通活动使用已有活动草稿并绑定默认站点。
- 巡演站点首次发布时创建或更新对应 `activity`。
- `schedule_tba=true` 时不创建 `session`。
- 时间确定时创建或更新 `session`。
- 选择历史座位模板时复制到 activity/session 的 SeatCraft 布局。
- 已有订单的破坏性变更不自动应用，返回明确状态给管理员人工处理。

## 前端设计

### 普通活动新建页

- 第 1 步：活动基础信息。
- 第 2 步：站点/场次配置。
- 第 3 步：票档。

调整点：

- 移除活动基础信息中的场地审批凭证区域。
- 在站点配置步骤选择城市、选择或输入场馆。
- 新场馆上传申请资料。
- 已有场馆检测历史座位模板并询问是否复用。
- 时间可待定。
- 票档可留空。

### 巡演创建页

- 第 1 步：巡演基础信息。
- 第 2 步：城市清单。
- 支持批量城市输入。
- 每个城市生成站点草稿。
- 城市可先官宣。

### 巡演详情页

- 每个城市站显示当前状态、当前配置、配置草稿、历史版本、审核状态。
- 提供补场馆、改场馆、补时间、改时间、删除城市站入口。

### 审核页

新增“站点变更审核”页面，展示：

- 活动/巡演名。
- 城市站。
- 变更类型。
- 当前配置。
- 申请配置。
- 申请原因。
- 场地资料下载。
- 座位模板来源。

## 实施切片

1. 数据库迁移：新增 `station.activity_id` 和 `station_config_version`。
2. 后端版本服务：创建、编辑、删除草稿、提交、撤回、审核、应用。
3. 普通活动草稿 API：创建活动基础信息和默认站点。
4. 巡演批量城市：创建巡演草稿时生成站点草稿。
5. 新场馆与换场馆：接入场地申请和私有附件。
6. 发布与应用：审核通过后应用版本，生成或更新 activity/session/SeatCraft 布局。
7. 前端页面改造：活动新建、巡演新建、巡演详情、审核页。
8. 兼容和清理：历史普通活动补默认站点，历史巡演站点补 `applied` 基线版本。

## 测试策略

后端测试：

- `StationConfigVersionServiceTest`：覆盖草稿生命周期、审核、应用、历史保留、高风险变更不自动应用。
- `TourStationServiceTest`：覆盖巡演批量城市、站点名自动生成、城市官宣、后补场馆时间。
- `AdminControllerTest`：覆盖新 API 权限、草稿删除、非草稿删除失败、admin 审核。
- `VenueApplicationServiceTest` 或集成测试：覆盖新场馆资料、已通过场馆、历史座位模板候选。

前端验证：

- `pnpm typecheck`。
- 类型覆盖 `StationConfigVersionVO`、新建活动 payload、巡演城市清单 payload、审核页 VO。

边界验证：

- `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`
- `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`
- `git diff --check`

## 迁移策略

- 新增字段和表，不删除旧字段。
- `activity.venue_application_id` 暂保留，逐步由站点配置版本驱动。
- 为每个历史非巡演活动创建默认站点。
- 如果历史活动已有场次，从最早场次推导城市、场馆和时间。
- 如果历史活动没有场次，创建空默认站点草稿。
- 为每个历史巡演站点创建一条 `applied` 版本作为历史基线。
- 历史审核记录不强行迁移，新功能上线后进入站点配置历史。

## 自检结果

- 无待定占位符。
- 普通活动和巡演统一使用站点版本模型，状态机、API、UI 一致。
- 新场馆资料复用既有 `venue_application` 和 `private_asset`，不新增跨服务边界。
- 已有订单的破坏性变更明确不在第一期自动闭环，避免隐式退款/通知副作用。
- 范围足够大，实施前需要单独拆分计划。
