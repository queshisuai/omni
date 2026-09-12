package com.omni.ticket.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.ActivityEngagementOverviewResponse;
import com.omni.ticket.dto.ActivityReviewModerationRequest;
import com.omni.ticket.dto.ActivityReviewStatusRequest;
import com.omni.ticket.entity.ActivityReview;
import com.omni.ticket.service.ActivityEngagementService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActivityEngagementAdminControllerTest {

    @Mock
    private ActivityEngagementService engagementService;

    @Test
    void listReviewsRequiresAuthorization() {
        ActivityEngagementAdminController controller = new ActivityEngagementAdminController(engagementService);

        Result<List<ActivityReview>> result = controller.listReviews(null, null, null);

        assertEquals(401, result.getCode());
        verify(engagementService, never()).listAdminReviews(2002L, null, null);
    }

    @Test
    void approveReviewUsesCurrentAdminUser() {
        ActivityEngagementAdminController controller = new ActivityEngagementAdminController(engagementService);
        ActivityReviewModerationRequest request = new ActivityReviewModerationRequest();
        request.setAction("APPROVE");
        ActivityReview review = new ActivityReview();
        review.setId(77L);
        review.setStatus(1);
        when(engagementService.moderateReview(77L, 2002L, request)).thenReturn(review);

        Result<ActivityReview> result = controller.moderateReview(authorization(), 77L, request);

        assertEquals(200, result.getCode());
        assertEquals(Integer.valueOf(1), result.getData().getStatus());
        verify(engagementService).moderateReview(77L, 2002L, request);
    }

    @Test
    void listEngagementsUsesCurrentAdminUser() {
        ActivityEngagementAdminController controller = new ActivityEngagementAdminController(engagementService);
        Page<ActivityEngagementOverviewResponse> page = new Page<>(2, 20, 1);
        when(engagementService.listAdminActivityEngagements(2002L, 2, 20, "周杰伦", "TOUR", true))
                .thenReturn(page);

        Result<Page<ActivityEngagementOverviewResponse>> result =
                controller.listEngagements(authorization(), 2, 20, "周杰伦", "TOUR", true);

        assertEquals(200, result.getCode());
        assertEquals(2, result.getData().getCurrent());
        verify(engagementService).listAdminActivityEngagements(2002L, 2, 20, "周杰伦", "TOUR", true);
    }

    @Test
    void updateActivityScopedReviewStatusUsesCurrentAdminUser() {
        ActivityEngagementAdminController controller = new ActivityEngagementAdminController(engagementService);
        ActivityReviewStatusRequest request = new ActivityReviewStatusRequest();
        request.setStatus(2);
        request.setReason("评价包含违规内容");
        ActivityReview review = new ActivityReview();
        review.setId(77L);
        review.setStatus(2);
        when(engagementService.updateReviewStatus(10L, 77L, 2002L, "ACTIVITY", request)).thenReturn(review);

        Result<ActivityReview> result =
                controller.updateReviewStatus(authorization(), 10L, 77L, "ACTIVITY", request);

        assertEquals(200, result.getCode());
        assertEquals(Integer.valueOf(2), result.getData().getStatus());
        verify(engagementService).updateReviewStatus(10L, 77L, 2002L, "ACTIVITY", request);
    }

    private String authorization() {
        return "Bearer " + JwtUtil.generateToken(2002L, "13800000001", "admin");
    }
}
