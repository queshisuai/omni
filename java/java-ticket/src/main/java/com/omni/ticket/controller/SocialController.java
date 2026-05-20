package com.omni.ticket.controller;

import com.omni.common.result.Result;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * C端评价和动态接口
 */
@RestController
@RequestMapping("/api/ticket")
public class SocialController {

    private static final String SOCIAL_REMOVED_MESSAGE = "评价和动态功能已移除";

    // ========== 评价 ==========

    @GetMapping("/activities/{id}/reviews")
    public Result<Void> listReviews(
            @PathVariable Long id,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return socialRemoved();
    }

    @PostMapping("/reviews")
    public Result<Void> createReview(@RequestBody Map<String, Object> body) {
        return socialRemoved();
    }

    @DeleteMapping("/reviews/{id}")
    public Result<Void> deleteReview(@PathVariable Long id) {
        return socialRemoved();
    }

    // ========== 动态 ==========

    @GetMapping("/activities/{id}/moments")
    public Result<Void> listMoments(
            @PathVariable Long id,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return socialRemoved();
    }

    @PostMapping("/moments")
    public Result<Void> createMoment(@RequestBody Map<String, Object> body) {
        return socialRemoved();
    }

    @DeleteMapping("/moments/{id}")
    public Result<Void> deleteMoment(@PathVariable Long id) {
        return socialRemoved();
    }

    private Result<Void> socialRemoved() {
        return Result.fail(404, SOCIAL_REMOVED_MESSAGE);
    }
}
