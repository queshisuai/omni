package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.ActivityQuestionModerationRequest;
import com.omni.ticket.dto.ActivityQuestionRequest;
import com.omni.ticket.dto.ActivityReviewListResponse;
import com.omni.ticket.dto.ActivityReviewModerationRequest;
import com.omni.ticket.dto.ActivityReviewReportModerationRequest;
import com.omni.ticket.dto.ActivityReviewReportRequest;
import com.omni.ticket.dto.ActivityReviewRequest;
import com.omni.ticket.dto.ActivityReviewSummaryResponse;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivityQuestion;
import com.omni.ticket.entity.ActivityReview;
import com.omni.ticket.entity.ActivityReviewReport;
import com.omni.ticket.entity.Session;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivityQuestionMapper;
import com.omni.ticket.mapper.ActivityReviewMapper;
import com.omni.ticket.mapper.ActivityReviewReportMapper;
import com.omni.ticket.mapper.SessionMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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
    private static final int REVIEW_STATUS_PENDING = 0;
    private static final int REVIEW_STATUS_VISIBLE = 1;
    private static final int REVIEW_STATUS_HIDDEN = 2;
    private static final int ORDER_STATUS_PAID = 2;
    private static final int ORDER_STATUS_REFUNDED = 4;
    private static final String QUESTION_STATUS_PENDING = "PENDING";
    private static final String QUESTION_STATUS_ANSWERED = "ANSWERED";
    private static final String QUESTION_STATUS_HIDDEN = "HIDDEN";
    private static final String REPORT_STATUS_PENDING = "PENDING";
    private static final String REPORT_STATUS_RESOLVED = "RESOLVED";
    private static final String REPORT_STATUS_REJECTED = "REJECTED";
    private static final String PERMISSION_REVIEW_MANAGE = "activity.review.manage";

    private final ActivityReviewMapper reviewMapper;
    private final ActivityQuestionMapper questionMapper;
    private final ActivityReviewReportMapper reportMapper;
    private final ActivityMapper activityMapper;
    private final SessionMapper sessionMapper;
    private final OrderInternalClient orderInternalClient;
    private final UserAccessService userAccessService;
    private final String internalApiToken;

    public ActivityEngagementService(ActivityReviewMapper reviewMapper,
                                     ActivityQuestionMapper questionMapper,
                                     ActivityMapper activityMapper) {
        this(reviewMapper, questionMapper, null, activityMapper, null, null, null, null);
    }

    @Autowired
    public ActivityEngagementService(ActivityReviewMapper reviewMapper,
                                     ActivityQuestionMapper questionMapper,
                                     ActivityReviewReportMapper reportMapper,
                                     ActivityMapper activityMapper,
                                     SessionMapper sessionMapper,
                                     OrderInternalClient orderInternalClient,
                                     UserAccessService userAccessService,
                                     @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.reviewMapper = reviewMapper;
        this.questionMapper = questionMapper;
        this.reportMapper = reportMapper;
        this.activityMapper = activityMapper;
        this.sessionMapper = sessionMapper;
        this.orderInternalClient = orderInternalClient;
        this.userAccessService = userAccessService;
        this.internalApiToken = internalApiToken;
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
        if (request.getOrderId() == null || request.getOrderId() <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "评价必须选择已支付订单");
        }
        OrderInfoResponse order = requireEligibleOrder(activityId, userId, request.getOrderId());
        ensureOrderNotReviewed(activityId, userId, order.getId());
        ActivityReview review = new ActivityReview();
        review.setActivityId(activityId);
        review.setUserId(userId);
        review.setOrderId(order.getId());
        review.setRating(request.getRating());
        review.setContent(trimToNull(request.getContent()));
        review.setImages(trimToNull(request.getImages()));
        review.setLikeCount(0);
        review.setStatus(REVIEW_STATUS_PENDING);
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

    public ActivityReviewReport reportReview(Long activityId, Long reviewId, Long userId, ActivityReviewReportRequest request) {
        ensureActivityExists(activityId);
        if (reviewId == null || reviewId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "评价ID不正确");
        }
        if (userId == null || userId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户ID不正确");
        }
        if (request == null || !StringUtils.hasText(request.getReason())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "举报原因不能为空");
        }
        ActivityReview review = reviewMapper.selectById(reviewId);
        if (review == null || !activityId.equals(review.getActivityId())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "评价不存在");
        }
        if (!Integer.valueOf(REVIEW_STATUS_VISIBLE).equals(review.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "当前评价不可举报");
        }
        List<ActivityReviewReport> existing = reportMapper.selectList(new LambdaQueryWrapper<ActivityReviewReport>()
                .eq(ActivityReviewReport::getReviewId, reviewId)
                .eq(ActivityReviewReport::getUserId, userId)
                .eq(ActivityReviewReport::getStatus, REPORT_STATUS_PENDING));
        if (existing != null && !existing.isEmpty()) {
            throw new BusinessException(ResultCode.CONFLICT, "已举报过该评价");
        }
        ActivityReviewReport report = new ActivityReviewReport();
        report.setReviewId(reviewId);
        report.setActivityId(activityId);
        report.setUserId(userId);
        report.setReason(request.getReason().trim());
        report.setStatus(REPORT_STATUS_PENDING);
        report.setCreateTime(LocalDateTime.now());
        reportMapper.insert(report);
        return report;
    }

    public List<ActivityReview> listAdminReviews(Long userId, Long activityId, Integer status) {
        requireReviewManagePermission(userId);
        LambdaQueryWrapper<ActivityReview> query = new LambdaQueryWrapper<ActivityReview>()
                .orderByDesc(ActivityReview::getCreateTime);
        if (activityId != null && activityId > 0) {
            query.eq(ActivityReview::getActivityId, activityId);
        }
        if (status != null) {
            query.eq(ActivityReview::getStatus, status);
        }
        List<ActivityReview> reviews = reviewMapper.selectList(query);
        return reviews == null ? Collections.emptyList() : reviews;
    }

    public ActivityReview moderateReview(Long reviewId, Long userId, ActivityReviewModerationRequest request) {
        if (request == null || !StringUtils.hasText(request.getAction())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "审核动作不能为空");
        }
        String action = request.getAction().trim().toUpperCase();
        if ("APPROVE".equals(action)) {
            return approveReview(reviewId, userId);
        }
        if ("HIDE".equals(action)) {
            return updateReviewStatus(reviewId, userId, REVIEW_STATUS_HIDDEN);
        }
        if ("RESTORE".equals(action)) {
            return updateReviewStatus(reviewId, userId, REVIEW_STATUS_VISIBLE);
        }
        throw new BusinessException(ResultCode.BAD_REQUEST, "不支持的审核动作");
    }

    public ActivityReview approveReview(Long reviewId, Long userId) {
        return updateReviewStatus(reviewId, userId, REVIEW_STATUS_VISIBLE);
    }

    public List<ActivityReviewReport> listAdminReports(Long userId, String status) {
        requireReviewManagePermission(userId);
        LambdaQueryWrapper<ActivityReviewReport> query = new LambdaQueryWrapper<ActivityReviewReport>()
                .orderByDesc(ActivityReviewReport::getCreateTime);
        if (StringUtils.hasText(status)) {
            query.eq(ActivityReviewReport::getStatus, status.trim().toUpperCase());
        }
        List<ActivityReviewReport> reports = reportMapper.selectList(query);
        return reports == null ? Collections.emptyList() : reports;
    }

    public ActivityReviewReport moderateReport(Long reportId, Long userId, ActivityReviewReportModerationRequest request) {
        requireReviewManagePermission(userId);
        if (reportId == null || reportId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "举报ID不正确");
        }
        if (request == null || !StringUtils.hasText(request.getAction())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "处理动作不能为空");
        }
        ActivityReviewReport report = reportMapper.selectById(reportId);
        if (report == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "举报不存在");
        }
        if (!REPORT_STATUS_PENDING.equals(report.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "举报已处理");
        }
        String action = request.getAction().trim().toUpperCase();
        if ("RESOLVE".equals(action) || "HIDE".equals(action)) {
            report.setStatus(REPORT_STATUS_RESOLVED);
            ActivityReview review = reviewMapper.selectById(report.getReviewId());
            if (review != null) {
                review.setStatus(REVIEW_STATUS_HIDDEN);
                reviewMapper.updateById(review);
            }
        } else if ("REJECT".equals(action)) {
            report.setStatus(REPORT_STATUS_REJECTED);
        } else {
            throw new BusinessException(ResultCode.BAD_REQUEST, "不支持的处理动作");
        }
        report.setHandledBy(userId);
        report.setHandleNote(trimToNull(request.getNote()));
        report.setHandledAt(LocalDateTime.now());
        reportMapper.updateById(report);
        return report;
    }

    public List<ActivityQuestion> listAdminQuestions(Long userId, Long activityId, String status) {
        requireReviewManagePermission(userId);
        LambdaQueryWrapper<ActivityQuestion> query = new LambdaQueryWrapper<ActivityQuestion>()
                .orderByDesc(ActivityQuestion::getCreateTime);
        if (activityId != null && activityId > 0) {
            query.eq(ActivityQuestion::getActivityId, activityId);
        }
        if (StringUtils.hasText(status)) {
            query.eq(ActivityQuestion::getStatus, status.trim().toUpperCase());
        }
        List<ActivityQuestion> questions = questionMapper.selectList(query);
        return questions == null ? Collections.emptyList() : questions;
    }

    public ActivityQuestion moderateQuestion(Long questionId, Long userId, ActivityQuestionModerationRequest request) {
        requireReviewManagePermission(userId);
        if (questionId == null || questionId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "问题ID不正确");
        }
        if (request == null || !StringUtils.hasText(request.getAction())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "处理动作不能为空");
        }
        ActivityQuestion question = questionMapper.selectById(questionId);
        if (question == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "问题不存在");
        }
        String action = request.getAction().trim().toUpperCase();
        if ("ANSWER".equals(action)) {
            if (!StringUtils.hasText(request.getAnswer())) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "回复内容不能为空");
            }
            question.setAnswer(request.getAnswer().trim());
            question.setAnsweredBy(userId);
            question.setAnsweredAt(LocalDateTime.now());
            question.setStatus(QUESTION_STATUS_ANSWERED);
        } else if ("HIDE".equals(action)) {
            question.setStatus(QUESTION_STATUS_HIDDEN);
        } else if ("RESTORE".equals(action)) {
            question.setStatus(StringUtils.hasText(question.getAnswer()) ? QUESTION_STATUS_ANSWERED : QUESTION_STATUS_PENDING);
        } else {
            throw new BusinessException(ResultCode.BAD_REQUEST, "不支持的处理动作");
        }
        questionMapper.updateById(question);
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

    private OrderInfoResponse requireEligibleOrder(Long activityId, Long userId, Long orderId) {
        if (!StringUtils.hasText(internalApiToken)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "内部接口令牌未配置");
        }
        if (orderInternalClient == null) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "订单服务未配置");
        }
        Result<OrderInfoResponse> result;
        try {
            result = orderInternalClient.getOrderDetail(orderId, internalApiToken);
        } catch (RuntimeException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "订单服务无响应");
        }
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode() || result.getData() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "订单不存在或无法校验");
        }
        OrderInfoResponse order = result.getData();
        if (!userId.equals(order.getUserId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "只能评价自己的订单");
        }
        Integer status = order.getStatus();
        if (!Integer.valueOf(ORDER_STATUS_PAID).equals(status) && !Integer.valueOf(ORDER_STATUS_REFUNDED).equals(status)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "订单未支付，暂不能评价");
        }
        Long orderActivityId = order.getActivityId();
        if (orderActivityId == null && order.getSessionId() != null && sessionMapper != null) {
            Session session = sessionMapper.selectById(order.getSessionId());
            if (session != null) {
                orderActivityId = session.getActivityId();
            }
        }
        if (!activityId.equals(orderActivityId)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "订单不属于当前活动");
        }
        return order;
    }

    private void ensureOrderNotReviewed(Long activityId, Long userId, Long orderId) {
        List<ActivityReview> existing = reviewMapper.selectList(new LambdaQueryWrapper<ActivityReview>()
                .eq(ActivityReview::getActivityId, activityId)
                .eq(ActivityReview::getUserId, userId)
                .eq(ActivityReview::getOrderId, orderId)
                .in(ActivityReview::getStatus, List.of(REVIEW_STATUS_PENDING, REVIEW_STATUS_VISIBLE)));
        if (existing != null && !existing.isEmpty()) {
            throw new BusinessException(ResultCode.CONFLICT, "该订单已提交过评价");
        }
    }

    private ActivityReview updateReviewStatus(Long reviewId, Long userId, int status) {
        requireReviewManagePermission(userId);
        if (reviewId == null || reviewId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "评价ID不正确");
        }
        ActivityReview review = reviewMapper.selectById(reviewId);
        if (review == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "评价不存在");
        }
        review.setStatus(status);
        reviewMapper.updateById(review);
        return review;
    }

    private void requireReviewManagePermission(Long userId) {
        if (userAccessService == null) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "用户权限服务未配置");
        }
        userAccessService.requirePlatformPermission(userId, PERMISSION_REVIEW_MANAGE);
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
