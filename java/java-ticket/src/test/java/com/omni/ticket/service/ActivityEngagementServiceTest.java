package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.ActivityQuestionReplyRequest;
import com.omni.ticket.dto.ActivityQuestionUpdateRequest;
import com.omni.ticket.dto.ActivityReviewReportRequest;
import com.omni.ticket.dto.ActivityReviewRequest;
import com.omni.ticket.dto.ActivityReviewStatusRequest;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivityQuestion;
import com.omni.ticket.entity.ActivityReview;
import com.omni.ticket.entity.ActivityReviewReport;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivityQuestionMapper;
import com.omni.ticket.mapper.ActivityReviewMapper;
import com.omni.ticket.mapper.ActivityReviewReportMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.search.ActivitySearchIndexEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActivityEngagementServiceTest {

    @Mock ActivityReviewMapper reviewMapper;
    @Mock ActivityQuestionMapper questionMapper;
    @Mock ActivityReviewReportMapper reportMapper;
    @Mock ActivityMapper activityMapper;
    @Mock SessionMapper sessionMapper;
    @Mock OrderInternalClient orderInternalClient;
    @Mock UserAccessService userAccessService;
    @Mock ActivitySearchIndexEventPublisher searchIndexEventPublisher;

    private ActivityEngagementService service;

    @BeforeEach
    void setUp() {
        service = new ActivityEngagementService(reviewMapper, questionMapper, reportMapper, activityMapper,
                sessionMapper, orderInternalClient, userAccessService, "test-internal-token");
        service.setSearchIndexEventPublisher(searchIndexEventPublisher);
    }

    @Test
    void createReviewRejectsUnpaidOrder() {
        when(activityMapper.selectById(10L)).thenReturn(activity(10L));
        when(orderInternalClient.getOrderDetail(9001L, "test-internal-token")).thenReturn(Result.success(order(9001L, 2004L, 10L, 1)));
        ActivityReviewRequest request = reviewRequest(9001L, 5);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.createReview(10L, 2004L, request));

        assertEquals(400, error.getCode());
        assertEquals("订单未支付，暂不能评价", error.getMessage());
        verify(reviewMapper, never()).insert(any(ActivityReview.class));
    }

    @Test
    void createReviewStoresPaidOrderAsPendingReview() {
        when(activityMapper.selectById(10L)).thenReturn(activity(10L));
        when(orderInternalClient.getOrderDetail(9001L, "test-internal-token")).thenReturn(Result.success(order(9001L, 2004L, 10L, 2)));
        when(reviewMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

        ActivityReview review = service.createReview(10L, 2004L, reviewRequest(9001L, 4));

        assertEquals(10L, review.getActivityId());
        assertEquals(2004L, review.getUserId());
        assertEquals(9001L, review.getOrderId());
        assertEquals(Integer.valueOf(0), review.getStatus());
        ArgumentCaptor<ActivityReview> captor = ArgumentCaptor.forClass(ActivityReview.class);
        verify(reviewMapper).insert(captor.capture());
        assertEquals(Integer.valueOf(0), captor.getValue().getStatus());
    }

    @Test
    void approveReviewMakesItVisible() {
        ActivityReview review = new ActivityReview();
        review.setId(77L);
        review.setActivityId(10L);
        review.setStatus(0);
        when(userAccessService.requirePermission(2002L, "activity.review.manage")).thenReturn(auth("platform_super_admin"));
        when(reviewMapper.selectById(77L)).thenReturn(review);

        ActivityReview updated = service.approveReview(77L, 2002L);

        assertEquals(Integer.valueOf(1), updated.getStatus());
        verify(reviewMapper).updateById(review);
        verify(searchIndexEventPublisher).publishUpsert(10L);
    }

    @Test
    void updateReviewStatusRequiresReasonWhenHiding() {
        when(userAccessService.requirePermission(2002L, "activity.review.manage")).thenReturn(auth("platform_super_admin"));
        ActivityReviewStatusRequest request = new ActivityReviewStatusRequest();
        request.setStatus(2);
        request.setReason(" ");

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.updateReviewStatus(10L, 77L, 2002L, "ACTIVITY", request));

        assertEquals(400, error.getCode());
        assertEquals("操作原因/备注不能为空", error.getMessage());
        verify(reviewMapper, never()).updateById(any(ActivityReview.class));
        verify(searchIndexEventPublisher, never()).publishUpsert(any());
    }

    @Test
    void updateReviewStatusHidesAndWritesAuditReason() {
        ActivityReview review = new ActivityReview();
        review.setId(77L);
        review.setActivityId(10L);
        review.setStatus(1);
        when(userAccessService.requirePermission(2002L, "activity.review.manage")).thenReturn(auth("platform_super_admin"));
        when(reviewMapper.selectById(77L)).thenReturn(review);
        ActivityReviewStatusRequest request = new ActivityReviewStatusRequest();
        request.setStatus(2);
        request.setReason("评价包含违规内容");

        ActivityReview updated = service.updateReviewStatus(10L, 77L, 2002L, "ACTIVITY", request);

        assertEquals(Integer.valueOf(2), updated.getStatus());
        verify(reviewMapper).updateById(review);
        verify(searchIndexEventPublisher).publishUpsert(10L);
        verify(userAccessService).writeOperationAudit(argThat(audit ->
                audit instanceof OperationAuditWriteRequest
                        && "activity_review.hide".equals(audit.getAction())
                        && "activity_review".equals(audit.getTargetType())
                        && Long.valueOf(77L).equals(audit.getTargetId())
                        && "评价包含违规内容".equals(audit.getReason())
                        && Boolean.TRUE.equals(audit.getSuccess())));
    }

    @Test
    void replyQuestionStoresReplyIdentity() {
        ActivityQuestion question = new ActivityQuestion();
        question.setId(3L);
        question.setActivityId(10L);
        question.setStatus("PENDING");
        when(userAccessService.requirePermission(2002L, "activity.review.manage")).thenReturn(auth("support"));
        when(questionMapper.selectById(3L)).thenReturn(question);
        ActivityQuestionReplyRequest request = new ActivityQuestionReplyRequest();
        request.setAnswer("19:00 开始检票");
        request.setReplyIdentity("OFFICIAL_SUPPORT");

        ActivityQuestion updated = service.replyQuestion(10L, 3L, 2002L, "ACTIVITY", request);

        assertEquals("ANSWERED", updated.getStatus());
        assertEquals("19:00 开始检票", updated.getAnswer());
        assertEquals("OFFICIAL_SUPPORT", updated.getReplyIdentity());
        verify(questionMapper).updateById(question);
    }

    @Test
    void updateQuestionRequiresReasonWhenHiding() {
        when(userAccessService.requirePermission(2002L, "activity.review.manage")).thenReturn(auth("platform_super_admin"));
        ActivityQuestionUpdateRequest request = new ActivityQuestionUpdateRequest();
        request.setStatus("HIDDEN");
        request.setReason("");

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.updateQuestion(10L, 3L, 2002L, "ACTIVITY", request));

        assertEquals(400, error.getCode());
        assertEquals("操作原因/备注不能为空", error.getMessage());
        verify(questionMapper, never()).updateById(any(ActivityQuestion.class));
    }

    @Test
    void updateQuestionHidesAndWritesAuditReason() {
        ActivityQuestion question = new ActivityQuestion();
        question.setId(3L);
        question.setActivityId(10L);
        question.setStatus("ANSWERED");
        when(userAccessService.requirePermission(2002L, "activity.review.manage")).thenReturn(auth("platform_super_admin"));
        when(questionMapper.selectById(3L)).thenReturn(question);
        ActivityQuestionUpdateRequest request = new ActivityQuestionUpdateRequest();
        request.setStatus("HIDDEN");
        request.setReason("主办方回复包含误导信息");

        ActivityQuestion updated = service.updateQuestion(10L, 3L, 2002L, "ACTIVITY", request);

        assertEquals("HIDDEN", updated.getStatus());
        verify(questionMapper).updateById(question);
        verify(userAccessService).writeOperationAudit(argThat(audit ->
                audit instanceof OperationAuditWriteRequest
                        && "activity_question.hide".equals(audit.getAction())
                        && "activity_question".equals(audit.getTargetType())
                        && Long.valueOf(3L).equals(audit.getTargetId())
                        && "主办方回复包含误导信息".equals(audit.getReason())));
    }

    @Test
    void reportReviewCreatesPendingReport() {
        ActivityReview review = new ActivityReview();
        review.setId(77L);
        review.setActivityId(10L);
        review.setStatus(1);
        when(activityMapper.selectById(10L)).thenReturn(activity(10L));
        when(reviewMapper.selectById(77L)).thenReturn(review);
        when(reportMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        ActivityReviewReportRequest request = new ActivityReviewReportRequest();
        request.setReason("评价包含辱骂内容");

        ActivityReviewReport report = service.reportReview(10L, 77L, 2005L, request);

        assertEquals(77L, report.getReviewId());
        assertEquals(10L, report.getActivityId());
        assertEquals(2005L, report.getUserId());
        assertEquals("PENDING", report.getStatus());
        verify(reportMapper).insert(report);
    }

    private Activity activity(Long id) {
        Activity activity = new Activity();
        activity.setId(id);
        return activity;
    }

    private OrderInfoResponse order(Long id, Long userId, Long activityId, Integer status) {
        OrderInfoResponse order = new OrderInfoResponse();
        order.setId(id);
        order.setUserId(userId);
        order.setActivityId(activityId);
        order.setStatus(status);
        return order;
    }

    private ActivityReviewRequest reviewRequest(Long orderId, Integer rating) {
        ActivityReviewRequest request = new ActivityReviewRequest();
        request.setOrderId(orderId);
        request.setRating(rating);
        request.setContent("现场体验不错");
        return request;
    }

    private InternalAuthContextResponse auth(String role) {
        InternalAuthContextResponse auth = new InternalAuthContextResponse();
        auth.setRole(role);
        auth.setEffectiveRole(role);
        auth.setScopeType("platform");
        auth.setPermissionCodes(List.of("activity.review.manage"));
        return auth;
    }
}
