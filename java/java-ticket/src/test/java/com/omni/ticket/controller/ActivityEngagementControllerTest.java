package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.ActivityQuestionRequest;
import com.omni.ticket.dto.ActivityReviewListResponse;
import com.omni.ticket.dto.ActivityReviewRequest;
import com.omni.ticket.entity.ActivityQuestion;
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
class ActivityEngagementControllerTest {

    @Mock
    private ActivityEngagementService engagementService;

    @Test
    void listReviewsReturnsSummaryAndReviews() {
        ActivityController controller = new ActivityController(null, null, engagementService);
        ActivityReviewListResponse response = new ActivityReviewListResponse();
        response.getSummary().setReviewCount(1);
        response.getSummary().setAverageRating(5.0);
        ActivityReview review = new ActivityReview();
        review.setActivityId(5L);
        review.setUserId(2004L);
        review.setRating(5);
        response.setReviews(List.of(review));
        when(engagementService.listReviews(5L)).thenReturn(response);

        Result<ActivityReviewListResponse> result = controller.listActivityReviews(5L);

        assertEquals(200, result.getCode());
        assertEquals(1, result.getData().getSummary().getReviewCount());
        assertEquals(1, result.getData().getReviews().size());
    }

    @Test
    void createReviewUsesAuthorizationToken() {
        ActivityController controller = new ActivityController(null, null, engagementService);
        ActivityReviewRequest request = new ActivityReviewRequest();
        request.setRating(4);
        request.setContent("观演体验不错");
        ActivityReview response = new ActivityReview();
        response.setUserId(2004L);
        response.setRating(4);
        when(engagementService.createReview(5L, 2004L, request)).thenReturn(response);

        Result<ActivityReview> result = controller.createActivityReview(authorization(), 5L, request);

        assertEquals(200, result.getCode());
        assertEquals(2004L, result.getData().getUserId());
        verify(engagementService).createReview(5L, 2004L, request);
    }

    @Test
    void createReviewRejectsMissingAuthorization() {
        ActivityController controller = new ActivityController(null, null, engagementService);

        Result<ActivityReview> result = controller.createActivityReview(null, 5L, new ActivityReviewRequest());

        assertEquals(401, result.getCode());
        verify(engagementService, never()).createReview(5L, 2004L, new ActivityReviewRequest());
    }

    @Test
    void listQuestionsReturnsCurrentQuestions() {
        ActivityController controller = new ActivityController(null, null, engagementService);
        ActivityQuestion question = new ActivityQuestion();
        question.setActivityId(5L);
        question.setUserId(2004L);
        question.setContent("几点检票");
        when(engagementService.listQuestions(5L)).thenReturn(List.of(question));

        Result<List<ActivityQuestion>> result = controller.listActivityQuestions(5L);

        assertEquals(200, result.getCode());
        assertEquals(1, result.getData().size());
    }

    @Test
    void createQuestionUsesAuthorizationToken() {
        ActivityController controller = new ActivityController(null, null, engagementService);
        ActivityQuestionRequest request = new ActivityQuestionRequest();
        request.setContent("儿童是否需要购票");
        ActivityQuestion response = new ActivityQuestion();
        response.setUserId(2004L);
        response.setContent(request.getContent());
        when(engagementService.createQuestion(5L, 2004L, request)).thenReturn(response);

        Result<ActivityQuestion> result = controller.createActivityQuestion(authorization(), 5L, request);

        assertEquals(200, result.getCode());
        assertEquals("儿童是否需要购票", result.getData().getContent());
        verify(engagementService).createQuestion(5L, 2004L, request);
    }

    private String authorization() {
        return "Bearer " + JwtUtil.generateToken(2004L, "13900000001", "user");
    }
}
