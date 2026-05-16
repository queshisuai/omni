package com.damai.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.damai.common.result.ResultCode;
import com.damai.common.util.JwtUtil;
import com.damai.exception.BusinessException;
import com.damai.user.dto.LoginRequest;
import com.damai.user.dto.LoginResponse;
import com.damai.user.dto.RegisterRequest;
import com.damai.user.entity.User;
import com.damai.user.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * 用户服务
 */
@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserMapper userMapper, PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 用户注册
     */
    public void register(RegisterRequest request) {
        // 校验两次密码一致
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "两次密码输入不一致");
        }

        // 校验手机号是否已注册
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(User::getPhone, request.getPhone());
        if (userMapper.selectCount(wrapper) > 0) {
            throw new BusinessException(ResultCode.CONFLICT, "该手机号已注册");
        }

        // 创建用户
        User user = new User();
        user.setPhone(request.getPhone());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        userMapper.insert(user);

        log.info("用户注册成功: phone={}", request.getPhone());
    }

    /**
     * 用户登录
     */
    public LoginResponse login(LoginRequest request) {
        // 根据账号查询用户（支持手机号或邮箱）
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(User::getPhone, request.getAccount())
               .or()
               .eq(User::getEmail, request.getAccount());
        User user = userMapper.selectOne(wrapper);

        if (user == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "账号不存在");
        }

        if ("password".equals(request.getLoginType())) {
            // 密码登录
            if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "密码错误");
            }
        } else if ("sms".equals(request.getLoginType())) {
            // 短信登录：TODO 对接真实短信验证码校验
            throw new BusinessException(ResultCode.BAD_REQUEST, "短信登录暂未开放");
        } else {
            throw new BusinessException(ResultCode.BAD_REQUEST, "不支持的登录方式");
        }

        // 生成 JWT Token
        String role = user.getRole() != null ? user.getRole() : "user";
        String token = JwtUtil.generateToken(user.getId(), user.getPhone(), role);

        LoginResponse response = new LoginResponse();
        response.setUserId(user.getId());
        response.setPhone(user.getPhone());
        response.setNickname(user.getNickname());
        response.setToken(token);
        response.setRole(role);

        log.info("用户登录成功: userId={}, phone={}", user.getId(), user.getPhone());
        return response;
    }

    /**
     * 申请成为主办方
     */
    public User applyOrganizer(Long userId, String organizerName) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        user.setRole("organizer");
        user.setOrganizerName(organizerName);
        user.setOrganizerStatus(1); // 沙盒版：自动通过审核
        userMapper.updateById(user);
        log.info("用户申请主办方成功: userId={}, organizerName={}", userId, organizerName);
        return user;
    }

    /**
     * 获取用户信息
     */
    public User getUserInfo(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        return user;
    }
}
