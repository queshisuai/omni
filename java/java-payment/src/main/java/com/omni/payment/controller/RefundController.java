package com.omni.payment.controller;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.payment.dto.ApplyRefundRequest;
import com.omni.payment.dto.DirectRefundRequest;
import com.omni.payment.dto.DirectRefundResponse;
import com.omni.payment.dto.RefundRequestVO;
import com.omni.payment.dto.ReviewRefundRequest;
import com.omni.payment.service.RefundService;
import org.springframework.beans.factory.annotation.Value;
import io.jsonwebtoken.Claims;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 退款接口
 */
@RestController
@RequestMapping("/api/payment/refunds")
public class RefundController {

    private static final String BEARER_PREFIX = "Bearer ";

    private final RefundService refundService;
    private final String internalApiToken;

    public RefundController(RefundService refundService,
                            @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.refundService = refundService;
        this.internalApiToken = internalApiToken;
    }

    @PostMapping("/apply")
    public Result<RefundRequestVO> apply(@RequestHeader(value = "Authorization", required = false) String authorization,
                                         @RequestBody(required = false) ApplyRefundRequest request) {
        if (request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "退款申请参数不能为空");
        }
        AuthUser authUser = requireAuthUser(authorization);
        return Result.success(refundService.applyRefund(
                request.getOrderId(),
                authUser.userId,
                request.getReason(),
                request.getReasonType(),
                request.getQuantity(),
                request.getOrderSeatIds()));
    }

    @GetMapping("/my")
    public Result<List<RefundRequestVO>> listMine(@RequestHeader(value = "Authorization", required = false) String authorization) {
        AuthUser authUser = requireAuthUser(authorization);
        return Result.success(refundService.listUserRefunds(authUser.userId));
    }

    @GetMapping("/admin")
    public Result<List<RefundRequestVO>> listAdmin(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                  @RequestParam(required = false) Integer status) {
        AuthUser authUser = requireAuthUser(authorization);
        return Result.success(refundService.listAdminRefunds(authUser.userId, status));
    }

    @PostMapping("/{id}/approve")
    public Result<RefundRequestVO> approve(@RequestHeader(value = "Authorization", required = false) String authorization,
                                           @PathVariable Long id,
                                           @RequestBody(required = false) ReviewRefundRequest request) {
        AuthUser authUser = requireAuthUser(authorization);
        String reviewNote = request != null ? request.getReviewNote() : null;
        return Result.success(refundService.approve(id, authUser.userId, reviewNote));
    }

    @PostMapping("/{id}/reject")
    public Result<RefundRequestVO> reject(@RequestHeader(value = "Authorization", required = false) String authorization,
                                           @PathVariable Long id,
                                           @RequestBody(required = false) ReviewRefundRequest request) {
        AuthUser authUser = requireAuthUser(authorization);
        String reviewNote = request != null ? request.getReviewNote() : null;
        return Result.success(refundService.reject(id, authUser.userId, reviewNote));
    }

    @PostMapping("/internal/direct")
    public Result<DirectRefundResponse> directRefund(@RequestHeader(value = "X-Internal-Token", required = false) String token,
                                                     @RequestBody(required = false) DirectRefundRequest request) {
        if (!StringUtils.hasText(internalApiToken) || !internalApiToken.equals(token)) {
            return Result.fail(403, "无权限");
        }
        if (request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "退款参数不能为空");
        }
        return Result.success(refundService.directRefund(request.getOrderId(), request.getReason()));
    }

    private AuthUser requireAuthUser(String authorization) {
        if (!StringUtils.hasText(authorization) || !authorization.startsWith(BEARER_PREFIX)) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        String token = authorization.substring(BEARER_PREFIX.length());
        try {
            Claims claims = JwtUtil.parseToken(token);
            Long userId = Long.valueOf(claims.getSubject());
            String role = claims.get("role", String.class);
            return new AuthUser(userId, role);
        } catch (RuntimeException e) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
    }

    private static class AuthUser {
        private final Long userId;
        @SuppressWarnings("unused")
        private final String role;

        private AuthUser(Long userId, String role) {
            this.userId = userId;
            this.role = role;
        }

    }
}
