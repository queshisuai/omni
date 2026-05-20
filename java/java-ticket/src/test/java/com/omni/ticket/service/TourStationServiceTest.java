package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.entity.Station;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.Tour;
import com.omni.ticket.entity.UserRef;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.StationMapper;
import com.omni.ticket.mapper.TourMapper;
import com.omni.ticket.mapper.UserRefMapper;
import com.omni.ticket.mapper.VenueApplicationMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.List;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TourStationServiceTest {
    @Mock
    private TourMapper tourMapper;
    @Mock
    private StationMapper stationMapper;
    @Mock
    private UserRefMapper userRefMapper;
    @Mock
    private VenueApplicationMapper venueApplicationMapper;
    @Mock
    private ActivityMapper activityMapper;
    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private ActivitySeatLayoutService activitySeatLayoutService;
    @Mock
    private SessionSeatLayoutService sessionSeatLayoutService;

    private TourStationService service;

    @BeforeEach
    void setUp() {
        service = new TourStationService(tourMapper, stationMapper, userRefMapper, venueApplicationMapper,
                activityMapper, sessionMapper, activitySeatLayoutService, sessionSeatLayoutService);
    }

    @Test
    void organizerCreatesTourDraftForSelf() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));

        Tour result = service.createTourDraft(2003L, Map.of("title", "巡回演唱会"));

        ArgumentCaptor<Tour> captor = ArgumentCaptor.forClass(Tour.class);
        verify(tourMapper).insert(captor.capture());
        assertEquals("巡回演唱会", captor.getValue().getTitle());
        assertEquals(2003L, captor.getValue().getOrganizerId());
        assertEquals("draft", captor.getValue().getReviewStatus());
        assertEquals(1, captor.getValue().getStatus());
        assertEquals(captor.getValue(), result);
    }

    @Test
    void adminCreatesTourDraftForProvidedOrganizer() {
        when(userRefMapper.selectById(2002L)).thenReturn(user(2002L, "admin"));

        service.createTourDraft(2002L, Map.of("title", "平台巡演", "organizerId", 2003L));

        ArgumentCaptor<Tour> captor = ArgumentCaptor.forClass(Tour.class);
        verify(tourMapper).insert(captor.capture());
        assertEquals(2003L, captor.getValue().getOrganizerId());
    }

    @Test
    void normalUserCannotCreateTourDraft() {
        when(userRefMapper.selectById(2004L)).thenReturn(user(2004L, "user"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.createTourDraft(2004L, Map.of("title", "普通用户演出")));

        assertEquals(403, error.getCode());
    }

    @Test
    void organizerCreatesStationDraftForOwnTour() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(tourMapper.selectById(10L)).thenReturn(tour(10L, 2003L));

        Station result = service.createStationDraft(2003L, 10L, Map.of("city", "哈尔滨", "stationName", "哈尔滨站"));

        ArgumentCaptor<Station> captor = ArgumentCaptor.forClass(Station.class);
        verify(stationMapper).insert(captor.capture());
        assertEquals(10L, captor.getValue().getTourId());
        assertEquals("哈尔滨", captor.getValue().getCity());
        assertEquals("哈尔滨站", captor.getValue().getStationName());
        assertEquals("draft", captor.getValue().getPublishStatus());
        assertEquals(captor.getValue(), result);
    }

    @Test
    void stationDraftStoresVenueApplicationIdWhenProvided() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(tourMapper.selectById(10L)).thenReturn(tour(10L, 2003L));

        service.createStationDraft(2003L, 10L, Map.of("city", "上海", "stationName", "上海站", "venueApplicationId", 88L));

        ArgumentCaptor<Station> captor = ArgumentCaptor.forClass(Station.class);
        verify(stationMapper).insert(captor.capture());
        assertEquals(88L, captor.getValue().getVenueApplicationId());
    }

    @Test
    void organizerCannotCreateStationDraftForOthersTour() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(tourMapper.selectById(10L)).thenReturn(tour(10L, 9999L));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.createStationDraft(2003L, 10L, Map.of("city", "哈尔滨", "stationName", "哈尔滨站")));

        assertEquals(403, error.getCode());
    }

    @Test
    void organizerListsOnlyOwnTours() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        Page<Tour> page = new Page<>(1, 10);
        page.setRecords(List.of(tour(10L, 2003L)));
        when(tourMapper.selectPage(any(), any())).thenReturn(page);

        Page<Tour> result = service.listManageableTours(2003L, 1, 10);

        assertSame(page, result);
        verify(tourMapper).selectPage(any(), any());
    }

    @Test
    void getTourDetailReturnsTourAndStations() {
        Tour tour = tour(10L, 2003L);
        Station station = new Station();
        station.setId(20L);
        station.setTourId(10L);
        station.setCity("北京");
        station.setStatus(1);
        when(tourMapper.selectById(10L)).thenReturn(tour);
        when(stationMapper.selectList(any())).thenReturn(List.of(station));

        Map<String, Object> detail = service.getTourDetail(10L);

        assertSame(tour, detail.get("tour"));
        assertEquals(List.of(station), detail.get("stations"));
    }

    @Test
    void getTourDetailIncludesPublishedStationPurchaseData() {
        Tour tour = tour(10L, 2003L);
        Station station = station(20L, 10L, 88L);
        station.setPublishStatus("published");
        Activity activity = new Activity();
        activity.setId(301L);
        activity.setTourId(10L);
        activity.setStationId(20L);
        activity.setPublishStatus("published");
        activity.setStatus(1);
        Session session = new Session();
        session.setId(401L);
        session.setActivityId(301L);
        session.setStatus(1);
        when(tourMapper.selectById(10L)).thenReturn(tour);
        when(stationMapper.selectList(any())).thenReturn(List.of(station));
        when(activityMapper.selectList(any())).thenReturn(List.of(activity));
        when(sessionMapper.selectList(any())).thenReturn(List.of(session));

        Map<String, Object> detail = service.getTourDetail(10L);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> stationDetails = (List<Map<String, Object>>) detail.get("stationDetails");
        assertEquals(1, stationDetails.size());
        assertSame(station, stationDetails.get(0).get("station"));
        assertSame(activity, stationDetails.get(0).get("activity"));
        assertEquals(List.of(session), stationDetails.get(0).get("sessions"));
    }

    @Test
    void publishStationCreatesActivitySessionCopiesLayoutGeneratesStockAndMarksPublished() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        Tour tour = tour(10L, 2003L);
        tour.setTitle("万象巡演");
        tour.setCategoryId(2L);
        tour.setArtistId(3L);
        tour.setPoster("poster.jpg");
        tour.setDescription("巡演介绍");
        Station station = station(20L, 10L, 88L);
        VenueApplication application = approvedApplication(88L, 2003L, 101L,
                LocalDateTime.of(2026, 6, 1, 0, 0), LocalDateTime.of(2026, 6, 30, 23, 59));
        when(tourMapper.selectById(10L)).thenReturn(tour);
        when(stationMapper.selectById(20L)).thenReturn(station);
        when(venueApplicationMapper.selectById(88L)).thenReturn(application);
        doAnswer(invocation -> {
            Activity activity = invocation.getArgument(0);
            activity.setId(301L);
            return 1;
        }).when(activityMapper).insert(any(Activity.class));
        doAnswer(invocation -> {
            Session session = invocation.getArgument(0);
            session.setId(401L);
            return 1;
        }).when(sessionMapper).insert(any(Session.class));

        Map<String, Object> result = service.publishStation(2003L, 20L, Map.of(
                "startTime", "2026-06-10T20:00",
                "endTime", "2026-06-10T22:00"));

        Activity activity = (Activity) result.get("activity");
        Session session = (Session) result.get("session");
        assertEquals(301L, activity.getId());
        assertEquals(401L, session.getId());
        assertEquals("万象巡演 上海站", activity.getName());
        assertEquals("published", activity.getPublishStatus());
        assertEquals("published", station.getPublishStatus());
        verify(activitySeatLayoutService).copyFromVenueApplication(2003L, 301L, 88L);
        verify(sessionSeatLayoutService).copyFromActivity(2003L, 401L, 301L);
        verify(sessionSeatLayoutService).generateSessionSeats(401L);
        verify(activityMapper).updateById(activity);
        verify(stationMapper).updateById(station);
    }

    @Test
    void publishStationRejectsWhenSessionOutsideVenueApplicationValidity() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(tourMapper.selectById(10L)).thenReturn(tour(10L, 2003L));
        when(stationMapper.selectById(20L)).thenReturn(station(20L, 10L, 88L));
        when(venueApplicationMapper.selectById(88L)).thenReturn(approvedApplication(88L, 2003L, 101L,
                LocalDateTime.of(2026, 6, 1, 0, 0), LocalDateTime.of(2026, 6, 5, 23, 59)));

        BusinessException error = assertThrows(BusinessException.class, () -> service.publishStation(2003L, 20L, Map.of(
                "startTime", "2026-06-10T20:00",
                "endTime", "2026-06-10T22:00")));

        assertEquals("场次时间不在场地使用权有效期内", error.getMessage());
    }

    private UserRef user(Long id, String role) {
        UserRef user = new UserRef();
        user.setId(id);
        user.setRole(role);
        return user;
    }

    private Tour tour(Long id, Long organizerId) {
        Tour tour = new Tour();
        tour.setId(id);
        tour.setOrganizerId(organizerId);
        tour.setStatus(1);
        return tour;
    }

    private Station station(Long id, Long tourId, Long venueApplicationId) {
        Station station = new Station();
        station.setId(id);
        station.setTourId(tourId);
        station.setStationName("上海站");
        station.setCity("上海");
        station.setVenueApplicationId(venueApplicationId);
        station.setPublishStatus("draft");
        station.setStatus(1);
        return station;
    }

    private VenueApplication approvedApplication(Long id, Long applicantId, Long venueId, LocalDateTime validFrom, LocalDateTime validTo) {
        VenueApplication application = new VenueApplication();
        application.setId(id);
        application.setApplicantId(applicantId);
        application.setVenueId(venueId);
        application.setStatus(1);
        application.setValidFrom(validFrom);
        application.setValidTo(validTo);
        return application;
    }
}
