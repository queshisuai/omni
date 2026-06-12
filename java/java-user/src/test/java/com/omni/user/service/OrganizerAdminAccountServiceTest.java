package com.omni.user.service;

import com.omni.exception.BusinessException;
import com.omni.user.dto.OrganizerAdminAccountRequest;
import com.omni.user.entity.User;
import com.omni.user.mapper.UserMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrganizerAdminAccountServiceTest {
    private final UserMapper userMapper = mock(UserMapper.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final OrganizerAdminAccountService service = new OrganizerAdminAccountService(userMapper, passwordEncoder);

    @Test
    void createsOrganizerAdminRoleAccount() {
        when(userMapper.selectOne(any())).thenReturn(null);
        when(passwordEncoder.encode("admin123")).thenReturn("encoded");
        when(userMapper.insert(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(11L);
            return 1;
        });

        var response = service.create(request("13900000004", "平台主办方运营员", "admin123"));

        assertEquals(11L, response.getId());
        assertEquals("organizer_admin", response.getRole());
        verify(userMapper).insert(any(User.class));
    }

    @Test
    void rejectsDuplicateOrganizerAdminPhone() {
        when(userMapper.selectOne(any())).thenReturn(new User());

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.create(request("13900000004", "平台主办方运营员", "admin123")));

        assertEquals("该手机号已存在", error.getMessage());
    }

    @Test
    void updateOrganizerAdminRejectsMissingBodyWithPlatformOpsLabel() {
        BusinessException error = assertThrows(BusinessException.class,
                () -> service.update(11L, null));

        assertEquals("平台主办方运营员账号参数不能为空", error.getMessage());
    }

    @Test
    void listsOrganizerAdminAccounts() {
        User user = new User();
        user.setId(11L);
        user.setPhone("13900000004");
        user.setNickname("平台主办方运营员");
        user.setRole("organizer_admin");
        user.setStatus(1);
        when(userMapper.selectList(any())).thenReturn(List.of(user));

        var accounts = service.list();

        assertEquals(1, accounts.size());
        assertEquals("平台主办方运营员", accounts.get(0).getNickname());
    }

    @Test
    void updatesOrganizerAdminAccountAndLinkedLoginFields() {
        User user = new User();
        user.setId(11L);
        user.setPhone("13900000004");
        user.setNickname("平台主办方运营员");
        user.setRole("organizer_admin");
        user.setStatus(0);
        when(userMapper.selectById(11L)).thenReturn(user);
        when(userMapper.selectOne(any())).thenReturn(null);
        when(passwordEncoder.encode("newpass123")).thenReturn("encoded-newpass123");

        OrganizerAdminAccountRequest request = request("13900000005", "平台主办方运营员账号", "newpass123");
        request.setStatus(1);
        var response = service.update(11L, request);

        assertEquals("13900000005", response.getPhone());
        assertEquals("平台主办方运营员账号", response.getNickname());
        assertEquals(1, response.getStatus());
        assertEquals("13900000005", user.getPhone());
        assertEquals("平台主办方运营员账号", user.getNickname());
        assertEquals("encoded-newpass123", user.getPassword());
        verify(userMapper).updateById(user);
    }

    @Test
    void updateOrganizerAdminWithoutPasswordKeepsOldPassword() {
        User user = new User();
        user.setId(11L);
        user.setPhone("13900000004");
        user.setNickname("平台主办方运营员");
        user.setPassword("old-password");
        user.setRole("organizer_admin");
        user.setStatus(1);
        when(userMapper.selectById(11L)).thenReturn(user);

        OrganizerAdminAccountRequest request = request("13900000004", "平台主办方运营员账号", "");
        request.setStatus(1);
        service.update(11L, request);

        assertEquals("old-password", user.getPassword());
        verify(passwordEncoder, never()).encode(any());
        verify(userMapper).updateById(user);
    }

    @Test
    void deletesOrganizerAdminAccount() {
        User user = new User();
        user.setId(11L);
        user.setPhone("13900000004");
        user.setNickname("平台主办方运营员");
        user.setRole("organizer_admin");
        user.setStatus(1);
        when(userMapper.selectById(11L)).thenReturn(user);

        var response = service.delete(11L);

        assertEquals(11L, response.getId());
        assertEquals("13900000004", response.getPhone());
        verify(userMapper).deleteById(11L);
    }

    private OrganizerAdminAccountRequest request(String phone, String nickname, String password) {
        OrganizerAdminAccountRequest request = new OrganizerAdminAccountRequest();
        request.setPhone(phone);
        request.setNickname(nickname);
        request.setPassword(password);
        return request;
    }
}
