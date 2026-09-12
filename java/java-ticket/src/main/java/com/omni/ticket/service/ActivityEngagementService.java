package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.ActivityEngagementOverviewResponse;
import com.omni.ticket.dto.ActivityQuestionModerationRequest;
import com.omni.ticket.dto.ActivityQuestionReplyRequest;
import com.omni.ticket.dto.ActivityQuestionRequest;
import com.omni.ticket.dto.ActivityQuestionUpdateRequest;
import com.omni.ticket.dto.ActivityReviewListResponse;
import com.omni.ticket.dto.ActivityReviewModerationRequest;
import com.omni.ticket.dto.ActivityReviewReportModerationRequest;
import com.omni.ticket.dto.ActivityReviewReportRequest;
import com.omni.ticket.dto.ActivityReviewReportStatusRequest;
import com.omni.ticket.dto.ActivityReviewRequest;
import com.omni.ticket.dto.ActivityReviewStatusRequest;
import com.omni.ticket.dto.ActivityReviewSummaryResponse;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivityQuestion;
import com.omni.ticket.entity.ActivityReview;
import com.omni.ticket.entity.ActivityReviewReport;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.Tour;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivityQuestionMapper;
import com.omni.ticket.mapper.ActivityReviewMapper;
import com.omni.ticket.mapper.ActivityReviewReportMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TourMapper;
import com.omni.ticket.search.ActivitySearchIndexEventPublisher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

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
    private static final String ITEM_TYPE_ACTIVITY = "ACTIVITY";
    private static final String ITEM_TYPE_TOUR = "TOUR";
    private static final String PUBLISH_STATUS_DELETED = "deleted";
    private static final String REPLY_IDENTITY_OFFICIAL_SUPPORT = "OFFICIAL_SUPPORT";
    private static final String REPLY_IDENTITY_ORGANIZER_PROXY = "ORGANIZER_PROXY";
    private static final String PERMISSION_REVIEW_MANAGE = "activity.review.manage";

    private final ActivityReviewMapper reviewMapper;
    private final ActivityQuestionMapper questionMapper;
    private final ActivityReviewReportMapper reportMapper;
    private final ActivityMapper activityMapper;
    private final TourMapper tourMapper;
    private final SessionMapper sessionMapper;
    private final OrderInternalClient orderInternalClient;
    private final UserAccessService userAccessService;
    private final String internalApiToken;
    private ActivitySearchIndexEventPublisher searchIndexEventPublisher;

    public ActivityEngagementService(ActivityReviewMapper reviewMapper,
                                     ActivityQuestionMapper questionMapper,
                                     ActivityMapper activityMapper) {
        this(reviewMapper, questionMapper, null, activityMapper, null, null, null, null, null);
    }

    public ActivityEngagementService(ActivityReviewMapper reviewMapper,
                                     ActivityQuestionMapper questionMapper,
                                     ActivityReviewReportMapper reportMapper,
                                     ActivityMapper activityMapper,
                                     SessionMapper sessionMapper,
                                     OrderInternalClient orderInternalClient,
                                     UserAccessService userAccessService,
                                     String internalApiToken) {
        this(reviewMapper, questionMapper, reportMapper, activityMapper, null,
                sessionMapper, orderInternalClient, userAccessService, internalApiToken);
    }

    @Autowired
    public ActivityEngagementService(ActivityReviewMapper reviewMapper,
                                     ActivityQuestionMapper questionMapper,
                                     ActivityReviewReportMapper reportMapper,
                                     ActivityMapper activityMapper,
                                     TourMapper tourMapper,
                                     SessionMapper sessionMapper,
                                     OrderInternalClient orderInternalClient,
                                     UserAccessService userAccessService,
                                     @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.reviewMapper = reviewMapper;
        this.questionMapper = questionMapper;
        this.reportMapper = reportMapper;
        this.activityMapper = activityMapper;
        this.tourMapper = tourMapper;
        this.sessionMapper = sessionMapper;
        this.orderInternalClient = orderInternalClient;
        this.userAccessService = userAccessService;
        this.internalApiToken = internalApiToken;
    }

    @Autowired(required = false)
    public void setSearchIndexEventPublisher(ActivitySearchIndexEventPublisher searchIndexEventPublisher) {
        this.searchIndexEventPublisher = searchIndexEventPublisher;
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

    public Page<ActivityEngagementOverviewResponse> listAdminActivityEngagements(Long userId,
                                                                                 Integer page,
                                                                                 Integer size,
                                                                                 String keyword,
                                                                                 String itemType,
                                                                                 Boolean todoOnly) {
        requireReviewManagePermission(userId);
        int current = page == null || page < 1 ? 1 : page;
        int pageSize = size == null || size < 1 ? 10 : Math.min(size, 100);
        String normalizedType = normalizeOptionalItemType(itemType);
        List<ActivityEngagementOverviewResponse> rows = new ArrayList<>();
        if (normalizedType == null || ITEM_TYPE_ACTIVITY.equals(normalizedType)) {
            rows.addAll(buildActivityOverviews(keyword));
        }
        if (normalizedType == null || ITEM_TYPE_TOUR.equals(normalizedType)) {
            rows.addAll(buildTourOverviews(keyword));
        }
        if (Boolean.TRUE.equals(todoOnly)) {
            rows = rows.stream()
                    .filter(row -> safeLong(row.getPendingReviewCount()) > 0
                            || safeLong(row.getPendingQuestionCount()) > 0
                            || safeLong(row.getPendingReportCount()) > 0)
                    .collect(Collectors.toList());
        }
        int fromIndex = Math.min((current - 1) * pageSize, rows.size());
        int toIndex = Math.min(fromIndex + pageSize, rows.size());
        Page<ActivityEngagementOverviewResponse> result = new Page<>(current, pageSize, rows.size());
        result.setRecords(new ArrayList<>(rows.subList(fromIndex, toIndex)));
        return result;
    }

    public List<ActivityReview> listAdminReviews(Long userId, Long activityId, Integer status) {
        requireReviewManagePermission(userId);
        return listReviewsByActivityIds(activityId == null || activityId <= 0 ? null : List.of(activityId), status);
    }

    public List<ActivityReview> listAdminReviews(Long userId, Long targetId, String itemType, Integer status) {
        requireReviewManagePermission(userId);
        return listReviewsByActivityIds(resolveTargetActivityIds(targetId, itemType), status);
    }

    public ActivityReview moderateReview(Long reviewId, Long userId, ActivityReviewModerationRequest request) {
        if (request == null || !StringUtils.hasText(request.getAction())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "审核动作不能为空");
        }
        String action = request.getAction().trim().toUpperCase(Locale.ROOT);
        ActivityReviewStatusRequest statusRequest = new ActivityReviewStatusRequest();
        if ("APPROVE".equals(action)) {
            statusRequest.setStatus(REVIEW_STATUS_VISIBLE);
            statusRequest.setReason(StringUtils.hasText(request.getNote()) ? request.getNote().trim() : "审核通过并公开评价");
            return updateReviewStatus(null, reviewId, userId, ITEM_TYPE_ACTIVITY, statusRequest);
        }
        if ("HIDE".equals(action)) {
            statusRequest.setStatus(REVIEW_STATUS_HIDDEN);
            statusRequest.setReason(request.getNote());
            return updateReviewStatus(null, reviewId, userId, ITEM_TYPE_ACTIVITY, statusRequest);
        }
        if ("RESTORE".equals(action)) {
            statusRequest.setStatus(REVIEW_STATUS_VISIBLE);
            statusRequest.setReason(StringUtils.hasText(request.getNote()) ? request.getNote().trim() : "恢复展示评价");
            return updateReviewStatus(null, reviewId, userId, ITEM_TYPE_ACTIVITY, statusRequest);
        }
        throw new BusinessException(ResultCode.BAD_REQUEST, "不支持的审核动作");
    }

    public ActivityReview approveReview(Long reviewId, Long userId) {
        ActivityReviewStatusRequest request = new ActivityReviewStatusRequest();
        request.setStatus(REVIEW_STATUS_VISIBLE);
        request.setReason("审核通过并公开评价");
        return updateReviewStatus(null, reviewId, userId, ITEM_TYPE_ACTIVITY, request);
    }

    @Transactional
    public ActivityReview updateReviewStatus(Long targetId,
                                             Long reviewId,
                                             Long userId,
                                             String itemType,
                                             ActivityReviewStatusRequest request) {
        InternalAuthContextResponse auth = requireReviewManagePermission(userId);
        int status = requireReviewStatus(request);
        String reason = REVIEW_STATUS_HIDDEN == status ? requireReason(request.getReason()) : trimToNull(request.getReason());
        if (reviewId == null || reviewId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "评价ID不正确");
        }
        ActivityReview review = reviewMapper.selectById(reviewId);
        if (review == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "评价不存在");
        }
        ensureBelongsToTarget(review.getActivityId(), targetId, itemType, "评价不属于当前活动/巡演");
        review.setStatus(status);
        reviewMapper.updateById(review);
        writeAudit(auth, userId, reviewAuditAction(status), "activity_review", review.getId(),
                "activity:" + review.getActivityId(), defaultReviewReason(status, reason),
                "评价状态更新为 " + status);
        publishActivityIndexUpsert(review.getActivityId());
        return review;
    }

    public List<ActivityReviewReport> listAdminReports(Long userId, String status) {
        requireReviewManagePermission(userId);
        return listReportsByActivityIds(null, status);
    }

    public List<ActivityReviewReport> listAdminReports(Long userId, Long targetId, String itemType, String status) {
        requireReviewManagePermission(userId);
        return listReportsByActivityIds(resolveTargetActivityIds(targetId, itemType), status);
    }

    @Transactional
    public ActivityReviewReport moderateReport(Long reportId, Long userId, ActivityReviewReportModerationRequest request) {
        if (request == null || !StringUtils.hasText(request.getAction())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "处理动作不能为空");
        }
        ActivityReviewReportStatusRequest statusRequest = new ActivityReviewReportStatusRequest();
        statusRequest.setAction(request.getAction());
        statusRequest.setReason(request.getNote());
        return updateReportStatus(null, reportId, userId, ITEM_TYPE_ACTIVITY, statusRequest);
    }

    @Transactional
    public ActivityReviewReport updateReportStatus(Long targetId,
                                                   Long reportId,
                                                   Long userId,
                                                   String itemType,
                                                   ActivityReviewReportStatusRequest request) {
        InternalAuthContextResponse auth = requireReviewManagePermission(userId);
        String action = requireReportAction(request);
        String reason = ("RESOLVE".equals(action) || "HIDE".equals(action)) ? requireReason(request.getReason()) : trimToNull(request.getReason());
        if (reportId == null || reportId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "举报ID不正确");
        }
        ActivityReviewReport report = reportMapper.selectById(reportId);
        if (report == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "举报不存在");
        }
        ensureBelongsToTarget(report.getActivityId(), targetId, itemType, "举报不属于当前活动/巡演");
        if (!REPORT_STATUS_PENDING.equals(report.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "举报已处理");
        }
        if ("RESOLVE".equals(action) || "HIDE".equals(action)) {
            report.setStatus(REPORT_STATUS_RESOLVED);
            ActivityReview review = reviewMapper.selectById(report.getReviewId());
            if (review != null) {
                review.setStatus(REVIEW_STATUS_HIDDEN);
                reviewMapper.updateById(review);
                publishActivityIndexUpsert(review.getActivityId());
            }
        } else if ("REJECT".equals(action)) {
            report.setStatus(REPORT_STATUS_REJECTED);
        } else {
            throw new BusinessException(ResultCode.BAD_REQUEST, "不支持的处理动作");
        }
        report.setHandledBy(userId);
        report.setHandleNote(reason);
        report.setHandledAt(LocalDateTime.now());
        reportMapper.updateById(report);
        writeAudit(auth, userId, "REJECT".equals(action) ? "activity_review_report.reject" : "activity_review_report.resolve",
                "activity_review_report", report.getId(), "review:" + report.getReviewId(),
                reason == null ? "驳回举报" : reason, "举报状态更新为 " + report.getStatus());
        return report;
    }

    public List<ActivityQuestion> listAdminQuestions(Long userId, Long activityId, String status) {
        requireReviewManagePermission(userId);
        return listQuestionsByActivityIds(activityId == null || activityId <= 0 ? null : List.of(activityId), status);
    }

    public List<ActivityQuestion> listAdminQuestions(Long userId, Long targetId, String itemType, String status) {
        requireReviewManagePermission(userId);
        return listQuestionsByActivityIds(resolveTargetActivityIds(targetId, itemType), status);
    }

    @Transactional
    public ActivityQuestion moderateQuestion(Long questionId, Long userId, ActivityQuestionModerationRequest request) {
        if (request == null || !StringUtils.hasText(request.getAction())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "处理动作不能为空");
        }
        String action = request.getAction().trim().toUpperCase(Locale.ROOT);
        if ("ANSWER".equals(action)) {
            ActivityQuestionReplyRequest replyRequest = new ActivityQuestionReplyRequest();
            replyRequest.setAnswer(request.getAnswer());
            replyRequest.setReplyIdentity(REPLY_IDENTITY_ORGANIZER_PROXY);
            return replyQuestion(null, questionId, userId, ITEM_TYPE_ACTIVITY, replyRequest);
        }
        ActivityQuestionUpdateRequest updateRequest = new ActivityQuestionUpdateRequest();
        if ("HIDE".equals(action)) {
            updateRequest.setStatus(QUESTION_STATUS_HIDDEN);
            return updateQuestion(null, questionId, userId, ITEM_TYPE_ACTIVITY, updateRequest);
        }
        if ("RESTORE".equals(action)) {
            updateRequest.setStatus(null);
            updateRequest.setReason("恢复问答展示");
            return restoreQuestion(questionId, userId, updateRequest);
        }
        throw new BusinessException(ResultCode.BAD_REQUEST, "不支持的处理动作");
    }

    @Transactional
    public ActivityQuestion replyQuestion(Long targetId,
                                          Long questionId,
                                          Long userId,
                                          String itemType,
                                          ActivityQuestionReplyRequest request) {
        requireReviewManagePermission(userId);
        if (questionId == null || questionId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "问题ID不正确");
        }
        if (request == null || !StringUtils.hasText(request.getAnswer())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "回复内容不能为空");
        }
        String replyIdentity = normalizeReplyIdentity(request.getReplyIdentity(), true);
        ActivityQuestion question = questionMapper.selectById(questionId);
        if (question == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "问题不存在");
        }
        ensureBelongsToTarget(question.getActivityId(), targetId, itemType, "问题不属于当前活动/巡演");
        question.setAnswer(request.getAnswer().trim());
        question.setAnsweredBy(userId);
        question.setAnsweredAt(LocalDateTime.now());
        question.setReplyIdentity(replyIdentity);
        question.setStatus(QUESTION_STATUS_ANSWERED);
        questionMapper.updateById(question);
        return question;
    }

    @Transactional
    public ActivityQuestion updateQuestion(Long targetId,
                                           Long questionId,
                                           Long userId,
                                           String itemType,
                                           ActivityQuestionUpdateRequest request) {
        InternalAuthContextResponse auth = requireReviewManagePermission(userId);
        if (request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "问答更新参数不能为空");
        }
        String reason = requireReason(request.getReason());
        if (questionId == null || questionId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "问题ID不正确");
        }
        String nextStatus = normalizeQuestionStatus(request.getStatus());
        String nextAnswer = request.getAnswer() == null ? null : requireAnswer(request.getAnswer());
        String nextIdentity = request.getReplyIdentity() == null
                ? null
                : normalizeReplyIdentity(request.getReplyIdentity(), false);
        ActivityQuestion question = questionMapper.selectById(questionId);
        if (question == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "问题不存在");
        }
        ensureBelongsToTarget(question.getActivityId(), targetId, itemType, "问题不属于当前活动/巡演");
        if (nextAnswer != null) {
            question.setAnswer(nextAnswer);
            question.setAnsweredBy(userId);
            question.setAnsweredAt(LocalDateTime.now());
            if (nextIdentity != null) {
                question.setReplyIdentity(nextIdentity);
            }
            if (nextStatus == null) {
                nextStatus = QUESTION_STATUS_ANSWERED;
            }
        } else if (nextIdentity != null) {
            question.setReplyIdentity(nextIdentity);
        }
        if (nextStatus != null) {
            question.setStatus(nextStatus);
        }
        questionMapper.updateById(question);
        writeAudit(auth, userId,
                QUESTION_STATUS_HIDDEN.equals(nextStatus) ? "activity_question.hide" : "activity_question.rewrite",
                "activity_question", question.getId(), "activity:" + question.getActivityId(),
                reason, "问答状态更新为 " + question.getStatus());
        return question;
    }

    private ActivityQuestion restoreQuestion(Long questionId, Long userId, ActivityQuestionUpdateRequest request) {
        InternalAuthContextResponse auth = requireReviewManagePermission(userId);
        if (questionId == null || questionId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "问题ID不正确");
        }
        ActivityQuestion question = questionMapper.selectById(questionId);
        if (question == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "问题不存在");
        }
        question.setStatus(StringUtils.hasText(question.getAnswer()) ? QUESTION_STATUS_ANSWERED : QUESTION_STATUS_PENDING);
        questionMapper.updateById(question);
        writeAudit(auth, userId, "activity_question.rewrite", "activity_question", question.getId(),
                "activity:" + question.getActivityId(), trimToNull(request.getReason()), "恢复问答展示");
        return question;
    }

    private List<ActivityEngagementOverviewResponse> buildActivityOverviews(String keyword) {
        LambdaQueryWrapper<Activity> wrapper = activeActivityWrapper()
                .isNull(Activity::getTourId)
                .orderByAsc(Activity::getId);
        if (StringUtils.hasText(keyword)) {
            wrapper.like(Activity::getName, keyword.trim());
        }
        List<Activity> activities = activityMapper.selectList(wrapper);
        if (activities == null || activities.isEmpty()) {
            return Collections.emptyList();
        }
        List<ActivityEngagementOverviewResponse> rows = new ArrayList<>();
        for (Activity activity : activities) {
            rows.add(buildOverview(activity.getId(), ITEM_TYPE_ACTIVITY, activity.getName(), activity.getPoster(),
                    activity.getOrganizerId(), List.of(activity.getId())));
        }
        return rows;
    }

    private List<ActivityEngagementOverviewResponse> buildTourOverviews(String keyword) {
        if (tourMapper == null) {
            return Collections.emptyList();
        }
        LambdaQueryWrapper<Tour> wrapper = new LambdaQueryWrapper<Tour>()
                .eq(Tour::getStatus, 1)
                .orderByAsc(Tour::getId);
        if (StringUtils.hasText(keyword)) {
            wrapper.like(Tour::getTitle, keyword.trim());
        }
        List<Tour> tours = tourMapper.selectList(wrapper);
        if (tours == null || tours.isEmpty()) {
            return Collections.emptyList();
        }
        List<ActivityEngagementOverviewResponse> rows = new ArrayList<>();
        for (Tour tour : tours) {
            List<Activity> activities = listTourActivities(tour.getId(), false);
            List<Long> activityIds = activities.stream()
                    .map(Activity::getId)
                    .filter(id -> id != null && id > 0)
                    .collect(Collectors.toList());
            rows.add(buildOverview(tour.getId(), ITEM_TYPE_TOUR, tour.getTitle(), tour.getPoster(),
                    tour.getOrganizerId(), activityIds));
        }
        return rows;
    }

    private ActivityEngagementOverviewResponse buildOverview(Long targetId,
                                                             String targetType,
                                                             String activityName,
                                                             String poster,
                                                             Long organizerId,
                                                             List<Long> activityIds) {
        EngagementCounts reviewCounts = countReviews(activityIds);
        EngagementCounts questionCounts = countQuestions(activityIds);
        EngagementCounts reportCounts = countReports(activityIds);
        ActivityEngagementOverviewResponse response = new ActivityEngagementOverviewResponse();
        response.setTargetId(targetId);
        response.setTargetType(targetType);
        response.setActivityName(activityName);
        response.setPoster(poster);
        response.setOrganizerId(organizerId);
        response.setOrganizerName(resolveOrganizerName(organizerId));
        response.setPendingReviewCount(reviewCounts.pending);
        response.setPublishedReviewCount(reviewCounts.published);
        response.setHiddenReviewCount(reviewCounts.hidden);
        response.setTotalReviewCount(reviewCounts.total);
        response.setPendingQuestionCount(questionCounts.pending);
        response.setAnsweredQuestionCount(questionCounts.answered);
        response.setHiddenQuestionCount(questionCounts.hidden);
        response.setTotalQuestionCount(questionCounts.total);
        response.setPendingReportCount(reportCounts.pending);
        response.setTotalReportCount(reportCounts.total);
        response.setAverageRating(reviewCounts.averageRating);
        return response;
    }

    private EngagementCounts countReviews(List<Long> activityIds) {
        EngagementCounts counts = new EngagementCounts();
        if (activityIds == null || activityIds.isEmpty()) {
            return counts;
        }
        List<ActivityReview> reviews = reviewMapper.selectList(new LambdaQueryWrapper<ActivityReview>()
                .in(ActivityReview::getActivityId, activityIds));
        if (reviews == null || reviews.isEmpty()) {
            return counts;
        }
        int ratingTotal = 0;
        long ratingCount = 0;
        for (ActivityReview review : reviews) {
            Integer status = review.getStatus();
            counts.total++;
            if (Integer.valueOf(REVIEW_STATUS_PENDING).equals(status)) counts.pending++;
            if (Integer.valueOf(REVIEW_STATUS_VISIBLE).equals(status)) {
                counts.published++;
                Integer rating = review.getRating();
                if (rating != null && rating >= 1 && rating <= 5) {
                    ratingTotal += rating;
                    ratingCount++;
                }
            }
            if (Integer.valueOf(REVIEW_STATUS_HIDDEN).equals(status)) counts.hidden++;
        }
        counts.averageRating = ratingCount == 0 ? 0.0 : BigDecimal.valueOf(ratingTotal)
                .divide(BigDecimal.valueOf(ratingCount), 1, RoundingMode.HALF_UP)
                .doubleValue();
        return counts;
    }

    private EngagementCounts countQuestions(List<Long> activityIds) {
        EngagementCounts counts = new EngagementCounts();
        if (activityIds == null || activityIds.isEmpty()) {
            return counts;
        }
        List<ActivityQuestion> questions = questionMapper.selectList(new LambdaQueryWrapper<ActivityQuestion>()
                .in(ActivityQuestion::getActivityId, activityIds));
        if (questions == null || questions.isEmpty()) {
            return counts;
        }
        for (ActivityQuestion question : questions) {
            String status = question.getStatus();
            counts.total++;
            if (QUESTION_STATUS_PENDING.equals(status)) counts.pending++;
            if (QUESTION_STATUS_ANSWERED.equals(status)) counts.answered++;
            if (QUESTION_STATUS_HIDDEN.equals(status)) counts.hidden++;
        }
        return counts;
    }

    private EngagementCounts countReports(List<Long> activityIds) {
        EngagementCounts counts = new EngagementCounts();
        if (activityIds == null || activityIds.isEmpty()) {
            return counts;
        }
        List<ActivityReviewReport> reports = reportMapper.selectList(new LambdaQueryWrapper<ActivityReviewReport>()
                .in(ActivityReviewReport::getActivityId, activityIds));
        if (reports == null || reports.isEmpty()) {
            return counts;
        }
        for (ActivityReviewReport report : reports) {
            counts.total++;
            if (REPORT_STATUS_PENDING.equals(report.getStatus())) counts.pending++;
        }
        return counts;
    }

    private List<ActivityReview> listReviewsByActivityIds(List<Long> activityIds, Integer status) {
        LambdaQueryWrapper<ActivityReview> query = new LambdaQueryWrapper<ActivityReview>()
                .orderByDesc(ActivityReview::getCreateTime);
        if (activityIds != null) {
            if (activityIds.isEmpty()) return Collections.emptyList();
            query.in(ActivityReview::getActivityId, activityIds);
        }
        if (status != null) {
            query.eq(ActivityReview::getStatus, status);
        }
        List<ActivityReview> reviews = reviewMapper.selectList(query);
        return reviews == null ? Collections.emptyList() : reviews;
    }

    private List<ActivityReviewReport> listReportsByActivityIds(List<Long> activityIds, String status) {
        LambdaQueryWrapper<ActivityReviewReport> query = new LambdaQueryWrapper<ActivityReviewReport>()
                .orderByDesc(ActivityReviewReport::getCreateTime);
        if (activityIds != null) {
            if (activityIds.isEmpty()) return Collections.emptyList();
            query.in(ActivityReviewReport::getActivityId, activityIds);
        }
        if (StringUtils.hasText(status)) {
            query.eq(ActivityReviewReport::getStatus, status.trim().toUpperCase(Locale.ROOT));
        }
        List<ActivityReviewReport> reports = reportMapper.selectList(query);
        return reports == null ? Collections.emptyList() : reports;
    }

    private List<ActivityQuestion> listQuestionsByActivityIds(List<Long> activityIds, String status) {
        LambdaQueryWrapper<ActivityQuestion> query = new LambdaQueryWrapper<ActivityQuestion>()
                .orderByDesc(ActivityQuestion::getCreateTime);
        if (activityIds != null) {
            if (activityIds.isEmpty()) return Collections.emptyList();
            query.in(ActivityQuestion::getActivityId, activityIds);
        }
        if (StringUtils.hasText(status)) {
            query.eq(ActivityQuestion::getStatus, status.trim().toUpperCase(Locale.ROOT));
        }
        List<ActivityQuestion> questions = questionMapper.selectList(query);
        return questions == null ? Collections.emptyList() : questions;
    }

    private List<Long> resolveTargetActivityIds(Long targetId, String itemType) {
        if (targetId == null || targetId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动ID不正确");
        }
        String normalizedType = normalizeItemType(itemType);
        if (ITEM_TYPE_ACTIVITY.equals(normalizedType)) {
            ensureActivityExists(targetId);
            return List.of(targetId);
        }
        Tour tour = requireTour(targetId);
        return listTourActivities(tour.getId(), false).stream()
                .map(Activity::getId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toList());
    }

    private void ensureBelongsToTarget(Long activityId, Long targetId, String itemType, String message) {
        if (targetId == null) {
            return;
        }
        if (activityId == null || activityId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动ID不正确");
        }
        String normalizedType = normalizeItemType(itemType);
        if (ITEM_TYPE_ACTIVITY.equals(normalizedType)) {
            if (!targetId.equals(activityId)) {
                throw new BusinessException(ResultCode.NOT_FOUND, message);
            }
            return;
        }
        if (!resolveTargetActivityIds(targetId, ITEM_TYPE_TOUR).contains(activityId)) {
            throw new BusinessException(ResultCode.NOT_FOUND, message);
        }
    }

    private LambdaQueryWrapper<Activity> activeActivityWrapper() {
        return new LambdaQueryWrapper<Activity>()
                .and(wrapper -> wrapper.isNull(Activity::getPublishStatus)
                        .or()
                        .ne(Activity::getPublishStatus, PUBLISH_STATUS_DELETED));
    }

    private List<Activity> listTourActivities(Long tourId, boolean requireAny) {
        if (tourId == null || tourId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "巡演ID不正确");
        }
        List<Activity> activities = activityMapper.selectList(activeActivityWrapper()
                .eq(Activity::getTourId, tourId)
                .orderByAsc(Activity::getId));
        if ((activities == null || activities.isEmpty()) && requireAny) {
            throw new BusinessException(ResultCode.NOT_FOUND, "巡演下暂无活动");
        }
        return activities == null ? Collections.emptyList() : activities;
    }

    private Tour requireTour(Long tourId) {
        if (tourMapper == null) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "巡演服务未配置");
        }
        Tour tour = tourMapper.selectById(tourId);
        if (tour == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "巡演不存在");
        }
        return tour;
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

    private InternalAuthContextResponse requireReviewManagePermission(Long userId) {
        if (userAccessService == null) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "用户权限服务未配置");
        }
        return userAccessService.requirePermission(userId, PERMISSION_REVIEW_MANAGE);
    }

    private int requireReviewStatus(ActivityReviewStatusRequest request) {
        if (request == null || request.getStatus() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "评价状态不能为空");
        }
        Integer status = request.getStatus();
        if (!Integer.valueOf(REVIEW_STATUS_PENDING).equals(status)
                && !Integer.valueOf(REVIEW_STATUS_VISIBLE).equals(status)
                && !Integer.valueOf(REVIEW_STATUS_HIDDEN).equals(status)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "不支持的评价状态");
        }
        return status;
    }

    private String requireReportAction(ActivityReviewReportStatusRequest request) {
        if (request == null || !StringUtils.hasText(request.getAction())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "处理动作不能为空");
        }
        return request.getAction().trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeQuestionStatus(String status) {
        if (!StringUtils.hasText(status)) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!QUESTION_STATUS_PENDING.equals(normalized)
                && !QUESTION_STATUS_ANSWERED.equals(normalized)
                && !QUESTION_STATUS_HIDDEN.equals(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "不支持的问答状态");
        }
        return normalized;
    }

    private String normalizeReplyIdentity(String replyIdentity, boolean allowDefault) {
        if (!StringUtils.hasText(replyIdentity)) {
            if (allowDefault) {
                return REPLY_IDENTITY_ORGANIZER_PROXY;
            }
            throw new BusinessException(ResultCode.BAD_REQUEST, "回复身份不正确");
        }
        String normalized = replyIdentity.trim().toUpperCase(Locale.ROOT);
        if (!REPLY_IDENTITY_OFFICIAL_SUPPORT.equals(normalized) && !REPLY_IDENTITY_ORGANIZER_PROXY.equals(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "回复身份不正确");
        }
        return normalized;
    }

    private String normalizeItemType(String itemType) {
        String normalized = StringUtils.hasText(itemType) ? itemType.trim().toUpperCase(Locale.ROOT) : ITEM_TYPE_ACTIVITY;
        if (!ITEM_TYPE_ACTIVITY.equals(normalized) && !ITEM_TYPE_TOUR.equals(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "互动归属类型不正确");
        }
        return normalized;
    }

    private String normalizeOptionalItemType(String itemType) {
        if (!StringUtils.hasText(itemType)) {
            return null;
        }
        return normalizeItemType(itemType);
    }

    private String requireReason(String reason) {
        if (!StringUtils.hasText(reason)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "操作原因/备注不能为空");
        }
        return reason.trim();
    }

    private String requireAnswer(String answer) {
        if (!StringUtils.hasText(answer)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "回复内容不能为空");
        }
        return answer.trim();
    }

    private String reviewAuditAction(int status) {
        if (status == REVIEW_STATUS_VISIBLE) {
            return "activity_review.publish";
        }
        if (status == REVIEW_STATUS_HIDDEN) {
            return "activity_review.hide";
        }
        return "activity_review.pending";
    }

    private String defaultReviewReason(int status, String reason) {
        if (StringUtils.hasText(reason)) {
            return reason.trim();
        }
        if (status == REVIEW_STATUS_VISIBLE) {
            return "审核通过并公开评价";
        }
        if (status == REVIEW_STATUS_PENDING) {
            return "评价退回待审核";
        }
        return reason;
    }

    private void writeAudit(InternalAuthContextResponse auth,
                            Long operatorId,
                            String action,
                            String targetType,
                            Long targetId,
                            String targetRef,
                            String reason,
                            String result) {
        OperationAuditWriteRequest request = new OperationAuditWriteRequest();
        request.setOperatorId(operatorId);
        request.setOperatorRole(resolveOperatorRole(auth));
        request.setAction(action);
        request.setTargetType(targetType);
        request.setTargetId(targetId);
        request.setTargetRef(targetRef);
        request.setReason(reason);
        request.setResult(result);
        request.setSuccess(true);
        userAccessService.writeOperationAudit(request);
    }

    private String resolveOperatorRole(InternalAuthContextResponse auth) {
        if (auth == null) {
            return "unknown";
        }
        if (StringUtils.hasText(auth.getEffectiveRole())) {
            return auth.getEffectiveRole();
        }
        if (StringUtils.hasText(auth.getRole())) {
            return auth.getRole();
        }
        return "unknown";
    }

    private void publishActivityIndexUpsert(Long activityId) {
        if (searchIndexEventPublisher != null && activityId != null && activityId > 0) {
            searchIndexEventPublisher.publishUpsert(activityId);
        }
    }

    private String resolveOrganizerName(Long organizerId) {
        if (organizerId == null || organizerId <= 0) {
            return "未关联主办方";
        }
        if (userAccessService != null) {
            try {
                InternalUserRefResponse user = userAccessService.requireUser(organizerId);
                if (user != null && StringUtils.hasText(user.getOrganizerName())) {
                    return user.getOrganizerName();
                }
            } catch (RuntimeException ignored) {
                // 概览不因主办方展示名读取失败而中断，保留编号便于后台继续处理待办。
            }
        }
        return "主办方编号：" + organizerId;
    }

    private long safeLong(Long value) {
        return value == null ? 0 : value;
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static class EngagementCounts {
        private long pending;
        private long published;
        private long answered;
        private long hidden;
        private long total;
        private double averageRating;
    }
}
