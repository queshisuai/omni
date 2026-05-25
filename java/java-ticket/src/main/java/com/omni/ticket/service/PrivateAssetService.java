package com.omni.ticket.service;

import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.dto.PrivateAssetDownload;
import com.omni.ticket.dto.PrivateAssetResponse;
import com.omni.ticket.entity.PrivateAsset;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.mapper.PrivateAssetMapper;
import com.omni.ticket.mapper.VenueApplicationMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class PrivateAssetService {

    private static final String SERVICE_NAME = "ticket";
    private static final String BIZ_TYPE_VENUE_PROOF = "venue-proof";
    private static final String STATUS_PENDING = "pending";
    private static final String STATUS_BOUND = "bound";
    private static final long MAX_FILE_BYTES = 20L * 1024L * 1024L;
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "application/pdf", "image/jpeg", "image/png", "image/webp");

    private final PrivateAssetMapper privateAssetMapper;
    private final VenueApplicationMapper venueApplicationMapper;
    private final UserAccessService userAccessService;
    private final Path privateRoot;

    public PrivateAssetService(PrivateAssetMapper privateAssetMapper,
                               VenueApplicationMapper venueApplicationMapper,
                               UserAccessService userAccessService,
                               @Value("${omni.private-asset.root:${OMNI_PRIVATE_ASSET_ROOT:}}") String privateRoot) {
        this.privateAssetMapper = privateAssetMapper;
        this.venueApplicationMapper = venueApplicationMapper;
        this.userAccessService = userAccessService;
        this.privateRoot = resolvePrivateRoot(privateRoot);
    }

    @Transactional
    public PrivateAssetResponse upload(Long uploaderId, String bizType, MultipartFile file) {
        if (!BIZ_TYPE_VENUE_PROOF.equals(bizType)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "不支持的私有资产类型");
        }
        userAccessService.requireAdminOrOrganizer(uploaderId);
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "上传文件不能为空");
        }
        validateFile(file);

        LocalDate now = LocalDate.now();
        String contentType = file.getContentType();
        String storedName = UUID.randomUUID() + "." + extensionFor(contentType);
        String relativePath = String.format(Locale.ROOT, "%s/%04d/%02d/%s",
                bizType, now.getYear(), now.getMonthValue(), storedName);
        Path target = privateRoot.resolve(relativePath).normalize();
        assertInsidePrivateRoot(target);

        String sha256;
        try {
            Files.createDirectories(target.getParent());
            sha256 = saveFileAndSha256(file, target);
        } catch (IOException e) {
            deleteQuietly(target);
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "私有资产文件保存失败");
        } catch (RuntimeException e) {
            deleteQuietly(target);
            throw e;
        }

        try {
            PrivateAsset asset = new PrivateAsset();
            asset.setServiceName(SERVICE_NAME);
            asset.setBizType(bizType);
            asset.setUploaderId(uploaderId);
            asset.setOriginalFilename(file.getOriginalFilename());
            asset.setStoredFilename(storedName);
            asset.setRelativePath(relativePath.replace('\\', '/'));
            asset.setContentType(contentType);
            asset.setFileSize(file.getSize());
            asset.setSha256(sha256);
            asset.setStatus(STATUS_PENDING);
            asset.setCreateTime(LocalDateTime.now());
            privateAssetMapper.insert(asset);
            return PrivateAssetResponse.from(asset);
        } catch (RuntimeException e) {
            deleteQuietly(target);
            throw e;
        }
    }

    @Transactional
    public PrivateAssetResponse bindVenueProof(Long assetId, Long venueApplicationId, Long userId) {
        userAccessService.requireAdminOrOrganizer(userId);
        if (venueApplicationId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场地申请ID不能为空");
        }
        PrivateAsset asset = requireAsset(assetId);
        if (!BIZ_TYPE_VENUE_PROOF.equals(asset.getBizType())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "不支持的私有资产类型");
        }
        if (!STATUS_PENDING.equals(asset.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "私有资产状态不正确");
        }
        if (!userId.equals(asset.getUploaderId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权绑定该私有资产");
        }

        asset.setBizId(venueApplicationId);
        asset.setStatus(STATUS_BOUND);
        asset.setBindTime(LocalDateTime.now());
        privateAssetMapper.updateById(asset);
        return PrivateAssetResponse.from(asset);
    }

    public PrivateAssetResponse getById(Long assetId) {
        return PrivateAssetResponse.from(requireAsset(assetId));
    }

    public PrivateAssetDownload prepareDownload(Long assetId, Long userId) {
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(userId);
        PrivateAsset asset = requireAsset(assetId);
        verifyDownloadPermission(asset, user);
        Path path = privateRoot.resolve(asset.getRelativePath()).normalize();
        assertInsidePrivateRoot(path);
        if (!Files.exists(path) || !Files.isRegularFile(path)) {
            throw new BusinessException(ResultCode.NOT_FOUND, "私有资产文件不存在");
        }
        return new PrivateAssetDownload(path, asset.getOriginalFilename(), asset.getContentType(), asset.getFileSize());
    }

    private void validateFile(MultipartFile file) {
        String contentType = file.getContentType();
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场地证明仅支持 PDF、JPG、PNG 或 WEBP 文件");
        }
        validateExtension(file.getOriginalFilename(), contentType);
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场地证明文件不能超过20MB");
        }
        if ("application/pdf".equals(contentType)) {
            validatePdfMagic(file);
        } else {
            validateImageMagic(contentType, file);
        }
    }

    private void verifyDownloadPermission(PrivateAsset asset, InternalUserRefResponse user) {
        if (!BIZ_TYPE_VENUE_PROOF.equals(asset.getBizType())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权下载该私有资产");
        }
        if (STATUS_PENDING.equals(asset.getStatus())) {
            if (asset.getUploaderId().equals(user.getId())) {
                return;
            }
            throw new BusinessException(ResultCode.FORBIDDEN, "无权下载该私有资产");
        }
        if (STATUS_BOUND.equals(asset.getStatus())) {
            if ("admin".equals(user.getRole())) {
                return;
            }
            VenueApplication application = requireVenueApplication(asset.getBizId());
            if (user.getId().equals(application.getApplicantId())) {
                return;
            }
            throw new BusinessException(ResultCode.FORBIDDEN, "无权下载该私有资产");
        }
        throw new BusinessException(ResultCode.FORBIDDEN, "无权下载该私有资产");
    }

    private PrivateAsset requireAsset(Long assetId) {
        if (assetId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "私有资产ID不能为空");
        }
        PrivateAsset asset = privateAssetMapper.selectById(assetId);
        if (asset == null || asset.getDeletedAt() != null || "deleted".equals(asset.getStatus())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "私有资产不存在");
        }
        return asset;
    }

    private VenueApplication requireVenueApplication(Long applicationId) {
        if (applicationId == null) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权下载该私有资产");
        }
        VenueApplication application = venueApplicationMapper.selectById(applicationId);
        if (application == null) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权下载该私有资产");
        }
        return application;
    }

    private Path resolvePrivateRoot(String configuredRoot) {
        if (StringUtils.hasText(configuredRoot)) {
            return Paths.get(configuredRoot).toAbsolutePath().normalize();
        }
        return Paths.get(System.getProperty("user.dir"), "..", "runtime", "private-uploads", "ticket")
                .toAbsolutePath()
                .normalize();
    }

    private void assertInsidePrivateRoot(Path path) {
        if (!path.normalize().startsWith(privateRoot.normalize())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "私有资产路径不合法");
        }
    }

    private void validateExtension(String originalFilename, String contentType) {
        if (!StringUtils.hasText(originalFilename)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场地证明仅支持 PDF、JPG、PNG 或 WEBP 文件");
        }
        String lowerName = originalFilename.toLowerCase(Locale.ROOT);
        int dot = lowerName.lastIndexOf('.');
        if (dot < 0 || dot == lowerName.length() - 1) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场地证明仅支持 PDF、JPG、PNG 或 WEBP 文件");
        }
        String extension = lowerName.substring(dot + 1);
        boolean valid = ("application/pdf".equals(contentType) && "pdf".equals(extension))
                || ("image/jpeg".equals(contentType) && ("jpg".equals(extension) || "jpeg".equals(extension)))
                || ("image/png".equals(contentType) && "png".equals(extension))
                || ("image/webp".equals(contentType) && "webp".equals(extension));
        if (!valid) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场地证明仅支持 PDF、JPG、PNG 或 WEBP 文件");
        }
    }

    private void validatePdfMagic(MultipartFile file) {
        if (!startsWith(readHeader(file), new int[] {'%', 'P', 'D', 'F'})) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "文件内容不是有效PDF");
        }
    }

    private void validateImageMagic(String contentType, MultipartFile file) {
        byte[] header = readHeader(file);
        boolean valid;
        if ("image/jpeg".equals(contentType)) {
            valid = startsWith(header, new int[] {0xff, 0xd8, 0xff});
        } else if ("image/png".equals(contentType)) {
            valid = startsWith(header, new int[] {0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a});
        } else {
            valid = startsWith(header, new int[] {'R', 'I', 'F', 'F'})
                    && header.length >= 12
                    && header[8] == 'W'
                    && header[9] == 'E'
                    && header[10] == 'B'
                    && header[11] == 'P';
        }
        if (!valid) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "文件内容不是有效图片");
        }
    }

    private byte[] readHeader(MultipartFile file) {
        byte[] header = new byte[12];
        try (InputStream inputStream = file.getInputStream()) {
            int offset = 0;
            while (offset < header.length) {
                int read = inputStream.read(header, offset, header.length - offset);
                if (read == -1) {
                    break;
                }
                offset += read;
            }
            if (offset == header.length) {
                return header;
            }
            byte[] actual = new byte[offset];
            System.arraycopy(header, 0, actual, 0, offset);
            return actual;
        } catch (IOException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "上传文件读取失败");
        }
    }

    private boolean startsWith(byte[] bytes, int[] expected) {
        if (bytes.length < expected.length) {
            return false;
        }
        for (int i = 0; i < expected.length; i++) {
            if ((bytes[i] & 0xff) != expected[i]) {
                return false;
            }
        }
        return true;
    }

    private String saveFileAndSha256(MultipartFile file, Path target) throws IOException {
        MessageDigest digest = newSha256Digest();
        byte[] buffer = new byte[8192];
        long total = 0L;
        try (InputStream inputStream = file.getInputStream();
             OutputStream outputStream = Files.newOutputStream(target, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                total += read;
                if (total > MAX_FILE_BYTES) {
                    throw new BusinessException(ResultCode.BAD_REQUEST, "场地证明文件不能超过20MB");
                }
                outputStream.write(buffer, 0, read);
                digest.update(buffer, 0, read);
            }
        }
        return hex(digest.digest());
    }

    private String extensionFor(String contentType) {
        if ("application/pdf".equals(contentType)) {
            return "pdf";
        }
        if ("image/jpeg".equals(contentType)) {
            return "jpg";
        }
        if ("image/png".equals(contentType)) {
            return "png";
        }
        if ("image/webp".equals(contentType)) {
            return "webp";
        }
        throw new BusinessException(ResultCode.BAD_REQUEST, "场地证明仅支持 PDF、JPG、PNG 或 WEBP 文件");
    }

    private MessageDigest newSha256Digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "文件摘要计算失败");
        }
    }

    private String hex(byte[] hash) {
        StringBuilder builder = new StringBuilder(hash.length * 2);
        for (byte value : hash) {
            builder.append(String.format("%02x", value));
        }
        return builder.toString();
    }

    private void deleteQuietly(Path target) {
        try {
            Files.deleteIfExists(target);
        } catch (IOException ignored) {
        }
    }
}
