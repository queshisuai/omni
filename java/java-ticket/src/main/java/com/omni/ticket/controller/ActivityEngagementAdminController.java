package com.omni.ticket.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.ActivityEngagementOverviewResponse;
import com.omni.ticket.dto.ActivityQuestionModerationRequest;
import com.omni.ticket.dto.ActivityQuestionReplyRequest;
import com.omni.ticket.dto.ActivityQuestionUpdateRequest;
import com.omni.ticket.dto.ActivityReviewModerationRequest;
import com.omni.ticket.dto.ActivityReviewReportModerationRequest;
import com.omni.ticket.dto.ActivityReviewReportStatusRequest;
import com.omni.ticket.dto.ActivityReviewStatusRequest;
import com.omni.ticket.entity.ActivityQuestion;
import com.omni.ticket.entity.ActivityReview;
import com.omni.ticket.entity.ActivityReviewReport;
import com.omni.ticket.service.ActivityEngagementService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/ticket/admin")
public class ActivityEngagementAdminController {

    private static final String BEARER_PREFIX = "Bearer ";

    private final ActivityEngagementService engagementService;

    public ActivityEngagementAdminController(ActivityEngagementService engagementService) {
        this.engagementService = engagementService;
    }

    @GetMapping("/activity-engagements")
    public Result<Page<ActivityEngagementOverviewResponse>> listEngagements(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String itemType,
            @RequestParam(required = false) Boolean todoOnly) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.listAdminActivityEngagements(userId, page, size, keyword, itemType, todoOnly));
    }

    @GetMapping("/activity-engagement/reviews")
    public Result<List<ActivityReview>> listReviews(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) Long activityId,
            @RequestParam(required = false) Integer status) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.listAdminReviews(userId, activityId, status));
    }

    @PostMapping("/activity-engagement/reviews/{reviewId}/moderation")
    public Result<ActivityReview> moderateReview(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long reviewId,
            @RequestBody(required = false) ActivityReviewModerationRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.moderateReview(reviewId, userId, request));
    }

    @GetMapping("/activity-engagement/review-reports")
    public Result<List<ActivityReviewReport>> listReviewReports(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) String status) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.listAdminReports(userId, status));
    }

    @PostMapping("/activity-engagement/review-reports/{reportId}/moderation")
    public Result<ActivityReviewReport> moderateReviewReport(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long reportId,
            @RequestBody(required = false) ActivityReviewReportModerationRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.moderateReport(reportId, userId, request));
    }

    @GetMapping("/activity-engagement/questions")
    public Result<List<ActivityQuestion>> listQuestions(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) Long activityId,
            @RequestParam(required = false) String status) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.listAdminQuestions(userId, activityId, status));
    }

    @PostMapping("/activity-engagement/questions/{questionId}/moderation")
    public Result<ActivityQuestion> moderateQuestion(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long questionId,
            @RequestBody(required = false) ActivityQuestionModerationRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.moderateQuestion(questionId, userId, request));
    }

    @GetMapping("/activities/{activityId}/questions")
    public Result<List<ActivityQuestion>> listActivityQuestions(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long activityId,
            @RequestParam(defaultValue = "ACTIVITY") String itemType,
            @RequestParam(required = false) String status) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.listAdminQuestions(userId, activityId, itemType, status));
    }

    @PostMapping("/activities/{activityId}/questions/{questionId}/reply")
    public Result<ActivityQuestion> replyQuestion(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long activityId,
            @PathVariable Long questionId,
            @RequestParam(defaultValue = "ACTIVITY") String itemType,
            @RequestBody(required = false) ActivityQuestionReplyRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.replyQuestion(activityId, questionId, userId, itemType, request));
    }

    @PutMapping("/activities/{activityId}/questions/{questionId}")
    public Result<ActivityQuestion> updateQuestion(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long activityId,
            @PathVariable Long questionId,
            @RequestParam(defaultValue = "ACTIVITY") String itemType,
            @RequestBody(required = false) ActivityQuestionUpdateRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.updateQuestion(activityId, questionId, userId, itemType, request));
    }

    @GetMapping("/activities/{activityId}/reviews")
    public Result<List<ActivityReview>> listActivityReviews(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long activityId,
            @RequestParam(defaultValue = "ACTIVITY") String itemType,
            @RequestParam(required = false) Integer status) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.listAdminReviews(userId, activityId, itemType, status));
    }

    @PutMapping("/activities/{activityId}/reviews/{reviewId}/status")
    public Result<ActivityReview> updateReviewStatus(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long activityId,
            @PathVariable Long reviewId,
            @RequestParam(defaultValue = "ACTIVITY") String itemType,
            @RequestBody(required = false) ActivityReviewStatusRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.updateReviewStatus(activityId, reviewId, userId, itemType, request));
    }

    @GetMapping("/activities/{activityId}/reports")
    public Result<List<ActivityReviewReport>> listActivityReports(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long activityId,
            @RequestParam(defaultValue = "ACTIVITY") String itemType,
            @RequestParam(required = false) String status) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.listAdminReports(userId, activityId, itemType, status));
    }

    @PutMapping("/activities/{activityId}/reports/{reportId}/status")
    public Result<ActivityReviewReport> updateReportStatus(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long activityId,
            @PathVariable Long reportId,
            @RequestParam(defaultValue = "ACTIVITY") String itemType,
            @RequestBody(required = false) ActivityReviewReportStatusRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.updateReportStatus(activityId, reportId, userId, itemType, request));
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
