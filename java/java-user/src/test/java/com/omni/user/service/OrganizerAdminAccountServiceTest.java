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

        var response = service.create(request("13900000004", "主办方管理员", "admin123"));

        assertEquals(11L, response.getId());
        assertEquals("organizer_admin", response.getRole());
        verify(userMapper).insert(any(User.class));
    }

    @Test
    void rejectsDuplicateOrganizerAdminPhone() {
        when(userMapper.selectOne(any())).thenReturn(new User());

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.create(request("13900000004", "主办方管理员", "admin123")));

        assertEquals("该手机号已存在", error.getMessage());
    }

    @Test
    void listsOrganizerAdminAccounts() {
        User user = new User();
        user.setId(11L);
        user.setPhone("13900000004");
        user.setNickname("主办方管理员");
        user.setRole("organizer_admin");
        user.setStatus(1);
        when(userMapper.selectList(any())).thenReturn(List.of(user));

        var accounts = service.list();

        assertEquals(1, accounts.size());
        assertEquals("主办方管理员", accounts.get(0).getNickname());
    }

    private OrganizerAdminAccountRequest request(String phone, String nickname, String password) {
        OrganizerAdminAccountRequest request = new OrganizerAdminAccountRequest();
        request.setPhone(phone);
        request.setNickname(nickname);
        request.setPassword(password);
        return request;
    }
}
