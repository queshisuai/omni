package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.ActivityRiskResolutionRequest;
import com.omni.ticket.dto.ActivityRiskResolutionResponse;
import com.omni.ticket.dto.ActivityRiskResolutionReviewRequest;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivityRiskResolution;
import com.omni.ticket.mapper.ActivityArtistMapper;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivityRiskResolutionMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
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
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActivityRiskResponseServiceTest {
    @Mock private ActivityMapper activityMapper;
    @Mock private ActivityArtistMapper activityArtistMapper;
    @Mock private SessionMapper sessionMapper;
    @Mock private TicketTypeMapper ticketTypeMapper;
    @Mock private ActivityRiskResolutionMapper resolutionMapper;
    @Mock private UserAccessService userAccessService;
    @Mock private ActivityAdminService activityAdminService;

    private ActivityRiskResponseService service;

    @BeforeEach
    void setUp() {
        service = new ActivityRiskResponseService(activityMapper, activityArtistMapper, sessionMapper, ticketTypeMapper,
                resolutionMapper, userAccessService, null, activityAdminService, "test-token");
    }

    @Test
    void listResolutionsIncludesActivityNameForReviewCards() {
        ActivityRiskResolution resolution = new ActivityRiskResolution();
        resolution.setId(10L);
        resolution.setActivityId(5L);
        resolution.setOrganizerId(2003L);
        resolution.setStatus("pending");
        Activity activity = new Activity();
        activity.setId(5L);
        activity.setName("经典歌剧《茶花女》上海站");

        when(userAccessService.requireAdminOrOrganizerRole(2002L)).thenReturn("admin");
        when(resolutionMapper.selectList(any())).thenReturn(List.of(resolution));
        when(activityMapper.selectById(5L)).thenReturn(activity);

        List<ActivityRiskResolutionResponse> result = service.listResolutions(2002L, "pending");

        assertEquals(1, result.size());
        assertEquals("经典歌剧《茶花女》上海站", result.get(0).getActivityName());
    }

    @Test
    void adminSuspendActivityCreatesAwaitingResponseRecordBeforeOrganizerResponse() {
        Activity activity = activity(5L, 2003L, "published");

        when(activityMapper.selectById(5L)).thenReturn(activity);

        service.adminSuspendActivity(5L, 2002L, "艺人风险");

        verify(userAccessService).requireAdmin(2002L);
        ArgumentCaptor<ActivityRiskResolution> captor = ArgumentCaptor.forClass(ActivityRiskResolution.class);
        verify(resolutionMapper).insert(captor.capture());
        assertEquals("awaiting_response", captor.getValue().getStatus());
        assertEquals("系统因风险艺人自动停止售票，等待主办方处理", captor.getValue().getResolutionNote());
    }

    @Test
    void submitResolutionRequiresRiskSuspendedActivity() {
        Activity activity = activity(5L, 2003L, "published");
        ActivityRiskResolutionRequest request = new ActivityRiskResolutionRequest();
        request.setUserId(2003L);
        request.setResolutionNote("已处理");

        when(activityMapper.selectById(5L)).thenReturn(activity);
        lenient().when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");

        BusinessException error = assertThrows(BusinessException.class, () -> service.submitResolution(5L, request));

        assertEquals("仅风险停票活动可提交恢复申请", error.getMessage());
        verify(resolutionMapper, never()).insert(any(ActivityRiskResolution.class));
    }

    @Test
    void submitResolutionRejectsDuplicatePendingResolution() {
        Activity activity = activity(5L, 2003L, "risk_suspended");
        ActivityRiskResolution existing = new ActivityRiskResolution();
        existing.setId(9L);
        existing.setActivityId(5L);
        existing.setStatus("pending");
        ActivityRiskResolutionRequest request = new ActivityRiskResolutionRequest();
        request.setUserId(2003L);
        request.setResolutionNote("已处理");

        when(activityMapper.selectById(5L)).thenReturn(activity);
        when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");
        when(userAccessService.requireUser(2003L)).thenReturn(user(2003L, "organizer"));
        when(resolutionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(existing);

        BusinessException error = assertThrows(BusinessException.class, () -> service.submitResolution(5L, request));

        assertEquals("该活动已有待审核恢复申请", error.getMessage());
        verify(resolutionMapper, never()).insert(any(ActivityRiskResolution.class));
    }

    @Test
    void platformReportedActivityCanBeSubmittedByAdmin() {
        Activity activity = activity(5L, 2002L, "risk_suspended");
        ActivityRiskResolutionRequest request = new ActivityRiskResolutionRequest();
        request.setUserId(2004L);
        request.setResolutionNote("平台已处理");

        when(activityMapper.selectById(5L)).thenReturn(activity);
        when(userAccessService.requireAdminOrOrganizerRole(2004L)).thenReturn("admin");
        lenient().when(userAccessService.requireUser(2002L)).thenReturn(user(2002L, "admin"));
        lenient().when(resolutionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        service.submitResolution(5L, request);

        ArgumentCaptor<ActivityRiskResolution> captor = ArgumentCaptor.forClass(ActivityRiskResolution.class);
        verify(resolutionMapper).insert(captor.capture());
        assertEquals(2002L, captor.getValue().getOrganizerId());
        assertEquals(2004L, captor.getValue().getSubmittedBy());
    }

    @Test
    void organizerActivityCannotBeSubmittedByOtherAdmin() {
        Activity activity = activity(5L, 2003L, "risk_suspended");
        ActivityRiskResolutionRequest request = new ActivityRiskResolutionRequest();
        request.setUserId(2002L);
        request.setResolutionNote("平台代提交");

        when(activityMapper.selectById(5L)).thenReturn(activity);
        when(userAccessService.requireAdminOrOrganizerRole(2002L)).thenReturn("admin");
        when(userAccessService.requireUser(2003L)).thenReturn(user(2003L, "organizer"));

        BusinessException error = assertThrows(BusinessException.class, () -> service.submitResolution(5L, request));

        assertEquals("只能由活动主办方提交恢复申请", error.getMessage());
        verify(resolutionMapper, never()).insert(any(ActivityRiskResolution.class));
    }

    @Test
    void reviewResolutionRejectsSameUserSubmitterAndReviewer() {
        ActivityRiskResolution resolution = new ActivityRiskResolution();
        resolution.setId(10L);
        resolution.setActivityId(5L);
        resolution.setOrganizerId(2002L);
        resolution.setStatus("pending");
        resolution.setSubmittedBy(2002L);
        Activity activity = activity(5L, 2002L, "risk_suspended");
        ActivityRiskResolutionReviewRequest request = new ActivityRiskResolutionReviewRequest();
        request.setUserId(2002L);
        request.setAction("approve");

        when(resolutionMapper.selectById(10L)).thenReturn(resolution);
        when(activityMapper.selectById(5L)).thenReturn(activity);

        BusinessException error = assertThrows(BusinessException.class, () -> service.reviewResolution(10L, request));

        assertEquals("恢复申请提交人不能审核自己的申请", error.getMessage());
        verify(activityAdminService, never()).validatePublishableForReview(any());
    }

    @Test
    void reviewResolutionRequiresPendingResolution() {
        ActivityRiskResolution resolution = new ActivityRiskResolution();
        resolution.setId(10L);
        resolution.setActivityId(5L);
        resolution.setOrganizerId(2003L);
        resolution.setStatus("approved");
        resolution.setSubmittedBy(2003L);
        Activity activity = activity(5L, 2003L, "risk_suspended");
        ActivityRiskResolutionReviewRequest request = new ActivityRiskResolutionReviewRequest();
        request.setUserId(2002L);
        request.setAction("approve");

        when(resolutionMapper.selectById(10L)).thenReturn(resolution);
        when(activityMapper.selectById(5L)).thenReturn(activity);

        BusinessException error = assertThrows(BusinessException.class, () -> service.reviewResolution(10L, request));

        assertEquals("只能审核待审核恢复申请", error.getMessage());
        verify(activityAdminService, never()).validatePublishableForReview(any());
    }

    @Test
    void reviewResolutionRequiresActivityStillRiskSuspended() {
        ActivityRiskResolution resolution = new ActivityRiskResolution();
        resolution.setId(10L);
        resolution.setActivityId(5L);
        resolution.setOrganizerId(2003L);
        resolution.setStatus("pending");
        resolution.setSubmittedBy(2003L);
        Activity activity = activity(5L, 2003L, "published");
        ActivityRiskResolutionReviewRequest request = new ActivityRiskResolutionReviewRequest();
        request.setUserId(2002L);
        request.setAction("approve");

        when(resolutionMapper.selectById(10L)).thenReturn(resolution);
        when(activityMapper.selectById(5L)).thenReturn(activity);

        BusinessException error = assertThrows(BusinessException.class, () -> service.reviewResolution(10L, request));

        assertEquals("活动已不处于风险停票状态", error.getMessage());
        verify(activityAdminService, never()).validatePublishableForReview(any());
    }

    private Activity activity(Long id, Long organizerId, String publishStatus) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setName("测试活动");
        activity.setOrganizerId(organizerId);
        activity.setPublishStatus(publishStatus);
        activity.setStatus(1);
        return activity;
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(id);
        user.setRole(role);
        return user;
    }
}
