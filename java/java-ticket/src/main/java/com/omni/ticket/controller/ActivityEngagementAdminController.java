package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.ActivityQuestionModerationRequest;
import com.omni.ticket.dto.ActivityReviewModerationRequest;
import com.omni.ticket.dto.ActivityReviewReportModerationRequest;
import com.omni.ticket.entity.ActivityQuestion;
import com.omni.ticket.entity.ActivityReview;
import com.omni.ticket.entity.ActivityReviewReport;
import com.omni.ticket.service.ActivityEngagementService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ticket/admin/activity-engagement")
public class ActivityEngagementAdminController {

    private static final String BEARER_PREFIX = "Bearer ";

    private final ActivityEngagementService engagementService;

    public ActivityEngagementAdminController(ActivityEngagementService engagementService) {
        this.engagementService = engagementService;
    }

    @GetMapping("/reviews")
    public Result<List<ActivityReview>> listReviews(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) Long activityId,
            @RequestParam(required = false) Integer status) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.listAdminReviews(userId, activityId, status));
    }

    @PostMapping("/reviews/{reviewId}/moderation")
    public Result<ActivityReview> moderateReview(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long reviewId,
            @RequestBody(required = false) ActivityReviewModerationRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.moderateReview(reviewId, userId, request));
    }

    @GetMapping("/review-reports")
    public Result<List<ActivityReviewReport>> listReviewReports(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) String status) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.listAdminReports(userId, status));
    }

    @PostMapping("/review-reports/{reportId}/moderation")
    public Result<ActivityReviewReport> moderateReviewReport(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long reportId,
            @RequestBody(required = false) ActivityReviewReportModerationRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.moderateReport(reportId, userId, request));
    }

    @GetMapping("/questions")
    public Result<List<ActivityQuestion>> listQuestions(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) Long activityId,
            @RequestParam(required = false) String status) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.listAdminQuestions(userId, activityId, status));
    }

    @PostMapping("/questions/{questionId}/moderation")
    public Result<ActivityQuestion> moderateQuestion(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long questionId,
            @RequestBody(required = false) ActivityQuestionModerationRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.moderateQuestion(questionId, userId, request));
    }

    private Long parseUserId(String authorization) {
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) return null;
        try {
            return Long.valueOf(JwtUtil.parseToken(authorization.substring(BEARER_PREFIX.length())).getSubject());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
