# 主办方入驻审核和管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将主办方入驻审核和正式名录管理统一为双 Tab 分页表格、抽屉详情、材料预览、审批/冻结审计闭环。

**Architecture:** `java-user` 负责申请历史、材料关联、用户资质、运营分配和审计；`java-ticket` 只提供自有库的主办方在售活动批量统计。前端先加载 `java-user` 分页数据，再以 3 秒超时的弱依赖补全活动数，不让票务服务阻塞主列表。

**Tech Stack:** Spring Boot 2.7、MyBatis-Plus、PostgreSQL、Next.js 16、React 19、TypeScript、`request<T>()`、`GlobalPagination`、共享 `Drawer` / `Modal`。

---

## 文件范围

**创建：**

- `sql/production-split/user/20260912_organizer_application_material.sql`
- `java/java-user/src/main/java/com/omni/user/entity/OrganizerApplicationMaterial.java`
- `java/java-user/src/main/java/com/omni/user/mapper/OrganizerApplicationMaterialMapper.java`
- `java/java-user/src/main/java/com/omni/user/dto/OrganizerApplicationMaterialResponse.java`
- `java/java-user/src/main/java/com/omni/user/dto/OrganizerDirectoryResponse.java`
- `java/java-user/src/main/java/com/omni/user/dto/OrganizerDirectoryRevokeRequest.java`
- `java/java-user/src/main/java/com/omni/user/dto/OrganizerApplicationPageResponse.java`（若直接使用 MyBatis-Plus `Page`，则不创建）
- `java/java-user/src/main/java/com/omni/user/service/OrganizerApplicationMaterialService.java`
- `java/java-user/src/main/java/com/omni/user/service/OrganizerDirectoryService.java`
- `java/java-ticket/src/main/java/com/omni/ticket/dto/OrganizerOnsaleSummaryRequest.java`
- `java/java-ticket/src/main/java/com/omni/ticket/dto/OrganizerOnsaleSummaryResponse.java`
- `frontend/src/lib/organizer-onboarding-production-entry.test.ts`

**修改：**

- `sql/production-split/manifest.json`
- `java/java-user/src/main/java/com/omni/user/entity/OrganizerApplication.java`
- `java/java-user/src/main/java/com/omni/user/dto/OrganizerApplicationRequest.java`
- `java/java-user/src/main/java/com/omni/user/dto/OrganizerApplicationResponse.java`
- `java/java-user/src/main/java/com/omni/user/service/OrganizerApplicationService.java`
- `java/java-user/src/main/java/com/omni/user/controller/UserController.java`
- `java/java-user/src/main/java/com/omni/user/controller/InternalWorkbenchController.java`
- `java/java-user/src/main/java/com/omni/user/service/UserAssetService.java`
- `java/java-user/src/test/java/com/omni/user/service/OrganizerApplicationServiceTest.java`
- `java/java-user/src/test/java/com/omni/user/service/OrganizerApplicationFullTest.java`
- `java/java-user/src/test/java/com/omni/user/controller/UserControllerSentinelTest.java`（如现有测试覆盖新增构造器/接口）
- `java/java-user/src/test/java/com/omni/user/controller/InternalWorkbenchControllerOrganizerOpsTest.java`
- `java/java-user/src/test/java/com/omni/user/service/OrganizerApplicationMaterialServiceTest.java`
- `java/java-user/src/test/java/com/omni/user/service/OrganizerDirectoryServiceTest.java`
- `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java` 或新增同模块管理 Controller
- `java/java-ticket/src/main/java/com/omni/ticket/service/OrganizerOnsaleSummaryService.java`
- `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`
- `java/java-ticket/src/test/java/com/omni/ticket/service/OrganizerOnsaleSummaryServiceTest.java`
- `frontend/src/app/console/layout.tsx`
- `frontend/src/lib/console-paths.ts`
- `frontend/src/app/console/profile/page.tsx`
- `frontend/src/app/console/organizer-applications/page.tsx`
- `frontend/src/app/merchant/page.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/types/api.ts`
- `frontend/src/lib/console-modal-drawer-layout.test.ts`
- `implementation-notes.md`

## Task 1: 编写并登记用户库迁移

**Files:**

- Create: `sql/production-split/user/20260912_organizer_application_material.sql`
- Modify: `sql/production-split/manifest.json`

- [ ] **Step 1: Write the failing migration contract test**

在 `frontend/src/lib/organizer-onboarding-production-entry.test.ts` 之外，先用 PowerShell 静态断言迁移内容：

```powershell
$migration = Get-Content -Raw 'sql/production-split/user/20260912_organizer_application_material.sql'
if ($migration -notmatch 'CREATE TABLE IF NOT EXISTS organizer_application_material') { throw '缺少材料关联表' }
if ($migration -notmatch 'DROP INDEX IF EXISTS idx_organizer_application_user_id') { throw '未移除申请人唯一索引' }
if ($migration -notmatch 'CREATE INDEX IF NOT EXISTS idx_organizer_application_user_id') { throw '未建立申请人普通索引' }
```

运行该检查，预期因迁移文件不存在而失败。

- [ ] **Step 2: Create the migration**

迁移必须按以下语义执行：

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS organizer_application_material (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES organizer_application(id),
    asset_id BIGINT NOT NULL REFERENCES user_asset(id),
    material_type VARCHAR(64) NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP INDEX IF EXISTS idx_organizer_application_user_id;
CREATE INDEX IF NOT EXISTS idx_organizer_application_user_id
    ON organizer_application(user_id);
CREATE INDEX IF NOT EXISTS idx_organizer_application_material_application
    ON organizer_application_material(application_id, create_time DESC);
CREATE INDEX IF NOT EXISTS idx_organizer_application_material_type
    ON organizer_application_material(application_id, material_type);
CREATE UNIQUE INDEX IF NOT EXISTS uk_organizer_application_material_asset
    ON organizer_application_material(application_id, asset_id);

COMMIT;
```

保留旧申请记录和材料，不删除数据；`manifest.json` 的 `user.migrations` 追加 `user/20260912_organizer_application_material.sql`。

- [ ] **Step 3: Re-run the migration contract**

运行同一段 PowerShell，预期通过，并执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
```

预期迁移路径、owner 和 SQL 资产检查通过。

## Task 2: 先写材料与申请历史测试，再实现用户域材料模型

**Files:**

- Create: `OrganizerApplicationMaterial.java`
- Create: `OrganizerApplicationMaterialMapper.java`
- Create: `OrganizerApplicationMaterialResponse.java`
- Create: `OrganizerApplicationMaterialService.java`
- Modify: `OrganizerApplication.java`, `OrganizerApplicationRequest.java`, `OrganizerApplicationResponse.java`, `UserAssetService.java`
- Test: `OrganizerApplicationMaterialServiceTest.java`

- [ ] **Step 1: Write failing material ownership tests**

测试至少覆盖以下行为：

```java
@Test
void uploadRejectsApplicationOwnedByAnotherUser() {
    when(applicationMapper.selectById(11L)).thenReturn(application(11L, 2004L, 0));

    BusinessException error = assertThrows(BusinessException.class,
            () -> service.upload(2005L, 11L, "BUSINESS_LICENSE",
                    new MockMultipartFile("file", "license.jpg", "image/jpeg", jpegBytes())));

    assertEquals("无权操作该入驻申请", error.getMessage());
    verify(materialMapper, never()).insert(any());
}

@Test
void uploadRejectsApprovedOrRejectedApplication() {
    when(applicationMapper.selectById(11L)).thenReturn(application(11L, 2004L, 1));

    BusinessException error = assertThrows(BusinessException.class,
            () -> service.upload(2004L, 11L, "BUSINESS_LICENSE",
                    new MockMultipartFile("file", "license.jpg", "image/jpeg", jpegBytes())));

    assertEquals("仅待审核申请可维护材料", error.getMessage());
}
```

运行：

```powershell
mvn -pl java-user "-Dtest=OrganizerApplicationMaterialServiceTest" test
```

预期失败，因为服务和实体尚不存在。

- [ ] **Step 2: Implement the material model and upload service**

实现以下契约：

- `materialType` 只允许 `BUSINESS_LICENSE`、`ID_CARD_FRONT`、`ID_CARD_BACK`、`OTHER_QUALIFICATION`。
- 允许 JPG、PNG、WEBP，大小上限 10 MB，并复用 `UserAssetService` 的文件内容校验、摘要和公共路径逻辑。
- 申请必须存在、属于当前用户、状态为 `PENDING`。
- 上传文件成功后插入 `user_asset` 和 `organizer_application_material`；资产插入失败时删除文件。
- 响应返回 `id`、`materialType`、`assetId`、`publicUrl`、原文件名、mimeType、sizeBytes、createTime。
- 详情读取允许申请人读取自己的申请，也允许具备 `organizer.review` 或 `organizer.account.manage` 的后台操作者读取。

- [ ] **Step 3: Run the material tests**

```powershell
mvn -pl java-user "-Dtest=OrganizerApplicationMaterialServiceTest" test
```

预期材料所有权、状态、类型、文件校验和关联写入测试通过。

## Task 3: 重构申请历史、分页筛选和审批审计

**Files:**

- Modify: `OrganizerApplicationService.java`, `UserController.java`, `OrganizerApplicationResponse.java`
- Modify: `OrganizerApplicationServiceTest.java`, `OrganizerApplicationFullTest.java`

- [ ] **Step 1: Add failing tests for the new application contract**

覆盖：

```java
@Test
void rejectedResubmissionCreatesNewApplicationAndKeepsHistory() {
    when(userMapper.selectById(2004L)).thenReturn(user(2004L, "user", 2));
    when(applicationMapper.selectOne(any())).thenReturn(rejectedApplication(9L, 2004L));
    when(applicationMapper.insert(any())).thenAnswer(invocation -> {
        OrganizerApplication next = invocation.getArgument(0);
        next.setId(10L);
        return 1;
    });

    OrganizerApplicationResponse response = service.submitOrUpdate(2004L, request());

    assertEquals(10L, response.getId());
    verify(applicationMapper).insert(any());
}

@Test
void rejectRequiresReviewNoteAndWritesAudit() {
    when(applicationMapper.selectById(9L)).thenReturn(pendingApplication(9L, 2004L));

    BusinessException error = assertThrows(BusinessException.class,
            () -> service.reject(9L, 2002L, "  "));

    assertEquals("驳回原因不能为空", error.getMessage());
    verify(auditService, never()).write(any());
}
```

新增分页筛选测试，断言 `page=2`、`size=10`、`keyword`、状态枚举和主体类型被映射到 MyBatis-Plus `Page` 与查询条件。

运行：

```powershell
mvn -pl java-user "-Dtest=OrganizerApplicationServiceTest,OrganizerApplicationFullTest" test
```

预期新测试失败，旧测试可能因返回类型变化失败；随后同步修改旧断言。

- [ ] **Step 2: Implement paginated application query**

使用 MyBatis-Plus `Page<OrganizerApplicationResponse>` 或本模块统一的分页 DTO，不返回全量数组。服务内部将：

```java
long current = page == null || page < 1 ? 1 : page;
long pageSize = size == null ? 10 : Math.min(Math.max(size, 1), 50);
```

状态映射：

```java
private Integer statusCode(String status) {
    if ("PENDING".equalsIgnoreCase(status)) return 0;
    if ("APPROVED".equalsIgnoreCase(status)) return 1;
    if ("REJECTED".equalsIgnoreCase(status)) return 2;
    return null;
}
```

`keyword` 使用现有用户批量查询补充手机号、昵称匹配；不得执行跨库查询。结果附带材料列表和审核字段。

- [ ] **Step 3: Implement new-application resubmission**

提交规则：

- 最新申请不存在：插入新申请。
- 最新申请 `PENDING`：更新文本字段，材料仍绑定原申请。
- 最新申请 `REJECTED`：插入新申请，不复用旧材料。
- 最新申请 `APPROVED` 且用户仍有效：抛出“入驻申请已通过”。
- 被取消/冻结的历史主办方重新申请时插入新申请。

取消 `organizer_application.user_id` 唯一假设，所有“查申请”逻辑改为按 `create_time DESC, id DESC` 取最新记录。

- [ ] **Step 4: Add approval/rejection audit**

审批成功后调用 `OperationAuditService.write()`：

```java
auditService.write(audit(reviewerId, "organizer_application.approve",
        "organizer_application", id, application.getOrganizerName(),
        trimToNull(reviewNote), "审核通过"));
```

驳回使用 action `organizer_application.reject`，reason 使用必填 `reviewNote`。审核和审计必须在 `omni_user` 本地事务内完成。

- [ ] **Step 5: Implement and test controller parameters**

将 `UserController` 的 admin 列表改为接收 `page`、`size`、`keyword`、`status`、`subjectType`；approve/reject 保持原路径，新增材料上传和读取映射。

运行：

```powershell
mvn -pl java-user "-Dtest=OrganizerApplicationServiceTest,OrganizerApplicationFullTest,UserControllerSentinelTest" test
```

预期申请分页、重提历史、审批审计和 Controller 映射全部通过。

## Task 4: 实现正式主办方名录与冻结审计

**Files:**

- Create: `OrganizerDirectoryResponse.java`, `OrganizerDirectoryRevokeRequest.java`, `OrganizerDirectoryService.java`
- Modify: `InternalWorkbenchController.java`
- Test: `OrganizerDirectoryServiceTest.java`, `InternalWorkbenchControllerOrganizerOpsTest.java`

- [ ] **Step 1: Write failing directory tests**

```java
@Test
void listReturnsLatestApprovedQualificationAndAssignedOperator() {
    when(userMapper.selectPage(any(), any())).thenReturn(pageOf(
            organizer(2003L, "星河演艺集团", 1)));
    when(applicationMapper.selectList(any())).thenReturn(List.of(
            approvedApplication(21L, 2003L, "91110000XINGHE")));
    when(assignmentMapper.selectList(any())).thenReturn(List.of(assignment(2003L, 2002L)));
    when(userMapper.selectBatchIds(any())).thenReturn(List.of(operator(2002L, "平台运营员")));

    Page<OrganizerDirectoryResponse> result =
            service.list(2002L, 1, 10, "星河", null, "ACTIVE");

    assertEquals("91110000XINGHE", result.getRecords().get(0).getQualificationNo());
    assertEquals("平台运营员", result.getRecords().get(0).getFollowUpOperatorName());
}

@Test
void revokeRequiresReasonAndWritesAudit() {
    when(userMapper.selectById(2003L)).thenReturn(organizer(2003L, "星河演艺集团", 1));

    BusinessException error = assertThrows(BusinessException.class,
            () -> service.revoke(2002L, 2003L, "  "));

    assertEquals("取消合作/冻结原因不能为空", error.getMessage());
    verify(userMapper, never()).updateById(any());
}
```

先运行目标测试，预期失败。

- [ ] **Step 2: Implement same-database directory query**

名录服务只使用 `userMapper`、`organizerApplicationMapper`、`organizerOpsAssignmentMapper` 和同库用户批量查询：

- 有效名录：`role=organizer`、`organizer_status=1`。
- 冻结记录：`organizer_status=3`，仅在合作状态筛选为冻结时展示。
- 资质编号：每个主办方取最新 `APPROVED` 申请，不取最新驳回申请。
- 运营跟进人：从 `organizer_ops_assignment.assigned_operator_id` 批量解析同库用户昵称/手机号。
- 关键字匹配主办方名称；`followUpOperator` 匹配运营员昵称、手机号和 ID。

- [ ] **Step 3: Implement revoke**

```java
@Transactional
public OrganizerDirectoryResponse revoke(Long operatorId, Long organizerId, String reason) {
    requireAnyPermission(operatorId, "organizer.review", "organizer.account.manage");
    String normalizedReason = requireText(reason, "取消合作/冻结原因不能为空");
    User organizer = requireActiveOrganizer(organizerId);
    organizer.setRole("user");
    organizer.setOrganizerStatus(3);
    organizer.setUpdateTime(LocalDateTime.now());
    userMapper.updateById(organizer);
    auditService.write(audit(operatorId, "organizer.revoke", "user", organizerId,
            organizer.getOrganizerName(), normalizedReason, "主办方资质已冻结"));
    return toResponse(organizer);
}
```

不调用 `java-ticket`、不退款、不删除材料。

- [ ] **Step 4: Wire Controller permission checks**

在 `InternalWorkbenchController` 新增：

```java
@GetMapping("/organizers")
public Result<Page<OrganizerDirectoryResponse>> listOrganizers(
        @RequestHeader(value = "Authorization", required = false) String authorization,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String followUpOperator,
        @RequestParam(required = false) String cooperationStatus) {
    Long operatorId = requireOperatorId(authorization);
    requireAnyPermission(operatorId, "organizer.review", "organizer.account.manage");
    return Result.success(organizerDirectoryService.list(
            operatorId, page, size, keyword, followUpOperator, cooperationStatus));
}
```

新增 `POST /organizers/{organizerId}/revoke`，body 为空或 reason 空白时返回中文 400。

- [ ] **Step 5: Run Java user tests**

```powershell
mvn -pl java-user "-Dtest=OrganizerDirectoryServiceTest,InternalWorkbenchControllerOrganizerOpsTest,OrganizerApplicationServiceTest,OrganizerApplicationFullTest" test
```

预期名录查询、最新资质、双权限、冻结状态更新和审计测试通过。

## Task 5: 实现票务侧批量在售活动数接口

**Files:**

- Create: `OrganizerOnsaleSummaryRequest.java`, `OrganizerOnsaleSummaryResponse.java`, `OrganizerOnsaleSummaryService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Test: `OrganizerOnsaleSummaryServiceTest.java`, `AdminControllerTest.java`

- [ ] **Step 1: Write failing batch aggregation tests**

```java
@Test
void batchSummaryAggregatesOnlyOnsaleActivitiesByOrganizer() {
    when(activityMapper.selectMaps(any())).thenReturn(List.of(
            Map.of("organizerId", 2003L, "count", 4L),
            Map.of("organizerId", 2005L, "count", 1L)));

    Map<Long, Long> result = service.batchSummary(2002L, List.of(2003L, 2005L));

    assertEquals(4L, result.get(2003L));
    assertEquals(1L, result.get(2005L));
}

@Test
void emptyOrganizerIdsDoesNotQueryDatabase() {
    assertTrue(service.batchSummary(2002L, List.of()).isEmpty());
    verify(activityMapper, never()).selectMaps(any());
}
```

预期失败。

- [ ] **Step 2: Implement ticket-owned aggregation**

接口为 `POST /api/ticket/admin/organizers/batch-onsale-summary`，请求体 `{ "organizerIds": [2003, 2005] }`：

- 校验管理员权限和 `X-Internal-Token`/现有后台权限链路。
- 去重、过滤非正整数、限制最多 50 个 ID。
- 只在 `java-ticket` 内聚合 `activity.organizer_id`，按当前在售状态定义过滤。
- 返回 `organizerId`、`onsaleActivityCount`、`available`。

- [ ] **Step 3: Run ticket tests and boundary check**

```powershell
mvn -pl java-ticket "-Dtest=OrganizerOnsaleSummaryServiceTest,AdminControllerTest" test
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
```

预期票务测试通过，边界检查不出现 `java-user` 访问票务 Entity/Mapper/SQL。

## Task 6: 先写前端 API/type 测试，再补齐请求封装

**Files:**

- Modify: `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`
- Test: `frontend/src/lib/api.test.ts`, `frontend/src/lib/organizer-onboarding-production-entry.test.ts`

- [ ] **Step 1: Write failing API assertions**

新增断言目标：

```typescript
test('builds organizer application pagination query with enum status', async () => {
  await listOrganizerApplications({
    page: 2,
    size: 10,
    keyword: '星河',
    status: 'PENDING',
    subjectType: 'enterprise',
  })
  assert.equal(lastRequest.url,
    '/api/user/organizer/applications/admin?page=2&size=10&keyword=%E6%98%9F%E6%B2%B3&status=PENDING&subjectType=enterprise')
})

test('builds revoke request with mandatory reason', async () => {
  await revokeOrganizer(2003, '材料长期未补齐')
  assert.deepEqual(lastRequest.body, { reason: '材料长期未补齐' })
})
```

先运行：

```powershell
cd frontend
node --test src/lib/api.test.ts
```

预期新增断言失败。

- [ ] **Step 2: Add API and types**

新增 TypeScript 契约：

```typescript
export interface OrganizerApplicationMaterialVO {
  id: number
  materialType: string
  assetId: number
  publicUrl: string
  originalName: string | null
  mimeType: string
  sizeBytes: number
  createTime: string
}

export interface OrganizerDirectoryVO {
  organizerId: number
  organizerName: string
  subjectType: SubjectType
  qualificationNo: string | null
  contactName: string
  contactPhone: string
  followUpOperatorId: number | null
  followUpOperatorName: string | null
  onsaleActivityCount: number | null
  cooperationStatus: 'ACTIVE' | 'FROZEN' | string
}
```

API 函数：

- `listOrganizerApplications(params)` -> `PageResult<OrganizerApplicationVO>`。
- `listOrganizers(params)` -> `PageResult<OrganizerDirectoryVO>`。
- `approveOrganizerApplication(id, reviewNote?)`。
- `rejectOrganizerApplication(id, reviewNote)`。
- `uploadOrganizerApplicationMaterial(applicationId, materialType, file)`，通过现有 multipart 封装。
- `revokeOrganizer(organizerId, reason)`。
- `batchOrganizerOnsaleSummary(organizerIds, { timeoutMs: 3000 })`。

`request<T>()` 增加可选 `timeoutMs`，使用 `AbortController`；未传时保持现有行为。

- [ ] **Step 3: Run front-end API tests**

```powershell
node --test src/lib/api.test.ts src/lib/organizer-onboarding-production-entry.test.ts
```

预期 query、body、multipart、超时参数和类型入口测试通过。

## Task 7: 接通 C 端先申请后上传材料流程

**Files:**

- Modify: `frontend/src/app/merchant/page.tsx`
- Modify: `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`

- [ ] **Step 1: Write failing page contract assertions**

```typescript
const merchant = source('../app/merchant/page.tsx')
assert.match(merchant, /uploadOrganizerApplicationMaterial/)
assert.match(merchant, /先提交申请/)
assert.match(merchant, /仅待审核申请可上传材料/)
```

运行入口测试，预期失败。

- [ ] **Step 2: Implement upload timing**

提交表单成功后保存返回的 `application.id`，只在返回申请状态为 `PENDING` 时显示营业执照、身份证正反面上传控件；上传成功后刷新申请详情。

当最新申请为 `REJECTED` 时，显示“重新提交申请”并调用现有提交接口创建新申请；新返回 ID 替换旧材料关联。`APPROVED` 申请不显示上传控件。

- [ ] **Step 3: Run merchant and API tests**

```powershell
node --test src/lib/organizer-onboarding-production-entry.test.ts src/lib/api.test.ts
```

预期上传时序和重新申请材料归属测试通过。

## Task 8: 重构控制台双 Tab 页面

**Files:**

- Modify: `frontend/src/app/console/organizer-applications/page.tsx`
- Modify: `frontend/src/app/console/layout.tsx`
- Modify: `frontend/src/lib/console-paths.ts`
- Modify: `frontend/src/app/console/profile/page.tsx`
- Modify: `frontend/src/lib/console-modal-drawer-layout.test.ts`
- Test: `frontend/src/lib/organizer-onboarding-production-entry.test.ts`

- [ ] **Step 1: Write failing UI structure assertions**

```typescript
const page = source('../app/console/organizer-applications/page.tsx')
assert.match(page, /Tab 1|入驻审核申请流/)
assert.match(page, /正式主办方名录/)
assert.match(page, /<GlobalPagination/)
assert.match(page, /<Drawer/)
assert.match(page, /营业执照状态/)
assert.match(page, /取消合作\/冻结原因不能为空/)
assert.doesNotMatch(page, /filteredItems\.map/)
```

运行：

```powershell
cd frontend
node --test src/lib/organizer-onboarding-production-entry.test.ts src/lib/console-modal-drawer-layout.test.ts
```

预期因旧卡片页面不存在双 Tab 和 Drawer 而失败。

- [ ] **Step 2: Implement Tab 1**

页面状态至少包含：

```typescript
const [activeTab, setActiveTab] = useState<'applications' | 'organizers'>('applications')
const [applicationPage, setApplicationPage] = useState(1)
const [applicationFilters, setApplicationFilters] = useState({
  keyword: '',
  status: '',
  subjectType: '',
})
const [selectedApplication, setSelectedApplication] = useState<OrganizerApplicationVO | null>(null)
const [applicationReviewDialog, setApplicationReviewDialog] = useState<... | null>(null)
```

使用固定表头、不换行、横向滚动和 `GlobalPagination`。行点击、`立即审核`、`查看详情` 都打开同一个 Drawer。Drawer 展示联系信息、用户 ID、营业执照/身份证图片、经营范围、申请说明和审核留痕。图片点击打开预览 Modal。

待审核状态只显示审核按钮；驳回 Modal 的 `reviewNote.trim()` 为空时不调用 API，并显示“驳回原因不能为空”。

- [ ] **Step 3: Implement Tab 2**

使用独立的 `organizerPage` 和筛选状态。列表加载完成后：

```typescript
const ids = rows.map(row => row.organizerId).filter(id => Number.isInteger(id) && id > 0)
if (ids.length > 0) {
  try {
    const summaries = await batchOrganizerOnsaleSummary([...new Set(ids)], { timeoutMs: 3000 })
    setOnsaleCounts(current => ({ ...current, ...toCountMap(summaries) }))
  } catch {
    setOnsaleCounts(current => ({ ...current, ...Object.fromEntries(ids.map(id => [id, null])) }))
  }
}
```

不为每行发请求。冻结 Modal 固定显示：

“该操作将收回主办方发布与管理权限。旗下若有在售活动将自动限制新增场次，但已售订单仍需正常核销或履约退款。”

原因非空前禁止提交，成功后刷新名录和当前 Drawer。

- [ ] **Step 4: Update navigation labels**

将 `layout.tsx`、`console-paths.ts` 和个人中心快捷入口的显示文案统一为“主办方入驻审核和管理”，保持 href `/console/organizer-applications` 和 `organizer.review` 不变；同时页面入口允许 `organizer.account.manage`。

- [ ] **Step 5: Run front-end tests and typecheck**

```powershell
cd frontend
node --test src/lib/organizer-onboarding-production-entry.test.ts src/lib/console-modal-drawer-layout.test.ts src/lib/api.test.ts
pnpm typecheck
```

预期双 Tab、表格、抽屉、图片预览、必填原因、活动数弱依赖和导航文案测试通过，TypeScript 无错误。

## Task 9: 同步 implementation-notes 并执行全量验收

**Files:**

- Modify: `implementation-notes.md`

- [ ] **Step 1: Record implementation notes**

记录：

- 申请材料关联表和移除用户唯一索引。
- 驳回重提创建新申请单的行为。
- 材料只允许 `PENDING` 申请维护。
- 名录冻结不触发旧自动退款链路。
- 活动数 3 秒弱依赖和 `-` 降级。
- 本地迁移是否已执行及数据库名。
- 未执行的真实冻结/上传副作用验证。

- [ ] **Step 2: Run focused Java verification**

```powershell
mvn -pl java-user "-Dtest=OrganizerApplicationMaterialServiceTest,OrganizerApplicationServiceTest,OrganizerDirectoryServiceTest,InternalWorkbenchControllerOrganizerOpsTest" test
mvn -pl java-ticket "-Dtest=OrganizerOnsaleSummaryServiceTest,AdminControllerTest" test
```

- [ ] **Step 3: Run required boundary verification**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

必须确认没有 `java-user` -> `omni_ticket_split` 直连、跨服务 Mapper/Entity/XML 或 SQL Join。

- [ ] **Step 4: Run front-end verification**

```powershell
cd frontend
pnpm typecheck
node --test src/lib/organizer-onboarding-production-entry.test.ts src/lib/console-modal-drawer-layout.test.ts src/lib/api.test.ts
```

- [ ] **Step 5: Inspect final diff without committing**

```powershell
git diff --check
git status --short
git diff --stat
```

确认只包含本任务文件、`implementation-notes.md` 和设计/计划文档；不提交、不推送、不修改 `runtime/`、`backups/` 或 dump 文件。
