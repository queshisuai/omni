package com.omni.user.service;

import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.exception.BusinessException;
import com.omni.user.dto.ChangePasswordRequest;
import com.omni.user.dto.InternalUserRefResponse;
import com.omni.user.dto.LoginRequest;
import com.omni.user.dto.LoginResponse;
import com.omni.user.dto.ResetPasswordRequest;
import com.omni.user.entity.User;
import com.omni.user.mapper.UserMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class UserServiceTest {

    private final UserMapper userMapper = mock(UserMapper.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final RbacService rbacService = mock(RbacService.class);
    private final UserService userService = new UserService(userMapper, passwordEncoder, rbacService);

    @Test
    void smsLoginRejectsWrongCode() {
        when(userMapper.selectOne(any())).thenReturn(existingUser());

        LoginRequest request = smsLoginRequest("123456");

        BusinessException exception = assertThrows(BusinessException.class, () -> userService.login(request));
        assertEquals("验证码错误", exception.getMessage());
    }

    @Test
    void smsLoginAcceptsMockCode666666() {
        when(userMapper.selectOne(any())).thenReturn(existingUser());
        when(rbacService.getInternalAuthContext(2004L)).thenReturn(authContextWithNoPermissions());

        LoginResponse response = userService.login(smsLoginRequest("666666"));

        assertEquals(2004L, response.getUserId());
        assertEquals("13900000001", response.getPhone());
        assertEquals("user", response.getRole());
        assertEquals("/uploads/user/avatar/2026/05/avatar.webp", response.getAvatar());
        assertNotNull(response.getToken());
    }

    @Test
    void loginExposesPlatformSuperAdminEffectiveRoleForFrontend() {
        User user = existingUser();
        user.setRole("admin");
        when(userMapper.selectOne(any())).thenReturn(user);
        when(rbacService.getInternalAuthContext(2004L)).thenReturn(authContext("platform_super_admin", List.of("rbac.manage")));

        LoginResponse response = userService.login(smsLoginRequest("666666"));

        assertEquals("platform_super_admin", response.getRole());
        assertEquals(List.of("rbac.manage"), response.getPermissionCodes());
    }

    @Test
    void loginRejectsDeactivatedUserBeforeCheckingCredential() {
        User user = existingUser();
        user.setStatus(0);
        when(userMapper.selectOne(any())).thenReturn(user);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userService.login(smsLoginRequest("666666"))
        );

        assertEquals("账号已停用", exception.getMessage());
        verifyNoInteractions(passwordEncoder);
    }

    @Test
    void resetPasswordRejectsWrongSmsCode() {
        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userService.resetPassword(resetPasswordRequest("123456", "newpass1", "newpass1"))
        );

        assertEquals("手机号或验证码错误", exception.getMessage());
        verify(userMapper, never()).selectOne(any());
        verify(userMapper, never()).updateById(any());
    }

    @Test
    void resetPasswordRejectsBlankInputWithoutQueryingUser() {
        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userService.resetPassword(resetPasswordRequest("  ", " newpass1 ", " newpass1 "))
        );

        assertEquals("验证码不能为空", exception.getMessage());
        verifyNoInteractions(userMapper);
    }

    @Test
    void resetPasswordRejectsUnknownPhoneWithoutUpdatingPassword() {
        when(userMapper.selectOne(any())).thenReturn(null);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userService.resetPassword(resetPasswordRequest("666666", "newpass1", "newpass1"))
        );

        assertEquals("手机号或验证码错误", exception.getMessage());
        verify(userMapper, never()).updateById(any());
    }

    @Test
    void resetPasswordRejectsMismatchedPasswords() {
        when(userMapper.selectOne(any())).thenReturn(existingUser());

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userService.resetPassword(resetPasswordRequest("666666", "newpass1", "newpass2"))
        );

        assertEquals("两次密码输入不一致", exception.getMessage());
        verify(userMapper, never()).updateById(any());
    }

    @Test
    void resetPasswordRejectsShortPasswordForExistingPhoneWithoutUpdatingPassword() {
        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userService.resetPassword(resetPasswordRequest("666666", "12345", "12345"))
        );

        assertEquals("新密码长度不能少于6位", exception.getMessage());
        verify(userMapper, never()).selectOne(any());
        verify(userMapper, never()).updateById(any());
    }

    @Test
    void resetPasswordRejectsShortPasswordForUnknownPhoneWithSameMessage() {
        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userService.resetPassword(resetPasswordRequest("18800000000", "666666", "12345", "12345"))
        );

        assertEquals("新密码长度不能少于6位", exception.getMessage());
        verify(userMapper, never()).selectOne(any());
        verify(userMapper, never()).updateById(any());
    }

    @Test
    void resetPasswordRejectsMismatchedPasswordsForExistingPhoneBeforeQueryingUser() {
        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userService.resetPassword(resetPasswordRequest("666666", "newpass1", "newpass2"))
        );

        assertEquals("两次密码输入不一致", exception.getMessage());
        verify(userMapper, never()).selectOne(any());
        verify(userMapper, never()).updateById(any());
    }

    @Test
    void resetPasswordRejectsMismatchedPasswordsForUnknownPhoneWithSameMessage() {
        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userService.resetPassword(resetPasswordRequest("18800000000", "666666", "newpass1", "newpass2"))
        );

        assertEquals("两次密码输入不一致", exception.getMessage());
        verify(userMapper, never()).selectOne(any());
        verify(userMapper, never()).updateById(any());
    }

    @Test
    void resetPasswordUpdatesEncodedPasswordWhenSmsCodeIsCorrect() {
        User user = existingUser();
        when(userMapper.selectOne(any())).thenReturn(user);
        when(passwordEncoder.encode("newpass1")).thenReturn("encoded-newpass1");

        userService.resetPassword(resetPasswordRequest(" 666666 ", " newpass1 ", " newpass1 "));

        assertEquals("encoded-newpass1", user.getPassword());
        verify(userMapper).updateById(user);
    }

    @Test
    void changePasswordRejectsWrongOldPasswordWithoutCheckingSmsCodeOrUpdatingPassword() {
        User user = existingUser();
        user.setPassword("encoded-oldpass");
        when(userMapper.selectById(2004L)).thenReturn(user);
        when(passwordEncoder.matches("wrongpass", "encoded-oldpass")).thenReturn(false);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userService.changePassword(changePasswordRequest("wrongpass", "badcode", "newpass1", "newpass1"))
        );

        assertEquals("原密码错误", exception.getMessage());
        verify(passwordEncoder, never()).encode(any());
        verify(userMapper, never()).updateById(any());
    }

    @Test
    void changePasswordRejectsWrongSmsCodeWithoutUpdatingPassword() {
        User user = existingUser();
        user.setPassword("encoded-oldpass");
        when(userMapper.selectById(2004L)).thenReturn(user);
        when(passwordEncoder.matches("oldpass", "encoded-oldpass")).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userService.changePassword(changePasswordRequest("oldpass", "123456", "newpass1", "newpass1"))
        );

        assertEquals("验证码错误", exception.getMessage());
        verify(passwordEncoder, never()).encode(any());
        verify(userMapper, never()).updateById(any());
    }

    @Test
    void changePasswordRejectsBlankSmsCodeWithoutUpdatingPassword() {
        User user = existingUser();
        user.setPassword("encoded-oldpass");
        when(userMapper.selectById(2004L)).thenReturn(user);
        when(passwordEncoder.matches("oldpass", "encoded-oldpass")).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userService.changePassword(changePasswordRequest("oldpass", "  ", "newpass1", "newpass1"))
        );

        assertEquals("验证码不能为空", exception.getMessage());
        verify(passwordEncoder, never()).encode(any());
        verify(userMapper, never()).updateById(any());
    }

    @Test
    void changePasswordRejectsBlankNewPasswordWithoutUpdatingPassword() {
        User user = existingUser();
        user.setPassword("encoded-oldpass");
        when(userMapper.selectById(2004L)).thenReturn(user);
        when(passwordEncoder.matches("oldpass", "encoded-oldpass")).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userService.changePassword(changePasswordRequest("oldpass", "666666", "  ", "newpass1"))
        );

        assertEquals("新密码不能为空", exception.getMessage());
        verify(passwordEncoder, never()).encode(any());
        verify(userMapper, never()).updateById(any());
    }

    @Test
    void changePasswordRejectsBlankConfirmPasswordWithoutUpdatingPassword() {
        User user = existingUser();
        user.setPassword("encoded-oldpass");
        when(userMapper.selectById(2004L)).thenReturn(user);
        when(passwordEncoder.matches("oldpass", "encoded-oldpass")).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userService.changePassword(changePasswordRequest("oldpass", "666666", "newpass1", "  "))
        );

        assertEquals("确认密码不能为空", exception.getMessage());
        verify(passwordEncoder, never()).encode(any());
        verify(userMapper, never()).updateById(any());
    }

    @Test
    void changePasswordUpdatesEncodedPasswordWhenSmsCodeAndPasswordAreValid() {
        User user = existingUser();
        user.setPassword("encoded-oldpass");
        when(userMapper.selectById(2004L)).thenReturn(user);
        when(passwordEncoder.matches("oldpass", "encoded-oldpass")).thenReturn(true);
        when(passwordEncoder.encode("newpass1")).thenReturn("encoded-newpass1");

        userService.changePassword(changePasswordRequest("oldpass", "666666", "newpass1", "newpass1"));

        assertEquals("encoded-newpass1", user.getPassword());
        verify(userMapper).updateById(user);
    }

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

    private LoginRequest smsLoginRequest(String smsCode) {
        LoginRequest request = new LoginRequest();
        request.setLoginType("sms");
        request.setAccount("13900000001");
        request.setSmsCode(smsCode);
        return request;
    }

    private ResetPasswordRequest resetPasswordRequest(String smsCode, String newPassword, String confirmPassword) {
        return resetPasswordRequest("13900000001", smsCode, newPassword, confirmPassword);
    }

    private ResetPasswordRequest resetPasswordRequest(String phone, String smsCode, String newPassword, String confirmPassword) {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setPhone(phone);
        request.setSmsCode(smsCode);
        request.setNewPassword(newPassword);
        request.setConfirmPassword(confirmPassword);
        return request;
    }

    private ChangePasswordRequest changePasswordRequest(String oldPassword, String smsCode, String newPassword, String confirmPassword) {
        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setUserId(2004L);
        request.setOldPassword(oldPassword);
        request.setSmsCode(smsCode);
        request.setNewPassword(newPassword);
        request.setConfirmPassword(confirmPassword);
        return request;
    }

    private InternalAuthContextResponse authContextWithNoPermissions() {
        return authContext(null, List.of());
    }

    private InternalAuthContextResponse authContext(String effectiveRole, List<String> permissionCodes) {
        InternalAuthContextResponse auth = new InternalAuthContextResponse();
        auth.setEffectiveRole(effectiveRole);
        auth.setPermissionCodes(permissionCodes);
        return auth;
    }

    private User existingUser() {
        User user = new User();
        user.setId(2004L);
        user.setPhone("13900000001");
        user.setAvatar("/uploads/user/avatar/2026/05/avatar.webp");
        user.setRole("user");
        return user;
    }
}
