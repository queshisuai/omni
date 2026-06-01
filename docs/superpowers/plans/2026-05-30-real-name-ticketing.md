# 实名购票核心版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为当前购票链路增加实名观演人能力：每张票绑定一位观演人，同场次同证件去重，并在用户订单、主办方后台和平台后台按权限展示实名信息。

**Architecture:** `java-user` 拥有常用观演人资料，`java-order` 在下单时通过 user internal API 拉取观演人快照并写入 `order_attendee`，`java-ticket` 只提供活动是否实名制和后台订单权限过滤，`grab-service` 只透传 `attendeeIds`，前端负责预选观演人和下单前引导。所有跨服务数据只通过 internal API 传递，不新增跨服务数据库 Mapper、Entity、XML mapper 或跨库 join。

**Tech Stack:** Spring Boot 2.7.18、MyBatis-Plus、PostgreSQL 17、Seata、NestJS、Next.js 16、React 19、TypeScript。

---

## 执行纪律

- 按任务顺序执行，每个任务完成后运行对应测试。
- 只有用户明确要求时才执行 `git commit`；任务里的 commit 步骤是给后续执行者的检查点，不代表自动提交授权。
- 涉及下载依赖或大规模联网操作时先停下询问用户；本计划不需要新增依赖。
- 修改 `java-common` 后才需要 `mvn install -pl java-common -am`；本计划不修改 `java-common`。
- 修改微服务边界相关代码后必须运行 `scripts/verify-microservice-boundaries.ps1`。

## 方案补强决策

- `activity.real_name_required` 默认值使用 `FALSE`，避免迁移后把所有历史活动静默切换成实名制；需要实名的活动由后台显式开启。
- user internal 解析接口统一使用现有路径风格：`POST /api/user/internal/attendees/resolve`，由 `X-Internal-Token` 鉴权。
- 核心版只保存证件 hash 和 mask；`id_no_encrypted` 字段保留但先写 `null`，不把标准化证件号伪装成“加密值”入库。
- `user_attendee` 使用 `status=1` 的部分唯一索引保护同一用户有效证件唯一，允许删除后重新添加。
- `order_attendee` 使用 `status=1` 的部分唯一索引保护同场次同证件有效票唯一，防止两个并发订单同时通过应用层检查。
- `order_attendee.status` 语义固定为：`1=有效占用`、`3=已退款释放`、`4=订单取消释放`。
- 抢票链路只透传 `attendeeIds`，最终实名数量、归属、同场次证件去重仍由 order-service 校验。

## 文件结构总览

### SQL

- Create: `sql/production-split/ticket/20260530_activity_real_name_required.sql` — 给活动表增加实名制开关。
- Create: `sql/production-split/user/20260530_user_attendee.sql` — user 库常用观演人表。
- Create: `sql/production-split/order/20260530_order_attendee.sql` — order 库订单实名快照表。
- Modify: `sql/docker-init/010-seata-undo-log.sql` 或当前 Docker 初始化汇总脚本 — 同步新增表，确保本地重建库有表。
- Modify: `sql/production-split/manifest.json` — 登记新增生产拆库 SQL。

### java-ticket

- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java` — 增加 `realNameRequired`。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityVO.java` — 活动列表可返回实名制标记。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityService.java` — 活动详情和列表填充实名制标记。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesQuoteResponse.java` — 票务报价返回实名制标记给 order。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java` — quote 时填充 `realNameRequired`。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/OrderInfoResponse.java` — 后台订单响应带实名观演人列表。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java` — 保持从 Authorization 解析操作者，不信任 query userId。

### java-user

- Create: `java/java-user/src/main/java/com/omni/user/entity/UserAttendee.java` — 常用观演人实体。
- Create: `java/java-user/src/main/java/com/omni/user/mapper/UserAttendeeMapper.java` — MyBatis-Plus Mapper。
- Create: `java/java-user/src/main/java/com/omni/user/dto/UserAttendeeRequest.java` — 新增/编辑请求。
- Create: `java/java-user/src/main/java/com/omni/user/dto/UserAttendeeResponse.java` — 用户侧观演人响应。
- Create: `java/java-user/src/main/java/com/omni/user/dto/ResolveAttendeesRequest.java` — internal resolve 请求。
- Create: `java/java-user/src/main/java/com/omni/user/dto/ResolvedAttendeeResponse.java` — internal resolve 响应。
- Create: `java/java-user/src/main/java/com/omni/user/service/UserAttendeeService.java` — 观演人业务、身份证标准化、hash、mask、校验。
- Modify: `java/java-user/src/main/java/com/omni/user/controller/UserController.java` — 增加用户侧和 internal 观演人接口。
- Create: `java/java-user/src/test/java/com/omni/user/service/UserAttendeeServiceTest.java` — 观演人服务测试。
- Create: `java/java-user/src/test/java/com/omni/user/controller/UserAttendeeControllerTest.java` — 接口权限测试。

### java-order

- Create: `java/java-order/src/main/java/com/omni/order/entity/OrderAttendee.java` — 订单实名快照实体。
- Create: `java/java-order/src/main/java/com/omni/order/mapper/OrderAttendeeMapper.java` — 快照 Mapper 和去重查询。
- Create: `java/java-order/src/main/java/com/omni/order/dto/OrderAttendeeResponse.java` — 订单/后台展示 DTO。
- Create: `java/java-order/src/main/java/com/omni/order/dto/ResolveAttendeesRequest.java` — 调 user internal 请求。
- Create: `java/java-order/src/main/java/com/omni/order/dto/ResolvedAttendeeResponse.java` — user internal 响应。
- Modify: `java/java-order/src/main/java/com/omni/order/dto/CreateOrderRequest.java` — 增加 `attendeeIds`。
- Modify: `java/java-order/src/main/java/com/omni/order/dto/LockSeatsRequest.java` — 增加 `attendeeIds`。
- Modify: `java/java-order/src/main/java/com/omni/order/dto/TicketSalesQuoteResponse.java` — 增加 `realNameRequired`。
- Modify: `java/java-order/src/main/java/com/omni/order/dto/OrderListItemResponse.java` — 增加 `attendees`。
- Modify: `java/java-order/src/main/java/com/omni/order/client/UserInternalClient.java` — 增加 resolve attendees internal API。
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java` — 下单实名校验、快照写入、取消/退款释放。
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java` — 用户订单详情继续从 JWT/内部接口隔离。
- Modify: `java/java-order/src/test/java/com/omni/order/service/OrderServiceTest.java` — 普通下单实名测试。
- Modify: `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java` — 带座实名测试。
- Modify: `java/java-order/src/test/java/com/omni/order/controller/OrderControllerPublicAuthTest.java` — 确认前端不能伪造 userId。

### grab-service

- Modify: `nestjs/grab-service/src/grab/grab.types.ts` — 抢票请求、记录、active intent 增加 `attendeeIds`。
- Modify: `nestjs/grab-service/src/grab/grab.repository.ts` — `grab_request` 读写 `attendee_ids`。
- Modify: `nestjs/grab-service/src/grab/grab.service.ts` — 校验 `attendeeIds.length === quantity`，active intent 纳入 attendeeIds。
- Modify: `nestjs/grab-service/src/grab/grab-worker.service.ts` — 创建订单时转发 `attendeeIds`。
- Modify: `nestjs/grab-service/src/grab/order-client.service.ts` — order client body 增加 `attendeeIds`。
- Modify: `nestjs/grab-service/src/grab/*.spec.ts` — 覆盖请求校验和转发。
- Create: `sql/production-split/grab/20260530_grab_attendee_ids.sql` — 抢票请求表增加 attendee_ids。

### frontend

- Modify: `frontend/src/types/api.ts` — 增加观演人类型、订单实名类型、活动实名标记、抢票 payload 字段。
- Modify: `frontend/src/lib/api.ts` — 新增观演人 API，下单和抢票 API 增加 `attendeeIds`。
- Create: `frontend/src/lib/attendees.ts` — 身份证前端格式校验、脱敏展示、预选数量校验。
- Create: `frontend/src/lib/attendees.test.ts` — 前端纯逻辑测试。
- Create: `frontend/src/components/RealNameNoticeModal.tsx` — 实名制提示弹窗。
- Create: `frontend/src/components/AttendeePickerModal.tsx` — 选择/新增实名观演人弹层。
- Modify: `frontend/src/app/activity/[id]/page.tsx` — 活动详情实名提示、预选观演人、下单前校验和传参。
- Modify: `frontend/src/app/orders/page.tsx` — 用户订单显示实名观演人。
- Modify: `frontend/src/app/console/orders/page.tsx` — 后台订单显示实名观演人。
- Modify: `frontend/src/lib/console-orders.ts`、`frontend/src/lib/console-orders.test.ts` — 订单实名展示辅助。

---

### Task 1: ticket 服务增加活动实名制开关

**Files:**
- Create: `sql/production-split/ticket/20260530_activity_real_name_required.sql`
- Modify: `sql/production-split/manifest.json`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityVO.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesQuoteResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/TicketSalesInternalServiceTest.java`

- [ ] **Step 1: 写失败测试，quote 返回实名制标记**

在 `TicketSalesInternalServiceTest` 现有 `quoteReturnsPerUserLimitFromActivity()` 附近增加用例：

```java
@Test
void quoteReturnsRealNameRequirementFromActivity() {
    TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
    SessionMapper sessionMapper = mock(SessionMapper.class);
    ActivityMapper activityMapper = mock(ActivityMapper.class);
    VenueMapper venueMapper = mock(VenueMapper.class);
    SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
    TicketSalesInternalService service = new TicketSalesInternalService(
            ticketTypeMapper, sessionMapper, activityMapper, venueMapper, sessionSeatMapper);

    TicketType ticketType = new TicketType();
    ticketType.setId(3001L);
    ticketType.setSessionId(2001L);
    ticketType.setName("看台");
    ticketType.setPrice(new BigDecimal("380.00"));
    ticketType.setStatus(1);
    when(ticketTypeMapper.selectById(3001L)).thenReturn(ticketType);
    when(sessionSeatMapper.selectSessionSellable(2001L)).thenReturn(true);

    Session session = new Session();
    session.setId(2001L);
    session.setActivityId(1001L);
    when(sessionMapper.selectById(2001L)).thenReturn(session);

    Activity activity = new Activity();
    activity.setId(1001L);
    activity.setName("南京站");
    activity.setRealNameRequired(true);
    when(activityMapper.selectById(1001L)).thenReturn(activity);

    TicketSalesQuoteRequest request = new TicketSalesQuoteRequest();
    request.setSessionId(2001L);
    request.setTicketTypeId(3001L);
    request.setQuantity(1);

    TicketSalesQuoteResponse response = service.quote(request);

    assertTrue(response.getRealNameRequired());
}
```

需要的 import 若测试文件尚未包含：

```java
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.assertTrue;
```

这个测试必须使用真实 `TicketSalesInternalService.quote(...)`，不要只 mock `TicketSalesQuoteResponse`。

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd java
mvn -pl java-ticket -Dtest=TicketSalesInternalServiceTest test
```

Expected: FAIL，原因是 `getRealNameRequired()` 或字段不存在。

- [ ] **Step 3: 新增生产拆库 SQL**

创建 `sql/production-split/ticket/20260530_activity_real_name_required.sql`：

```sql
-- owner: java-ticket
ALTER TABLE activity
    ADD COLUMN IF NOT EXISTS real_name_required BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN activity.real_name_required IS '是否要求实名制购票';
```

- [ ] **Step 4: 更新 `Activity` 实体**

在 `Activity` 增加字段和 getter/setter：

```java
private Boolean realNameRequired;

public Boolean getRealNameRequired() { return realNameRequired; }
public void setRealNameRequired(Boolean realNameRequired) { this.realNameRequired = realNameRequired; }
```

- [ ] **Step 5: 更新活动列表 DTO**

在 `ActivityVO` 增加：

```java
private Boolean realNameRequired;

public Boolean getRealNameRequired() { return realNameRequired; }
public void setRealNameRequired(Boolean realNameRequired) { this.realNameRequired = realNameRequired; }
```

在 `ActivityService.listActivities(...)` 构造 `ActivityVO` 时加入：

```java
vo.setRealNameRequired(!Boolean.FALSE.equals(activity.getRealNameRequired()));
```

- [ ] **Step 6: 活动详情直接通过 `Activity` 返回实名制字段**

`ActivityDetailVO` 当前直接返回 `Activity`，只要 `Activity` 有字段即可。检查 `ActivityService.getActivityDetail(...)` 不要过滤掉 `realNameRequired`。

- [ ] **Step 7: 票务报价 DTO 增加实名制字段**

在 ticket 侧 `TicketSalesQuoteResponse` 增加：

```java
private Boolean realNameRequired;

public Boolean getRealNameRequired() { return realNameRequired; }
public void setRealNameRequired(Boolean realNameRequired) { this.realNameRequired = realNameRequired; }
```

在 `TicketSalesInternalService.quote(...)` 填充：

```java
response.setRealNameRequired(!Boolean.FALSE.equals(activity.getRealNameRequired()));
```

- [ ] **Step 8: 更新 manifest**

在 `sql/production-split/manifest.json` 的 ticket 迁移列表中加入：

```json
"ticket/20260530_activity_real_name_required.sql"
```

保持 JSON 顺序按日期追加。

- [ ] **Step 9: 运行 ticket 测试**

Run:

```bash
cd java
mvn -pl java-ticket -Dtest=TicketSalesInternalServiceTest test
```

Expected: PASS。

- [ ] **Step 10: 用户授权后提交**

```bash
git add sql/production-split/ticket/20260530_activity_real_name_required.sql sql/production-split/manifest.json java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java java/java-ticket/src/main/java/com/omni/ticket/dto/ActivityVO.java java/java-ticket/src/main/java/com/omni/ticket/service/ActivityService.java java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesQuoteResponse.java java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java java/java-ticket/src/test/java/com/omni/ticket/service/TicketSalesInternalServiceTest.java
git commit -m "feat: add real-name requirement flag to ticketing"
```

---

### Task 2: user 服务实现常用实名观演人

**Files:**
- Create: `sql/production-split/user/20260530_user_attendee.sql`
- Modify: `sql/production-split/manifest.json`
- Create: `java/java-user/src/main/java/com/omni/user/entity/UserAttendee.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/UserAttendeeMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/UserAttendeeRequest.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/UserAttendeeResponse.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/ResolveAttendeesRequest.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/ResolvedAttendeeResponse.java`
- Create: `java/java-user/src/main/java/com/omni/user/service/UserAttendeeService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/UserController.java`
- Test: `java/java-user/src/test/java/com/omni/user/service/UserAttendeeServiceTest.java`
- Test: `java/java-user/src/test/java/com/omni/user/controller/UserAttendeeControllerTest.java`

- [ ] **Step 1: 写服务失败测试**

创建 `UserAttendeeServiceTest`，覆盖：

```java
@Test
void createMasksAndHashesChineseIdCard() {
    UserAttendeeRequest request = new UserAttendeeRequest();
    request.setRealName("张三");
    request.setIdType("ID_CARD");
    request.setIdNo("11010519491231002X");

    UserAttendeeResponse response = service.create(2004L, request);

    assertEquals("张三", response.getRealName());
    assertEquals("ID_CARD", response.getIdType());
    assertEquals("110***********02X", response.getIdNoMask());
    verify(mapper).insert(argThat(attendee ->
            attendee.getIdNoHash() != null && attendee.getIdNoHash().length() == 64));
}

@Test
void resolveRejectsAttendeeOwnedByAnotherUser() {
    ResolveAttendeesRequest request = new ResolveAttendeesRequest();
    request.setUserId(2004L);
    request.setAttendeeIds(List.of(9L));

    when(mapper.selectBatchIds(List.of(9L))).thenReturn(List.of(attendee(9L, 3000L, "李四", "110***********03X")));

    BusinessException ex = assertThrows(BusinessException.class, () -> service.resolve(request));
    assertEquals("观演人不存在或无权限", ex.getMessage());
}
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd java
mvn -pl java-user -Dtest=UserAttendeeServiceTest test
```

Expected: FAIL，类不存在。

- [ ] **Step 3: 新增 user_attendee SQL**

创建 `sql/production-split/user/20260530_user_attendee.sql`：

```sql
-- owner: java-user
CREATE TABLE IF NOT EXISTS user_attendee (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    real_name VARCHAR(80) NOT NULL,
    id_type VARCHAR(32) NOT NULL,
    id_no_hash VARCHAR(64) NOT NULL,
    id_no_mask VARCHAR(40) NOT NULL,
    id_no_encrypted TEXT,
    phone VARCHAR(32),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_attendee_id_type CHECK (id_type IN ('ID_CARD')),
    CONSTRAINT chk_user_attendee_status CHECK (status IN (1, 2))
);

CREATE INDEX IF NOT EXISTS idx_user_attendee_user_id ON user_attendee(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_attendee_active_identity
    ON user_attendee(user_id, id_type, id_no_hash)
    WHERE status = 1;
```

- [ ] **Step 4: 创建实体和 Mapper**

`UserAttendee.java`：

```java
package com.omni.user.entity;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("user_attendee")
@KeySequence(value = "user_attendee_id_seq", dbType = DbType.POSTGRE_SQL)
public class UserAttendee {
    @TableId(type = IdType.INPUT)
    private Long id;
    private Long userId;
    private String realName;
    private String idType;
    private String idNoHash;
    private String idNoMask;
    private String idNoEncrypted;
    private String phone;
    private Boolean isDefault;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getRealName() { return realName; }
    public void setRealName(String realName) { this.realName = realName; }
    public String getIdType() { return idType; }
    public void setIdType(String idType) { this.idType = idType; }
    public String getIdNoHash() { return idNoHash; }
    public void setIdNoHash(String idNoHash) { this.idNoHash = idNoHash; }
    public String getIdNoMask() { return idNoMask; }
    public void setIdNoMask(String idNoMask) { this.idNoMask = idNoMask; }
    public String getIdNoEncrypted() { return idNoEncrypted; }
    public void setIdNoEncrypted(String idNoEncrypted) { this.idNoEncrypted = idNoEncrypted; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public Boolean getIsDefault() { return isDefault; }
    public void setIsDefault(Boolean isDefault) { this.isDefault = isDefault; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
```

`UserAttendeeMapper.java`：

```java
@Mapper
public interface UserAttendeeMapper extends BaseMapper<UserAttendee> {
}
```

- [ ] **Step 5: 创建 DTO**

`UserAttendeeRequest` 字段：

```java
private String realName;
private String idType;
private String idNo;
private String phone;
private Boolean isDefault;
```

`UserAttendeeResponse` 字段：

```java
private Long id;
private String realName;
private String idType;
private String idNoMask;
private String phone;
private Boolean isDefault;
```

`ResolveAttendeesRequest` 字段：

```java
private Long userId;
private List<Long> attendeeIds;
```

`ResolvedAttendeeResponse` 字段：

```java
private Long id;
private String realName;
private String idType;
private String idNoHash;
private String idNoMask;
private String idNoEncrypted;
private String phone;
```

- [ ] **Step 6: 实现身份证工具方法**

在 `UserAttendeeService` 内实现私有方法：

```java
private String normalizeIdNo(String idNo) {
    if (!StringUtils.hasText(idNo)) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "证件号不能为空");
    }
    return idNo.replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
}

private void validateIdCard(String normalized) {
    if (!normalized.matches("^\\d{17}[0-9X]$")) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "身份证号格式不正确");
    }
}

private String hashIdNo(String idType, String normalized) {
    try {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] bytes = digest.digest((idType + ":" + normalized).getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder();
        for (byte b : bytes) hex.append(String.format("%02x", b));
        return hex.toString();
    } catch (NoSuchAlgorithmException e) {
        throw new BusinessException(ResultCode.INTERNAL_ERROR, "证件摘要生成失败");
    }
}

private String maskIdNo(String normalized) {
    return normalized.substring(0, 3) + "***********" + normalized.substring(normalized.length() - 3);
}
```

- [ ] **Step 7: 实现 UserAttendeeService**

核心方法：

```java
public List<UserAttendeeResponse> list(Long userId) {
    return mapper.selectList(new LambdaQueryWrapper<UserAttendee>()
            .eq(UserAttendee::getUserId, userId)
            .eq(UserAttendee::getStatus, 1)
            .orderByDesc(UserAttendee::getIsDefault)
            .orderByDesc(UserAttendee::getUpdateTime))
            .stream().map(this::toResponse).collect(Collectors.toList());
}

public UserAttendeeResponse create(Long userId, UserAttendeeRequest request) {
    String realName = requireText(request.getRealName(), "观演人姓名不能为空");
    String idType = StringUtils.hasText(request.getIdType()) ? request.getIdType() : "ID_CARD";
    if (!"ID_CARD".equals(idType)) throw new BusinessException(ResultCode.BAD_REQUEST, "暂不支持该证件类型");
    String normalized = normalizeIdNo(request.getIdNo());
    validateIdCard(normalized);
    LocalDateTime now = LocalDateTime.now();
    UserAttendee attendee = new UserAttendee();
    attendee.setUserId(userId);
    attendee.setRealName(realName);
    attendee.setIdType(idType);
    attendee.setIdNoHash(hashIdNo(idType, normalized));
    attendee.setIdNoMask(maskIdNo(normalized));
    attendee.setIdNoEncrypted(null);
    attendee.setPhone(trimToNull(request.getPhone()));
    attendee.setIsDefault(Boolean.TRUE.equals(request.getIsDefault()));
    attendee.setStatus(1);
    attendee.setCreateTime(now);
    attendee.setUpdateTime(now);
    mapper.insert(attendee);
    return toResponse(attendee);
}

public List<ResolvedAttendeeResponse> resolve(ResolveAttendeesRequest request) {
    if (request == null || request.getUserId() == null || request.getAttendeeIds() == null || request.getAttendeeIds().isEmpty()) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "观演人不能为空");
    }
    List<UserAttendee> attendees = mapper.selectBatchIds(request.getAttendeeIds());
    Map<Long, UserAttendee> byId = attendees.stream().collect(Collectors.toMap(UserAttendee::getId, a -> a));
    List<ResolvedAttendeeResponse> result = new ArrayList<>();
    for (Long id : request.getAttendeeIds()) {
        UserAttendee attendee = byId.get(id);
        if (attendee == null || !request.getUserId().equals(attendee.getUserId()) || !Integer.valueOf(1).equals(attendee.getStatus())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "观演人不存在或无权限");
        }
        result.add(toResolved(attendee));
    }
    return result;
}
```

- [ ] **Step 8: 接入 UserController**

构造器增加 `UserAttendeeService userAttendeeService`。新增接口：

```java
@GetMapping("/attendees")
public Result<List<UserAttendeeResponse>> listAttendees(@RequestHeader(value = "Authorization", required = false) String authorization) {
    return Result.success(userAttendeeService.list(requireAuthUserId(authorization)));
}

@PostMapping("/attendees")
public Result<UserAttendeeResponse> createAttendee(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                   @RequestBody UserAttendeeRequest request) {
    return Result.success(userAttendeeService.create(requireAuthUserId(authorization), request));
}

@PutMapping("/attendees/{id}")
public Result<UserAttendeeResponse> updateAttendee(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                   @PathVariable Long id,
                                                   @RequestBody UserAttendeeRequest request) {
    return Result.success(userAttendeeService.update(requireAuthUserId(authorization), id, request));
}

@DeleteMapping("/attendees/{id}")
public Result<Void> deleteAttendee(@RequestHeader(value = "Authorization", required = false) String authorization,
                                   @PathVariable Long id) {
    userAttendeeService.delete(requireAuthUserId(authorization), id);
    return Result.success();
}

@PostMapping("/internal/attendees/resolve")
public Result<List<ResolvedAttendeeResponse>> resolveInternalAttendees(
        @RequestBody ResolveAttendeesRequest request,
        @RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!isValidInternalToken(token)) return Result.fail(403, "无权限");
    return Result.success(userAttendeeService.resolve(request));
}
```

- [ ] **Step 9: 更新 manifest**

在 `sql/production-split/manifest.json` 的 user 迁移列表加入：

```json
"user/20260530_user_attendee.sql"
```

- [ ] **Step 10: 运行 user 测试**

Run:

```bash
cd java
mvn -pl java-user -Dtest=UserAttendeeServiceTest,UserAttendeeControllerTest test
```

Expected: PASS。

- [ ] **Step 11: 用户授权后提交**

```bash
git add sql/production-split/user/20260530_user_attendee.sql sql/production-split/manifest.json java/java-user/src/main/java/com/omni/user/entity/UserAttendee.java java/java-user/src/main/java/com/omni/user/mapper/UserAttendeeMapper.java java/java-user/src/main/java/com/omni/user/dto/UserAttendeeRequest.java java/java-user/src/main/java/com/omni/user/dto/UserAttendeeResponse.java java/java-user/src/main/java/com/omni/user/dto/ResolveAttendeesRequest.java java/java-user/src/main/java/com/omni/user/dto/ResolvedAttendeeResponse.java java/java-user/src/main/java/com/omni/user/service/UserAttendeeService.java java/java-user/src/main/java/com/omni/user/controller/UserController.java java/java-user/src/test/java/com/omni/user/service/UserAttendeeServiceTest.java java/java-user/src/test/java/com/omni/user/controller/UserAttendeeControllerTest.java
git commit -m "feat: add user attendee profiles"
```

---

### Task 3: order 服务保存实名快照并强制下单校验

**Files:**
- Create: `sql/production-split/order/20260530_order_attendee.sql`
- Modify: `sql/production-split/manifest.json`
- Create: `java/java-order/src/main/java/com/omni/order/entity/OrderAttendee.java`
- Create: `java/java-order/src/main/java/com/omni/order/mapper/OrderAttendeeMapper.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/OrderAttendeeResponse.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/ResolveAttendeesRequest.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/ResolvedAttendeeResponse.java`
- Modify: `java/java-order/src/main/java/com/omni/order/dto/CreateOrderRequest.java`
- Modify: `java/java-order/src/main/java/com/omni/order/dto/LockSeatsRequest.java`
- Modify: `java/java-order/src/main/java/com/omni/order/dto/TicketSalesQuoteResponse.java`
- Modify: `java/java-order/src/main/java/com/omni/order/dto/OrderListItemResponse.java`
- Modify: `java/java-order/src/main/java/com/omni/order/client/UserInternalClient.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderServiceTest.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java`

- [ ] **Step 1: 写失败测试：实名制订单缺少观演人被拒绝**

在 `OrderServiceTest` 增加：

```java
@Test
void createOrderRejectsMissingAttendeesWhenRealNameRequired() {
    CreateOrderRequest request = new CreateOrderRequest();
    request.setUserId(2004L);
    request.setSessionId(7L);
    request.setTicketTypeId(21L);
    request.setQuantity(1);

    TicketSalesQuoteResponse quote = quote(1);
    quote.setRealNameRequired(true);
    when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));

    BusinessException ex = assertThrows(BusinessException.class, () -> service.createOrder(request));
    assertEquals("请选择实名观演人", ex.getMessage());
}
```

- [ ] **Step 2: 写失败测试：同场次身份证重复被拒绝**

在 `OrderServiceTest` 增加：

```java
@Test
void createOrderRejectsDuplicateIdentityInSameSession() {
    CreateOrderRequest request = realNameCreateOrderRequest(List.of(1L));
    ResolvedAttendeeResponse attendee = resolvedAttendee(1L, "张三", "ID_CARD", "hash-a", "110***********02X");
    when(userInternalClient.resolveAttendees(any(), anyString())).thenReturn(Result.success(List.of(attendee)));
    when(orderAttendeeMapper.countEffectiveBySessionAndIdentity(7L, "ID_CARD", "hash-a")).thenReturn(1);

    TicketSalesQuoteResponse quote = quote(1);
    quote.setRealNameRequired(true);
    when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));

    BusinessException ex = assertThrows(BusinessException.class, () -> service.createOrder(request));
    assertEquals("该观演人已购买当前场次", ex.getMessage());
}
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
cd java
mvn -pl java-order -Dtest=OrderServiceTest test
```

Expected: FAIL，字段、Mapper 或方法不存在。

- [ ] **Step 4: 新增 order_attendee SQL**

创建 `sql/production-split/order/20260530_order_attendee.sql`：

```sql
-- owner: java-order
CREATE TABLE IF NOT EXISTS order_attendee (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
    order_seat_id BIGINT REFERENCES order_seat(id) ON DELETE SET NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    attendee_user_profile_id BIGINT,
    real_name VARCHAR(80) NOT NULL,
    id_type VARCHAR(32) NOT NULL,
    id_no_hash VARCHAR(64) NOT NULL,
    id_no_mask VARCHAR(40) NOT NULL,
    id_no_encrypted TEXT,
    phone VARCHAR(32),
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_order_attendee_id_type CHECK (id_type IN ('ID_CARD')),
    CONSTRAINT chk_order_attendee_status CHECK (status IN (1, 3, 4))
);

CREATE INDEX IF NOT EXISTS idx_order_attendee_order_id ON order_attendee(order_id);
CREATE INDEX IF NOT EXISTS idx_order_attendee_order_seat_id ON order_attendee(order_seat_id);
CREATE INDEX IF NOT EXISTS idx_order_attendee_session_identity ON order_attendee(session_id, id_type, id_no_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_attendee_active_session_identity
    ON order_attendee(session_id, id_type, id_no_hash)
    WHERE status = 1;
```

Status 约定：`1=正常/占用`、`3=已退款`、`4=已释放`。

- [ ] **Step 5: 创建实体和 Mapper**

`OrderAttendee.java` 字段对应 SQL。Mapper 增加查询：

```java
@Mapper
public interface OrderAttendeeMapper extends BaseMapper<OrderAttendee> {
    @Select("SELECT COUNT(*) FROM order_attendee oa " +
            "JOIN \"order\" o ON o.id = oa.order_id " +
            "WHERE oa.session_id = #{sessionId} AND oa.id_type = #{idType} AND oa.id_no_hash = #{idNoHash} " +
            "AND oa.status = 1 AND o.status IN (1, 2)")
    int countEffectiveBySessionAndIdentity(@Param("sessionId") Long sessionId,
                                           @Param("idType") String idType,
                                           @Param("idNoHash") String idNoHash);

    @Select("SELECT * FROM order_attendee WHERE order_id = #{orderId} ORDER BY id")
    List<OrderAttendee> selectByOrderId(@Param("orderId") Long orderId);

    @Update("UPDATE order_attendee SET status = 4, update_time = CURRENT_TIMESTAMP WHERE order_id = #{orderId} AND status = 1")
    int releaseByOrderId(@Param("orderId") Long orderId);
}
```

- [ ] **Step 6: 扩展 DTO 和 Feign client**

`CreateOrderRequest` 和 `LockSeatsRequest` 增加：

```java
private List<Long> attendeeIds;

public List<Long> getAttendeeIds() { return attendeeIds; }
public void setAttendeeIds(List<Long> attendeeIds) { this.attendeeIds = attendeeIds; }
```

order 侧 `TicketSalesQuoteResponse` 增加：

```java
private Boolean realNameRequired;

public Boolean getRealNameRequired() { return realNameRequired; }
public void setRealNameRequired(Boolean realNameRequired) { this.realNameRequired = realNameRequired; }
```

`UserInternalClient` 增加：

```java
@PostMapping("/api/user/internal/attendees/resolve")
Result<List<ResolvedAttendeeResponse>> resolveAttendees(@RequestBody ResolveAttendeesRequest request,
                                                        @RequestHeader("X-Internal-Token") String internalToken);
```

- [ ] **Step 7: 修改 OrderService 构造器注入 OrderAttendeeMapper**

在字段中增加：

```java
private final OrderAttendeeMapper orderAttendeeMapper;
```

在主构造器参数中增加 `OrderAttendeeMapper orderAttendeeMapper`，并在测试构造器中提供兼容重载，避免旧测试大面积改动。

- [ ] **Step 8: 实现实名解析和校验辅助方法**

在 `OrderService` 增加：

```java
private List<ResolvedAttendeeResponse> resolveAttendeesIfRequired(Long userId, List<Long> attendeeIds, int quantity, TicketSalesQuoteResponse quote) {
    if (!Boolean.TRUE.equals(quote.getRealNameRequired())) {
        return Collections.emptyList();
    }
    if (attendeeIds == null || attendeeIds.isEmpty()) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "请选择实名观演人");
    }
    if (attendeeIds.size() != quantity) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "实名观演人数必须等于购票数量");
    }
    if (new HashSet<>(attendeeIds).size() != attendeeIds.size()) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "实名观演人不能重复");
    }
    String token = requireInternalApiToken("用户实名接口令牌未配置");
    ResolveAttendeesRequest request = new ResolveAttendeesRequest();
    request.setUserId(userId);
    request.setAttendeeIds(attendeeIds);
    Result<List<ResolvedAttendeeResponse>> result = callUserValidate(() -> userInternalClient.resolveAttendees(request, token));
    if (result == null || result.getCode() != ResultCode.SUCCESS.getCode() || result.getData() == null) {
        throw new BusinessException(ResultCode.BAD_REQUEST, result != null ? result.getMessage() : "用户服务无响应");
    }
    List<ResolvedAttendeeResponse> attendees = result.getData();
    if (attendees.size() != quantity) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "实名观演人数必须等于购票数量");
    }
    Set<String> identities = new HashSet<>();
    for (ResolvedAttendeeResponse attendee : attendees) {
        String key = attendee.getIdType() + ":" + attendee.getIdNoHash();
        if (!identities.add(key)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "实名观演人不能重复");
        }
    }
    return attendees;
}

private void assertNoEffectiveAttendeeConflict(Long sessionId, List<ResolvedAttendeeResponse> attendees) {
    if (orderAttendeeMapper == null || attendees == null || attendees.isEmpty()) return;
    for (ResolvedAttendeeResponse attendee : attendees) {
        if (orderAttendeeMapper.countEffectiveBySessionAndIdentity(sessionId, attendee.getIdType(), attendee.getIdNoHash()) > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "该观演人已购买当前场次");
        }
    }
}
```

- [ ] **Step 9: 普通下单写 order_attendee**

在 `createOrder` 中 quote 后、锁库存前加入：

```java
List<ResolvedAttendeeResponse> attendees = resolveAttendeesIfRequired(request.getUserId(), request.getAttendeeIds(), quantity, quote);
assertNoEffectiveAttendeeConflict(request.getSessionId(), attendees);
```

order 插入和 snapshot 后写：

```java
writeOrderAttendees(order, attendees, Collections.emptyList());
```

实现：

```java
private void writeOrderAttendees(Order order, List<ResolvedAttendeeResponse> attendees, List<OrderSeat> orderSeats) {
    if (orderAttendeeMapper == null || attendees == null || attendees.isEmpty()) return;
    LocalDateTime now = LocalDateTime.now();
    for (int i = 0; i < attendees.size(); i++) {
        ResolvedAttendeeResponse source = attendees.get(i);
        OrderSeat seat = i < orderSeats.size() ? orderSeats.get(i) : null;
        OrderAttendee attendee = new OrderAttendee();
        attendee.setOrderId(order.getId());
        attendee.setOrderSeatId(seat != null ? seat.getId() : null);
        attendee.setSessionId(order.getSessionId());
        attendee.setTicketTypeId(order.getTicketTypeId());
        attendee.setAttendeeUserProfileId(source.getId());
        attendee.setRealName(source.getRealName());
        attendee.setIdType(source.getIdType());
        attendee.setIdNoHash(source.getIdNoHash());
        attendee.setIdNoMask(source.getIdNoMask());
        attendee.setIdNoEncrypted(source.getIdNoEncrypted());
        attendee.setPhone(source.getPhone());
        attendee.setStatus(1);
        attendee.setCreateTime(now);
        attendee.setUpdateTime(now);
        orderAttendeeMapper.insert(attendee);
    }
}
```

- [ ] **Step 10: 带座下单绑定 order_seat 顺序**

在 `createOrderWithSeats` 中 quote 后加入实名校验。创建 `OrderSeat` 时收集到列表：

```java
List<OrderSeat> createdOrderSeats = new ArrayList<>();
if (lockedSeatIds != null && !lockedSeatIds.isEmpty() && orderSeatMapper != null) {
    LocalDateTime now = LocalDateTime.now();
    LocalDateTime expireTime = now.plusMinutes(15);
    for (Long seatId : lockedSeatIds) {
        OrderSeat orderSeat = new OrderSeat();
        orderSeat.setOrderId(order.getId());
        orderSeat.setSessionSeatId(seatId);
        orderSeat.setSessionId(request.getSessionId());
        orderSeat.setTicketTypeId(request.getTicketTypeId());
        orderSeat.setStatus(1);
        orderSeat.setLockExpireTime(expireTime);
        orderSeat.setCreateTime(now);
        orderSeat.setUpdateTime(now);
        orderSeatMapper.insert(orderSeat);
        createdOrderSeats.add(orderSeat);
    }
}
writeOrderAttendees(order, attendees, createdOrderSeats);
```

随机分配座位时 `lockedSeatIds` 的顺序就是绑定顺序。

- [ ] **Step 11: 取消订单释放实名占用**

在 `cancelOrder` 中 `releaseLockedResourcesStrict(order)` 后加入：

```java
if (orderAttendeeMapper != null) {
    orderAttendeeMapper.releaseByOrderId(order.getId());
}
```

过期待支付订单释放也调用同一释放方法。

- [ ] **Step 12: 退款释放实名占用**

全额退款 `markRefunded` 成功路径中加入：

```java
if (orderAttendeeMapper != null) {
    orderAttendeeMapper.updateRefundedByOrderId(order.getId());
}
```

部分退款如有 `selectedSeats`，按 `order_seat_id` 更新：

```java
orderAttendeeMapper.updateRefundedByOrderSeatIds(selectedIds);
```

如果是数量退款没有 seat，则按订单选取前 N 条 status=1 的 `order_attendee` 标记退款。

- [ ] **Step 13: 订单响应带 attendees**

`OrderAttendeeResponse` 字段：

```java
private Long id;
private Long orderSeatId;
private String realName;
private String idType;
private String idNoMask;
private String phone;
private Integer status;
```

`OrderListItemResponse` 增加：

```java
private List<OrderAttendeeResponse> attendees;
```

在 `getOrderItemDetail`、`findOrderByGrabRequestId`、`listOrderItems`、`listOrdersBySessions` 返回前填充 attendees。不要在 `OrderMapper` SQL 里聚合 JSON，保持简单：查订单列表后批量按 orderIds 查询 `order_attendee`。

- [ ] **Step 14: 更新 manifest**

在 `sql/production-split/manifest.json` 的 order 迁移列表加入：

```json
"order/20260530_order_attendee.sql"
```

- [ ] **Step 15: 运行 order 测试**

Run:

```bash
cd java
mvn -pl java-order -Dtest=OrderServiceTest,OrderSeatServiceTest,OrderControllerPublicAuthTest test
```

Expected: PASS。

- [ ] **Step 16: 用户授权后提交**

```bash
git add sql/production-split/order/20260530_order_attendee.sql sql/production-split/manifest.json java/java-order/src/main/java/com/omni/order/entity/OrderAttendee.java java/java-order/src/main/java/com/omni/order/mapper/OrderAttendeeMapper.java java/java-order/src/main/java/com/omni/order/dto/OrderAttendeeResponse.java java/java-order/src/main/java/com/omni/order/dto/ResolveAttendeesRequest.java java/java-order/src/main/java/com/omni/order/dto/ResolvedAttendeeResponse.java java/java-order/src/main/java/com/omni/order/dto/CreateOrderRequest.java java/java-order/src/main/java/com/omni/order/dto/LockSeatsRequest.java java/java-order/src/main/java/com/omni/order/dto/TicketSalesQuoteResponse.java java/java-order/src/main/java/com/omni/order/dto/OrderListItemResponse.java java/java-order/src/main/java/com/omni/order/client/UserInternalClient.java java/java-order/src/main/java/com/omni/order/service/OrderService.java java/java-order/src/test/java/com/omni/order/service/OrderServiceTest.java java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java java/java-order/src/test/java/com/omni/order/controller/OrderControllerPublicAuthTest.java
git commit -m "feat: enforce real-name attendees on orders"
```

---

### Task 4: ticket 后台订单透传实名信息并保持权限边界

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/OrderInfoResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/OrderAdminQueryService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`

- [ ] **Step 1: 写失败测试：主办方只查自己活动订单且响应含 attendees**

在 `AdminControllerTest` 或 `OrderAdminQueryServiceTest` 增加断言：

```java
OrderInfoResponse order = result.get(0);
assertEquals("张三", order.getAttendees().get(0).getRealName());
assertEquals("110***********02X", order.getAttendees().get(0).getIdNoMask());
verify(orderInternalClient).listPaidBySessions(argThat(req -> req.getSessionIds().equals(List.of(ownedSessionId))), anyString());
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd java
mvn -pl java-ticket -Dtest=AdminControllerTest test
```

Expected: FAIL，`attendees` 字段不存在或未透传。

- [ ] **Step 3: 扩展 ticket 侧 OrderInfoResponse**

增加内部静态 DTO：

```java
private List<OrderAttendeeInfo> attendees;

public List<OrderAttendeeInfo> getAttendees() { return attendees; }
public void setAttendees(List<OrderAttendeeInfo> attendees) { this.attendees = attendees; }

public static class OrderAttendeeInfo {
    private Long id;
    private Long orderSeatId;
    private String realName;
    private String idType;
    private String idNoMask;
    private String phone;
    private Integer status;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrderSeatId() { return orderSeatId; }
    public void setOrderSeatId(Long orderSeatId) { this.orderSeatId = orderSeatId; }
    public String getRealName() { return realName; }
    public void setRealName(String realName) { this.realName = realName; }
    public String getIdType() { return idType; }
    public void setIdType(String idType) { this.idType = idType; }
    public String getIdNoMask() { return idNoMask; }
    public void setIdNoMask(String idNoMask) { this.idNoMask = idNoMask; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
}
```

- [ ] **Step 4: 确认 AdminController 不使用前端传入 userId**

`AdminController.listAdminOrders(...)` 当前解析 `Authorization` 得到 `operatorId`，忽略 `@RequestParam userId`。保持这个行为，不要重新信任 query 里的 `userId`。

- [ ] **Step 5: 运行后台订单测试**

Run:

```bash
cd java
mvn -pl java-ticket -Dtest=AdminControllerTest test
```

Expected: PASS。

- [ ] **Step 6: 用户授权后提交**

```bash
git add java/java-ticket/src/main/java/com/omni/ticket/dto/OrderInfoResponse.java java/java-ticket/src/main/java/com/omni/ticket/service/OrderAdminQueryService.java java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java
git commit -m "feat: expose real-name attendees in console orders"
```

---

### Task 5: grab-service 透传 attendeeIds

**Files:**
- Create: `sql/production-split/grab/20260530_grab_attendee_ids.sql`
- Modify: `sql/production-split/manifest.json`
- Modify: `nestjs/grab-service/src/grab/grab.types.ts`
- Modify: `nestjs/grab-service/src/grab/grab.repository.ts`
- Modify: `nestjs/grab-service/src/grab/grab.service.ts`
- Modify: `nestjs/grab-service/src/grab/grab-worker.service.ts`
- Modify: `nestjs/grab-service/src/grab/order-client.service.ts`
- Test: `nestjs/grab-service/src/grab/grab.service.spec.ts`
- Test: `nestjs/grab-service/src/grab/order-client.service.spec.ts`

- [ ] **Step 1: 写失败测试：抢票观演人数必须等于票数**

在 `grab.service.spec.ts` 增加：

```ts
await expect(service.submitRequest(2004, {
  sessionId: 7,
  ticketTypeId: 21,
  quantity: 2,
  attendeeIds: [1],
  idempotencyKey: 'k1',
})).rejects.toThrow('invalid attendee quantity')
```

- [ ] **Step 2: 写失败测试：order client 透传 attendeeIds**

在 `order-client.service.spec.ts` 增加断言 fetch body：

```ts
await service.createOrder({
  userId: 2004,
  sessionId: 7,
  ticketTypeId: 21,
  quantity: 2,
  seatIds: [],
  allocateRandom: false,
  attendeeIds: [11, 12],
})
expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).attendeeIds).toEqual([11, 12])
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
cd nestjs/grab-service
npm test -- grab.service.spec.ts order-client.service.spec.ts
```

Expected: FAIL，字段不存在或未校验。

- [ ] **Step 4: 新增 grab SQL**

创建 `sql/production-split/grab/20260530_grab_attendee_ids.sql`：

```sql
-- owner: grab-service
ALTER TABLE grab_request
    ADD COLUMN IF NOT EXISTS attendee_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
```

- [ ] **Step 5: 扩展 TypeScript 类型**

`SubmitGrabRequestDto`、`GrabRequestRecord`、`CreateQueuedGrabRequestInput`、`CreatePendingGrabRequestInput`、`FindActiveGrabIntentInput` 增加：

```ts
attendeeIds: number[]
```

请求 DTO 中字段可选：

```ts
attendeeIds?: number[]
```

- [ ] **Step 6: repository 读写 attendee_ids**

`GrabRequestRow` 增加：

```ts
attendee_ids: number[] | string
```

insert SQL 增加 `attendee_ids` 列和值：

```ts
JSON.stringify(input.attendeeIds)
```

`mapRow` 增加：

```ts
attendeeIds: this.parseJsonArray(row.attendee_ids).map(Number),
```

- [ ] **Step 7: submitRequest 校验并纳入 active intent**

在 `validateSubmitRequest` 加：

```ts
if (!Array.isArray(dto.attendeeIds) || dto.attendeeIds.length !== dto.quantity) {
  throw new BadRequestException('invalid attendee quantity')
}
if (new Set(dto.attendeeIds).size !== dto.attendeeIds.length) {
  throw new BadRequestException('duplicate attendees')
}
```

在 `submitRequest` 里规范化：

```ts
const attendeeIds = [...(dto.attendeeIds ?? [])]
```

传入 repository 和 `findActiveByIntent`。

- [ ] **Step 8: worker 和 order client 透传**

`grab-worker.service.ts` 的 `orderInput` 增加：

```ts
attendeeIds: record.attendeeIds,
```

`CreateOrderInput` 增加：

```ts
attendeeIds: number[];
```

请求 body 增加：

```ts
attendeeIds: input.attendeeIds,
```

- [ ] **Step 9: 更新 manifest**

在 `sql/production-split/manifest.json` 的 grab 迁移列表加入：

```json
"grab/20260530_grab_attendee_ids.sql"
```

- [ ] **Step 10: 运行 grab-service 测试**

Run:

```bash
cd nestjs/grab-service
npm test -- grab.service.spec.ts order-client.service.spec.ts grab-worker.service.spec.ts
```

Expected: PASS。

- [ ] **Step 11: 用户授权后提交**

```bash
git add sql/production-split/grab/20260530_grab_attendee_ids.sql sql/production-split/manifest.json nestjs/grab-service/src/grab/grab.types.ts nestjs/grab-service/src/grab/grab.repository.ts nestjs/grab-service/src/grab/grab.service.ts nestjs/grab-service/src/grab/grab-worker.service.ts nestjs/grab-service/src/grab/order-client.service.ts nestjs/grab-service/src/grab/grab.service.spec.ts nestjs/grab-service/src/grab/order-client.service.spec.ts nestjs/grab-service/src/grab/grab-worker.service.spec.ts
git commit -m "feat: pass attendees through grab requests"
```

---

### Task 6: frontend API 和观演人纯逻辑

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/attendees.ts`
- Create: `frontend/src/lib/attendees.test.ts`
- Test: `frontend/src/lib/attendees.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `frontend/src/lib/attendees.test.ts`：

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { maskIdCard, validateSelectedAttendees } from './attendees.ts'

test('maskIdCard masks Chinese id card', () => {
  assert.equal(maskIdCard('11010519491231002X'), '110***********02X')
})

test('validateSelectedAttendees requires count equals quantity', () => {
  assert.equal(validateSelectedAttendees([{ id: 1 }], 2), '请选择 2 位实名观演人')
  assert.equal(validateSelectedAttendees([{ id: 1 }, { id: 2 }], 2), null)
})

test('validateSelectedAttendees rejects duplicate attendee ids', () => {
  assert.equal(validateSelectedAttendees([{ id: 1 }, { id: 1 }], 2), '实名观演人不能重复')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd frontend
node --test src/lib/attendees.test.ts
```

Expected: FAIL，模块不存在。

- [ ] **Step 3: 扩展前端类型**

在 `api.ts` 类型文件增加：

```ts
export interface UserAttendeeVO {
  id: number
  realName: string
  idType: 'ID_CARD'
  idNoMask: string
  phone?: string | null
  isDefault?: boolean | null
}

export interface UserAttendeePayload {
  realName: string
  idType: 'ID_CARD'
  idNo: string
  phone?: string | null
  isDefault?: boolean
}

export interface OrderAttendeeVO {
  id: number
  orderSeatId?: number | null
  realName: string
  idType: 'ID_CARD'
  idNoMask: string
  phone?: string | null
  status: number
}
```

`SubmitGrabRequestPayload`、`createOrder`、`createOrderWithSeats` 参数增加：

```ts
attendeeIds?: number[]
```

`ActivityEntity` 增加：

```ts
realNameRequired?: boolean | null
```

`OrderEntity` 增加：

```ts
attendees?: OrderAttendeeVO[] | null
```

- [ ] **Step 4: 实现 attendees 纯逻辑**

创建 `frontend/src/lib/attendees.ts`：

```ts
export interface SelectedAttendeeLike { id: number }

export function maskIdCard(idNo: string) {
  const normalized = idNo.replace(/\s+/g, '').toUpperCase()
  if (normalized.length < 6) return normalized
  return `${normalized.slice(0, 3)}***********${normalized.slice(-3)}`
}

export function validateSelectedAttendees(attendees: SelectedAttendeeLike[], quantity: number) {
  if (attendees.length !== quantity) return `请选择 ${quantity} 位实名观演人`
  if (new Set(attendees.map(item => item.id)).size !== attendees.length) return '实名观演人不能重复'
  return null
}

export function isRealNameRequired(value: boolean | null | undefined) {
  return value !== false
}
```

- [ ] **Step 5: 扩展 API 函数**

在 `frontend/src/lib/api.ts` 增加：

```ts
export async function listMyAttendees() {
  return request<import('@/types/api').UserAttendeeVO[]>('/api/user/attendees')
}

export async function createAttendee(params: import('@/types/api').UserAttendeePayload) {
  return request<import('@/types/api').UserAttendeeVO>('/api/user/attendees', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function updateAttendee(id: number, params: import('@/types/api').UserAttendeePayload) {
  return request<import('@/types/api').UserAttendeeVO>(`/api/user/attendees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  })
}

export async function deleteAttendee(id: number) {
  return request<void>(`/api/user/attendees/${id}`, { method: 'DELETE' })
}
```

更新 `submitGrabRequest` 调用类型即可；body 会自动带 `attendeeIds`。

- [ ] **Step 6: 运行前端纯逻辑测试**

Run:

```bash
cd frontend
node --test src/lib/attendees.test.ts
```

Expected: PASS。

- [ ] **Step 7: 用户授权后提交**

```bash
git add frontend/src/types/api.ts frontend/src/lib/api.ts frontend/src/lib/attendees.ts frontend/src/lib/attendees.test.ts
git commit -m "feat: add attendee API types and validation"
```

---

### Task 7: frontend 活动详情实名预选和抢票传参

**Files:**
- Create: `frontend/src/components/RealNameNoticeModal.tsx`
- Create: `frontend/src/components/AttendeePickerModal.tsx`
- Modify: `frontend/src/app/activity/[id]/page.tsx`
- Test: `frontend/src/lib/attendees.test.ts`

- [ ] **Step 1: 创建实名提示弹窗组件**

`RealNameNoticeModal.tsx`：

```tsx
interface RealNameNoticeModalProps {
  open: boolean
  onClose: () => void
  onPick: () => void
}

export function RealNameNoticeModal({ open, onClose, onPick }: RealNameNoticeModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-6">
      <div className="w-full max-w-[360px] rounded-[28px] bg-white px-8 py-7 text-center shadow-xl">
        <h2 className="text-[22px] font-semibold text-[#111]">实名制观演</h2>
        <div className="mt-5 space-y-2 text-left text-[16px] leading-7 text-[#666]">
          <p>1. 本项目需要<span className="text-[#ff6a00]">实名制购票及入场</span></p>
          <p>2. 观演请本人携带购票时填写证件验证入场</p>
          <p>3. 购票完成后观演人信息不可更改</p>
        </div>
        <button type="button" onClick={onPick} className="mt-6 h-12 w-full rounded-2xl bg-gradient-to-r from-[#ff9f1a] to-[#ff4d00] text-[17px] font-semibold text-white">
          预选实名观演人
        </button>
        <button type="button" onClick={onClose} className="mt-4 text-[16px] text-[#777]">知道了</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建观演人选择弹层**

`AttendeePickerModal.tsx`：

```tsx
import { useState } from 'react'
import type { UserAttendeeVO } from '@/types/api'

interface AttendeePickerModalProps {
  open: boolean
  attendees: UserAttendeeVO[]
  selectedIds: number[]
  maxCount: number
  onChange: (ids: number[]) => void
  onCreate: (payload: { realName: string; idNo: string; phone?: string }) => Promise<void>
  onClose: () => void
}

export function AttendeePickerModal({ open, attendees, selectedIds, maxCount, onChange, onCreate, onClose }: AttendeePickerModalProps) {
  const [creating, setCreating] = useState(false)
  const [realName, setRealName] = useState('')
  const [idNo, setIdNo] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  if (!open) return null
  const toggle = (id: number) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter(item => item !== id))
    else if (selectedIds.length < maxCount) onChange([...selectedIds, id])
  }
  const submitCreate = async () => {
    if (!realName.trim() || !idNo.trim()) {
      setError('请填写姓名和证件号')
      return
    }
    setCreating(true)
    setError('')
    try {
      await onCreate({ realName: realName.trim(), idNo: idNo.trim(), phone: phone.trim() || undefined })
      setRealName('')
      setIdNo('')
      setPhone('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '新增观演人失败')
    } finally {
      setCreating(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45">
      <div className="max-h-[82vh] w-full rounded-t-[28px] bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[22px] font-semibold text-[#111]">选择实名观演人</h2>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-full bg-[#eee] text-[#777]">×</button>
        </div>
        <div className="mt-4 space-y-2 text-[14px] text-[#777]">
          <p><span className="font-semibold text-[#ff6a00]">支持排序</span> 票数变动或库存不足时，将按排序顺序选择观演人</p>
          <p><span className="font-semibold text-[#ff6a00]">特权购票</span> 如存在特权购票，请确保勾选特权观演人</p>
        </div>
        <div className="mt-5 space-y-3">
          {attendees.map(attendee => (
            <button key={attendee.id} type="button" onClick={() => toggle(attendee.id)} className="flex w-full items-center justify-between rounded-xl border border-[#eee] p-3 text-left">
              <span>
                <span className="block text-[17px] font-semibold text-[#111]">{attendee.realName}</span>
                <span className="mt-1 block text-[14px] text-[#777]">身份证 {attendee.idNoMask}</span>
              </span>
              <span className={`h-6 w-6 rounded-full border ${selectedIds.includes(attendee.id) ? 'border-[#111] bg-[#111]' : 'border-[#999]'}`} />
            </button>
          ))}
        </div>
        <div className="mt-5 rounded-xl bg-[#fafafa] p-3">
          <div className="text-[15px] font-semibold text-[#111]">新增观演人</div>
          <div className="mt-3 grid gap-2">
            <input value={realName} onChange={e => setRealName(e.target.value)} placeholder="姓名" className="h-11 rounded-lg border border-[#ddd] px-3 text-[15px] outline-none" />
            <input value={idNo} onChange={e => setIdNo(e.target.value)} placeholder="身份证号" className="h-11 rounded-lg border border-[#ddd] px-3 text-[15px] outline-none" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="手机号（选填）" className="h-11 rounded-lg border border-[#ddd] px-3 text-[15px] outline-none" />
          </div>
          {error && <div className="mt-2 text-[13px] text-[#e74c3c]">{error}</div>}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => void submitCreate()} disabled={creating} className="h-12 rounded-xl border border-[#111] text-[17px] font-semibold disabled:opacity-50">{creating ? '保存中...' : '新增观演人'}</button>
          <button type="button" onClick={onClose} className="h-12 rounded-xl bg-[#111] text-[17px] font-semibold text-white">确定</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 活动页加载观演人**

在 `activity/[id]/page.tsx` 引入：

```ts
import { createAttendee, listMyAttendees } from '@/lib/api'
import { isRealNameRequired, validateSelectedAttendees } from '@/lib/attendees'
import { RealNameNoticeModal } from '@/components/RealNameNoticeModal'
import { AttendeePickerModal } from '@/components/AttendeePickerModal'
import type { UserAttendeeVO } from '@/types/api'
```

新增 state：

```ts
const [attendees, setAttendees] = useState<UserAttendeeVO[]>([])
const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<number[]>([])
const [showRealNameNotice, setShowRealNameNotice] = useState(false)
const [showAttendeePicker, setShowAttendeePicker] = useState(false)
```

详情加载后：

```ts
const required = isRealNameRequired(data.activity.realNameRequired)
setShowRealNameNotice(required)
if (required && isAuthenticated()) {
  setAttendees(await listMyAttendees())
}
```

- [ ] **Step 4: 下单前校验并传 attendeeIds**

在 `handleConfirmOrder` 中，构建 grab 请求前加入：

```ts
if (isRealNameRequired(detail?.activity.realNameRequired)) {
  const selected = selectedAttendeeIds.map(attendeeId => attendees.find(item => item.id === attendeeId)).filter(Boolean) as UserAttendeeVO[]
  const attendeeError = validateSelectedAttendees(selected, quantity)
  if (attendeeError) {
    setOrderError(attendeeError)
    setShowAttendeePicker(true)
    return
  }
}
```

`submitGrabRequest` body 增加：

```ts
attendeeIds: isRealNameRequired(detail?.activity.realNameRequired) ? selectedAttendeeIds.slice(0, quantity) : [],
```

`buildGrabIntent` 也把 attendeeIds 纳入幂等 intent，避免换观演人复用旧幂等键：

```ts
attendeeIds: selectedAttendeeIds.slice(0, quantity),
```

如果 `buildGrabIdempotencyIntent` 类型不支持，更新 `frontend/src/lib/purchase-intent.ts` 和测试。

- [ ] **Step 5: 活动页展示预选模块和弹窗**

在购票区域附近增加：

```tsx
{isRealNameRequired(detail?.activity.realNameRequired) && (
  <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-[17px] font-semibold text-[#111]">预选本次实名观演人</div>
        <div className="mt-1 text-[13px] text-[#777]">最多可设置 6 位实名观演人，购票时将自动选择对应票张数和观演人</div>
      </div>
      <button type="button" onClick={() => setShowAttendeePicker(true)} className="rounded-lg border border-[#ff1268] px-3 py-1.5 text-[14px] text-[#ff1268]">
        {selectedAttendeeIds.length ? '去设置' : '去预选'}
      </button>
    </div>
  </section>
)}
```

在 modals 区域渲染：

```tsx
const handleCreateAttendee = async (payload: { realName: string; idNo: string; phone?: string }) => {
  const created = await createAttendee({
    realName: payload.realName,
    idType: 'ID_CARD',
    idNo: payload.idNo,
    phone: payload.phone ?? null,
  })
  const next = await listMyAttendees()
  setAttendees(next)
  setSelectedAttendeeIds(prev => prev.includes(created.id) ? prev : [...prev, created.id].slice(0, 6))
}

<RealNameNoticeModal
  open={showRealNameNotice}
  onClose={() => setShowRealNameNotice(false)}
  onPick={() => { setShowRealNameNotice(false); setShowAttendeePicker(true) }}
/>
<AttendeePickerModal
  open={showAttendeePicker}
  attendees={attendees}
  selectedIds={selectedAttendeeIds}
  maxCount={6}
  onChange={setSelectedAttendeeIds}
  onCreate={handleCreateAttendee}
  onClose={() => setShowAttendeePicker(false)}
/>
```

- [ ] **Step 6: 运行前端检查**

Run:

```bash
cd frontend
node --test src/lib/attendees.test.ts
pnpm typecheck
```

Expected: PASS。

- [ ] **Step 7: 用户授权后提交**

```bash
git add frontend/src/components/RealNameNoticeModal.tsx frontend/src/components/AttendeePickerModal.tsx frontend/src/app/activity/[id]/page.tsx frontend/src/lib/purchase-intent.ts frontend/src/lib/purchase-intent.test.ts
git commit -m "feat: require attendees before grab purchase"
```

---

### Task 8: 用户订单和后台订单展示实名观演人

**Files:**
- Modify: `frontend/src/app/orders/page.tsx`
- Modify: `frontend/src/app/console/orders/page.tsx`
- Modify: `frontend/src/lib/console-orders.ts`
- Modify: `frontend/src/lib/console-orders.test.ts`

- [ ] **Step 1: 写失败测试：后台订单可统计实名人数**

在 `console-orders.test.ts` 增加：

```ts
import { getConsoleOrderAttendeeSummary } from './console-orders.ts'

test('getConsoleOrderAttendeeSummary returns attendee count', () => {
  assert.equal(getConsoleOrderAttendeeSummary({ attendees: [{ id: 1 }, { id: 2 }] } as never), '实名观演人 2 人')
})
```

- [ ] **Step 2: 实现展示辅助方法**

在 `console-orders.ts` 增加：

```ts
export function getConsoleOrderAttendeeSummary(order: Pick<OrderEntity, 'attendees'>) {
  const count = order.attendees?.length ?? 0
  return count > 0 ? `实名观演人 ${count} 人` : '未绑定实名观演人'
}
```

- [ ] **Step 3: 用户订单页展示实名信息**

在订单卡片中增加：

```tsx
{order.attendees?.length ? (
  <div className="mt-3 rounded-lg bg-[#fafafa] p-3 text-[13px] text-[#555]">
    <div className="mb-2 font-medium text-[#333]">实名观演人</div>
    {order.attendees.map(attendee => (
      <div key={attendee.id} className="flex justify-between py-1">
        <span>{attendee.realName}</span>
        <span>{attendee.idType === 'ID_CARD' ? '身份证' : attendee.idType} {attendee.idNoMask}</span>
      </div>
    ))}
  </div>
) : null}
```

- [ ] **Step 4: 后台订单页展示实名信息**

在 `console/orders/page.tsx` 表格增加列：

```tsx
<th className="text-left p-3 font-medium text-[#666]">实名观演人</th>
```

每行增加：

```tsx
<td className="p-3 text-[#555]">
  {o.attendees?.length ? (
    <div className="space-y-1">
      {o.attendees.map(attendee => (
        <div key={attendee.id} className="text-[12px]">
          <span className="font-medium text-[#333]">{attendee.realName}</span>
          <span className="ml-1 text-[#777]">{attendee.idNoMask}</span>
        </div>
      ))}
    </div>
  ) : <span className="text-[#aaa]">-</span>}
</td>
```

- [ ] **Step 5: 运行前端测试和类型检查**

Run:

```bash
cd frontend
node --test src/lib/console-orders.test.ts src/lib/attendees.test.ts
pnpm typecheck
```

Expected: PASS。

- [ ] **Step 6: 用户授权后提交**

```bash
git add frontend/src/app/orders/page.tsx frontend/src/app/console/orders/page.tsx frontend/src/lib/console-orders.ts frontend/src/lib/console-orders.test.ts
git commit -m "feat: show real-name attendees on orders"
```

---

### Task 9: 初始化脚本、边界检查和集成验证

**Files:**
- Modify: `sql/docker-init/010-seata-undo-log.sql` 或当前 Docker init 聚合 SQL
- Test: `scripts/verify-microservice-boundaries.ps1`

- [ ] **Step 1: 同步本地初始化 SQL**

把以下变更同步到 Docker/local 初始化资产中：

```sql
ALTER TABLE activity
    ADD COLUMN IF NOT EXISTS real_name_required BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS user_attendee (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    real_name VARCHAR(80) NOT NULL,
    id_type VARCHAR(32) NOT NULL,
    id_no_hash VARCHAR(64) NOT NULL,
    id_no_mask VARCHAR(40) NOT NULL,
    id_no_encrypted TEXT,
    phone VARCHAR(32),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_attendee_id_type CHECK (id_type IN ('ID_CARD')),
    CONSTRAINT chk_user_attendee_status CHECK (status IN (1, 2))
);

CREATE INDEX IF NOT EXISTS idx_user_attendee_user_id ON user_attendee(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_attendee_active_identity
    ON user_attendee(user_id, id_type, id_no_hash)
    WHERE status = 1;

CREATE TABLE IF NOT EXISTS order_attendee (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
    order_seat_id BIGINT REFERENCES order_seat(id) ON DELETE SET NULL,
    session_id BIGINT NOT NULL,
    ticket_type_id BIGINT NOT NULL,
    attendee_user_profile_id BIGINT,
    real_name VARCHAR(80) NOT NULL,
    id_type VARCHAR(32) NOT NULL,
    id_no_hash VARCHAR(64) NOT NULL,
    id_no_mask VARCHAR(40) NOT NULL,
    id_no_encrypted TEXT,
    phone VARCHAR(32),
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_order_attendee_id_type CHECK (id_type IN ('ID_CARD')),
    CONSTRAINT chk_order_attendee_status CHECK (status IN (1, 3, 4))
);

CREATE INDEX IF NOT EXISTS idx_order_attendee_order_id ON order_attendee(order_id);
CREATE INDEX IF NOT EXISTS idx_order_attendee_order_seat_id ON order_attendee(order_seat_id);
CREATE INDEX IF NOT EXISTS idx_order_attendee_session_identity ON order_attendee(session_id, id_type, id_no_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_attendee_active_session_identity
    ON order_attendee(session_id, id_type, id_no_hash)
    WHERE status = 1;

ALTER TABLE grab_request
    ADD COLUMN IF NOT EXISTS attendee_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
```

不要删除现有表、volume 或历史迁移。

- [ ] **Step 2: 运行微服务边界检查**

Run:

```bash
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

Expected: PASS。不得出现 `java-order` 直接引用 ticket/user 表，或 `java-ticket` 直接引用 order 表。

- [ ] **Step 3: 运行 Java 定向测试**

Run:

```bash
cd java
mvn -pl java-user,java-order,java-ticket -Dtest=UserAttendeeServiceTest,UserAttendeeControllerTest,OrderServiceTest,OrderSeatServiceTest,OrderControllerPublicAuthTest,AdminControllerTest,TicketSalesInternalServiceTest test
```

Expected: PASS。

- [ ] **Step 4: 运行 grab-service 测试**

Run:

```bash
cd nestjs/grab-service
npm test -- grab.service.spec.ts order-client.service.spec.ts grab-worker.service.spec.ts
```

Expected: PASS。

- [ ] **Step 5: 运行 frontend 测试**

Run:

```bash
cd frontend
node --test src/lib/*.test.ts
pnpm typecheck
```

Expected: PASS。

- [ ] **Step 6: 手工 UI 验证**

启动项目：

```powershell
powershell -ExecutionPolicy Bypass -File start-project.ps1
```

浏览器验证：

1. 用用户 `13900000001 / 123456` 登录。
2. 打开任意活动详情页。
3. 看到实名制弹窗。
4. 新增 2 位观演人。
5. 选择 2 张票，预选 2 位观演人。
6. 发起抢票，确认请求体带 `attendeeIds`。
7. 订单创建后进入用户订单页，看到实名观演人。
8. 用主办方 `13800000002 / 123456` 登录后台，只看到自己活动订单的实名信息。
9. 用平台管理员 `13800000001 / 123456` 登录后台，看到全平台订单实名信息。
10. 再次用同一身份证购买同一场次，后端拒绝并显示“该观演人已购买当前场次”。

- [ ] **Step 7: 用户授权后提交最终验证修正**

```bash
git add sql/docker-init/010-seata-undo-log.sql
git commit -m "chore: document and verify real-name ticketing"
```

---

## 自审结果

- Spec coverage: 已覆盖实名制提示、观演人管理、每票绑定、同场次证件去重、抢票透传、退款/取消释放、主办方/平台后台展示和微服务边界。
- Placeholder scan: 未发现待办标记、注释占位或“类似实现”这类不可执行指令；省略号命中均为代码语法或示例签名。
- Type consistency: 前后统一使用 `attendeeIds`、`UserAttendeeVO`、`OrderAttendeeResponse`、`ResolvedAttendeeResponse`、`realNameRequired`。
- Concurrency/privacy review: 已补充 `real_name_required DEFAULT FALSE`、active 部分唯一索引、`id_no_encrypted` 核心版不写明文、`/api/user/internal/attendees/resolve` 路径对齐和 `order_attendee.status` 释放语义。
- Scope note: 本计划不接入公安实名认证、人脸核验、入场核验设备或完整证件号审计查看。
