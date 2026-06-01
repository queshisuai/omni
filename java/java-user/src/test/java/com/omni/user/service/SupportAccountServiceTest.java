package com.omni.user.service;

import com.omni.exception.BusinessException;
import com.omni.user.dto.SupportAccountRequest;
import com.omni.user.dto.SupportAccountResponse;
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

class SupportAccountServiceTest {

    private final UserMapper userMapper = mock(UserMapper.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final SupportAccountService service = new SupportAccountService(userMapper, passwordEncoder);

    @Test
    void adminCreatesSupportAccountWithSupportRole() {
        when(userMapper.selectById(1L)).thenReturn(user(1L, "admin", 1));
        when(userMapper.selectOne(any())).thenReturn(null);
        when(passwordEncoder.encode("support123")).thenReturn("encoded-support123");

        SupportAccountResponse response = service.create(1L, request("13900000002", "客服一号", "support123"));

        assertEquals("13900000002", response.getPhone());
        assertEquals("客服一号", response.getNickname());
        assertEquals("support", response.getRole());
        assertEquals(1, response.getStatus());
        verify(userMapper).insert(any(User.class));
    }

    @Test
    void nonAdminCannotCreateSupportAccount() {
        when(userMapper.selectById(2L)).thenReturn(user(2L, "organizer", 1));

        BusinessException error = assertThrows(
                BusinessException.class,
                () -> service.create(2L, request("13900000002", "客服一号", "support123"))
        );

        assertEquals("仅平台管理员可以管理客服账号", error.getMessage());
        verify(userMapper, never()).insert(any());
    }

    @Test
    void adminDeactivatesSupportAccountWithoutDeletingHistory() {
        User support = user(3L, "support", 1);
        when(userMapper.selectById(1L)).thenReturn(user(1L, "admin", 1));
        when(userMapper.selectById(3L)).thenReturn(support);

        SupportAccountResponse response = service.deactivate(1L, 3L);

        assertEquals(0, response.getStatus());
        assertEquals("support", response.getRole());
        verify(userMapper).updateById(support);
    }

    @Test
    void listOnlyReturnsSupportAccountsForAdmin() {
        when(userMapper.selectById(1L)).thenReturn(user(1L, "admin", 1));
        User support = user(3L, "support", 1);
        support.setPhone("13900000003");
        support.setNickname("客服三号");
        when(userMapper.selectList(any())).thenReturn(List.of(support));

        List<SupportAccountResponse> accounts = service.list(1L);

        assertEquals(1, accounts.size());
        assertEquals("客服三号", accounts.get(0).getNickname());
    }

    private SupportAccountRequest request(String phone, String nickname, String password) {
        SupportAccountRequest request = new SupportAccountRequest();
        request.setPhone(phone);
        request.setNickname(nickname);
        request.setPassword(password);
        return request;
    }

    private User user(Long id, String role, Integer status) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        user.setStatus(status);
        return user;
    }
}
