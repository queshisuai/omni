package com.omni.user.controller;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.user.dto.ChangePasswordRequest;
import com.omni.user.dto.InternalUserRefResponse;
import com.omni.user.dto.LoginRequest;
import com.omni.user.dto.LoginResponse;
import com.omni.user.dto.OrganizerApplicationRequest;
import com.omni.user.dto.OrganizerApplicationResponse;
import com.omni.user.dto.OrganizerApplicationReviewRequest;
import com.omni.user.dto.RegisterRequest;
import com.omni.user.dto.ResetPasswordRequest;
import com.omni.user.dto.UpdateProfileRequest;
import com.omni.user.dto.UserInfoResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import com.omni.user.service.OrganizerApplicationService;
import com.omni.user.service.UserAssetService;
import com.omni.user.service.UserService;
import io.jsonwebtoken.Claims;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * 用户接口
 */
@RestController
@RequestMapping("/api/user")
public class UserController {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final String MOCK_SMS_CODE = "666666";

    private final UserService userService;
    private final OrganizerApplicationService organizerApplicationService;
    private final UserAssetService userAssetService;
    private final String internalApiToken;

    public UserController(UserService userService, OrganizerApplicationService organizerApplicationService) {
        this(userService, organizerApplicationService, null, "");
    }

    public UserController(UserService userService,
                          OrganizerApplicationService organizerApplicationService,
                          String internalApiToken) {
        this(userService, organizerApplicationService, null, internalApiToken);
    }

    @Autowired
    public UserController(UserService userService,
                          OrganizerApplicationService organizerApplicationService,
                          UserAssetService userAssetService,
                          @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.userService = userService;
        this.organizerApplicationService = organizerApplicationService;
        this.userAssetService = userAssetService;
        this.internalApiToken = internalApiToken;
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

    @PostMapping("/assets/avatar")
    public Result<UserInfoResponse> uploadAvatar(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestPart("file") MultipartFile file) {
        Long userId = requireAuthUserId(authorization);
        if (userAssetService == null) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "头像上传服务未配置");
        }
        UserInfoResponse response = userAssetService.uploadAvatar(userId, file);
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

    /**
     * 找回密码重置
     */
    @PostMapping("/password/reset")
    public Result<Void> resetPassword(@RequestBody ResetPasswordRequest request) {
        userService.resetPassword(request);
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

    @GetMapping("/internal/{id}")
    public Result<InternalUserRefResponse> getInternalUserRef(
            @PathVariable Long id,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(userService.getInternalUserRef(id));
    }

    private boolean isValidInternalToken(String token) {
        return StringUtils.hasText(internalApiToken) && internalApiToken.equals(token);
    }

    /**
     * 发送短信验证码（沙盒版：固定验证码）
     */
    @PostMapping("/send-code")
    public Result<String> sendCode(@RequestParam String phone) {
        System.out.println("==========================================");
        System.out.println("  短信验证码 [" + phone + "]: " + MOCK_SMS_CODE);
        System.out.println("==========================================");
        return Result.success(MOCK_SMS_CODE);
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
