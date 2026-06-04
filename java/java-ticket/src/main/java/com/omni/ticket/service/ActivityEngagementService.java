package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.ActivityQuestionRequest;
import com.omni.ticket.dto.ActivityReviewListResponse;
import com.omni.ticket.dto.ActivityReviewRequest;
import com.omni.ticket.dto.ActivityReviewSummaryResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivityQuestion;
import com.omni.ticket.entity.ActivityReview;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivityQuestionMapper;
import com.omni.ticket.mapper.ActivityReviewMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
public class ActivityEngagementService {
    private static final int REVIEW_STATUS_VISIBLE = 1;
    private static final String QUESTION_STATUS_PENDING = "PENDING";
    private static final String QUESTION_STATUS_ANSWERED = "ANSWERED";

    private final ActivityReviewMapper reviewMapper;
    private final ActivityQuestionMapper questionMapper;
    private final ActivityMapper activityMapper;

    public ActivityEngagementService(ActivityReviewMapper reviewMapper,
                                     ActivityQuestionMapper questionMapper,
                                     ActivityMapper activityMapper) {
        this.reviewMapper = reviewMapper;
        this.questionMapper = questionMapper;
        this.activityMapper = activityMapper;
    }

    public ActivityReviewListResponse listReviews(Long activityId) {
        ensureActivityExists(activityId);
        List<ActivityReview> reviews = reviewMapper.selectList(new LambdaQueryWrapper<ActivityReview>()
                .eq(ActivityReview::getActivityId, activityId)
                .eq(ActivityReview::getStatus, REVIEW_STATUS_VISIBLE)
                .orderByDesc(ActivityReview::getCreateTime));
        if (reviews == null) reviews = Collections.emptyList();
        ActivityReviewListResponse response = new ActivityReviewListResponse();
        response.setReviews(reviews);
        response.setSummary(buildSummary(reviews));
        return response;
    }

    public ActivityReview createReview(Long activityId, Long userId, ActivityReviewRequest request) {
        ensureActivityExists(activityId);
        if (userId == null || userId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户ID不正确");
        }
        if (request == null || request.getRating() == null || request.getRating() < 1 || request.getRating() > 5) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "评分必须在1到5之间");
        }
        ActivityReview review = new ActivityReview();
        review.setActivityId(activityId);
        review.setUserId(userId);
        review.setOrderId(request.getOrderId());
        review.setRating(request.getRating());
        review.setContent(trimToNull(request.getContent()));
        review.setImages(trimToNull(request.getImages()));
        review.setLikeCount(0);
        review.setStatus(REVIEW_STATUS_VISIBLE);
        review.setCreateTime(LocalDateTime.now());
        reviewMapper.insert(review);
        return review;
    }

    public List<ActivityQuestion> listQuestions(Long activityId) {
        ensureActivityExists(activityId);
        List<ActivityQuestion> questions = questionMapper.selectList(new LambdaQueryWrapper<ActivityQuestion>()
                .eq(ActivityQuestion::getActivityId, activityId)
                .in(ActivityQuestion::getStatus, List.of(QUESTION_STATUS_PENDING, QUESTION_STATUS_ANSWERED))
                .orderByDesc(ActivityQuestion::getCreateTime));
        return questions == null ? Collections.emptyList() : questions;
    }

    public ActivityQuestion createQuestion(Long activityId, Long userId, ActivityQuestionRequest request) {
        ensureActivityExists(activityId);
        if (userId == null || userId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户ID不正确");
        }
        if (request == null || !StringUtils.hasText(request.getContent())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "问题内容不能为空");
        }
        ActivityQuestion question = new ActivityQuestion();
        question.setActivityId(activityId);
        question.setUserId(userId);
        question.setContent(request.getContent().trim());
        question.setStatus(QUESTION_STATUS_PENDING);
        question.setCreateTime(LocalDateTime.now());
        questionMapper.insert(question);
        return question;
    }

    private ActivityReviewSummaryResponse buildSummary(List<ActivityReview> reviews) {
        ActivityReviewSummaryResponse summary = new ActivityReviewSummaryResponse();
        summary.setReviewCount(reviews.size());
        if (reviews.isEmpty()) {
            summary.setAverageRating(0.0);
            return summary;
        }
        int total = 0;
        Map<String, Integer> distribution = summary.getRatingDistribution();
        for (ActivityReview review : reviews) {
            int rating = review.getRating() == null ? 0 : review.getRating();
            if (rating >= 1 && rating <= 5) {
                total += rating;
                String key = String.valueOf(rating);
                distribution.put(key, distribution.getOrDefault(key, 0) + 1);
            }
        }
        double average = BigDecimal.valueOf(total)
                .divide(BigDecimal.valueOf(reviews.size()), 1, RoundingMode.HALF_UP)
                .doubleValue();
        summary.setAverageRating(average);
        return summary;
    }

    private void ensureActivityExists(Long activityId) {
        if (activityId == null || activityId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动ID不正确");
        }
        Activity activity = activityMapper.selectById(activityId);
        if (activity == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "活动不存在");
        }
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
