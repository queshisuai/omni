package com.omni.ticket.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.ActivityDetailVO;
import com.omni.ticket.dto.ActivityQuestionRequest;
import com.omni.ticket.dto.ActivityQuestionResponse;
import com.omni.ticket.dto.ActivityReviewListResponse;
import com.omni.ticket.dto.ActivityReviewRequest;
import com.omni.ticket.dto.ActivityReviewResponse;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.entity.Category;
import com.omni.ticket.service.ActivityService;
import com.omni.ticket.service.ActivityReviewService;
import com.omni.ticket.service.TourStationService;
import io.jsonwebtoken.Claims;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.util.StringUtils;
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
    private final ActivityReviewService activityReviewService;

    public ActivityController(ActivityService activityService) {
        this(activityService, null, null);
    }

    public ActivityController(ActivityService activityService, TourStationService tourStationService) {
        this(activityService, tourStationService, null);
    }

    @Autowired
    public ActivityController(ActivityService activityService,
                              TourStationService tourStationService,
                              ActivityReviewService activityReviewService) {
        this.activityService = activityService;
        this.tourStationService = tourStationService;
        this.activityReviewService = activityReviewService;
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
            @RequestParam(required = false) Boolean realNameRequired,
            @RequestParam(required = false) String sort) {
        Page<ActivityVO> result = activityService.searchActivities(page, size, categoryId, keyword, city, dateFrom,
                dateTo, minPrice, maxPrice, saleStatus, seatMapOnly, realNameRequired, sort);
        return Result.success(result);
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
        return Result.success(requireActivityReviewService().listReviews(id));
    }

    @PostMapping("/activities/{id}/reviews")
    public Result<ActivityReviewResponse> createActivityReview(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestBody ActivityReviewRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(requireActivityReviewService().createReview(userId, id, request));
    }

    @GetMapping("/activities/{id}/questions")
    public Result<List<ActivityQuestionResponse>> listActivityQuestions(@PathVariable Long id) {
        return Result.success(requireActivityReviewService().listQuestions(id));
    }

    @PostMapping("/activities/{id}/questions")
    public Result<ActivityQuestionResponse> createActivityQuestion(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestBody ActivityQuestionRequest request) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        return Result.success(requireActivityReviewService().createQuestion(userId, id, request));
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

    private ActivityReviewService requireActivityReviewService() {
        if (activityReviewService == null) {
            throw new IllegalStateException("活动评价服务未配置");
        }
        return activityReviewService;
    }

    private Long parseUserId(String authorization) {
        if (!StringUtils.hasText(authorization) || !authorization.startsWith(BEARER_PREFIX)) {
            return null;
        }
        try {
            Claims claims = JwtUtil.parseToken(authorization.substring(BEARER_PREFIX.length()));
            return Long.valueOf(claims.getSubject());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
