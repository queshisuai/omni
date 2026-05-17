package com.omni.user.controller;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.user.dto.ChangePasswordRequest;
import com.omni.user.dto.LoginRequest;
import com.omni.user.dto.LoginResponse;
import com.omni.user.dto.OrganizerApplicationRequest;
import com.omni.user.dto.OrganizerApplicationResponse;
import com.omni.user.dto.OrganizerApplicationReviewRequest;
import com.omni.user.dto.RegisterRequest;
import com.omni.user.dto.UpdateProfileRequest;
import com.omni.user.dto.UserInfoResponse;
import com.omni.user.service.OrganizerApplicationService;
import com.omni.user.service.UserService;
import io.jsonwebtoken.Claims;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 用户接口
 */
@RestController
@RequestMapping("/api/user")
public class UserController {

    private static final String BEARER_PREFIX = "Bearer ";

    private final UserService userService;
    private final OrganizerApplicationService organizerApplicationService;

    public UserController(UserService userService, OrganizerApplicationService organizerApplicationService) {
        this.userService = userService;
        this.organizerApplicationService = organizerApplicationService;
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
    public Result<UserInfoResponse> getUserInfo(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthUserId(authorization);
        UserInfoResponse response = userService.getUserInfo(userId);
        return Result.success(response);
    }

    /**
     * 更新用户资料
     */
    @PutMapping("/profile")
    public Result<UserInfoResponse> updateProfile(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                  @RequestBody UpdateProfileRequest request) {
        Long userId = requireAuthUserId(authorization);
        if (request != null) {
            request.setUserId(userId);
        }
        UserInfoResponse response = userService.updateProfile(request);
        return Result.success(response);
    }

    /**
     * 修改密码
     */
    @PutMapping("/password")
    public Result<Void> changePassword(@RequestHeader(value = "Authorization", required = false) String authorization,
                                       @RequestBody ChangePasswordRequest request) {
        Long userId = requireAuthUserId(authorization);
        if (request != null) {
            request.setUserId(userId);
        }
        userService.changePassword(request);
        return Result.success();
    }

    @PostMapping("/organizer/applications")
    public Result<OrganizerApplicationResponse> submitOrganizerApplication(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody OrganizerApplicationRequest request) {
        Long userId = requireAuthUserId(authorization);
        OrganizerApplicationResponse response = organizerApplicationService.submitOrUpdate(userId, request);
        return Result.success(response);
    }

    @GetMapping("/organizer/applications/my")
    public Result<OrganizerApplicationResponse> getMyOrganizerApplication(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthUserId(authorization);
        OrganizerApplicationResponse response = organizerApplicationService.getMine(userId);
        return Result.success(response);
    }

    @GetMapping("/organizer/applications/admin")
    public Result<List<OrganizerApplicationResponse>> listOrganizerApplicationsForAdmin(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) Integer status) {
        Long reviewerId = requireAuthUserId(authorization);
        List<OrganizerApplicationResponse> response = organizerApplicationService.listForAdmin(reviewerId, status);
        return Result.success(response);
    }

    @PostMapping("/organizer/applications/{id}/approve")
    public Result<OrganizerApplicationResponse> approveOrganizerApplication(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestBody(required = false) OrganizerApplicationReviewRequest request) {
        Long reviewerId = requireAuthUserId(authorization);
        String reviewNote = request == null ? null : request.getReviewNote();
        OrganizerApplicationResponse response = organizerApplicationService.approve(id, reviewerId, reviewNote);
        return Result.success(response);
    }

    @PostMapping("/organizer/applications/{id}/reject")
    public Result<OrganizerApplicationResponse> rejectOrganizerApplication(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestBody(required = false) OrganizerApplicationReviewRequest request) {
        Long reviewerId = requireAuthUserId(authorization);
        String reviewNote = request == null ? null : request.getReviewNote();
        OrganizerApplicationResponse response = organizerApplicationService.reject(id, reviewerId, reviewNote);
        return Result.success(response);
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

    private Long requireAuthUserId(String authorization) {
        Long userId = parseAuthUserId(authorization);
        if (userId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        return userId;
    }

    private Long parseAuthUserId(String authorization) {
        if (!StringUtils.hasText(authorization) || !authorization.startsWith(BEARER_PREFIX)) {
            return null;
        }
        String token = authorization.substring(BEARER_PREFIX.length());
        try {
            Claims claims = JwtUtil.parseToken(token);
            return Long.valueOf(claims.getSubject());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
