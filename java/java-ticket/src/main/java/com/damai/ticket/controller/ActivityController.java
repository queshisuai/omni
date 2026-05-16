package com.damai.ticket.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.damai.common.result.Result;
import com.damai.ticket.dto.ActivityDetailVO;
import com.damai.ticket.dto.ActivityVO;
import com.damai.ticket.entity.Category;
import com.damai.ticket.service.ActivityService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 活动接口
 */
@RestController
@RequestMapping("/api/ticket")
public class ActivityController {

    private final ActivityService activityService;

    public ActivityController(ActivityService activityService) {
        this.activityService = activityService;
    }

    /**
     * 活动列表（分页 + 分类筛选）
     */
    @GetMapping("/activities")
    public Result<Page<ActivityVO>> listActivities(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) Long categoryId) {
        Page<ActivityVO> result = activityService.listActivities(page, size, categoryId);
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

    /**
     * 分类列表
     */
    @GetMapping("/categories")
    public Result<List<Category>> listCategories() {
        List<Category> categories = activityService.listCategories();
        return Result.success(categories);
    }
}
