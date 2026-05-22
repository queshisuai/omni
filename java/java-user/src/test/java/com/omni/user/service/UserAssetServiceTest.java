package com.omni.user.service;

import com.omni.exception.BusinessException;
import com.omni.user.dto.UserInfoResponse;
import com.omni.user.entity.User;
import com.omni.user.entity.UserAsset;
import com.omni.user.mapper.UserAssetMapper;
import com.omni.user.mapper.UserMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserAssetServiceTest {

    private static final Long USER_ID = 2004L;

    private final UserAssetMapper userAssetMapper = mock(UserAssetMapper.class);
    private final UserMapper userMapper = mock(UserMapper.class);

    @Test
    void uploadAvatarStoresImageAndUpdatesUserAvatar() throws Exception {
        Path uploadRoot = Files.createTempDirectory("omni-user-avatar-test");
        User user = userWithAvatar(null);
        when(userMapper.selectById(USER_ID)).thenReturn(user);
        when(userAssetMapper.insert(any(UserAsset.class))).thenAnswer(invocation -> {
            UserAsset asset = invocation.getArgument(0);
            asset.setId(9001L);
            return 1;
        });

        UserAssetService service = new UserAssetService(userAssetMapper, userMapper, uploadRoot.toString());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.png",
                "image/png",
                new byte[] {1, 2, 3, 4}
        );

        UserInfoResponse response = service.uploadAvatar(USER_ID, file);

        assertNotNull(response.getAvatar());
        assertTrue(response.getAvatar().startsWith("/uploads/user/avatar/"));
        assertTrue(response.getAvatar().endsWith(".png"));
        assertEquals(response.getAvatar(), user.getAvatar());
        assertTrue(Files.exists(uploadRoot.resolve(response.getAvatar().substring("/uploads/".length()))));
        verify(userAssetMapper).insert(any(UserAsset.class));
        verify(userMapper).updateById(user);
    }

    @Test
    void uploadAvatarRejectsNonImageFile() throws Exception {
        Path uploadRoot = Files.createTempDirectory("omni-user-avatar-test");
        UserAssetService service = new UserAssetService(userAssetMapper, userMapper, uploadRoot.toString());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.txt",
                "text/plain",
                new byte[] {1, 2, 3}
        );

        BusinessException exception = assertThrows(BusinessException.class, () -> service.uploadAvatar(USER_ID, file));

        assertEquals("仅支持上传 JPG、PNG、WEBP 或 GIF 图片", exception.getMessage());
        verify(userAssetMapper, never()).insert(any());
        verify(userMapper, never()).updateById(any());
    }

    @Test
    void uploadAvatarRejectsFileLargerThanTwoMb() throws Exception {
        Path uploadRoot = Files.createTempDirectory("omni-user-avatar-test");
        UserAssetService service = new UserAssetService(userAssetMapper, userMapper, uploadRoot.toString());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.jpg",
                "image/jpeg",
                new byte[2 * 1024 * 1024 + 1]
        );

        BusinessException exception = assertThrows(BusinessException.class, () -> service.uploadAvatar(USER_ID, file));

        assertEquals("头像图片不能超过2MB", exception.getMessage());
        verify(userAssetMapper, never()).insert(any());
        verify(userMapper, never()).updateById(any());
    }

    private User userWithAvatar(String avatar) {
        User user = new User();
        user.setId(USER_ID);
        user.setPhone("13900000001");
        user.setNickname("测试用户");
        user.setRole("user");
        user.setAvatar(avatar);
        return user;
    }
}
