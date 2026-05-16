package com.damai.ticket.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.damai.common.result.Result;
import com.damai.ticket.entity.Moment;
import com.damai.ticket.entity.Review;
import com.damai.ticket.mapper.MomentMapper;
import com.damai.ticket.mapper.ReviewMapper;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * C端评价和动态接口
 */
@RestController
@RequestMapping("/api/ticket")
public class SocialController {

    private final ReviewMapper reviewMapper;
    private final MomentMapper momentMapper;

    public SocialController(ReviewMapper reviewMapper, MomentMapper momentMapper) {
        this.reviewMapper = reviewMapper;
        this.momentMapper = momentMapper;
    }

    // ========== 评价 ==========

    @GetMapping("/activities/{id}/reviews")
    public Result<Page<Review>> listReviews(
            @PathVariable Long id,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        LambdaQueryWrapper<Review> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Review::getActivityId, id).eq(Review::getStatus, 1).orderByDesc(Review::getCreateTime);
        return Result.success(reviewMapper.selectPage(new Page<>(page, size), wrapper));
    }

    @PostMapping("/reviews")
    public Result<Review> createReview(@RequestBody Map<String, Object> body) {
        Review review = new Review();
        review.setActivityId(Long.valueOf(body.get("activityId").toString()));
        review.setUserId(Long.valueOf(body.get("userId").toString()));
        if (body.containsKey("orderId") && body.get("orderId") != null)
            review.setOrderId(Long.valueOf(body.get("orderId").toString()));
        review.setRating(Integer.valueOf(body.get("rating").toString()));
        review.setContent(body.get("content") != null ? body.get("content").toString() : null);
        review.setImages(body.get("images") != null ? body.get("images").toString() : null);
        review.setLikeCount(0);
        review.setStatus(1);
        reviewMapper.insert(review);
        return Result.success(review);
    }

    @DeleteMapping("/reviews/{id}")
    public Result<Void> deleteReview(@PathVariable Long id) {
        reviewMapper.deleteById(id);
        return Result.success();
    }

    // ========== 动态 ==========

    @GetMapping("/activities/{id}/moments")
    public Result<Page<Moment>> listMoments(
            @PathVariable Long id,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        LambdaQueryWrapper<Moment> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Moment::getActivityId, id).eq(Moment::getStatus, 1).orderByDesc(Moment::getCreateTime);
        return Result.success(momentMapper.selectPage(new Page<>(page, size), wrapper));
    }

    @PostMapping("/moments")
    public Result<Moment> createMoment(@RequestBody Map<String, Object> body) {
        Moment moment = new Moment();
        moment.setUserId(Long.valueOf(body.get("userId").toString()));
        if (body.containsKey("activityId") && body.get("activityId") != null)
            moment.setActivityId(Long.valueOf(body.get("activityId").toString()));
        moment.setContent(body.get("content").toString());
        moment.setImages(body.get("images") != null ? body.get("images").toString() : null);
        moment.setLikeCount(0);
        moment.setCommentCount(0);
        moment.setStatus(1);
        momentMapper.insert(moment);
        return Result.success(moment);
    }

    @DeleteMapping("/moments/{id}")
    public Result<Void> deleteMoment(@PathVariable Long id) {
        momentMapper.deleteById(id);
        return Result.success();
    }
}
