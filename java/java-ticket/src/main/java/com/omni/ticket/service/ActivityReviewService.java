package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.ActivityQuestionRequest;
import com.omni.ticket.dto.ActivityQuestionResponse;
import com.omni.ticket.dto.ActivityReviewListResponse;
import com.omni.ticket.dto.ActivityReviewRequest;
import com.omni.ticket.dto.ActivityReviewResponse;
import com.omni.ticket.dto.ActivityReviewSummaryResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivityQuestion;
import com.omni.ticket.entity.ActivityReview;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivityQuestionMapper;
import com.omni.ticket.mapper.ActivityReviewMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ActivityReviewService {

    private static final String PUBLISH_STATUS_PUBLISHED = "published";

    private final ActivityReviewMapper reviewMapper;
    private final ActivityQuestionMapper questionMapper;
    private final ActivityMapper activityMapper;

    public ActivityReviewService(ActivityReviewMapper reviewMapper,
                                 ActivityQuestionMapper questionMapper,
                                 ActivityMapper activityMapper) {
        this.reviewMapper = reviewMapper;
        this.questionMapper = questionMapper;
        this.activityMapper = activityMapper;
    }

    public ActivityReviewListResponse listReviews(Long activityId) {
        requirePublicActivity(activityId);
        List<ActivityReview> reviews = reviewMapper.selectList(new LambdaQueryWrapper<ActivityReview>()
                .eq(ActivityReview::getActivityId, activityId)
                .eq(ActivityReview::getStatus, 1)
                .orderByDesc(ActivityReview::getCreateTime)
                .orderByDesc(ActivityReview::getId));
        ActivityReviewListResponse response = new ActivityReviewListResponse();
        response.setSummary(buildSummary(reviews));
        response.setReviews(reviews.stream().map(this::toReviewResponse).collect(Collectors.toList()));
        return response;
    }

    @Transactional
    public ActivityReviewResponse createReview(Long userId, Long activityId, ActivityReviewRequest request) {
        requireUser(userId);
        requirePublicActivity(activityId);
        if (request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "评价参数不能为空");
        }
        Integer rating = request.getRating();
        if (rating == null || rating < 1 || rating > 5) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "评分必须在1到5星之间");
        }
        Long orderId = request.getOrderId();
        if (orderId != null) {
            Long count = reviewMapper.selectCount(new LambdaQueryWrapper<ActivityReview>()
                    .eq(ActivityReview::getActivityId, activityId)
                    .eq(ActivityReview::getUserId, userId)
                    .eq(ActivityReview::getOrderId, orderId)
                    .eq(ActivityReview::getStatus, 1));
            if (count != null && count > 0) {
                throw new BusinessException(ResultCode.CONFLICT, "该订单已评价");
            }
        }
        ActivityReview review = new ActivityReview();
        review.setActivityId(activityId);
        review.setUserId(userId);
        review.setOrderId(orderId);
        review.setRating(rating);
        review.setContent(trimToNull(request.getContent()));
        review.setImages(trimToNull(request.getImages()));
        review.setLikeCount(0);
        review.setStatus(1);
        reviewMapper.insert(review);
        return toReviewResponse(review);
    }

    public List<ActivityQuestionResponse> listQuestions(Long activityId) {
        requirePublicActivity(activityId);
        return questionMapper.selectList(new LambdaQueryWrapper<ActivityQuestion>()
                        .eq(ActivityQuestion::getActivityId, activityId)
                        .ne(ActivityQuestion::getStatus, "HIDDEN")
                        .orderByDesc(ActivityQuestion::getCreateTime)
                        .orderByDesc(ActivityQuestion::getId))
                .stream()
                .map(this::toQuestionResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ActivityQuestionResponse createQuestion(Long userId, Long activityId, ActivityQuestionRequest request) {
        requireUser(userId);
        requirePublicActivity(activityId);
        String content = request == null ? null : trimToNull(request.getContent());
        if (content == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "问题内容不能为空");
        }
        ActivityQuestion question = new ActivityQuestion();
        question.setActivityId(activityId);
        question.setUserId(userId);
        question.setContent(content);
        question.setStatus("PENDING");
        questionMapper.insert(question);
        return toQuestionResponse(question);
    }

    private ActivityReviewSummaryResponse buildSummary(List<ActivityReview> reviews) {
        Map<Integer, Integer> distribution = new LinkedHashMap<>();
        for (int rating = 5; rating >= 1; rating--) {
            distribution.put(rating, 0);
        }
        int total = 0;
        for (ActivityReview review : reviews) {
            Integer rating = review.getRating();
            if (rating != null && distribution.containsKey(rating)) {
                distribution.put(rating, distribution.get(rating) + 1);
                total += rating;
            }
        }
        ActivityReviewSummaryResponse summary = new ActivityReviewSummaryResponse();
        summary.setReviewCount(reviews.size());
        BigDecimal average = reviews.isEmpty()
                ? BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP)
                : BigDecimal.valueOf(total).divide(BigDecimal.valueOf(reviews.size()), 1, RoundingMode.HALF_UP);
        summary.setAverageRating(average);
        summary.setRatingDistribution(distribution);
        return summary;
    }

    private void requireUser(Long userId) {
        if (userId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
    }

    private void requirePublicActivity(Long activityId) {
        if (activityId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动ID不能为空");
        }
        Activity activity = activityMapper.selectById(activityId);
        if (activity == null
                || !Integer.valueOf(1).equals(activity.getStatus())
                || !PUBLISH_STATUS_PUBLISHED.equals(activity.getPublishStatus())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "活动不存在");
        }
    }

    private ActivityReviewResponse toReviewResponse(ActivityReview review) {
        ActivityReviewResponse response = new ActivityReviewResponse();
        response.setId(review.getId());
        response.setActivityId(review.getActivityId());
        response.setUserId(review.getUserId());
        response.setOrderId(review.getOrderId());
        response.setRating(review.getRating());
        response.setContent(review.getContent());
        response.setImages(review.getImages());
        response.setLikeCount(review.getLikeCount());
        response.setStatus(review.getStatus());
        response.setCreateTime(review.getCreateTime());
        return response;
    }

    private ActivityQuestionResponse toQuestionResponse(ActivityQuestion question) {
        ActivityQuestionResponse response = new ActivityQuestionResponse();
        response.setId(question.getId());
        response.setActivityId(question.getActivityId());
        response.setUserId(question.getUserId());
        response.setContent(question.getContent());
        response.setAnswer(question.getAnswer());
        response.setAnsweredBy(question.getAnsweredBy());
        response.setStatus(question.getStatus());
        response.setCreateTime(question.getCreateTime());
        response.setAnsweredAt(question.getAnsweredAt());
        return response;
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
