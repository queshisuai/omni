package com.omni.user.controller;

import com.omni.common.result.Result;
import com.omni.user.dto.LoginRequest;
import com.omni.user.dto.LoginResponse;
import com.omni.user.dto.RegisterRequest;
import com.omni.user.entity.User;
import com.omni.user.service.UserService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 用户接口
 */
@RestController
@RequestMapping("/api/user")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * 用户注册
     */
    @PostMapping("/register")
    public Result<Void> register(@RequestBody RegisterRequest request) {
        userService.register(request);
        return Result.success();
    }

    /**
     * 用户登录
     */
    @PostMapping("/login")
    public Result<LoginResponse> login(@RequestBody LoginRequest request) {
        LoginResponse response = userService.login(request);
        return Result.success(response);
    }

    /**
     * 获取当前用户信息
     */
    @GetMapping("/info")
    public Result<User> getUserInfo(@RequestParam Long userId) {
        User user = userService.getUserInfo(userId);
        return Result.success(user);
    }

    /**
     * 申请成为主办方
     */
    @PostMapping("/organizer/apply")
    public Result<User> applyOrganizer(@RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String organizerName = body.get("organizerName").toString();
        User user = userService.applyOrganizer(userId, organizerName);
        return Result.success(user);
    }

    /**
     * 发送短信验证码（沙盒版：验证码打印到日志）
     */
    @PostMapping("/send-code")
    public Result<String> sendCode(@RequestParam String phone) {
        // 沙盒版：生成 6 位验证码，打印到日志
        String code = String.valueOf((int) ((Math.random() * 9 + 1) * 100000));
        System.out.println("==========================================");
        System.out.println("  短信验证码 [" + phone + "]: " + code);
        System.out.println("==========================================");
        return Result.success(code);
    }
}
