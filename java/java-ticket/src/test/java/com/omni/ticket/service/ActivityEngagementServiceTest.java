package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.ActivityReviewReportRequest;
import com.omni.ticket.dto.ActivityReviewRequest;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivityReview;
import com.omni.ticket.entity.ActivityReviewReport;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivityQuestionMapper;
import com.omni.ticket.mapper.ActivityReviewMapper;
import com.omni.ticket.mapper.ActivityReviewReportMapper;
import com.omni.ticket.mapper.SessionMapper;
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

    private ActivityEngagementService service;

    @BeforeEach
    void setUp() {
        service = new ActivityEngagementService(reviewMapper, questionMapper, reportMapper, activityMapper,
                sessionMapper, orderInternalClient, userAccessService, "test-internal-token");
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
        when(userAccessService.requirePlatformPermission(2002L, "activity.review.manage")).thenReturn(null);
        when(reviewMapper.selectById(77L)).thenReturn(review);

        ActivityReview updated = service.approveReview(77L, 2002L);

        assertEquals(Integer.valueOf(1), updated.getStatus());
        verify(reviewMapper).updateById(review);
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
}
