# Phase A-B Ticket User Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立微服务数据边界规则，并让 `java-ticket` 通过 `java-user` internal API 获取用户角色，不再直接读取用户表。

**Architecture:** 本计划只执行低风险的 Phase A + Phase B，不改订单库存和支付链路。`java-user` 暴露最小用户引用 internal API；`java-ticket` 新增 Feign client 和本地权限服务，逐步替换 `UserRefMapper`。所有 internal API 使用显式 `INTERNAL_API_TOKEN`，空 token 必须拒绝。

**Tech Stack:** Java 17, Spring Boot, Spring Cloud OpenFeign, MyBatis-Plus, JUnit 5, Mockito, Maven.

---

## Scope

本计划覆盖：

- Phase A：增加边界规则文档，冻结数据所有权。
- Phase B：实现 `java-user -> internal user reference API`。
- Phase B：实现 `java-ticket -> UserInternalClient -> UserAccessService`。
- Phase B：替换 `java-ticket` 生产代码中的 `UserRefMapper` 读取用户表行为。

本计划不覆盖：

- `java-order -> java-ticket` 库存解耦。
- 订单快照化。
- schema 拆分或物理拆库。
- 前端页面修改。

## File Structure

- Create: `docs/microservices/service-boundaries.md`
  - 记录服务数据所有权、禁止跨表访问规则、本阶段豁免和后续阶段。
- Create: `java/java-user/src/main/java/com/omni/user/dto/InternalUserRefResponse.java`
  - 用户 internal API 响应 DTO，只暴露权限判断必要字段。
- Modify: `java/java-user/src/main/java/com/omni/user/service/UserService.java`
  - 新增 `getInternalUserRef(Long userId)`。
- Modify: `java/java-user/src/main/java/com/omni/user/controller/UserController.java`
  - 注入 `internal.api.token`，新增 `/api/user/internal/{id}` 接口和 token 校验。
- Modify: `java/java-user/src/test/java/com/omni/user/service/UserServiceTest.java`
  - 覆盖 internal user ref 查询映射和不存在用户。
- Create: `java/java-user/src/test/java/com/omni/user/controller/UserControllerInternalTest.java`
  - 覆盖 internal API token 校验。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/InternalUserRefResponse.java`
  - ticket 侧独立 DTO，不复用 user 模块类。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/client/UserInternalClient.java`
  - Feign client，调用 `java-user` internal API。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/UserAccessService.java`
  - ticket 侧统一用户权限判断服务，封装 admin/organizer 判断。
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/UserAccessServiceTest.java`
  - 覆盖 admin、organizer、普通用户、空 token、用户服务错误。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
  - 使用 `UserAccessService` 替代 `UserRefMapper`。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/*.java`
  - 替换所有生产代码里的 `UserRefMapper.selectById(...)` 权限读取。
- Modify: existing ticket tests under `java/java-ticket/src/test/java/com/omni/ticket/**`
  - 将 mock `UserRefMapper` 改为 mock `UserAccessService`。

## Role Rules

`UserAccessService` 统一提供以下方法：

```java
public InternalUserRefResponse requireUser(Long userId)
public InternalUserRefResponse requireAdmin(Long userId)
public InternalUserRefResponse requireAdminOrOrganizer(Long userId)
public String requireAdminOrOrganizerRole(Long userId)
public boolean isAdmin(InternalUserRefResponse user)
public boolean isOrganizer(InternalUserRefResponse user)
```

错误语义：

- `userId == null`：抛 `BusinessException(ResultCode.BAD_REQUEST, "用户ID不能为空")`。
- 用户服务返回非 200：抛 `BusinessException(ResultCode.INTERNAL_ERROR, "用户服务无响应")`。
- 用户不存在：抛 `BusinessException(ResultCode.NOT_FOUND, "用户不存在")`。
- 非 admin/organizer 访问 B 端能力：抛 `BusinessException(ResultCode.FORBIDDEN, "无权限")`。
- 非 admin 访问 admin-only 能力：抛 `BusinessException(ResultCode.FORBIDDEN, "仅平台管理员可操作")`。

## Task 1: Boundary Documentation

**Files:**
- Create: `docs/microservices/service-boundaries.md`

- [ ] **Step 1: Create boundary document**

Create `docs/microservices/service-boundaries.md` with this content:

```markdown
# Service Boundaries

## Goal

当前阶段采用逻辑解耦优先策略：服务仍共用同一个 PostgreSQL 实例，但生产代码必须遵守服务数据所有权，不能通过 Mapper 或 SQL 直接读取其他服务拥有的表。

## Ownership

| Service | Owns |
|:---|:---|
| java-user | `user`, `organizer_application` |
| java-ticket | `tour`, `station`, `activity`, `venue`, `venue_application`, `session`, `ticket_type`, `session_seat`, SeatCraft tables |
| java-order | `order`, `order_seat` |
| java-payment | payment and refund transaction tables |
| java-notification | notification tables |
| java-gateway | no business tables |

## Rules

- `java-ticket` must call `java-user` internal API for user role and status.
- `java-order` must call `java-ticket` internal API for ticket price, stock, and seat changes.
- `java-payment` must call `java-order` internal API for order status changes.
- New internal endpoints must require `X-Internal-Token`.
- Empty internal token configuration is invalid for cross-service calls.
- New SQL migration files must include an owner comment at the top.

## Current Exceptions

- `java-order` still reads ticket tables during the next phase until inventory internal APIs are introduced.
- `java-order` still joins ticket tables for order list display until order snapshots are introduced.

## Verification

- After Phase B, `java-ticket` production code must not reference `UserRefMapper`.
- After Phase C, `java-order` production code must not reference ticket inventory mappers.
```

- [ ] **Step 2: Verify documentation is tracked**

Run from repo root:

```powershell
git status --short docs/microservices/service-boundaries.md
```

Expected output contains:

```text
?? docs/microservices/service-boundaries.md
```

Do not commit unless the user explicitly asks.

## Task 2: User Internal DTO And Service

**Files:**
- Create: `java/java-user/src/main/java/com/omni/user/dto/InternalUserRefResponse.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/UserService.java`
- Test: `java/java-user/src/test/java/com/omni/user/service/UserServiceTest.java`

- [ ] **Step 1: Write failing service tests**

Append these tests to `UserServiceTest` before helper methods:

```java
@Test
void internalUserRefReturnsOnlyAuthorizationFields() {
    User user = existingUser();
    user.setRole("organizer");
    user.setStatus(1);
    user.setOrganizerStatus(1);
    user.setOrganizerName("万象主办方");
    when(userMapper.selectById(2004L)).thenReturn(user);

    InternalUserRefResponse response = userService.getInternalUserRef(2004L);

    assertEquals(2004L, response.getId());
    assertEquals("13900000001", response.getPhone());
    assertEquals("organizer", response.getRole());
    assertEquals(1, response.getStatus());
    assertEquals(1, response.getOrganizerStatus());
    assertEquals("万象主办方", response.getOrganizerName());
}

@Test
void internalUserRefRejectsUnknownUser() {
    when(userMapper.selectById(9999L)).thenReturn(null);

    BusinessException exception = assertThrows(
            BusinessException.class,
            () -> userService.getInternalUserRef(9999L)
    );

    assertEquals("用户不存在", exception.getMessage());
}
```

Add import near the other imports:

```java
import com.omni.user.dto.InternalUserRefResponse;
```

- [ ] **Step 2: Run service test to verify it fails**

Run from `java/`:

```powershell
mvn test -pl java-user -am -Dtest=UserServiceTest
```

Expected: compilation fails because `InternalUserRefResponse` and `getInternalUserRef` do not exist.

- [ ] **Step 3: Add internal DTO**

Create `java/java-user/src/main/java/com/omni/user/dto/InternalUserRefResponse.java`:

```java
package com.omni.user.dto;

public class InternalUserRefResponse {
    private Long id;
    private String phone;
    private String role;
    private Integer status;
    private Integer organizerStatus;
    private String organizerName;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Integer getOrganizerStatus() { return organizerStatus; }
    public void setOrganizerStatus(Integer organizerStatus) { this.organizerStatus = organizerStatus; }
    public String getOrganizerName() { return organizerName; }
    public void setOrganizerName(String organizerName) { this.organizerName = organizerName; }
}
```

- [ ] **Step 4: Implement service method**

Modify `UserService.java` imports:

```java
import com.omni.user.dto.InternalUserRefResponse;
```

Add this method after `getUserById`:

```java
public InternalUserRefResponse getInternalUserRef(Long userId) {
    if (userId == null) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "用户ID不能为空");
    }
    User user = userMapper.selectById(userId);
    if (user == null) {
        throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
    }
    return toInternalUserRefResponse(user);
}
```

Add this private mapper near `toUserInfoResponse`:

```java
private InternalUserRefResponse toInternalUserRefResponse(User user) {
    InternalUserRefResponse response = new InternalUserRefResponse();
    response.setId(user.getId());
    response.setPhone(user.getPhone());
    response.setRole(user.getRole() != null ? user.getRole() : "user");
    response.setStatus(user.getStatus());
    response.setOrganizerStatus(user.getOrganizerStatus());
    response.setOrganizerName(user.getOrganizerName());
    return response;
}
```

- [ ] **Step 5: Run service test to verify it passes**

Run from `java/`:

```powershell
mvn test -pl java-user -am -Dtest=UserServiceTest
```

Expected: `BUILD SUCCESS`.

## Task 3: User Internal Controller

**Files:**
- Modify: `java/java-user/src/main/java/com/omni/user/controller/UserController.java`
- Test: `java/java-user/src/test/java/com/omni/user/controller/UserControllerInternalTest.java`

- [ ] **Step 1: Write failing controller tests**

Create `java/java-user/src/test/java/com/omni/user/controller/UserControllerInternalTest.java`:

```java
package com.omni.user.controller;

import com.omni.user.dto.InternalUserRefResponse;
import com.omni.user.service.OrganizerApplicationService;
import com.omni.user.service.UserService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserControllerInternalTest {

    private final UserService userService = mock(UserService.class);
    private final OrganizerApplicationService organizerApplicationService = mock(OrganizerApplicationService.class);
    private final UserController controller = new UserController(userService, organizerApplicationService, "internal-token");

    @Test
    void internalUserRefRejectsMissingToken() {
        var result = controller.getInternalUserRef(2004L, null);

        assertEquals(403, result.getCode());
        verify(userService, never()).getInternalUserRef(2004L);
    }

    @Test
    void internalUserRefRejectsWrongToken() {
        var result = controller.getInternalUserRef(2004L, "wrong-token");

        assertEquals(403, result.getCode());
        verify(userService, never()).getInternalUserRef(2004L);
    }

    @Test
    void internalUserRefReturnsUserWhenTokenMatches() {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(2004L);
        user.setRole("organizer");
        when(userService.getInternalUserRef(2004L)).thenReturn(user);

        var result = controller.getInternalUserRef(2004L, "internal-token");

        assertEquals(200, result.getCode());
        assertEquals(2004L, result.getData().getId());
        assertEquals("organizer", result.getData().getRole());
    }

    @Test
    void internalUserRefRejectsEmptyConfiguredToken() {
        UserController emptyTokenController = new UserController(userService, organizerApplicationService, "");

        var result = emptyTokenController.getInternalUserRef(2004L, "internal-token");

        assertEquals(403, result.getCode());
        assertNull(result.getData());
    }
}
```

- [ ] **Step 2: Run controller test to verify it fails**

Run from `java/`:

```powershell
mvn test -pl java-user -am -Dtest=UserControllerInternalTest
```

Expected: compilation fails because constructor and `getInternalUserRef` endpoint do not exist.

- [ ] **Step 3: Add controller constructor and endpoint**

Modify `UserController.java` imports:

```java
import com.omni.user.dto.InternalUserRefResponse;
import org.springframework.beans.factory.annotation.Value;
```

Add field:

```java
private final String internalApiToken;
```

Replace existing constructor with two constructors:

```java
public UserController(UserService userService, OrganizerApplicationService organizerApplicationService) {
    this(userService, organizerApplicationService, "");
}

public UserController(UserService userService,
                      OrganizerApplicationService organizerApplicationService,
                      @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
    this.userService = userService;
    this.organizerApplicationService = organizerApplicationService;
    this.internalApiToken = internalApiToken;
}
```

Add endpoint before `sendCode`:

```java
@GetMapping("/internal/{id}")
public Result<InternalUserRefResponse> getInternalUserRef(
        @PathVariable Long id,
        @RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!isValidInternalToken(token)) {
        return Result.fail(403, "无权限");
    }
    return Result.success(userService.getInternalUserRef(id));
}

private boolean isValidInternalToken(String token) {
    return StringUtils.hasText(internalApiToken) && internalApiToken.equals(token);
}
```

- [ ] **Step 4: Run user module tests**

Run from `java/`:

```powershell
mvn test -pl java-user -am
```

Expected: `BUILD SUCCESS`.

## Task 4: Ticket User Client And Access Service

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/InternalUserRefResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/client/UserInternalClient.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/UserAccessService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/UserAccessServiceTest.java`

- [ ] **Step 1: Write failing access service tests**

Create `java/java-ticket/src/test/java/com/omni/ticket/service/UserAccessServiceTest.java`:

```java
package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.UserInternalClient;
import com.omni.ticket.dto.InternalUserRefResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserAccessServiceTest {

    private final UserInternalClient userInternalClient = mock(UserInternalClient.class);

    @Test
    void requireAdminOrOrganizerReturnsOrganizer() {
        UserAccessService service = new UserAccessService(userInternalClient, "internal-token");
        when(userInternalClient.getUserRef(2003L, "internal-token")).thenReturn(Result.success(user("organizer")));

        InternalUserRefResponse response = service.requireAdminOrOrganizer(2003L);

        assertEquals("organizer", response.getRole());
    }

    @Test
    void requireAdminRejectsOrganizer() {
        UserAccessService service = new UserAccessService(userInternalClient, "internal-token");
        when(userInternalClient.getUserRef(2003L, "internal-token")).thenReturn(Result.success(user("organizer")));

        BusinessException exception = assertThrows(BusinessException.class, () -> service.requireAdmin(2003L));

        assertEquals("仅平台管理员可操作", exception.getMessage());
    }

    @Test
    void requireAdminOrOrganizerRejectsNormalUser() {
        UserAccessService service = new UserAccessService(userInternalClient, "internal-token");
        when(userInternalClient.getUserRef(2004L, "internal-token")).thenReturn(Result.success(user("user")));

        BusinessException exception = assertThrows(BusinessException.class, () -> service.requireAdminOrOrganizer(2004L));

        assertEquals("无权限", exception.getMessage());
    }

    @Test
    void requireUserRejectsEmptyInternalToken() {
        UserAccessService service = new UserAccessService(userInternalClient, "");

        BusinessException exception = assertThrows(BusinessException.class, () -> service.requireUser(2004L));

        assertEquals("内部接口令牌未配置", exception.getMessage());
    }

    @Test
    void requireUserRejectsUserServiceFailure() {
        UserAccessService service = new UserAccessService(userInternalClient, "internal-token");
        when(userInternalClient.getUserRef(2004L, "internal-token")).thenReturn(Result.fail(500, "error"));

        BusinessException exception = assertThrows(BusinessException.class, () -> service.requireUser(2004L));

        assertEquals("用户服务无响应", exception.getMessage());
    }

    private InternalUserRefResponse user(String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(2003L);
        user.setRole(role);
        user.setStatus(1);
        return user;
    }
}
```

- [ ] **Step 2: Run access service test to verify it fails**

Run from `java/`:

```powershell
mvn test -pl java-ticket -am -Dtest=UserAccessServiceTest
```

Expected: compilation fails because the client, DTO, and service do not exist.

- [ ] **Step 3: Add ticket internal user DTO**

Create `java/java-ticket/src/main/java/com/omni/ticket/dto/InternalUserRefResponse.java`:

```java
package com.omni.ticket.dto;

public class InternalUserRefResponse {
    private Long id;
    private String phone;
    private String role;
    private Integer status;
    private Integer organizerStatus;
    private String organizerName;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Integer getOrganizerStatus() { return organizerStatus; }
    public void setOrganizerStatus(Integer organizerStatus) { this.organizerStatus = organizerStatus; }
    public String getOrganizerName() { return organizerName; }
    public void setOrganizerName(String organizerName) { this.organizerName = organizerName; }
}
```

- [ ] **Step 4: Add Feign client**

Create `java/java-ticket/src/main/java/com/omni/ticket/client/UserInternalClient.java`:

```java
package com.omni.ticket.client;

import com.omni.common.result.Result;
import com.omni.ticket.dto.InternalUserRefResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "java-user")
public interface UserInternalClient {

    @GetMapping("/api/user/internal/{id}")
    Result<InternalUserRefResponse> getUserRef(@PathVariable("id") Long id,
                                               @RequestHeader("X-Internal-Token") String internalToken);
}
```

- [ ] **Step 5: Add UserAccessService**

Create `java/java-ticket/src/main/java/com/omni/ticket/service/UserAccessService.java`:

```java
package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.UserInternalClient;
import com.omni.ticket.dto.InternalUserRefResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class UserAccessService {
    private static final String ROLE_ADMIN = "admin";
    private static final String ROLE_ORGANIZER = "organizer";

    private final UserInternalClient userInternalClient;
    private final String internalApiToken;

    public UserAccessService(UserInternalClient userInternalClient,
                             @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.userInternalClient = userInternalClient;
        this.internalApiToken = internalApiToken;
    }

    public InternalUserRefResponse requireUser(Long userId) {
        if (userId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户ID不能为空");
        }
        if (!StringUtils.hasText(internalApiToken)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "内部接口令牌未配置");
        }
        Result<InternalUserRefResponse> result;
        try {
            result = userInternalClient.getUserRef(userId, internalApiToken);
        } catch (RuntimeException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "用户服务无响应");
        }
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "用户服务无响应");
        }
        InternalUserRefResponse user = result.getData();
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        return user;
    }

    public InternalUserRefResponse requireAdmin(Long userId) {
        InternalUserRefResponse user = requireUser(userId);
        if (!isAdmin(user)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "仅平台管理员可操作");
        }
        return user;
    }

    public InternalUserRefResponse requireAdminOrOrganizer(Long userId) {
        InternalUserRefResponse user = requireUser(userId);
        if (!isAdmin(user) && !isOrganizer(user)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
        }
        return user;
    }

    public String requireAdminOrOrganizerRole(Long userId) {
        return requireAdminOrOrganizer(userId).getRole();
    }

    public boolean isAdmin(InternalUserRefResponse user) {
        return user != null && ROLE_ADMIN.equals(user.getRole());
    }

    public boolean isOrganizer(InternalUserRefResponse user) {
        return user != null && ROLE_ORGANIZER.equals(user.getRole());
    }
}
```

- [ ] **Step 6: Run access service test**

Run from `java/`:

```powershell
mvn test -pl java-ticket -am -Dtest=UserAccessServiceTest
```

Expected: `BUILD SUCCESS`.

## Task 5: Replace UserRefMapper In Ticket Services

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/AdminSummaryService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatTemplateService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionAdminService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueDefaultLayoutService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivitySeatLayoutService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatLayoutService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/OrderAdminQueryService.java`

- [ ] **Step 1: Find all production references**

Run from repo root:

```powershell
rg "UserRefMapper|UserRef" java/java-ticket/src/main/java
```

Expected before implementation: references exist in the files listed above.

- [ ] **Step 2: Replace simple role reads**

For each file where code only needs role, replace this pattern:

```java
UserRef user = userRefMapper.selectById(userId);
String role = user != null ? user.getRole() : null;
if (!"admin".equals(role) && !"organizer".equals(role)) {
    throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
}
```

with:

```java
InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(userId);
String role = user.getRole();
```

Add imports:

```java
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.service.UserAccessService;
```

Remove imports:

```java
import com.omni.ticket.entity.UserRef;
import com.omni.ticket.mapper.UserRefMapper;
```

Replace constructor parameter:

```java
UserRefMapper userRefMapper
```

with:

```java
UserAccessService userAccessService
```

Replace field:

```java
private final UserRefMapper userRefMapper;
```

with:

```java
private final UserAccessService userAccessService;
```

- [ ] **Step 3: Replace admin-only checks**

Replace this pattern:

```java
UserRef user = userRefMapper.selectById(userId);
if (user == null || !"admin".equals(user.getRole())) {
    throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
}
```

with:

```java
userAccessService.requireAdmin(userId);
```

If the existing message is part of a test, use:

```java
try {
    userAccessService.requireAdmin(userId);
} catch (BusinessException e) {
    throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
}
```

- [ ] **Step 4: Preserve organizer ownership checks**

When code checks organizer ownership, preserve the existing comparison:

```java
InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(userId);
if ("organizer".equals(user.getRole()) && !userId.equals(activity.getOrganizerId())) {
    throw new BusinessException(ResultCode.FORBIDDEN, "只能管理自己主办的活动");
}
```

Use the same existing error message for each file.

- [ ] **Step 5: Replace organizer cancellation write-back**

`ActivityAdminService.deactivateOrganizer` currently updates user role through `UserRefMapper.updateById(organizer)`. Do not keep cross-service writes.

For this Phase B plan, change the method to stop directly mutating the user table and fail fast with a clear internal boundary message until a dedicated user internal mutation API is designed:

```java
throw new BusinessException(ResultCode.INTERNAL_ERROR, "取消主办方资格需通过用户服务接口处理");
```

Place this after validating the operator is admin and before querying organizer details. This preserves the boundary and avoids silently writing another service table. Existing tests for revoke organizer must be updated to expect this message.

- [ ] **Step 6: Run production reference check**

Run from repo root:

```powershell
rg "UserRefMapper|entity\.UserRef|UserRef" java/java-ticket/src/main/java
```

Expected after replacement: no output for production code, except the temporary `UserRef.java` entity file itself if it has not been deleted yet.

## Task 6: Update Ticket Tests

**Files:**
- Modify ticket tests that currently mock `UserRefMapper`.

- [ ] **Step 1: Find test references**

Run from repo root:

```powershell
rg "UserRefMapper|UserRef" java/java-ticket/src/test/java
```

Expected before replacement: references in service and controller tests.

- [ ] **Step 2: Replace mocks**

For each test class, replace:

```java
private UserRefMapper userRefMapper;
```

with:

```java
private UserAccessService userAccessService;
```

Replace setup:

```java
userRefMapper = mock(UserRefMapper.class);
```

with:

```java
userAccessService = mock(UserAccessService.class);
```

Replace stubs:

```java
UserRef user = new UserRef();
user.setId(2003L);
user.setRole("organizer");
when(userRefMapper.selectById(2003L)).thenReturn(user);
```

with:

```java
InternalUserRefResponse user = new InternalUserRefResponse();
user.setId(2003L);
user.setRole("organizer");
when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user);
```

For admin-only paths use:

```java
when(userAccessService.requireAdmin(2002L)).thenReturn(adminUser());
```

Add helper if useful inside each test class:

```java
private InternalUserRefResponse user(Long id, String role) {
    InternalUserRefResponse user = new InternalUserRefResponse();
    user.setId(id);
    user.setRole(role);
    user.setStatus(1);
    return user;
}
```

- [ ] **Step 3: Update revoke organizer tests**

If a test expects `ActivityAdminService.deactivateOrganizer` to mutate user role directly, change it to expect:

```java
BusinessException exception = assertThrows(
        BusinessException.class,
        () -> service.deactivateOrganizer(request)
);
assertEquals("取消主办方资格需通过用户服务接口处理", exception.getMessage());
```

This is intentional in Phase B because user mutations belong to `java-user`.

- [ ] **Step 4: Run ticket tests**

Run from `java/`:

```powershell
mvn test -pl java-ticket -am
```

Expected: `BUILD SUCCESS`.

## Task 7: Delete Ticket UserRef Mapper Boundary Violation

**Files:**
- Delete: `java/java-ticket/src/main/java/com/omni/ticket/mapper/UserRefMapper.java`
- Delete: `java/java-ticket/src/main/java/com/omni/ticket/entity/UserRef.java`

- [ ] **Step 1: Verify no production or test references remain**

Run from repo root:

```powershell
rg "UserRefMapper|entity\.UserRef|UserRef" java/java-ticket/src
```

Expected: no output except possibly file names being searched if references still exist. If output appears in Java code, finish Task 5 and Task 6 first.

- [ ] **Step 2: Delete obsolete files**

Delete:

```text
java/java-ticket/src/main/java/com/omni/ticket/mapper/UserRefMapper.java
java/java-ticket/src/main/java/com/omni/ticket/entity/UserRef.java
```

Use `apply_patch` delete operations or the editor; do not leave empty classes.

- [ ] **Step 3: Run boundary check**

Run from repo root:

```powershell
rg "UserRefMapper|entity\.UserRef|UserRef" java/java-ticket/src/main/java java/java-ticket/src/test/java
```

Expected: no output.

## Task 8: Verification

**Files:**
- No edits.

- [ ] **Step 1: Run user tests**

Run from `java/`:

```powershell
mvn test -pl java-user -am
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 2: Run ticket tests**

Run from `java/`:

```powershell
mvn test -pl java-ticket -am
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 3: Run order tests as regression guard**

Run from `java/`:

```powershell
mvn test -pl java-order -am
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 4: Run frontend typecheck only if frontend files changed**

This plan should not change frontend files. If any frontend file changed unexpectedly, run from `frontend/`:

```powershell
pnpm run typecheck
```

Expected: `tsc --noEmit` exits successfully.

- [ ] **Step 5: Inspect final diff**

Run from repo root:

```powershell
git diff --stat
git diff -- docs/microservices/service-boundaries.md java/java-user/src/main/java/com/omni/user java/java-ticket/src/main/java/com/omni/ticket
```

Expected: diff only contains Phase A/B boundary docs, user internal API, ticket user access client/service, and `UserRefMapper` replacement.

Do not commit unless the user explicitly asks.

## Self-Review

- Spec coverage: Phase A boundary freeze and Phase B `ticket -> user` decoupling are covered.
- Scope intentionally excludes order-ticket inventory decoupling and order snapshot work.
- No placeholders remain; each task has concrete files, code, commands, and expected results.
- Type names are consistent: `InternalUserRefResponse`, `UserInternalClient`, `UserAccessService`.
- The plan respects the project instruction not to use fixed default `INTERNAL_API_TOKEN` fallback.
- The plan respects the user preference not to commit automatically unless explicitly requested.
