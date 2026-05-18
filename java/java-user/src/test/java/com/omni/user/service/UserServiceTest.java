package com.omni.user.service;

import com.omni.exception.BusinessException;
import com.omni.user.dto.LoginRequest;
import com.omni.user.dto.LoginResponse;
import com.omni.user.entity.User;
import com.omni.user.mapper.UserMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserServiceTest {

    private final UserMapper userMapper = mock(UserMapper.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final UserService userService = new UserService(userMapper, passwordEncoder);

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

        LoginResponse response = userService.login(smsLoginRequest("666666"));

        assertEquals(2004L, response.getUserId());
        assertEquals("13900000001", response.getPhone());
        assertEquals("user", response.getRole());
        assertNotNull(response.getToken());
    }

    private LoginRequest smsLoginRequest(String smsCode) {
        LoginRequest request = new LoginRequest();
        request.setLoginType("sms");
        request.setAccount("13900000001");
        request.setSmsCode(smsCode);
        return request;
    }

    private User existingUser() {
        User user = new User();
        user.setId(2004L);
        user.setPhone("13900000001");
        user.setRole("user");
        return user;
    }
}
