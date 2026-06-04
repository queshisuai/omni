package com.omni.ticket.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.result.Result;
import com.omni.ticket.dto.ActivityDetailVO;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.entity.Category;
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

    private final ActivityService activityService;
    private final TourStationService tourStationService;

    public ActivityController(ActivityService activityService) {
        this(activityService, null);
    }

    @Autowired
    public ActivityController(ActivityService activityService, TourStationService tourStationService) {
        this.activityService = activityService;
        this.tourStationService = tourStationService;
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
}
