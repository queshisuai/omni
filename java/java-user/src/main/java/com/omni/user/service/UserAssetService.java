package com.omni.user.service;

import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.AssetUploadResponse;
import com.omni.user.dto.UserInfoResponse;
import com.omni.user.entity.User;
import com.omni.user.entity.UserAsset;
import com.omni.user.mapper.UserAssetMapper;
import com.omni.user.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class UserAssetService {

    private static final long MAX_AVATAR_BYTES = 2L * 1024L * 1024L;
    private static final String BIZ_TYPE_AVATAR = "avatar";
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");

    private final UserAssetMapper userAssetMapper;
    private final UserMapper userMapper;
    private final Path uploadRoot;

    public UserAssetService(UserAssetMapper userAssetMapper,
                            UserMapper userMapper,
                            @Value("${omni.upload.root:${OMNI_UPLOAD_ROOT:}}") String uploadRoot) {
        this.userAssetMapper = userAssetMapper;
        this.userMapper = userMapper;
        this.uploadRoot = resolveUploadRoot(uploadRoot);
    }

    public UserInfoResponse uploadAvatar(Long userId, MultipartFile file) {
        if (userId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户ID不能为空");
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "上传文件不能为空");
        }
        String contentType = file.getContentType();
        if (!ALLOWED_IMAGE_TYPES.contains(contentType)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "仅支持上传 JPG、PNG、WEBP 或 GIF 图片");
        }
        if (file.getSize() > MAX_AVATAR_BYTES) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "头像图片不能超过2MB");
        }

        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }

        LocalDate now = LocalDate.now();
        String extension = extensionFor(contentType);
        String storedName = UUID.randomUUID() + "." + extension;
        String relativePath = String.format(Locale.ROOT, "user/avatar/%04d/%02d/%s", now.getYear(), now.getMonthValue(), storedName);
        Path target = uploadRoot.resolve(relativePath).normalize();

        byte[] bytes = readBytes(file);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
        } catch (IOException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "头像文件保存失败");
        }

        String publicUrl = "/uploads/" + relativePath.replace('\\', '/');
        UserAsset asset = new UserAsset();
        asset.setUploaderId(userId);
        asset.setBizType(BIZ_TYPE_AVATAR);
        asset.setOriginalName(file.getOriginalFilename());
        asset.setStoredName(storedName);
        asset.setRelativePath(relativePath.replace('\\', '/'));
        asset.setPublicUrl(publicUrl);
        asset.setMimeType(contentType);
        asset.setSizeBytes(file.getSize());
        asset.setSha256(sha256(bytes));
        asset.setStatus(1);
        userAssetMapper.insert(asset);

        user.setAvatar(publicUrl);
        userMapper.updateById(user);
        return toUserInfoResponse(user);
    }

    AssetUploadResponse toAssetUploadResponse(UserAsset asset) {
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

    private byte[] readBytes(MultipartFile file) {
        try (InputStream inputStream = file.getInputStream()) {
            return inputStream.readAllBytes();
        } catch (IOException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "上传文件读取失败");
        }
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
        return "gif";
    }

    private String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte value : hash) {
                builder.append(String.format("%02x", value));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "文件摘要计算失败");
        }
    }

    private UserInfoResponse toUserInfoResponse(User user) {
        UserInfoResponse response = new UserInfoResponse();
        response.setId(user.getId());
        response.setPhone(user.getPhone());
        response.setNickname(user.getNickname());
        response.setEmail(user.getEmail());
        response.setAvatar(user.getAvatar());
        response.setStatus(user.getStatus());
        response.setRole(user.getRole());
        response.setOrganizerStatus(user.getOrganizerStatus());
        response.setOrganizerName(user.getOrganizerName());
        response.setCreateTime(user.getCreateTime());
        response.setUpdateTime(user.getUpdateTime());
        return response;
    }
}
