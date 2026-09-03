package com.omni.ticket.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.ActivityQuestionRequest;
import com.omni.ticket.dto.ActivityReviewListResponse;
import com.omni.ticket.dto.ActivityReviewReportRequest;
import com.omni.ticket.dto.ActivityReviewRequest;
import com.omni.ticket.dto.ActivityDetailVO;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.entity.ActivityQuestion;
import com.omni.ticket.entity.ActivityReview;
import com.omni.ticket.entity.ActivityReviewReport;
import com.omni.ticket.entity.Category;
import com.omni.ticket.service.ActivityEngagementService;
import com.omni.ticket.service.ActivityService;
import com.omni.ticket.service.TourStationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 活动接口
 */
@RestController
@RequestMapping("/api/ticket")
public class ActivityController {

    private static final String BEARER_PREFIX = "Bearer ";

    private final ActivityService activityService;
    private final TourStationService tourStationService;
    private final ActivityEngagementService engagementService;

    public ActivityController(ActivityService activityService) {
        this(activityService, null, null);
    }

    public ActivityController(ActivityService activityService, TourStationService tourStationService) {
        this(activityService, tourStationService, null);
    }

    @Autowired
    public ActivityController(ActivityService activityService,
                              TourStationService tourStationService,
                              ActivityEngagementService engagementService) {
        this.activityService = activityService;
        this.tourStationService = tourStationService;
        this.engagementService = engagementService;
    }

    /**
     * 活动列表（分页 + 分类筛选）
     */
    @GetMapping("/activities")
    public Result<Page<ActivityVO>> listActivities(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) String saleStatus,
            @RequestParam(required = false) Boolean seatMapOnly,
            @RequestParam(name = "isSupportSeat", required = false) Boolean isSupportSeat,
            @RequestParam(required = false) Boolean realNameRequired,
            @RequestParam(required = false) String sort) {
        Boolean supportSeatOnly = resolveSupportSeatOnly(seatMapOnly, isSupportSeat);
        Page<ActivityVO> result = activityService.searchActivities(page, size, categoryId, keyword, city, dateFrom,
                dateTo, minPrice, maxPrice, saleStatus, supportSeatOnly, realNameRequired, sort);
        return Result.success(result);
    }

    public Result<Page<ActivityVO>> listActivities(
            Integer page,
            Integer size,
            Long categoryId,
            String keyword,
            String city,
            LocalDate dateFrom,
            LocalDate dateTo,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            String saleStatus,
            Boolean seatMapOnly,
            Boolean realNameRequired,
            String sort) {
        return listActivities(page, size, categoryId, keyword, city, dateFrom, dateTo, minPrice, maxPrice,
                saleStatus, seatMapOnly, null, realNameRequired, sort);
    }

    /**
     * 活动详情（含场次和票档）
     */
    @GetMapping("/activities/{id}")
    public Result<ActivityDetailVO> getActivityDetail(@PathVariable Long id) {
        ActivityDetailVO detail = activityService.getActivityDetail(id);
        return Result.success(detail);
    }

    @GetMapping("/activities/{id}/reviews")
    public Result<ActivityReviewListResponse> listActivityReviews(@PathVariable Long id) {
        return Result.success(engagementService.listReviews(id));
    }

    @PostMapping("/activities/{id}/reviews")
    public Result<ActivityReview> createActivityReview(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestBody(required = false) ActivityReviewRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.createReview(id, userId, request));
    }

    @PostMapping("/activities/{id}/reviews/{reviewId}/reports")
    public Result<ActivityReviewReport> reportActivityReview(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @PathVariable Long reviewId,
            @RequestBody(required = false) ActivityReviewReportRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.reportReview(id, reviewId, userId, request));
    }

    @GetMapping("/activities/{id}/questions")
    public Result<List<ActivityQuestion>> listActivityQuestions(@PathVariable Long id) {
        return Result.success(engagementService.listQuestions(id));
    }

    @PostMapping("/activities/{id}/questions")
    public Result<ActivityQuestion> createActivityQuestion(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestBody(required = false) ActivityQuestionRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(engagementService.createQuestion(id, userId, request));
    }

    @GetMapping("/tours/{id}")
    public Result<Map<String, Object>> getTourDetail(@PathVariable Long id) {
        return Result.success(tourStationService.getTourDetail(id));
    }

    /**
     * 分类列表
     */
    @GetMapping("/categories")
    public Result<List<Category>> listCategories() {
        List<Category> categories = activityService.listCategories();
        return Result.success(categories);
    }

    private Boolean resolveSupportSeatOnly(Boolean seatMapOnly, Boolean isSupportSeat) {
        if (Boolean.TRUE.equals(seatMapOnly) || Boolean.TRUE.equals(isSupportSeat)) {
            return Boolean.TRUE;
        }
        if (seatMapOnly != null || isSupportSeat != null) {
            return Boolean.FALSE;
        }
        return null;
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
