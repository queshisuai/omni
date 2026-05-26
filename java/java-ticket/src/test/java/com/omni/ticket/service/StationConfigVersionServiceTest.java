package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.dto.PaidOrderCountResponse;
import com.omni.ticket.dto.StationConfigVersionDetailResponse;
import com.omni.ticket.dto.StationConfigVersionRequest;
import com.omni.ticket.dto.StationConfigVersionReviewRequest;
import com.omni.ticket.dto.StationConfigVersionResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.Station;
import com.omni.ticket.entity.StationConfigVersion;
import com.omni.ticket.entity.Tour;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.StationConfigVersionMapper;
import com.omni.ticket.mapper.StationMapper;
import com.omni.ticket.mapper.TourMapper;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.mapper.VenueApplicationMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationConfigVersionServiceTest {
    @Mock
    private StationConfigVersionMapper versionMapper;
    @Mock
    private StationMapper stationMapper;
    @Mock
    private VenueApplicationMapper venueApplicationMapper;
    @Mock
    private UserAccessService userAccessService;
    @Mock
    private TourMapper tourMapper;
    @Mock
    private ActivityMapper activityMapper;
    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private VenueMapper venueMapper;
    @Mock
    private OrderInternalClient orderInternalClient;

    private StationConfigVersionService service;

    @BeforeEach
    void setUp() {
        service = new StationConfigVersionService(versionMapper, stationMapper, venueApplicationMapper,
                userAccessService, tourMapper, activityMapper, sessionMapper, venueMapper,
                orderInternalClient, "omni-local-internal-token");
    }

    @Test
    void createDraftUsesNextVersionNoWithoutChangingStation() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, null, "北京", "北京站"));
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));
        StationConfigVersion previous = version(99L, 10L, 3, "applied", "update_city");
        when(versionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(previous));
        doAnswer(invocation -> {
            StationConfigVersion version = invocation.getArgument(0);
            version.setId(100L);
            return 1;
        }).when(versionMapper).insert(any(StationConfigVersion.class));

        StationConfigVersionRequest request = request(2003L, "update_city");
        request.setCity("上海");
        request.setStationName("上海站");
        StationConfigVersionResponse result = service.createDraft(2003L, 10L, request);

        ArgumentCaptor<StationConfigVersion> captor = ArgumentCaptor.forClass(StationConfigVersion.class);
        verify(versionMapper).insert(captor.capture());
        assertEquals(4, captor.getValue().getVersionNo());
        assertEquals("draft", captor.getValue().getStatus());
        assertEquals(20L, captor.getValue().getTourId());
        assertEquals("上海", result.getCity());
        verify(stationMapper, never()).updateById(any());
    }

    @Test
    void deleteDraftOnlyAllowsDraft() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(versionMapper.selectById(100L)).thenReturn(version(100L, 10L, 1, "draft", "update_city"));
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, null, "北京", "北京站"));
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));

        service.deleteDraft(100L, 2003L);

        verify(versionMapper).deleteById(100L);
    }

    @Test
    void submittedDeleteFails() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(versionMapper.selectById(100L)).thenReturn(version(100L, 10L, 1, "submitted", "update_city"));
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, null, "北京", "北京站"));
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));

        BusinessException error = assertThrows(BusinessException.class, () -> service.deleteDraft(100L, 2003L));

        assertEquals(400, error.getCode());
        verify(versionMapper, never()).deleteById(any(Long.class));
    }

    @Test
    void submitSetVenueWithoutVenueInformationFails() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(versionMapper.selectById(100L)).thenReturn(version(100L, 10L, 1, "draft", "set_venue"));
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, null, "北京", "北京站"));
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));

        BusinessException error = assertThrows(BusinessException.class, () -> service.submit(100L, 2003L));

        assertEquals(400, error.getCode());
        verify(versionMapper, never()).updateById(any());
    }

    @Test
    void submitActivitySetVenueWithOnlyVenueIdFails() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        StationConfigVersion draft = version(100L, 10L, 1, "draft", "set_venue");
        draft.setVenueId(66L);
        when(versionMapper.selectById(100L)).thenReturn(draft);
        when(stationMapper.selectById(10L)).thenReturn(station(10L, null, 30L, "北京", "北京站"));
        when(activityMapper.selectById(30L)).thenReturn(activity(30L, 2003L));

        BusinessException error = assertThrows(BusinessException.class, () -> service.submit(100L, 2003L));

        assertEquals(400, error.getCode());
        verify(versionMapper, never()).updateById(any());
    }

    @Test
    void submitActivitySetVenueWithApprovedVenueApplicationSucceeds() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        StationConfigVersion draft = version(100L, 10L, 1, "draft", "set_venue");
        draft.setVenueApplicationId(88L);
        when(versionMapper.selectById(100L)).thenReturn(draft);
        when(stationMapper.selectById(10L)).thenReturn(station(10L, null, 30L, "北京", "北京站"));
        when(activityMapper.selectById(30L)).thenReturn(activity(30L, 2003L));
        StationConfigVersionResponse result = service.submit(100L, 2003L);

        assertEquals("submitted", result.getStatus());
        verify(versionMapper).updateById(argThat(updated -> "submitted".equals(updated.getStatus())
                && updated.getUpdatedAt() != null));
    }

    @Test
    void submitActivityVenueChangeFailsWhenActivityHasPaidOrders() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        StationConfigVersion draft = version(100L, 10L, 1, "draft", "change_venue");
        draft.setActivityId(30L);
        draft.setCity("北京");
        draft.setVenueApplicationId(88L);
        when(versionMapper.selectById(100L)).thenReturn(draft);
        when(stationMapper.selectById(10L)).thenReturn(station(10L, null, 30L, "北京", "北京站"));
        when(activityMapper.selectById(30L)).thenReturn(activity(30L, 2003L));
        Session session = new Session();
        session.setId(500L);
        session.setActivityId(30L);
        session.setStatus(1);
        when(sessionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(session));
        when(orderInternalClient.countPaidBySessions(any(), any()))
                .thenReturn(Result.success(new PaidOrderCountResponse(1L)));

        BusinessException error = assertThrows(BusinessException.class, () -> service.submit(100L, 2003L));

        assertEquals(400, error.getCode());
        assertEquals("活动已有已支付订单，请先完成退款/下架清理后再申请场地变更", error.getMessage());
        verify(versionMapper, never()).updateById(any());
    }

    @Test
    void submitActivityVenueChangeRejectsCityChange() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        StationConfigVersion draft = version(100L, 10L, 1, "draft", "change_venue");
        draft.setActivityId(30L);
        draft.setCity("上海");
        draft.setVenueApplicationId(88L);
        when(versionMapper.selectById(100L)).thenReturn(draft);
        when(stationMapper.selectById(10L)).thenReturn(station(10L, null, 30L, "北京", "北京站"));
        when(activityMapper.selectById(30L)).thenReturn(activity(30L, 2003L));

        BusinessException error = assertThrows(BusinessException.class, () -> service.submit(100L, 2003L));

        assertEquals(400, error.getCode());
        assertEquals("场地变更不能修改城市", error.getMessage());
        verifyNoInteractions(orderInternalClient);
        verify(versionMapper, never()).updateById(any());
    }

    @Test
    void submitActivityVenueChangeChecksPaidOrdersAcrossAllSessions() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        StationConfigVersion draft = version(100L, 10L, 1, "draft", "change_venue");
        draft.setActivityId(30L);
        draft.setCity("北京");
        draft.setVenueApplicationId(88L);
        when(versionMapper.selectById(100L)).thenReturn(draft);
        when(stationMapper.selectById(10L)).thenReturn(station(10L, null, 30L, "北京", "北京站"));
        when(activityMapper.selectById(30L)).thenReturn(activity(30L, 2003L));
        Session closedSession = new Session();
        closedSession.setId(501L);
        closedSession.setActivityId(30L);
        closedSession.setStatus(0);
        when(sessionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(closedSession));
        when(orderInternalClient.countPaidBySessions(any(), any()))
                .thenReturn(Result.success(new PaidOrderCountResponse(1L)));

        BusinessException error = assertThrows(BusinessException.class, () -> service.submit(100L, 2003L));

        assertEquals(400, error.getCode());
        assertEquals("活动已有已支付订单，请先完成退款/下架清理后再申请场地变更", error.getMessage());
        verify(versionMapper, never()).updateById(any());
    }

    @Test
    void approveActivityVenueChangeFailsWhenPaidOrdersAppearAfterSubmit() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        Station station = station(10L, null, 30L, "北京", "北京站");
        when(stationMapper.selectById(10L)).thenReturn(station);
        StationConfigVersion submitted = version(100L, 10L, 2, "submitted", "change_venue");
        submitted.setActivityId(30L);
        submitted.setCity("北京");
        submitted.setVenueApplicationId(88L);
        when(versionMapper.selectById(100L)).thenReturn(submitted);
        Session session = new Session();
        session.setId(500L);
        session.setActivityId(30L);
        when(sessionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(session));
        when(orderInternalClient.countPaidBySessions(any(), any()))
                .thenReturn(Result.success(new PaidOrderCountResponse(1L)));

        StationConfigVersionReviewRequest review = new StationConfigVersionReviewRequest();
        review.setReviewerId(2002L);
        BusinessException error = assertThrows(BusinessException.class, () -> service.approve(100L, review));

        assertEquals(400, error.getCode());
        assertEquals("活动已有已支付订单，请先完成退款/下架清理后再申请场地变更", error.getMessage());
        verify(venueApplicationMapper, never()).selectById(any());
        verify(stationMapper, never()).updateById(any());
        verify(versionMapper, never()).updateById(any());
    }

    @Test
    void approveActivityVenueChangeRejectsVenueInAnotherCity() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        Station station = station(10L, null, 30L, "北京", "北京站");
        when(stationMapper.selectById(10L)).thenReturn(station);
        StationConfigVersion submitted = version(100L, 10L, 2, "submitted", "change_venue");
        submitted.setActivityId(30L);
        submitted.setCity("北京");
        submitted.setVenueApplicationId(88L);
        when(versionMapper.selectById(100L)).thenReturn(submitted);
        when(sessionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        VenueApplication application = new VenueApplication();
        application.setId(88L);
        application.setStatus(1);
        application.setApplicantId(2003L);
        application.setVenueId(66L);
        when(venueApplicationMapper.selectById(88L)).thenReturn(application);
        when(activityMapper.selectById(30L)).thenReturn(activity(30L, 2003L));
        Venue venue = venue(66L, 1);
        venue.setCity("上海");
        when(venueMapper.selectById(66L)).thenReturn(venue);

        StationConfigVersionReviewRequest review = new StationConfigVersionReviewRequest();
        review.setReviewerId(2002L);
        BusinessException error = assertThrows(BusinessException.class, () -> service.approve(100L, review));

        assertEquals(400, error.getCode());
        assertEquals("场地变更不能选择其他城市的场馆", error.getMessage());
        verify(stationMapper, never()).updateById(any());
        verify(versionMapper, never()).updateById(any());
    }

    @Test
    void submitTourSetVenueWithOnlyVenueIdStillFails() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        StationConfigVersion draft = version(100L, 10L, 1, "draft", "set_venue");
        draft.setVenueId(66L);
        draft.setTourId(20L);
        when(versionMapper.selectById(100L)).thenReturn(draft);
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, null, "北京", "北京站"));
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));

        BusinessException error = assertThrows(BusinessException.class, () -> service.submit(100L, 2003L));

        assertEquals(400, error.getCode());
        verify(versionMapper, never()).updateById(any());
    }

    @Test
    void submitScheduleChangeSucceedsForConfiguredStation() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        StationConfigVersion draft = version(100L, 10L, 1, "draft", "set_schedule");
        draft.setScheduleTba(false);
        draft.setStartTime(LocalDateTime.of(2026, 6, 1, 19, 30));
        draft.setEndTime(LocalDateTime.of(2026, 6, 1, 22, 0));
        when(versionMapper.selectById(100L)).thenReturn(draft);
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, null, "北京", "北京站"));
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));

        StationConfigVersionResponse result = service.submit(100L, 2003L);

        assertEquals("submitted", result.getStatus());
        verify(versionMapper).updateById(argThat(updated -> "submitted".equals(updated.getStatus())
                && updated.getUpdatedAt() != null));
    }

    @Test
    void submitChangeScheduleSucceedsForConfiguredStation() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        StationConfigVersion draft = version(100L, 10L, 1, "draft", "change_schedule");
        draft.setScheduleTba(false);
        draft.setStartTime(LocalDateTime.of(2026, 6, 1, 19, 30));
        draft.setEndTime(LocalDateTime.of(2026, 6, 1, 22, 0));
        when(versionMapper.selectById(100L)).thenReturn(draft);
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, null, "北京", "北京站"));
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));

        StationConfigVersionResponse result = service.submit(100L, 2003L);

        assertEquals("submitted", result.getStatus());
        verify(versionMapper).updateById(argThat(updated -> "submitted".equals(updated.getStatus())
                && updated.getUpdatedAt() != null));
    }

    @Test
    void organizerCannotManageOtherTourStation() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, null, "北京", "北京站"));
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 9999L));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.createDraft(2003L, 10L, request(2003L, "update_city")));

        assertEquals(403, error.getCode());
        verify(versionMapper, never()).insert(any());
    }

    @Test
    void organizerCanManageOwnTourStation() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, null, "北京", "北京站"));
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));
        when(versionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

        service.createDraft(2003L, 10L, request(2003L, "update_city"));

        verify(versionMapper).insert(any(StationConfigVersion.class));
    }

    @Test
    void organizerCanManageOwnActivityStation() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(stationMapper.selectById(10L)).thenReturn(station(10L, null, 30L, "北京", "北京站"));
        when(activityMapper.selectById(30L)).thenReturn(activity(30L, 2003L));
        when(versionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

        service.createDraft(2003L, 10L, request(2003L, "update_city"));

        verify(versionMapper).insert(any(StationConfigVersion.class));
        verifyNoInteractions(tourMapper);
    }

    @Test
    void organizerCannotManageOtherActivityStation() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(stationMapper.selectById(10L)).thenReturn(station(10L, null, 30L, "北京", "北京站"));
        when(activityMapper.selectById(30L)).thenReturn(activity(30L, 9999L));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.createDraft(2003L, 10L, request(2003L, "update_city")));

        assertEquals(403, error.getCode());
        verify(versionMapper, never()).insert(any());
        verifyNoInteractions(tourMapper);
    }

    @Test
    void adminCanManageAnyStationWithoutOwnerMatch() {
        InternalUserRefResponse admin = user(2002L, "admin");
        when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(admin);
        when(userAccessService.isAdmin(admin)).thenReturn(true);
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, 30L, "北京", "北京站"));
        when(versionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

        service.createDraft(2002L, 10L, request(9999L, "update_city"));

        verify(versionMapper).insert(any(StationConfigVersion.class));
        verifyNoInteractions(tourMapper, activityMapper);
    }

    @Test
    void updateDraftChangesDraftPayload() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        StationConfigVersion draft = version(100L, 10L, 1, "draft", "update_city");
        when(versionMapper.selectById(100L)).thenReturn(draft);
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, null, "北京", "北京站"));
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));

        StationConfigVersionRequest request = request(2003L, "update_city");
        request.setCity("广州");
        request.setStationName("广州站");
        StationConfigVersionResponse result = service.updateDraft(2003L, 100L, request);

        assertEquals("广州", result.getCity());
        assertEquals("广州站", result.getStationName());
        verify(versionMapper).updateById(argThat(updated -> Long.valueOf(100L).equals(updated.getId())
                && "draft".equals(updated.getStatus())
                && "广州".equals(updated.getCity())
                && "广州站".equals(updated.getStationName())
                && updated.getUpdatedAt() != null));
        verify(stationMapper, never()).updateById(any());
    }

    @Test
    void updateDraftRejectsSubmittedVersion() {
        when(versionMapper.selectById(100L)).thenReturn(version(100L, 10L, 1, "submitted", "update_city"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.updateDraft(2003L, 100L, request(2003L, "update_city")));

        assertEquals(400, error.getCode());
        verify(versionMapper, never()).updateById(any());
        verifyNoInteractions(stationMapper, tourMapper, activityMapper, userAccessService);
    }

    @Test
    void createDraftRejectsUnsupportedChangeType() {
        BusinessException error = assertThrows(BusinessException.class,
                () -> service.createDraft(2003L, 10L, request(2003L, "change_station")));

        assertEquals(400, error.getCode());
        verifyNoInteractions(stationMapper, tourMapper, activityMapper, userAccessService);
    }

    @Test
    void withdrawSubmittedVersionToWithdrawn() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(versionMapper.selectById(100L)).thenReturn(version(100L, 10L, 1, "submitted", "update_city"));
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, null, "北京", "北京站"));
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));

        StationConfigVersionResponse result = service.withdraw(100L, 2003L);

        assertEquals("withdrawn", result.getStatus());
        verify(versionMapper).updateById(argThat(updated -> "withdrawn".equals(updated.getStatus())
                && updated.getUpdatedAt() != null));
    }

    @Test
    void withdrawnVersionCannotBeDeletedAsDraft() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(versionMapper.selectById(100L)).thenReturn(version(100L, 10L, 1, "withdrawn", "update_city"));
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, null, "北京", "北京站"));
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));

        BusinessException error = assertThrows(BusinessException.class, () -> service.deleteDraft(100L, 2003L));

        assertEquals(400, error.getCode());
        verify(versionMapper, never()).deleteById(any(Long.class));
    }

    @Test
    void withdrawRejectsDraftVersion() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(versionMapper.selectById(100L)).thenReturn(version(100L, 10L, 1, "draft", "update_city"));
        when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, null, "北京", "北京站"));
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));

        BusinessException error = assertThrows(BusinessException.class, () -> service.withdraw(100L, 2003L));

        assertEquals(400, error.getCode());
        verify(versionMapper, never()).updateById(any());
    }

    @Test
    void getStationDetailReturnsStationAndVersionsForManageableStation() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        Station station = station(10L, 20L, null, "北京", "北京站");
        when(stationMapper.selectById(10L)).thenReturn(station);
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));
        StationConfigVersion draft = version(100L, 10L, 1, "draft", "update_city");
        when(versionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(draft));

        StationConfigVersionDetailResponse result = service.getStationDetail(10L, 2003L);

        assertEquals(station, result.getStation());
        assertEquals(1, result.getVersions().size());
        assertEquals(100L, result.getVersions().get(0).getId());
    }

    @Test
    void listReviewsReturnsFilteredReviewVersions() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        StationConfigVersion submitted = version(100L, 10L, 1, "submitted", "update_city");
        when(versionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(submitted));

        List<StationConfigVersionResponse> result = service.listReviews(2002L, "submitted");

        assertEquals(1, result.size());
        assertEquals("submitted", result.get(0).getStatus());
        verify(userAccessService).requireAdmin(2002L);
        verify(versionMapper).selectList(any(LambdaQueryWrapper.class));
    }

    @Test
    void listReviewsRequiresAdmin() {
        when(userAccessService.requireAdmin(2003L)).thenThrow(new BusinessException(403, "仅平台管理员可操作"));

        BusinessException error = assertThrows(BusinessException.class, () -> service.listReviews(2003L, "submitted"));

        assertEquals(403, error.getCode());
        verifyNoInteractions(versionMapper);
    }

    @Test
    void approveAppliesVenueCityStationNameAndKeepsHistoryFields() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        Station station = station(10L, 20L, null, "北京", "北京站");
        when(stationMapper.selectById(10L)).thenReturn(station);
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));
        StationConfigVersion submitted = version(100L, 10L, 2, "submitted", "change_venue");
        submitted.setCity("上海");
        submitted.setStationName("上海站");
        submitted.setVenueApplicationId(88L);
        submitted.setVenueName("历史场馆名");
        submitted.setVenueAddress("历史地址");
        when(versionMapper.selectById(100L)).thenReturn(submitted);
        VenueApplication application = new VenueApplication();
        application.setId(88L);
        application.setStatus(1);
        application.setApplicantId(2003L);
        application.setVenueId(66L);
        application.setVenueName("已审核场馆名");
        application.setAddress("已审核地址");
        when(venueApplicationMapper.selectById(88L)).thenReturn(application);

        StationConfigVersionReviewRequest review = new StationConfigVersionReviewRequest();
        review.setReviewerId(2002L);
        review.setReviewNote("通过");
        StationConfigVersionResponse result = service.approve(100L, review);

        assertEquals("applied", result.getStatus());
        assertEquals("历史场馆名", result.getVenueName());
        assertEquals("历史地址", result.getVenueAddress());
        verify(stationMapper).updateById(argThat(updated -> Long.valueOf(10L).equals(updated.getId())
                && "上海".equals(updated.getCity())
                && "上海站".equals(updated.getStationName())
                && Long.valueOf(88L).equals(updated.getVenueApplicationId())
                && "venue_confirmed".equals(updated.getPublishStatus())));
        verify(versionMapper).updateById(argThat(updated -> "applied".equals(updated.getStatus())
                && Long.valueOf(2002L).equals(updated.getReviewerId())
                && "通过".equals(updated.getReviewNote())
                && updated.getReviewTime() != null
                && updated.getAppliedAt() != null
                && updated.getUpdatedAt() != null));
    }

    @Test
    void approveRejectsVenueApplicationOwnedByOtherOrganizer() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        Station station = station(10L, 20L, null, "北京", "北京站");
        when(stationMapper.selectById(10L)).thenReturn(station);
        when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));
        StationConfigVersion submitted = version(100L, 10L, 2, "submitted", "change_venue");
        submitted.setVenueApplicationId(88L);
        when(versionMapper.selectById(100L)).thenReturn(submitted);
        VenueApplication application = new VenueApplication();
        application.setId(88L);
        application.setStatus(1);
        application.setApplicantId(9999L);
        when(venueApplicationMapper.selectById(88L)).thenReturn(application);

        StationConfigVersionReviewRequest review = new StationConfigVersionReviewRequest();
        review.setReviewerId(2002L);
        BusinessException error = assertThrows(BusinessException.class, () -> service.approve(100L, review));

        assertEquals(403, error.getCode());
        verify(stationMapper, never()).updateById(any());
        verify(versionMapper, never()).updateById(any());
    }

    @Test
    void approveActivityVenueIdCreatesActiveSessionWhenScheduled() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        Station station = station(10L, null, 30L, "北京", "北京站");
        when(stationMapper.selectById(10L)).thenReturn(station);
        StationConfigVersion submitted = version(100L, 10L, 2, "submitted", "set_venue");
        submitted.setActivityId(30L);
        submitted.setVenueId(66L);
        submitted.setStartTime(LocalDateTime.of(2026, 6, 1, 19, 30));
        submitted.setEndTime(LocalDateTime.of(2026, 6, 1, 21, 30));
        submitted.setScheduleTba(false);
        when(versionMapper.selectById(100L)).thenReturn(submitted);
        Venue venue = venue(66L, 1);
        when(venueMapper.selectById(66L)).thenReturn(venue);
        when(sessionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        StationConfigVersionReviewRequest review = new StationConfigVersionReviewRequest();
        review.setReviewerId(2002L);
        service.approve(100L, review);

        verify(sessionMapper).insert(argThat(session -> Long.valueOf(30L).equals(session.getActivityId())
                && Long.valueOf(66L).equals(session.getVenueId())
                && LocalDateTime.of(2026, 6, 1, 19, 30).equals(session.getStartTime())
                && LocalDateTime.of(2026, 6, 1, 21, 30).equals(session.getEndTime())
                && Integer.valueOf(1).equals(session.getStatus())
                && session.getCreateTime() != null
                && session.getUpdateTime() != null));
        verify(versionMapper).updateById(argThat(updated -> "applied".equals(updated.getStatus())));
    }

    @Test
    void approveActivityVenueIdUpdatesExistingActiveSession() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        Station station = station(10L, null, 30L, "北京", "北京站");
        when(stationMapper.selectById(10L)).thenReturn(station);
        StationConfigVersion submitted = version(100L, 10L, 2, "submitted", "set_venue");
        submitted.setActivityId(30L);
        submitted.setVenueId(66L);
        submitted.setStartTime(LocalDateTime.of(2026, 6, 1, 19, 30));
        submitted.setScheduleTba(false);
        when(versionMapper.selectById(100L)).thenReturn(submitted);
        when(venueMapper.selectById(66L)).thenReturn(venue(66L, 1));
        Session existing = new Session();
        existing.setId(500L);
        existing.setActivityId(30L);
        existing.setVenueId(55L);
        existing.setStatus(1);
        when(sessionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(existing);

        StationConfigVersionReviewRequest review = new StationConfigVersionReviewRequest();
        review.setReviewerId(2002L);
        service.approve(100L, review);

        verify(sessionMapper).updateById(argThat(session -> Long.valueOf(500L).equals(session.getId())
                && Long.valueOf(66L).equals(session.getVenueId())
                && LocalDateTime.of(2026, 6, 1, 19, 30).equals(session.getStartTime())
                && session.getEndTime() == null
                && session.getUpdateTime() != null));
        verify(sessionMapper, never()).insert(any());
    }

    @Test
    void approveScheduleChangeUpdatesExistingActivitySession() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        Station station = station(10L, null, 30L, "北京", "北京站");
        station.setVenueApplicationId(88L);
        when(stationMapper.selectById(10L)).thenReturn(station);
        StationConfigVersion submitted = version(100L, 10L, 2, "submitted", "change_schedule");
        submitted.setActivityId(30L);
        submitted.setStartTime(LocalDateTime.of(2026, 6, 2, 19, 30));
        submitted.setEndTime(LocalDateTime.of(2026, 6, 2, 21, 30));
        submitted.setScheduleTba(false);
        when(versionMapper.selectById(100L)).thenReturn(submitted);
        VenueApplication application = new VenueApplication();
        application.setId(88L);
        application.setApplicantId(2003L);
        application.setVenueId(66L);
        application.setStatus(1);
        when(venueApplicationMapper.selectById(88L)).thenReturn(application);
        when(activityMapper.selectById(30L)).thenReturn(activity(30L, 2003L));
        when(venueMapper.selectById(66L)).thenReturn(venue(66L, 1));
        Session existing = new Session();
        existing.setId(500L);
        existing.setActivityId(30L);
        existing.setVenueId(66L);
        existing.setStatus(1);
        existing.setStartTime(LocalDateTime.of(2026, 6, 1, 19, 30));
        existing.setEndTime(LocalDateTime.of(2026, 6, 1, 21, 30));
        when(sessionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(existing);

        StationConfigVersionReviewRequest review = new StationConfigVersionReviewRequest();
        review.setReviewerId(2002L);
        service.approve(100L, review);

        verify(sessionMapper).updateById(argThat(session -> Long.valueOf(500L).equals(session.getId())
                && Long.valueOf(66L).equals(session.getVenueId())
                && LocalDateTime.of(2026, 6, 2, 19, 30).equals(session.getStartTime())
                && LocalDateTime.of(2026, 6, 2, 21, 30).equals(session.getEndTime())
                && session.getUpdateTime() != null));
        verify(versionMapper).updateById(argThat(updated -> "applied".equals(updated.getStatus())));
    }

    @Test
    void approveActivityVenueIdRejectsInactiveVenue() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        when(stationMapper.selectById(10L)).thenReturn(station(10L, null, 30L, "北京", "北京站"));
        StationConfigVersion submitted = version(100L, 10L, 2, "submitted", "set_venue");
        submitted.setActivityId(30L);
        submitted.setVenueId(66L);
        submitted.setStartTime(LocalDateTime.of(2026, 6, 1, 19, 30));
        submitted.setScheduleTba(false);
        when(versionMapper.selectById(100L)).thenReturn(submitted);
        when(venueMapper.selectById(66L)).thenReturn(venue(66L, 0));

        StationConfigVersionReviewRequest review = new StationConfigVersionReviewRequest();
        review.setReviewerId(2002L);
        BusinessException error = assertThrows(BusinessException.class, () -> service.approve(100L, review));

        assertEquals(400, error.getCode());
        verify(sessionMapper, never()).insert(any());
        verify(sessionMapper, never()).updateById(any());
        verify(versionMapper, never()).updateById(any());
    }

    @Test
    void approveRejectsSubmittedScheduleChange() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        when(versionMapper.selectById(100L)).thenReturn(version(100L, 10L, 1, "submitted", "change_schedule"));

        StationConfigVersionReviewRequest review = new StationConfigVersionReviewRequest();
        review.setReviewerId(2002L);
        BusinessException error = assertThrows(BusinessException.class, () -> service.approve(100L, review));

        assertEquals(400, error.getCode());
        verifyNoInteractions(stationMapper);
        verify(versionMapper, never()).updateById(any());
    }

    @Test
    void rejectChangesSubmittedToRejected() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        when(versionMapper.selectById(100L)).thenReturn(version(100L, 10L, 1, "submitted", "update_city"));

        StationConfigVersionReviewRequest review = new StationConfigVersionReviewRequest();
        review.setReviewerId(2002L);
        review.setReviewNote("资料不足");
        StationConfigVersionResponse result = service.reject(100L, review);

        assertEquals("rejected", result.getStatus());
        verify(versionMapper).updateById(argThat(updated -> "rejected".equals(updated.getStatus())
                && Long.valueOf(2002L).equals(updated.getReviewerId())
                && "资料不足".equals(updated.getReviewNote())
                && updated.getReviewTime() != null));
    }

    @Test
    void approveOverloadOverridesForgedReviewerIdWithAdminUserId() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        Station station = station(10L, 20L, null, "北京", "北京站");
        when(stationMapper.selectById(10L)).thenReturn(station);
        when(versionMapper.selectById(100L)).thenReturn(version(100L, 10L, 1, "submitted", "update_city"));

        StationConfigVersionReviewRequest review = new StationConfigVersionReviewRequest();
        review.setReviewerId(9999L);
        review.setReviewNote("通过");
        service.approve(2002L, 100L, review);

        verify(versionMapper).updateById(argThat(updated -> "applied".equals(updated.getStatus())
                && Long.valueOf(2002L).equals(updated.getReviewerId())
                && "通过".equals(updated.getReviewNote())));
    }

    @Test
    void rejectOverloadOverridesForgedReviewerIdWithAdminUserId() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        when(versionMapper.selectById(100L)).thenReturn(version(100L, 10L, 1, "submitted", "update_city"));

        StationConfigVersionReviewRequest review = new StationConfigVersionReviewRequest();
        review.setReviewerId(9999L);
        review.setReviewNote("资料不足");
        service.reject(2002L, 100L, review);

        verify(versionMapper).updateById(argThat(updated -> "rejected".equals(updated.getStatus())
                && Long.valueOf(2002L).equals(updated.getReviewerId())
                && "资料不足".equals(updated.getReviewNote())));
    }

    private StationConfigVersionRequest request(Long userId, String changeType) {
        StationConfigVersionRequest request = new StationConfigVersionRequest();
        request.setUserId(userId);
        request.setChangeType(changeType);
        request.setReason("调整站点配置");
        return request;
    }

    private Station station(Long id, Long tourId, Long activityId, String city, String stationName) {
        Station station = new Station();
        station.setId(id);
        station.setTourId(tourId);
        station.setActivityId(activityId);
        station.setCity(city);
        station.setStationName(stationName);
        station.setStatus(1);
        station.setPublishStatus("published");
        return station;
    }

    private Tour tour(Long id, Long organizerId) {
        Tour tour = new Tour();
        tour.setId(id);
        tour.setOrganizerId(organizerId);
        return tour;
    }

    @SuppressWarnings("unused")
    private Activity activity(Long id, Long organizerId) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setOrganizerId(organizerId);
        return activity;
    }

    private Venue venue(Long id, Integer status) {
        Venue venue = new Venue();
        venue.setId(id);
        venue.setStatus(status);
        return venue;
    }

    private StationConfigVersion version(Long id, Long stationId, Integer versionNo, String status, String changeType) {
        StationConfigVersion version = new StationConfigVersion();
        version.setId(id);
        version.setStationId(stationId);
        version.setVersionNo(versionNo);
        version.setStatus(status);
        version.setChangeType(changeType);
        return version;
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(id);
        user.setRole(role);
        return user;
    }
}
