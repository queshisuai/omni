# Private Venue Proof Asset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增通用私有附件能力，并把场地凭证 `venue-proof` 从手填公开链接改为私有上传、业务绑定、鉴权下载。

**Architecture:** 在 `java-ticket` 内新增 `private_asset` 表、实体、Mapper、Service 和鉴权下载接口，文件保存到 `runtime/private-uploads/ticket`，不注册静态资源。`VenueApplication` 提交时带 `proofAssetId`，后端绑定到真实申请 ID；前端只替换 `/console/venue/apply` 创建入口和 `/console/venue/applications` 审核下载入口。

**Tech Stack:** Java 11、Spring Boot、MyBatis-Plus、PostgreSQL、Next.js 16、React 19、TypeScript、pnpm、Maven。

---

## File Structure

- Create: `sql/production-split/ticket/20260523_private_asset.sql`
  - 生产拆库 ticket 库私有附件表和 `venue_application.proof_asset_id` 字段。
- Create: `sql/migrations/shared/20260523_private_asset.sql`
  - shared 迁移归档，内容与 ticket SQL 对齐。
- Modify: `sql/production-split/manifest.json`
  - 注册新 ticket 迁移。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/PrivateAsset.java`
  - 私有附件实体。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/mapper/PrivateAssetMapper.java`
  - MyBatis-Plus Mapper。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/PrivateAssetResponse.java`
  - 上传和列表响应 DTO。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/PrivateAssetDownload.java`
  - 下载文件流元信息 DTO。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/PrivateAssetService.java`
  - 上传校验、落盘、绑定、下载鉴权核心服务。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueApplication.java`
  - 增加 `proofAssetId`。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationRequest.java`
  - 增加 `proofAssetId`。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationResponse.java`
  - 增加 `proofAssetId` 和 `proofAsset`。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`
  - 提交校验从 `proofFileUrl` 扩展为 `proofAssetId`；提交成功后绑定私有附件。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
  - 新增上传、下载接口；注入 `PrivateAssetService`。
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/PrivateAssetServiceTest.java`
  - 服务层上传校验、绑定、下载权限测试。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationServiceTest.java`
  - 场地申请绑定私有附件测试。若文件不存在，创建 focused 单测文件。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`
  - Controller 上传/下载委托测试。
- Modify: `frontend/src/types/api.ts`
  - 增加 `PrivateAssetVO`，扩展 `VenueApplicationVO.proofAssetId/proofAsset`。
- Modify: `frontend/src/lib/api.ts`
  - 增加 `uploadPrivateAsset()` 和 `downloadPrivateAsset()`。
- Create: `frontend/src/components/PrivateFileUpload.tsx`
  - 私有附件上传控件，只显示元信息，不生成公开预览 URL。
- Modify: `frontend/src/app/console/venue/apply/page.tsx`
  - 替换 `proofFileUrl` 手填入口为私有上传。
- Modify: `frontend/src/app/console/venue/applications/page.tsx`
  - 审核页显示附件并通过鉴权接口下载。

---

### Task 1: 数据库迁移

**Files:**
- Create: `sql/production-split/ticket/20260523_private_asset.sql`
- Create: `sql/migrations/shared/20260523_private_asset.sql`
- Modify: `sql/production-split/manifest.json`

- [ ] **Step 1: 创建 production split SQL**

Create `sql/production-split/ticket/20260523_private_asset.sql`:

```sql
-- Private ticket-side assets. Files are stored on disk, not in PostgreSQL.
CREATE TABLE IF NOT EXISTS private_asset (
  id BIGSERIAL PRIMARY KEY,
  service_name VARCHAR(50) NOT NULL DEFAULT 'ticket',
  biz_type VARCHAR(50) NOT NULL,
  biz_id BIGINT,
  uploader_id BIGINT NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  relative_path VARCHAR(500) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  sha256 VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  bind_time TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_private_asset_uploader ON private_asset(uploader_id);
CREATE INDEX IF NOT EXISTS idx_private_asset_biz ON private_asset(biz_type, biz_id);
CREATE INDEX IF NOT EXISTS idx_private_asset_status ON private_asset(status);

ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS proof_asset_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_venue_application_proof_asset ON venue_application(proof_asset_id);
```

- [ ] **Step 2: 创建 shared 归档 SQL**

Create `sql/migrations/shared/20260523_private_asset.sql` with the same SQL from Step 1.

- [ ] **Step 3: 注册 production split manifest**

Open `sql/production-split/manifest.json` and add the new ticket SQL entry next to other ticket migrations:

```json
"ticket/20260523_private_asset.sql"
```

Keep valid JSON ordering and comma placement.

- [ ] **Step 4: 验证 SQL 清单**

Run: `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`

Workdir: `C:\Users\Administrator\Desktop\omni`

Expected: script exits 0 with no production split SQL ownership errors.

---

### Task 2: 私有附件实体、DTO、Mapper

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/PrivateAsset.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/mapper/PrivateAssetMapper.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/PrivateAssetResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/PrivateAssetDownload.java`

- [ ] **Step 1: 创建实体**

Create `PrivateAsset.java`:

```java
package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("private_asset")
public class PrivateAsset {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String serviceName;
    private String bizType;
    private Long bizId;
    private Long uploaderId;
    private String originalFilename;
    private String storedFilename;
    private String relativePath;
    private String contentType;
    private Long fileSize;
    private String sha256;
    private String status;
    private LocalDateTime createTime;
    private LocalDateTime bindTime;
    private LocalDateTime deletedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    public String getBizType() { return bizType; }
    public void setBizType(String bizType) { this.bizType = bizType; }
    public Long getBizId() { return bizId; }
    public void setBizId(Long bizId) { this.bizId = bizId; }
    public Long getUploaderId() { return uploaderId; }
    public void setUploaderId(Long uploaderId) { this.uploaderId = uploaderId; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public String getStoredFilename() { return storedFilename; }
    public void setStoredFilename(String storedFilename) { this.storedFilename = storedFilename; }
    public String getRelativePath() { return relativePath; }
    public void setRelativePath(String relativePath) { this.relativePath = relativePath; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public String getSha256() { return sha256; }
    public void setSha256(String sha256) { this.sha256 = sha256; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getBindTime() { return bindTime; }
    public void setBindTime(LocalDateTime bindTime) { this.bindTime = bindTime; }
    public LocalDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }
}
```

- [ ] **Step 2: 创建 Mapper**

Create `PrivateAssetMapper.java`:

```java
package com.omni.ticket.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.ticket.entity.PrivateAsset;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface PrivateAssetMapper extends BaseMapper<PrivateAsset> {
}
```

- [ ] **Step 3: 创建响应 DTO**

Create `PrivateAssetResponse.java`:

```java
package com.omni.ticket.dto;

import com.omni.ticket.entity.PrivateAsset;

import java.time.LocalDateTime;

public class PrivateAssetResponse {
    private Long id;
    private String bizType;
    private Long bizId;
    private String originalFilename;
    private String contentType;
    private Long fileSize;
    private String status;
    private LocalDateTime createTime;

    public static PrivateAssetResponse from(PrivateAsset asset) {
        if (asset == null) return null;
        PrivateAssetResponse response = new PrivateAssetResponse();
        response.setId(asset.getId());
        response.setBizType(asset.getBizType());
        response.setBizId(asset.getBizId());
        response.setOriginalFilename(asset.getOriginalFilename());
        response.setContentType(asset.getContentType());
        response.setFileSize(asset.getFileSize());
        response.setStatus(asset.getStatus());
        response.setCreateTime(asset.getCreateTime());
        return response;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getBizType() { return bizType; }
    public void setBizType(String bizType) { this.bizType = bizType; }
    public Long getBizId() { return bizId; }
    public void setBizId(Long bizId) { this.bizId = bizId; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
```

- [ ] **Step 4: 创建下载 DTO**

Create `PrivateAssetDownload.java`:

```java
package com.omni.ticket.dto;

import java.nio.file.Path;

public class PrivateAssetDownload {
    private final Path path;
    private final String originalFilename;
    private final String contentType;
    private final long fileSize;

    public PrivateAssetDownload(Path path, String originalFilename, String contentType, long fileSize) {
        this.path = path;
        this.originalFilename = originalFilename;
        this.contentType = contentType;
        this.fileSize = fileSize;
    }

    public Path getPath() { return path; }
    public String getOriginalFilename() { return originalFilename; }
    public String getContentType() { return contentType; }
    public long getFileSize() { return fileSize; }
}
```

- [ ] **Step 5: 编译验证**

Run: `mvn test -pl java-ticket -DskipTests`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: compile succeeds.

---

### Task 3: PrivateAssetService TDD

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/PrivateAssetService.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/PrivateAssetServiceTest.java`

- [ ] **Step 1: 写失败测试**

Create `PrivateAssetServiceTest.java`:

```java
package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.entity.PrivateAsset;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.mapper.PrivateAssetMapper;
import com.omni.ticket.mapper.VenueApplicationMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PrivateAssetServiceTest {
    @Mock
    private PrivateAssetMapper privateAssetMapper;
    @Mock
    private VenueApplicationMapper venueApplicationMapper;
    @Mock
    private UserAccessService userAccessService;
    @TempDir
    Path tempDir;

    @Test
    void uploadVenueProofStoresPendingPrivateAsset() {
        PrivateAssetService service = new PrivateAssetService(privateAssetMapper, venueApplicationMapper, userAccessService, tempDir);
        MockMultipartFile file = new MockMultipartFile("file", "proof.pdf", "application/pdf", "hello".getBytes());

        PrivateAsset asset = service.upload(2003L, "venue-proof", file);

        assertEquals("venue-proof", asset.getBizType());
        assertEquals("pending", asset.getStatus());
        assertNull(asset.getBizId());
        assertEquals(2003L, asset.getUploaderId());
        assertTrue(asset.getRelativePath().startsWith("venue-proof/"));
        verify(privateAssetMapper).insert(any(PrivateAsset.class));
    }

    @Test
    void uploadRejectsUnsupportedType() {
        PrivateAssetService service = new PrivateAssetService(privateAssetMapper, venueApplicationMapper, userAccessService, tempDir);
        MockMultipartFile file = new MockMultipartFile("file", "proof.exe", "application/octet-stream", "bad".getBytes());

        BusinessException ex = assertThrows(BusinessException.class, () -> service.upload(2003L, "venue-proof", file));

        assertEquals(400, ex.getCode());
        verify(privateAssetMapper, never()).insert(any());
    }

    @Test
    void bindVenueProofRejectsOtherUploader() {
        PrivateAsset asset = pendingAsset(10L, 2004L);
        when(privateAssetMapper.selectById(10L)).thenReturn(asset);
        PrivateAssetService service = new PrivateAssetService(privateAssetMapper, venueApplicationMapper, userAccessService, tempDir);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.bindVenueProof(10L, 99L, 2003L));

        assertEquals(403, ex.getCode());
        verify(privateAssetMapper, never()).updateById(any());
    }

    @Test
    void bindVenueProofMarksAssetBound() {
        PrivateAsset asset = pendingAsset(10L, 2003L);
        when(privateAssetMapper.selectById(10L)).thenReturn(asset);
        PrivateAssetService service = new PrivateAssetService(privateAssetMapper, venueApplicationMapper, userAccessService, tempDir);

        PrivateAsset bound = service.bindVenueProof(10L, 99L, 2003L);

        assertEquals("bound", bound.getStatus());
        assertEquals(99L, bound.getBizId());
        assertNotNull(bound.getBindTime());
        verify(privateAssetMapper).updateById(asset);
    }

    @Test
    void downloadBoundVenueProofAllowsApplicant() {
        PrivateAsset asset = boundAsset(10L, 2003L, 99L);
        VenueApplication application = new VenueApplication();
        application.setId(99L);
        application.setApplicantId(2003L);
        when(privateAssetMapper.selectById(10L)).thenReturn(asset);
        when(venueApplicationMapper.selectById(99L)).thenReturn(application);
        when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");
        PrivateAssetService service = new PrivateAssetService(privateAssetMapper, venueApplicationMapper, userAccessService, tempDir);

        assertDoesNotThrow(() -> service.prepareDownload(10L, 2003L));
    }

    @Test
    void downloadBoundVenueProofRejectsOtherOrganizer() {
        PrivateAsset asset = boundAsset(10L, 2003L, 99L);
        VenueApplication application = new VenueApplication();
        application.setId(99L);
        application.setApplicantId(2003L);
        when(privateAssetMapper.selectById(10L)).thenReturn(asset);
        when(venueApplicationMapper.selectById(99L)).thenReturn(application);
        when(userAccessService.requireAdminOrOrganizerRole(2004L)).thenReturn("organizer");
        PrivateAssetService service = new PrivateAssetService(privateAssetMapper, venueApplicationMapper, userAccessService, tempDir);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.prepareDownload(10L, 2004L));

        assertEquals(403, ex.getCode());
    }

    private PrivateAsset pendingAsset(Long id, Long uploaderId) {
        PrivateAsset asset = new PrivateAsset();
        asset.setId(id);
        asset.setBizType("venue-proof");
        asset.setUploaderId(uploaderId);
        asset.setStatus("pending");
        asset.setOriginalFilename("proof.pdf");
        asset.setStoredFilename("proof.pdf");
        asset.setRelativePath("venue-proof/2026/05/proof.pdf");
        asset.setContentType("application/pdf");
        asset.setFileSize(5L);
        return asset;
    }

    private PrivateAsset boundAsset(Long id, Long uploaderId, Long bizId) {
        PrivateAsset asset = pendingAsset(id, uploaderId);
        asset.setStatus("bound");
        asset.setBizId(bizId);
        return asset;
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn test -pl java-ticket -Dtest=PrivateAssetServiceTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: compile fails because `PrivateAssetService` does not exist.

- [ ] **Step 3: 实现最小服务**

Create `PrivateAssetService.java`:

```java
package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.dto.PrivateAssetDownload;
import com.omni.ticket.entity.PrivateAsset;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.mapper.PrivateAssetMapper;
import com.omni.ticket.mapper.VenueApplicationMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class PrivateAssetService {
    public static final String BIZ_VENUE_PROOF = "venue-proof";
    private static final String STATUS_PENDING = "pending";
    private static final String STATUS_BOUND = "bound";
    private static final long MAX_SIZE = 20L * 1024L * 1024L;
    private static final Set<String> ALLOWED_TYPES = Set.of("application/pdf", "image/jpeg", "image/png", "image/webp");
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "jpg", "jpeg", "png", "webp");

    private final PrivateAssetMapper privateAssetMapper;
    private final VenueApplicationMapper venueApplicationMapper;
    private final UserAccessService userAccessService;
    private final Path rootDir;

    @Autowired
    public PrivateAssetService(PrivateAssetMapper privateAssetMapper,
                               VenueApplicationMapper venueApplicationMapper,
                               UserAccessService userAccessService,
                               @Value("${asset.private.ticket-root:}") String configuredRoot) {
        this(privateAssetMapper, venueApplicationMapper, userAccessService,
                configuredRoot == null || configuredRoot.isBlank()
                        ? Paths.get(System.getProperty("user.dir"), "..", "runtime", "private-uploads", "ticket").normalize()
                        : Paths.get(configuredRoot).normalize());
    }

    public PrivateAssetService(PrivateAssetMapper privateAssetMapper,
                               VenueApplicationMapper venueApplicationMapper,
                               UserAccessService userAccessService,
                               Path rootDir) {
        this.privateAssetMapper = privateAssetMapper;
        this.venueApplicationMapper = venueApplicationMapper;
        this.userAccessService = userAccessService;
        this.rootDir = rootDir;
    }

    public PrivateAsset upload(Long uploaderId, String bizType, MultipartFile file) {
        userAccessService.requireAdminOrOrganizer(uploaderId);
        validateUpload(bizType, file);
        LocalDateTime now = LocalDateTime.now();
        String extension = extension(file.getOriginalFilename());
        String storedName = UUID.randomUUID() + "." + extension;
        String monthPath = now.format(DateTimeFormatter.ofPattern("yyyy/MM"));
        String relativePath = bizType + "/" + monthPath + "/" + storedName;
        Path target = rootDir.resolve(relativePath).normalize();
        if (!target.startsWith(rootDir.normalize())) {
            throw new BusinessException(400, "附件路径不正确");
        }
        try {
            Files.createDirectories(target.getParent());
            file.transferTo(target);
        } catch (IOException e) {
            throw new BusinessException(500, "附件保存失败");
        }
        PrivateAsset asset = new PrivateAsset();
        asset.setServiceName("ticket");
        asset.setBizType(bizType);
        asset.setUploaderId(uploaderId);
        asset.setOriginalFilename(safeOriginalName(file.getOriginalFilename()));
        asset.setStoredFilename(storedName);
        asset.setRelativePath(relativePath.replace('\\', '/'));
        asset.setContentType(file.getContentType());
        asset.setFileSize(file.getSize());
        asset.setSha256(sha256(target));
        asset.setStatus(STATUS_PENDING);
        asset.setCreateTime(now);
        privateAssetMapper.insert(asset);
        return asset;
    }

    public PrivateAsset bindVenueProof(Long assetId, Long venueApplicationId, Long uploaderId) {
        PrivateAsset asset = requireAsset(assetId);
        if (!BIZ_VENUE_PROOF.equals(asset.getBizType())) {
            throw new BusinessException(400, "附件业务类型不正确");
        }
        if (!STATUS_PENDING.equals(asset.getStatus())) {
            throw new BusinessException(400, "附件已绑定或不可用");
        }
        if (!uploaderId.equals(asset.getUploaderId())) {
            throw new BusinessException(403, "不能绑定他人上传的附件");
        }
        asset.setBizId(venueApplicationId);
        asset.setStatus(STATUS_BOUND);
        asset.setBindTime(LocalDateTime.now());
        privateAssetMapper.updateById(asset);
        return asset;
    }

    public PrivateAsset getById(Long id) {
        return id == null ? null : privateAssetMapper.selectById(id);
    }

    public PrivateAssetDownload prepareDownload(Long assetId, Long operatorId) {
        PrivateAsset asset = requireAsset(assetId);
        if (asset.getDeletedAt() != null || "deleted".equals(asset.getStatus())) {
            throw new BusinessException(404, "附件不存在");
        }
        String role = userAccessService.requireAdminOrOrganizerRole(operatorId);
        if (role == null) {
            throw new BusinessException(403, "无权下载附件");
        }
        if (STATUS_PENDING.equals(asset.getStatus())) {
            if (!operatorId.equals(asset.getUploaderId())) {
                throw new BusinessException(403, "无权下载附件");
            }
        } else if (STATUS_BOUND.equals(asset.getStatus()) && BIZ_VENUE_PROOF.equals(asset.getBizType())) {
            if (!"admin".equals(role)) {
                VenueApplication application = venueApplicationMapper.selectById(asset.getBizId());
                if (application == null || !operatorId.equals(application.getApplicantId())) {
                    throw new BusinessException(403, "无权下载附件");
                }
            }
        } else {
            throw new BusinessException(403, "无权下载附件");
        }
        Path path = rootDir.resolve(asset.getRelativePath()).normalize();
        if (!path.startsWith(rootDir.normalize()) || !Files.exists(path)) {
            throw new BusinessException(404, "附件不存在");
        }
        return new PrivateAssetDownload(path, asset.getOriginalFilename(), asset.getContentType(), asset.getFileSize());
    }

    private PrivateAsset requireAsset(Long assetId) {
        if (assetId == null || assetId <= 0) {
            throw new BusinessException(400, "附件ID不正确");
        }
        PrivateAsset asset = privateAssetMapper.selectById(assetId);
        if (asset == null) {
            throw new BusinessException(404, "附件不存在");
        }
        return asset;
    }

    private void validateUpload(String bizType, MultipartFile file) {
        if (!BIZ_VENUE_PROOF.equals(bizType)) {
            throw new BusinessException(400, "附件业务类型不支持");
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException(400, "请选择附件");
        }
        if (file.getSize() > MAX_SIZE) {
            throw new BusinessException(400, "附件不能超过20MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new BusinessException(400, "附件类型不支持");
        }
        if (!ALLOWED_EXTENSIONS.contains(extension(file.getOriginalFilename()))) {
            throw new BusinessException(400, "附件扩展名不支持");
        }
    }

    private String extension(String filename) {
        String safe = safeOriginalName(filename).toLowerCase(Locale.ROOT);
        int dot = safe.lastIndexOf('.');
        return dot >= 0 ? safe.substring(dot + 1) : "";
    }

    private String safeOriginalName(String filename) {
        if (filename == null || filename.isBlank()) return "attachment";
        return Paths.get(filename).getFileName().toString();
    }

    private String sha256(Path path) {
        try (InputStream in = Files.newInputStream(path)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
            StringBuilder builder = new StringBuilder();
            for (byte b : digest.digest()) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (Exception e) {
            return null;
        }
    }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `mvn test -pl java-ticket -Dtest=PrivateAssetServiceTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: `Tests run: 6, Failures: 0, Errors: 0`.

---

### Task 4: VenueApplication 绑定私有附件

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueApplication.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationRequest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationServiceTest.java`

- [ ] **Step 1: 写失败测试**

If `VenueApplicationServiceTest.java` exists, add tests there. If it does not exist, create it with mocks for `VenueApplicationMapper`, `VenueMapper`, `UserAccessService`, `SeatCraftBlockLayoutService`, `VenueDefaultLayoutService`, and `PrivateAssetService`.

Add this test method:

```java
@Test
void submitBindsProofAssetAfterCreatingApplication() {
    VenueApplicationRequest request = validRequest();
    request.setProofFileUrl(null);
    request.setProofAssetId(10L);
    when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(new InternalUserRefResponse());
    doAnswer(invocation -> {
        VenueApplication application = invocation.getArgument(0);
        application.setId(99L);
        return 1;
    }).when(venueApplicationMapper).insert(any(VenueApplication.class));
    VenueApplicationService service = service();

    VenueApplication result = service.submit(request);

    assertEquals(99L, result.getId());
    assertEquals(10L, result.getProofAssetId());
    verify(privateAssetService).bindVenueProof(10L, 99L, 2003L);
}
```

Use this helper in the test class:

```java
private VenueApplicationRequest validRequest() {
    VenueApplicationRequest request = new VenueApplicationRequest();
    request.setUserId(2003L);
    request.setVenueName("测试场馆");
    request.setCity("杭州");
    request.setAddress("测试地址");
    request.setContactName("联系人");
    request.setContactPhone("13800000000");
    request.setValidFrom(LocalDateTime.now().plusDays(1));
    request.setValidTo(LocalDateTime.now().plusDays(2));
    request.setProofNote("已有审批说明");
    request.setLayoutSnapshot("{}");
    return request;
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn test -pl java-ticket -Dtest=VenueApplicationServiceTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: compile fails because `proofAssetId` and `PrivateAssetService` integration are missing.

- [ ] **Step 3: 增加字段和 DTO**

In `VenueApplication.java`, add field and accessors near `proofFileUrl`:

```java
private Long proofAssetId;

public Long getProofAssetId() { return proofAssetId; }
public void setProofAssetId(Long proofAssetId) { this.proofAssetId = proofAssetId; }
```

In `VenueApplicationRequest.java`, add:

```java
private Long proofAssetId;

public Long getProofAssetId() { return proofAssetId; }
public void setProofAssetId(Long proofAssetId) { this.proofAssetId = proofAssetId; }
```

In `VenueApplicationResponse.java`, add fields:

```java
private Long proofAssetId;
private PrivateAssetResponse proofAsset;
```

Set them in `from()`:

```java
response.setProofAssetId(application.getProofAssetId());
```

Add accessors:

```java
public Long getProofAssetId() { return proofAssetId; }
public void setProofAssetId(Long proofAssetId) { this.proofAssetId = proofAssetId; }
public PrivateAssetResponse getProofAsset() { return proofAsset; }
public void setProofAsset(PrivateAssetResponse proofAsset) { this.proofAsset = proofAsset; }
```

- [ ] **Step 4: 注入 PrivateAssetService 并绑定**

Modify `VenueApplicationService` constructors to include optional `PrivateAssetService privateAssetService`. Keep existing short constructor for tests by delegating with `null`.

Add field:

```java
private final PrivateAssetService privateAssetService;
```

In `submit()` immediately after this existing line:

```java
application.setProofFileUrl(trim(request.getProofFileUrl()));
```

add:

```java
application.setProofAssetId(request.getProofAssetId());
```

After `venueApplicationMapper.insert(application);`, add:

```java
if (request.getProofAssetId() != null && privateAssetService != null) {
    privateAssetService.bindVenueProof(request.getProofAssetId(), application.getId(), request.getUserId());
}
```

Update `validateUsageProof()` condition:

```java
if (trim(request.getProofNote()) == null && trim(request.getProofFileUrl()) == null && request.getProofAssetId() == null) {
    throw new BusinessException(400, "请填写场地审批凭证说明或上传附件");
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `mvn test -pl java-ticket -Dtest=VenueApplicationServiceTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: venue application service tests pass.

---

### Task 5: Controller 上传和下载接口

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`

- [ ] **Step 1: 写失败测试**

Add tests to `AdminControllerTest`:

```java
@Test
void uploadPrivateAssetRequiresAuthorization() throws Exception {
    AdminController controller = controller();
    MockMultipartFile file = new MockMultipartFile("file", "proof.pdf", "application/pdf", "hello".getBytes());

    Result<PrivateAssetResponse> result = controller.uploadPrivateAsset(null, 2003L, "venue-proof", file);

    assertEquals(401, result.getCode());
    verify(privateAssetService, never()).upload(any(), any(), any());
}

@Test
void uploadPrivateAssetUsesTokenOperator() throws Exception {
    AdminController controller = controller();
    MockMultipartFile file = new MockMultipartFile("file", "proof.pdf", "application/pdf", "hello".getBytes());
    PrivateAsset asset = new PrivateAsset();
    asset.setId(10L);
    asset.setBizType("venue-proof");
    asset.setOriginalFilename("proof.pdf");
    asset.setContentType("application/pdf");
    asset.setFileSize(5L);
    asset.setStatus("pending");
    when(privateAssetService.upload(eq(2003L), eq("venue-proof"), eq(file))).thenReturn(asset);

    Result<PrivateAssetResponse> result = controller.uploadPrivateAsset(
            "Bearer " + JwtUtil.generateToken(2003L, "13800000002", "organizer"), 9999L, "venue-proof", file);

    assertEquals(200, result.getCode());
    assertEquals(10L, result.getData().getId());
    verify(privateAssetService).upload(2003L, "venue-proof", file);
}
```

Add a mock field if missing:

```java
@Mock
private PrivateAssetService privateAssetService;
```

Update the `controller()` helper to pass `privateAssetService` into `AdminController`.

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn test -pl java-ticket -Dtest=AdminControllerTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: compile fails because Controller methods do not exist.

- [ ] **Step 3: 实现上传接口**

In `AdminController`, add imports:

```java
import com.omni.ticket.dto.PrivateAssetDownload;
import com.omni.ticket.dto.PrivateAssetResponse;
import com.omni.ticket.entity.PrivateAsset;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
```

Add field and constructor parameter:

```java
private final PrivateAssetService privateAssetService;
```

Add method:

```java
@PostMapping("/private-assets")
public Result<PrivateAssetResponse> uploadPrivateAsset(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                       @RequestParam Long userId,
                                                       @RequestParam String bizType,
                                                       @RequestParam("file") MultipartFile file) {
    Long operatorId = parseOperatorId(authorization);
    if (operatorId == null) {
        return Result.fail(ResultCode.UNAUTHORIZED);
    }
    PrivateAsset asset = privateAssetService.upload(operatorId, bizType, file);
    return Result.success(PrivateAssetResponse.from(asset));
}
```

The `userId` request param remains accepted for current frontend consistency, but token subject is authoritative.

- [ ] **Step 4: 实现下载接口**

Add method:

```java
@GetMapping("/private-assets/{id}/download")
public ResponseEntity<InputStreamResource> downloadPrivateAsset(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                               @PathVariable Long id) throws IOException {
    Long operatorId = parseOperatorId(authorization);
    if (operatorId == null) {
        return ResponseEntity.status(401).build();
    }
    PrivateAssetDownload download = privateAssetService.prepareDownload(id, operatorId);
    String encoded = URLEncoder.encode(download.getOriginalFilename(), StandardCharsets.UTF_8).replace("+", "%20");
    return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(download.getContentType()))
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
            .contentLength(download.getFileSize())
            .body(new InputStreamResource(Files.newInputStream(download.getPath())));
}
```

- [ ] **Step 5: 运行 Controller 测试**

Run: `mvn test -pl java-ticket -Dtest=AdminControllerTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: controller tests pass.

---

### Task 6: VenueApplicationResponse 附件元信息

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationResponse.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationServiceTest.java`

- [ ] **Step 1: 写失败测试**

Add a test that `listMine()` populates `proofAsset` when `proofAssetId` exists:

```java
@Test
void listMineIncludesProofAssetMetadata() {
    VenueApplication application = new VenueApplication();
    application.setId(99L);
    application.setApplicantId(2003L);
    application.setVenueName("测试场馆");
    application.setProofAssetId(10L);
    PrivateAsset asset = new PrivateAsset();
    asset.setId(10L);
    asset.setBizType("venue-proof");
    asset.setOriginalFilename("proof.pdf");
    asset.setContentType("application/pdf");
    asset.setFileSize(5L);
    asset.setStatus("bound");
    when(venueApplicationMapper.selectList(any())).thenReturn(List.of(application));
    when(privateAssetService.getById(10L)).thenReturn(asset);
    VenueApplicationService service = service();

    List<VenueApplicationResponse> result = service.listMine(2003L);

    assertEquals(10L, result.get(0).getProofAsset().getId());
    assertEquals("proof.pdf", result.get(0).getProofAsset().getOriginalFilename());
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn test -pl java-ticket -Dtest=VenueApplicationServiceTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: fails because `proofAsset` is not populated.

- [ ] **Step 3: 增加响应装配方法**

In `VenueApplicationService`, add:

```java
private VenueApplicationResponse toResponse(VenueApplication application) {
    VenueApplicationResponse response = VenueApplicationResponse.from(application);
    if (application.getProofAssetId() != null && privateAssetService != null) {
        response.setProofAsset(PrivateAssetResponse.from(privateAssetService.getById(application.getProofAssetId())));
    }
    return response;
}
```

Update `listMine()` and `listAdmin()` mapping:

```java
.stream().map(this::toResponse).collect(Collectors.toList());
```

Do not add a separate submit response method in this task. Keep `submit()` returning `VenueApplication`, and keep the existing Controller response conversion unchanged.

- [ ] **Step 4: 运行测试确认通过**

Run: `mvn test -pl java-ticket -Dtest=VenueApplicationServiceTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: tests pass.

---

### Task 7: 前端 API 类型和私有上传控件

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/components/PrivateFileUpload.tsx`

- [ ] **Step 1: 增加类型**

In `frontend/src/types/api.ts`, add near `VenueApplicationVO`:

```ts
export interface PrivateAssetVO {
  id: number
  bizType: string
  bizId?: number | null
  originalFilename: string
  contentType: string
  fileSize: number
  status: 'pending' | 'bound' | 'deleted' | string
  createTime?: string | null
}
```

Extend `VenueApplicationVO`:

```ts
proofAssetId?: number | null
proofAsset?: PrivateAssetVO | null
```

- [ ] **Step 2: 增加 API 函数**

In `frontend/src/lib/api.ts`, add:

```ts
export async function uploadPrivateAsset(params: { userId: number; bizType: string; file: File }) {
  assertPositiveInteger(params.userId, 'userId')
  if (!params.bizType.trim()) throw new Error('bizType 不能为空')
  const formData = new FormData()
  formData.append('userId', String(params.userId))
  formData.append('bizType', params.bizType)
  formData.append('file', params.file)
  return request<import('@/types/api').PrivateAssetVO>('/api/ticket/admin/private-assets', {
    method: 'POST',
    body: formData,
  })
}

export function privateAssetDownloadUrl(id: number) {
  assertPositiveInteger(id, 'assetId')
  return `/api/ticket/admin/private-assets/${id}/download`
}
```

- [ ] **Step 3: 创建私有上传控件**

Create `frontend/src/components/PrivateFileUpload.tsx`:

```tsx
'use client'

import { useRef, useState } from 'react'
import type { PrivateAssetVO } from '@/types/api'

export function PrivateFileUpload({
  label,
  value,
  accept,
  uploading,
  onUpload,
  onChange,
  hint,
}: {
  label: string
  value: PrivateAssetVO | null
  accept: string
  uploading?: boolean
  onUpload: (file: File) => Promise<PrivateAssetVO>
  onChange: (asset: PrivateAssetVO | null) => void
  hint?: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const disabled = busy || uploading

  const chooseFile = async (file: File | undefined) => {
    if (!file || disabled) return
    setBusy(true)
    setError('')
    try {
      const asset = await onUpload(file)
      onChange(asset)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
      <div className="mb-2 text-[13px] font-medium text-[#333]">{label}</div>
      {value ? (
        <div className="mb-3 rounded-lg bg-[#f8fafc] p-3 text-[13px] text-[#555]">
          <div className="font-medium text-[#333]">{value.originalFilename}</div>
          <div className="mt-1 text-[#999]">{formatSize(value.fileSize)} · {value.contentType}</div>
        </div>
      ) : (
        <div className="mb-3 rounded-lg bg-[#fafafa] p-3 text-[13px] text-[#999]">尚未上传附件</div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="rounded-lg bg-[#ff1268] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">
          {busy ? '上传中' : '选择并上传'}
        </button>
        {value && <button type="button" disabled={disabled} onClick={() => onChange(null)} className="rounded-lg border border-[#ddd] px-4 py-2 text-[13px] text-[#666] disabled:opacity-50">移除</button>}
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={event => chooseFile(event.target.files?.[0])} />
      {hint && <div className="mt-2 text-[12px] text-[#999]">{hint}</div>}
      {error && <div className="mt-2 text-[12px] text-[#dc2626]">{error}</div>}
    </div>
  )
}

function formatSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}
```

- [ ] **Step 4: 运行类型检查**

Run: `pnpm typecheck`

Workdir: `C:\Users\Administrator\Desktop\omni\frontend`

Expected: typecheck passes.

---

### Task 8: 前端场地申请上传接入

**Files:**
- Modify: `frontend/src/app/console/venue/apply/page.tsx`

- [ ] **Step 1: 修改 imports 和 state**

Update imports:

```ts
import { listMyVenueApplications, submitVenueApplication, uploadPrivateAsset } from '@/lib/api'
import { PrivateFileUpload } from '@/components/PrivateFileUpload'
import type { PrivateAssetVO, VenueApplicationVO } from '@/types/api'
```

Add state:

```ts
const [proofAsset, setProofAsset] = useState<PrivateAssetVO | null>(null)
```

Remove `proofFileUrl` from the initial form state for new submissions, or keep it as `proofFileUrl: ''` but do not render a manual input.

- [ ] **Step 2: 更新校验和提交参数**

Change validation:

```ts
if (!form.proofNote.trim() && !proofAsset) return '请填写场地审批凭证说明或上传附件'
```

Change submit body:

```ts
await submitVenueApplication({
  userId,
  venueName: form.venueName,
  city: form.city,
  address: form.address,
  contactName: form.contactName,
  contactPhone: form.contactPhone,
  qualificationNo: form.qualificationNo,
  businessScope: form.businessScope,
  description: form.description,
  validFrom: form.validFrom,
  validTo: form.validTo,
  proofNote: form.proofNote,
  proofFileUrl: null,
  proofAssetId: proofAsset?.id ?? null,
  capacity: form.capacity ? Number(form.capacity) : null,
  layout: layoutPayload,
})
```

After successful submit, reset:

```ts
setProofAsset(null)
```

- [ ] **Step 3: 替换附件输入 UI**

Replace the `proofFileUrl` input with:

```tsx
<div className="lg:col-span-2">
  <PrivateFileUpload
    label="场地审批凭证附件"
    value={proofAsset}
    accept="application/pdf,image/jpeg,image/png,image/webp"
    uploading={submitting}
    onUpload={async (file) => uploadPrivateAsset({ userId, bizType: 'venue-proof', file })}
    onChange={setProofAsset}
    hint="支持 PDF、JPG、PNG、WEBP，单文件不超过 20MB。附件不会公开访问。"
  />
</div>
```

- [ ] **Step 4: 运行类型检查**

Run: `pnpm typecheck`

Workdir: `C:\Users\Administrator\Desktop\omni\frontend`

Expected: typecheck passes.

---

### Task 9: 前端审核页下载接入

**Files:**
- Modify: `frontend/src/app/console/venue/applications/page.tsx`

- [ ] **Step 1: 增加 API import**

Update import:

```ts
import { listAdminVenues, listVenueApplications, privateAssetDownloadUrl, reviewVenueApplication } from '@/lib/api'
```

- [ ] **Step 2: 增加下载函数**

Inside component, add:

```ts
const downloadProofAsset = (assetId: number) => {
  window.open(privateAssetDownloadUrl(assetId), '_blank', 'noopener,noreferrer')
}
```

- [ ] **Step 3: 展示附件信息和下载按钮**

In each application card, after proof note/review note area, add:

```tsx
{item.proofAsset && (
  <div className="mt-3 rounded-lg bg-[#f8fafc] p-3 text-[13px] text-[#555]">
    <div className="font-medium text-[#333]">凭证附件：{item.proofAsset.originalFilename}</div>
    <div className="mt-1 text-[#999]">{formatSize(item.proofAsset.fileSize)} · {item.proofAsset.contentType}</div>
    <button type="button" onClick={() => downloadProofAsset(item.proofAsset!.id)} className="mt-2 rounded-lg border border-[#ddd] px-3 py-1.5 text-[12px] text-[#333] hover:border-[#ff1268] hover:text-[#ff1268]">下载凭证</button>
  </div>
)}
{!item.proofAsset && item.proofFileUrl && (
  <div className="mt-3 text-[13px] text-[#999]">历史附件链接：{item.proofFileUrl}</div>
)}
```

Add helper at file bottom:

```ts
function formatSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}
```

- [ ] **Step 4: 运行类型检查**

Run: `pnpm typecheck`

Workdir: `C:\Users\Administrator\Desktop\omni\frontend`

Expected: typecheck passes.

---

### Task 10: 全量目标验证

**Files:**
- All files touched by Tasks 1-9.

- [ ] **Step 1: 运行后端单测**

Run: `mvn test -pl java-ticket "-Dtest=PrivateAssetServiceTest,VenueApplicationServiceTest,AdminControllerTest"`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: all listed tests pass.

- [ ] **Step 2: 运行前端类型检查**

Run: `pnpm typecheck`

Workdir: `C:\Users\Administrator\Desktop\omni\frontend`

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 3: 运行边界验证**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`

Workdir: `C:\Users\Administrator\Desktop\omni`

Expected: script exits 0.

- [ ] **Step 4: 限定文件空白检查**

Run `git diff --check` with exactly the files touched by this plan. Include:

```powershell
git diff --check -- `
  "docs/superpowers/specs/2026-05-23-private-venue-proof-asset-design.md" `
  "docs/superpowers/plans/2026-05-23-private-venue-proof-asset.md" `
  "sql/production-split/ticket/20260523_private_asset.sql" `
  "sql/migrations/shared/20260523_private_asset.sql" `
  "sql/production-split/manifest.json" `
  "java/java-ticket/src/main/java/com/omni/ticket/entity/PrivateAsset.java" `
  "java/java-ticket/src/main/java/com/omni/ticket/mapper/PrivateAssetMapper.java" `
  "java/java-ticket/src/main/java/com/omni/ticket/dto/PrivateAssetResponse.java" `
  "java/java-ticket/src/main/java/com/omni/ticket/dto/PrivateAssetDownload.java" `
  "java/java-ticket/src/main/java/com/omni/ticket/service/PrivateAssetService.java" `
  "java/java-ticket/src/main/java/com/omni/ticket/entity/VenueApplication.java" `
  "java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationRequest.java" `
  "java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationResponse.java" `
  "java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java" `
  "java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java" `
  "java/java-ticket/src/test/java/com/omni/ticket/service/PrivateAssetServiceTest.java" `
  "java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationServiceTest.java" `
  "java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java" `
  "frontend/src/types/api.ts" `
  "frontend/src/lib/api.ts" `
  "frontend/src/components/PrivateFileUpload.tsx" `
  "frontend/src/app/console/venue/apply/page.tsx" `
  "frontend/src/app/console/venue/applications/page.tsx"
```

Workdir: `C:\Users\Administrator\Desktop\omni`

Expected: no trailing whitespace errors. LF/CRLF warnings are acceptable.

---

## Self-Review

- Spec coverage: 覆盖私有目录、非静态映射、`private_asset` 表、`proof_asset_id`、上传接口、下载接口、业务绑定鉴权、前端创建/审核入口、测试和边界验证。
- Placeholder scan: 未使用占位描述。
- Type consistency: 后端使用 `PrivateAsset` / `PrivateAssetResponse` / `proofAssetId`；前端使用 `PrivateAssetVO` / `proofAssetId` / `proofAsset`，命名保持一致。
- Scope check: 不新增独立服务，不改公开 `/uploads/ticket/**`，不触碰 SeatCraft/座位设计器文件。
