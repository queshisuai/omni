package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.OrganizerAdminAccountRequest;
import com.omni.user.dto.OrganizerAdminAccountResponse;
import com.omni.user.entity.User;
import com.omni.user.mapper.UserMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class OrganizerAdminAccountService {
    private static final String ROLE_ORGANIZER_ADMIN = "organizer_admin";

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    public OrganizerAdminAccountService(UserMapper userMapper, PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
    }

    public List<OrganizerAdminAccountResponse> list() {
        return userMapper.selectList(new LambdaQueryWrapper<User>()
                        .eq(User::getRole, ROLE_ORGANIZER_ADMIN)
                        .orderByDesc(User::getId))
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public OrganizerAdminAccountResponse create(OrganizerAdminAccountRequest request) {
        String phone = requireText(request == null ? null : request.getPhone(), "手机号不能为空");
        String nickname = requireText(request.getNickname(), "昵称不能为空");
        String password = requireText(request.getPassword(), "初始密码不能为空");
        if (password.length() < 6) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "密码长度不能少于6位");
        }
        User exists = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getPhone, phone));
        if (exists != null) {
            throw new BusinessException(ResultCode.CONFLICT, "该手机号已存在");
        }
        User user = new User();
        user.setPhone(phone);
        user.setNickname(nickname);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(ROLE_ORGANIZER_ADMIN);
        user.setStatus(1);
        userMapper.insert(user);
        return toResponse(user);
    }

    @Transactional
    public OrganizerAdminAccountResponse deactivate(Long id) {
        User user = userMapper.selectById(id);
        if (user == null || !ROLE_ORGANIZER_ADMIN.equals(user.getRole())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "主办方管理员账号不存在");
        }
        user.setStatus(0);
        user.setUpdateTime(LocalDateTime.now());
        userMapper.updateById(user);
        return toResponse(user);
    }

    private OrganizerAdminAccountResponse toResponse(User user) {
        OrganizerAdminAccountResponse response = new OrganizerAdminAccountResponse();
        response.setId(user.getId());
        response.setPhone(user.getPhone());
        response.setNickname(user.getNickname());
        response.setRole(user.getRole());
        response.setStatus(user.getStatus());
        response.setCreateTime(user.getCreateTime());
        response.setUpdateTime(user.getUpdateTime());
        return response;
    }

    private String requireText(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, message);
        }
        return value.trim();
    }
}
