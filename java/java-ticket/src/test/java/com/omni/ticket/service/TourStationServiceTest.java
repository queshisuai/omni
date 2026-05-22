package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.core.toolkit.LambdaUtils;
import com.omni.exception.BusinessException;
import com.omni.ticket.entity.Station;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.Tour;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.StationMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.TourMapper;
import com.omni.ticket.service.UserAccessService;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.mapper.VenueApplicationMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;

import java.util.Map;
import java.util.List;
import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TourStationServiceTest {
    @Mock
    private TourMapper tourMapper;
    @Mock
    private StationMapper stationMapper;
    @Mock
    private UserAccessService userAccessService;
    @Mock
    private VenueApplicationMapper venueApplicationMapper;
    @Mock
    private ActivityMapper activityMapper;
    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private TicketTypeMapper ticketTypeMapper;
    @Mock
    private VenueMapper venueMapper;
    @Mock
    private ActivitySeatLayoutService activitySeatLayoutService;
    @Mock
    private SessionSeatLayoutService sessionSeatLayoutService;

    private TourStationService service;

    @BeforeEach
    void setUp() {
        service = new TourStationService(tourMapper, stationMapper, userAccessService, venueApplicationMapper,
                activityMapper, sessionMapper, ticketTypeMapper, venueMapper,
                activitySeatLayoutService, sessionSeatLayoutService);
    }

    @Test
    void organizerCreatesTourDraftForSelf() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));

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
        when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));

        service.createTourDraft(2002L, Map.of("title", "平台巡演", "organizerId", 2003L));

        ArgumentCaptor<Tour> captor = ArgumentCaptor.forClass(Tour.class);
        verify(tourMapper).insert(captor.capture());
        assertEquals(2003L, captor.getValue().getOrganizerId());
    }

    @Test
    void normalUserCannotCreateTourDraft() {
        when(userAccessService.requireAdminOrOrganizer(2004L)).thenThrow(new BusinessException(403, "无权限"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.createTourDraft(2004L, Map.of("title", "普通用户演出")));

        assertEquals(403, error.getCode());
    }

    @Test
    void organizerCreatesStationDraftForOwnTour() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
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
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(tourMapper.selectById(10L)).thenReturn(tour(10L, 2003L));

        service.createStationDraft(2003L, 10L, Map.of("city", "上海", "stationName", "上海站", "venueApplicationId", 88L));

        ArgumentCaptor<Station> captor = ArgumentCaptor.forClass(Station.class);
        verify(stationMapper).insert(captor.capture());
        assertEquals(88L, captor.getValue().getVenueApplicationId());
    }

    @Test
    void stationDraftCanBeCityAnnouncedWithoutVenueApplication() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(tourMapper.selectById(10L)).thenReturn(tour(10L, 2003L));

        service.createStationDraft(2003L, 10L, Map.of("city", "成都", "stationName", "成都站", "announceOnly", true));

        ArgumentCaptor<Station> captor = ArgumentCaptor.forClass(Station.class);
        verify(stationMapper).insert(captor.capture());
        assertEquals("city_announced", captor.getValue().getPublishStatus());
    }

    @Test
    void organizerCannotCreateStationDraftForOthersTour() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(tourMapper.selectById(10L)).thenReturn(tour(10L, 9999L));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.createStationDraft(2003L, 10L, Map.of("city", "哈尔滨", "stationName", "哈尔滨站")));

        assertEquals(403, error.getCode());
    }

    @Test
    void organizerListsOnlyOwnTours() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
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
    void getTourDetailMarksCityAnnouncedStationAsUnannounced() {
        Tour tour = tour(10L, 2003L);
        Station station = station(20L, 10L, null);
        station.setPublishStatus("city_announced");
        when(tourMapper.selectById(10L)).thenReturn(tour);
        when(stationMapper.selectList(any())).thenReturn(List.of(station));
        when(activityMapper.selectList(any())).thenReturn(List.of());

        Map<String, Object> detail = service.getTourDetail(10L);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> stationDetails = (List<Map<String, Object>>) detail.get("stationDetails");
        Map<String, Object> item = stationDetails.get(0);
        assertEquals("unannounced", item.get("saleStatus"));
        assertEquals("未公布", item.get("saleStatusText"));
        assertEquals("none", item.get("primaryAction"));
        assertEquals(null, item.get("venueName"));
        assertEquals(null, item.get("priceMin"));
    }

    @Test
    void getTourDetailReturnsVenuePriceAndOnSaleStatusForPublishedStation() {
        Tour tour = tour(10L, 2003L);
        Station station = station(20L, 10L, 88L);
        station.setPublishStatus("published");
        Activity activity = activity(301L, 10L, 20L, "published");
        Session session = session(401L, 301L, 501L);
        Venue venue = venue(501L, "万象体育馆", "上海市浦东新区");
        TicketType low = ticketType(601L, 401L, "看台", "280.00", 12);
        TicketType high = ticketType(602L, 401L, "内场", "680.00", 3);
        when(tourMapper.selectById(10L)).thenReturn(tour);
        when(stationMapper.selectList(any())).thenReturn(List.of(station));
        when(activityMapper.selectList(any())).thenReturn(List.of(activity));
        when(sessionMapper.selectList(any())).thenReturn(List.of(session));
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(low, high));
        when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue));

        Map<String, Object> detail = service.getTourDetail(10L);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> stationDetails = (List<Map<String, Object>>) detail.get("stationDetails");
        Map<String, Object> item = stationDetails.get(0);
        assertEquals("万象体育馆", item.get("venueName"));
        assertEquals("上海市浦东新区", item.get("venueAddress"));
        assertEquals(new BigDecimal("280.00"), item.get("priceMin"));
        assertEquals(new BigDecimal("680.00"), item.get("priceMax"));
        assertEquals(15, item.get("remainStock"));
        assertEquals("on_sale", item.get("saleStatus"));
        assertEquals("售票中", item.get("saleStatusText"));
        assertEquals("buy", item.get("primaryAction"));
    }

    @Test
    void getTourDetailMarksRiskSuspendedStationWithoutActivityAsSuspended() {
        Tour tour = tour(10L, 2003L);
        Station station = station(20L, 10L, null);
        station.setPublishStatus("risk_suspended");
        when(tourMapper.selectById(10L)).thenReturn(tour);
        when(stationMapper.selectList(any())).thenReturn(List.of(station));
        when(activityMapper.selectList(any())).thenReturn(List.of());

        Map<String, Object> detail = service.getTourDetail(10L);

        Map<String, Object> item = firstStationDetail(detail);
        assertEquals("suspended", item.get("saleStatus"));
        assertEquals("暂时停止售票", item.get("saleStatusText"));
        assertEquals("none", item.get("primaryAction"));
    }

    @Test
    void getTourDetailMarksRiskSuspendedStationWithActivityAsSuspended() {
        Tour tour = tour(10L, 2003L);
        Station station = station(20L, 10L, null);
        station.setPublishStatus("risk_suspended");
        Activity activity = activity(301L, 10L, 20L, "published");
        when(tourMapper.selectById(10L)).thenReturn(tour);
        when(stationMapper.selectList(any())).thenReturn(List.of(station));
        when(activityMapper.selectList(any())).thenReturn(List.of(activity));

        Map<String, Object> detail = service.getTourDetail(10L);

        Map<String, Object> item = firstStationDetail(detail);
        assertEquals("suspended", item.get("saleStatus"));
        assertEquals("暂时停止售票", item.get("saleStatusText"));
        assertEquals("none", item.get("primaryAction"));
    }

    @Test
    void getTourDetailMarksDraftStationAsComingSoonAnnounce() {
        Tour tour = tour(10L, 2003L);
        Station station = station(20L, 10L, null);
        station.setPublishStatus("draft");
        when(tourMapper.selectById(10L)).thenReturn(tour);
        when(stationMapper.selectList(any())).thenReturn(List.of(station));
        when(activityMapper.selectList(any())).thenReturn(List.of());

        Map<String, Object> detail = service.getTourDetail(10L);

        Map<String, Object> item = firstStationDetail(detail);
        assertEquals("coming_soon", item.get("saleStatus"));
        assertEquals("即将公布", item.get("saleStatusText"));
        assertEquals("none", item.get("primaryAction"));
    }

    @Test
    void getTourDetailHandlesNullMapperResults() {
        Tour tour = tour(10L, 2003L);
        Station station = station(20L, 10L, null);
        station.setPublishStatus("draft");
        when(tourMapper.selectById(10L)).thenReturn(tour);
        when(stationMapper.selectList(any())).thenReturn(List.of(station));
        when(activityMapper.selectList(any())).thenReturn(null);

        Map<String, Object> detail = service.getTourDetail(10L);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> stationDetails = (List<Map<String, Object>>) detail.get("stationDetails");
        assertEquals(1, stationDetails.size());
        assertEquals("coming_soon", stationDetails.get(0).get("saleStatus"));
        assertEquals("即将公布", stationDetails.get(0).get("saleStatusText"));
    }

    @Test
    void getTourDetailHandlesNullSessionMapperResults() {
        Tour tour = tour(10L, 2003L);
        Station station = station(20L, 10L, null);
        station.setPublishStatus("published");
        Activity activity = activity(301L, 10L, 20L, "published");
        when(tourMapper.selectById(10L)).thenReturn(tour);
        when(stationMapper.selectList(any())).thenReturn(List.of(station));
        when(activityMapper.selectList(any())).thenReturn(List.of(activity));
        when(sessionMapper.selectList(any())).thenReturn(null);

        Map<String, Object> detail = service.getTourDetail(10L);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> stationDetails = (List<Map<String, Object>>) detail.get("stationDetails");
        assertEquals(1, stationDetails.size());
        assertEquals("to_be_scheduled", stationDetails.get(0).get("saleStatus"));
        assertEquals("待定", stationDetails.get(0).get("saleStatusText"));
    }

    @Test
    void getTourDetailHandlesNullTicketTypeMapperResults() {
        Tour tour = tour(10L, 2003L);
        Station station = station(20L, 10L, null);
        station.setPublishStatus("published");
        Activity activity = activity(301L, 10L, 20L, "published");
        Session session = session(401L, 301L, 501L);
        when(tourMapper.selectById(10L)).thenReturn(tour);
        when(stationMapper.selectList(any())).thenReturn(List.of(station));
        when(activityMapper.selectList(any())).thenReturn(List.of(activity));
        when(sessionMapper.selectList(any())).thenReturn(List.of(session));
        when(ticketTypeMapper.selectList(any())).thenReturn(null);

        Map<String, Object> detail = service.getTourDetail(10L);

        Map<String, Object> item = firstStationDetail(detail);
        assertEquals("coming_soon", item.get("saleStatus"));
        assertEquals("即将开抢", item.get("saleStatusText"));
    }

    @Test
    void getTourDetailHandlesNullVenueMapperResults() {
        Tour tour = tour(10L, 2003L);
        Station station = station(20L, 10L, null);
        station.setPublishStatus("published");
        Activity activity = activity(301L, 10L, 20L, "published");
        Session session = session(401L, 301L, 501L);
        TicketType ticketType = ticketType(601L, 401L, "看台", "280.00", 5);
        when(tourMapper.selectById(10L)).thenReturn(tour);
        when(stationMapper.selectList(any())).thenReturn(List.of(station));
        when(activityMapper.selectList(any())).thenReturn(List.of(activity));
        when(sessionMapper.selectList(any())).thenReturn(List.of(session));
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));
        when(venueMapper.selectBatchIds(any())).thenReturn(null);

        Map<String, Object> detail = service.getTourDetail(10L);

        Map<String, Object> item = firstStationDetail(detail);
        assertEquals("on_sale", item.get("saleStatus"));
        assertEquals(null, item.get("venueName"));
    }

    @Test
    void legacyConstructorHandlesMissingTicketTypeAndVenueMappers() {
        TourStationService legacyService = new TourStationService(tourMapper, stationMapper, userAccessService,
                venueApplicationMapper, activityMapper, sessionMapper,
                activitySeatLayoutService, sessionSeatLayoutService);
        Tour tour = tour(10L, 2003L);
        Station station = station(20L, 10L, null);
        station.setPublishStatus("published");
        Activity activity = activity(301L, 10L, 20L, "published");
        Session session = session(401L, 301L, 501L);
        when(tourMapper.selectById(10L)).thenReturn(tour);
        when(stationMapper.selectList(any())).thenReturn(List.of(station));
        when(activityMapper.selectList(any())).thenReturn(List.of(activity));
        when(sessionMapper.selectList(any())).thenReturn(List.of(session));

        Map<String, Object> detail = legacyService.getTourDetail(10L);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> stationDetails = (List<Map<String, Object>>) detail.get("stationDetails");
        assertEquals(1, stationDetails.size());
        assertEquals("coming_soon", stationDetails.get(0).get("saleStatus"));
        assertEquals("即将开抢", stationDetails.get(0).get("saleStatusText"));
        assertEquals(null, stationDetails.get(0).get("venueName"));
    }

    @Test
    void publishStationCreatesActivitySessionCopiesLayoutGeneratesStockAndMarksPublished() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
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
        assertNotNull(activity.getUpdateTime());
        assertNotNull(session.getUpdateTime());
        assertEquals("published", station.getPublishStatus());
        verify(activitySeatLayoutService).copyFromVenueApplication(2003L, 301L, 88L);
        verify(sessionSeatLayoutService).copyFromActivity(2003L, 401L, 301L);
        verify(sessionSeatLayoutService).generateSessionSeats(401L);
        verify(activityMapper).updateById(activity);
        verify(stationMapper).updateById(station);
    }

    @Test
    void publishStationReusesExistingStationActivity() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        Tour tour = tour(10L, 2003L);
        tour.setTitle("万象巡演");
        Station station = station(20L, 10L, 88L);
        Activity existing = activity(301L, 10L, 20L, "published");
        VenueApplication application = approvedApplication(88L, 2003L, 101L,
                LocalDateTime.of(2026, 6, 1, 0, 0), LocalDateTime.of(2026, 6, 30, 23, 59));
        when(tourMapper.selectById(10L)).thenReturn(tour);
        when(stationMapper.selectById(20L)).thenReturn(station);
        when(venueApplicationMapper.selectById(88L)).thenReturn(application);
        when(activityMapper.selectOne(any())).thenReturn(existing);
        doAnswer(invocation -> {
            Session session = invocation.getArgument(0);
            session.setId(401L);
            return 1;
        }).when(sessionMapper).insert(any(Session.class));

        Map<String, Object> result = service.publishStation(2003L, 20L, Map.of(
                "startTime", "2026-06-10T20:00",
                "endTime", "2026-06-10T22:00"));

        assertSame(existing, result.get("activity"));
        assertNotNull(existing.getUpdateTime());
        @SuppressWarnings("rawtypes")
        ArgumentCaptor<LambdaQueryWrapper> wrapperCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(activityMapper).selectOne(wrapperCaptor.capture());
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), Activity.class);
        LambdaUtils.installCache(TableInfoHelper.getTableInfo(Activity.class));
        String queryConditions = wrapperCaptor.getValue().getSqlSegment();
        assertTrue(queryConditions.contains("station_id") || queryConditions.contains("stationId"), queryConditions);
        assertTrue(queryConditions.contains("status"), queryConditions);
        assertTrue(wrapperCaptor.getValue().getParamNameValuePairs().containsValue(20L));
        assertTrue(wrapperCaptor.getValue().getParamNameValuePairs().containsValue(1));
        verify(activityMapper, never()).insert(any(Activity.class));
        verify(activitySeatLayoutService).copyFromVenueApplication(2003L, 301L, 88L);
        verify(sessionSeatLayoutService).copyFromActivity(2003L, 401L, 301L);
        verify(sessionSeatLayoutService).generateSessionSeats(401L);
        verify(activityMapper).updateById(existing);
    }

    @Test
    void publishStationRejectsWhenSessionOutsideVenueApplicationValidity() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(tourMapper.selectById(10L)).thenReturn(tour(10L, 2003L));
        when(stationMapper.selectById(20L)).thenReturn(station(20L, 10L, 88L));
        when(venueApplicationMapper.selectById(88L)).thenReturn(approvedApplication(88L, 2003L, 101L,
                LocalDateTime.of(2026, 6, 1, 0, 0), LocalDateTime.of(2026, 6, 5, 23, 59)));

        BusinessException error = assertThrows(BusinessException.class, () -> service.publishStation(2003L, 20L, Map.of(
                "startTime", "2026-06-10T20:00",
                "endTime", "2026-06-10T22:00")));

        assertEquals("场次时间不在场地使用权有效期内", error.getMessage());
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
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

    private Activity activity(Long id, Long tourId, Long stationId, String publishStatus) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setTourId(tourId);
        activity.setStationId(stationId);
        activity.setPublishStatus(publishStatus);
        activity.setStatus(1);
        return activity;
    }

    private Session session(Long id, Long activityId, Long venueId) {
        Session session = new Session();
        session.setId(id);
        session.setActivityId(activityId);
        session.setVenueId(venueId);
        session.setStatus(1);
        return session;
    }

    private TicketType ticketType(Long id, Long sessionId, String name, String price, Integer remainStock) {
        TicketType ticketType = new TicketType();
        ticketType.setId(id);
        ticketType.setSessionId(sessionId);
        ticketType.setName(name);
        ticketType.setPrice(new BigDecimal(price));
        ticketType.setRemainStock(remainStock);
        ticketType.setStatus(1);
        return ticketType;
    }

    private Venue venue(Long id, String name, String address) {
        Venue venue = new Venue();
        venue.setId(id);
        venue.setName(name);
        venue.setAddress(address);
        venue.setStatus(1);
        return venue;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> firstStationDetail(Map<String, Object> detail) {
        List<Map<String, Object>> stationDetails = (List<Map<String, Object>>) detail.get("stationDetails");
        return stationDetails.get(0);
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
