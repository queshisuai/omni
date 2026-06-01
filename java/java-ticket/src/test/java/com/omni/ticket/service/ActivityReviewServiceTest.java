package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.ActivityQuestionRequest;
import com.omni.ticket.dto.ActivityQuestionResponse;
import com.omni.ticket.dto.ActivityReviewListResponse;
import com.omni.ticket.dto.ActivityReviewRequest;
import com.omni.ticket.dto.ActivityReviewResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivityQuestion;
import com.omni.ticket.entity.ActivityReview;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivityQuestionMapper;
import com.omni.ticket.mapper.ActivityReviewMapper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActivityReviewServiceTest {

    @BeforeAll
    static void initMybatisPlusMetadata() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), ActivityReview.class);
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), ActivityQuestion.class);
    }

    private final ActivityReviewMapper reviewMapper = mock(ActivityReviewMapper.class);
    private final ActivityQuestionMapper questionMapper = mock(ActivityQuestionMapper.class);
    private final ActivityMapper activityMapper = mock(ActivityMapper.class);
    private final ActivityReviewService service = new ActivityReviewService(reviewMapper, questionMapper, activityMapper);

    @Test
    void createReviewRejectsInvalidRating() {
        when(activityMapper.selectById(10L)).thenReturn(publicActivity());

        ActivityReviewRequest request = new ActivityReviewRequest();
        request.setRating(6);
        request.setContent("超出评分范围");

        BusinessException error = assertThrows(BusinessException.class, () -> service.createReview(20L, 10L, request));

        assertEquals("评分必须在1到5星之间", error.getMessage());
        verify(reviewMapper, never()).insert(any());
    }

    @Test
    void createReviewRejectsDuplicateOrderReview() {
        when(activityMapper.selectById(10L)).thenReturn(publicActivity());
        when(reviewMapper.selectCount(any())).thenReturn(1L);

        ActivityReviewRequest request = new ActivityReviewRequest();
        request.setOrderId(88L);
        request.setRating(5);
        request.setContent("已评价订单");

        BusinessException error = assertThrows(BusinessException.class, () -> service.createReview(20L, 10L, request));

        assertEquals("该订单已评价", error.getMessage());
    }

    @Test
    void listReviewsReturnsSummaryAndVisibleReviews() {
        when(activityMapper.selectById(10L)).thenReturn(publicActivity());
        when(reviewMapper.selectList(any())).thenReturn(List.of(review(5), review(4), review(1)));

        ActivityReviewListResponse response = service.listReviews(10L);

        assertEquals(3, response.getSummary().getReviewCount());
        assertEquals("3.3", response.getSummary().getAverageRating().toPlainString());
        assertEquals(1, response.getSummary().getRatingDistribution().get(5));
        assertEquals(3, response.getReviews().size());
    }

    @Test
    void createReviewStoresUserActivityAndRating() {
        when(activityMapper.selectById(10L)).thenReturn(publicActivity());
        when(reviewMapper.selectCount(any())).thenReturn(0L);

        ActivityReviewRequest request = new ActivityReviewRequest();
        request.setOrderId(88L);
        request.setRating(5);
        request.setContent("现场体验很好");

        ActivityReviewResponse response = service.createReview(20L, 10L, request);

        assertEquals(20L, response.getUserId());
        assertEquals(10L, response.getActivityId());
        assertEquals(5, response.getRating());
        verify(reviewMapper).insert(any(ActivityReview.class));
    }

    @Test
    void createQuestionStoresPendingQuestion() {
        when(activityMapper.selectById(10L)).thenReturn(publicActivity());

        ActivityQuestionRequest request = new ActivityQuestionRequest();
        request.setContent("几点开始检票？");

        ActivityQuestionResponse response = service.createQuestion(20L, 10L, request);

        assertEquals("几点开始检票？", response.getContent());
        assertEquals("PENDING", response.getStatus());
        verify(questionMapper).insert(any(ActivityQuestion.class));
    }

    private Activity publicActivity() {
        Activity activity = new Activity();
        activity.setId(10L);
        activity.setStatus(1);
        activity.setPublishStatus("published");
        return activity;
    }

    private ActivityReview review(int rating) {
        ActivityReview review = new ActivityReview();
        review.setActivityId(10L);
        review.setUserId(20L + rating);
        review.setRating(rating);
        review.setContent(rating + "星评价");
        review.setStatus(1);
        return review;
    }
}
