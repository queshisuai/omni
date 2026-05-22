package com.omni.ticket.service;

import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.AssetUploadResponse;
import com.omni.ticket.entity.TicketAsset;
import com.omni.ticket.mapper.TicketAssetMapper;
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
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class TicketAssetService {

    private static final long MAX_IMAGE_BYTES = 5L * 1024L * 1024L;
    private static final long MAX_PROOF_BYTES = 10L * 1024L * 1024L;
    private static final String BIZ_TYPE_VENUE_PROOF = "venue-proof";
    private static final Set<String> ALLOWED_BIZ_TYPES = Set.of(
            "activity-poster", "tour-poster", "station-poster", "artist-avatar", BIZ_TYPE_VENUE_PROOF);
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");

    private final TicketAssetMapper ticketAssetMapper;
    private final Path uploadRoot;

    public TicketAssetService(TicketAssetMapper ticketAssetMapper,
                              @Value("${omni.upload.root:${OMNI_UPLOAD_ROOT:}}") String uploadRoot) {
        this.ticketAssetMapper = ticketAssetMapper;
        this.uploadRoot = resolveUploadRoot(uploadRoot);
    }

    @Transactional
    public AssetUploadResponse upload(Long userId, String bizType, MultipartFile file) {
        if (userId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户ID不能为空");
        }
        if (!ALLOWED_BIZ_TYPES.contains(bizType)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "不支持的资产类型");
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "上传文件不能为空");
        }
        String contentType = file.getContentType();
        boolean proof = BIZ_TYPE_VENUE_PROOF.equals(bizType);
        validateFileTypeAndSize(proof, contentType, file);

        LocalDate now = LocalDate.now();
        String extension = extensionFor(contentType);
        String storedName = UUID.randomUUID() + "." + extension;
        String relativePath = String.format(Locale.ROOT, "ticket/%s/%04d/%02d/%s", bizType, now.getYear(), now.getMonthValue(), storedName);
        Path target = uploadRoot.resolve(relativePath).normalize();

        String sha256;
        try {
            Files.createDirectories(target.getParent());
            sha256 = saveFileAndSha256(file, target);
        } catch (IOException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "资产文件保存失败");
        }

        String publicUrl = "/uploads/" + relativePath.replace('\\', '/');
        try {
            TicketAsset asset = new TicketAsset();
            asset.setUploaderId(userId);
            asset.setBizType(bizType);
            asset.setOriginalName(file.getOriginalFilename());
            asset.setStoredName(storedName);
            asset.setRelativePath(relativePath.replace('\\', '/'));
            asset.setPublicUrl(publicUrl);
            asset.setMimeType(contentType);
            asset.setSizeBytes(file.getSize());
            asset.setSha256(sha256);
            asset.setStatus(1);
            ticketAssetMapper.insert(asset);
            return toAssetUploadResponse(asset);
        } catch (RuntimeException e) {
            deleteQuietly(target);
            throw e;
        }
    }

    private void validateFileTypeAndSize(boolean proof, String contentType, MultipartFile file) {
        boolean image = ALLOWED_IMAGE_TYPES.contains(contentType);
        boolean pdf = "application/pdf".equals(contentType);
        if (!proof && !image) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "该资产类型仅支持 JPG、PNG、WEBP 或 GIF 图片");
        }
        if (proof && !image && !pdf) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场馆证明仅支持 JPG、PNG、WEBP、GIF 图片或 PDF");
        }
        long maxSize = proof ? MAX_PROOF_BYTES : MAX_IMAGE_BYTES;
        if (file.getSize() > maxSize) {
            throw new BusinessException(ResultCode.BAD_REQUEST, proof ? "场馆证明文件不能超过10MB" : "图片文件不能超过5MB");
        }
        if (image) {
            validateImageMagic(contentType, file);
        } else {
            validatePdfMagic(file);
        }
    }

    private AssetUploadResponse toAssetUploadResponse(TicketAsset asset) {
        AssetUploadResponse response = new AssetUploadResponse();
        response.setId(asset.getId());
        response.setBizType(asset.getBizType());
        response.setPublicUrl(asset.getPublicUrl());
        response.setOriginalName(asset.getOriginalName());
        response.setMimeType(asset.getMimeType());
        response.setSizeBytes(asset.getSizeBytes());
        return response;
    }

    private Path resolveUploadRoot(String configuredRoot) {
        if (StringUtils.hasText(configuredRoot)) {
            return Paths.get(configuredRoot).toAbsolutePath().normalize();
        }
        return Paths.get(System.getProperty("user.dir"), "..", "runtime", "uploads")
                .toAbsolutePath()
                .normalize();
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

    private void validateImageMagic(String contentType, MultipartFile file) {
        byte[] header = readHeader(file);
        boolean valid;
        if ("image/jpeg".equals(contentType)) {
            valid = startsWith(header, new int[] {0xff, 0xd8, 0xff});
        } else if ("image/png".equals(contentType)) {
            valid = startsWith(header, new int[] {0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a});
        } else if ("image/gif".equals(contentType)) {
            valid = startsWith(header, new int[] {'G', 'I', 'F', '8', '7', 'a'})
                    || startsWith(header, new int[] {'G', 'I', 'F', '8', '9', 'a'});
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

    private void validatePdfMagic(MultipartFile file) {
        if (!startsWith(readHeader(file), new int[] {'%', 'P', 'D', 'F', '-'})) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "文件内容不是有效PDF");
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
        try (InputStream inputStream = file.getInputStream();
             OutputStream outputStream = Files.newOutputStream(target, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, read);
                digest.update(buffer, 0, read);
            }
        }
        return hex(digest.digest());
    }

    private String extensionFor(String contentType) {
        if ("image/jpeg".equals(contentType)) {
            return "jpg";
        }
        if ("image/png".equals(contentType)) {
            return "png";
        }
        if ("image/webp".equals(contentType)) {
            return "webp";
        }
        if ("image/gif".equals(contentType)) {
            return "gif";
        }
        return "pdf";
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
