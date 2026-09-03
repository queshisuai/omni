package com.omni.ticket.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.ActivityArtistDto;
import com.omni.ticket.dto.ActivityDetailVO;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.Station;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.Tour;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ArtistMapper;
import com.omni.ticket.mapper.CategoryMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.StationMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.TourMapper;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.search.ActivitySearchProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActivityServiceArtistLineupTest {
    @Mock ActivityMapper activityMapper;
    @Mock CategoryMapper categoryMapper;
    @Mock ArtistMapper artistMapper;
    @Mock SessionMapper sessionMapper;
    @Mock VenueMapper venueMapper;
    @Mock TicketTypeMapper ticketTypeMapper;
    @Mock ActivityArtistService activityArtistService;
    @Mock TourMapper tourMapper;
    @Mock StationMapper stationMapper;

    @Test
    void listActivitiesUsesPublicLineupSummaryAndArtists() {
        Activity activity = new Activity();
        activity.setId(10L);
        activity.setName("公开阵容活动");
        activity.setArtistId(99L);
        activity.setStatus(1);
        activity.setPublishStatus("published");
        Page<Activity> page = new Page<>(1, 10, 1);
        page.setRecords(List.of(activity));
        when(activityMapper.selectPage(any(), any())).thenReturn(page);
        when(artistMapper.selectBatchIds(any())).thenReturn(List.of(artist(99L, "旧单艺人")));
        when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());
        when(activityArtistService.listPublicLineup(10L)).thenReturn(List.of(lineup("周杰伦"), lineup("五月天")));

        ActivityService service = new ActivityService(activityMapper, categoryMapper, artistMapper, sessionMapper, venueMapper, ticketTypeMapper, activityArtistService);

        ActivityVO vo = service.listActivities(1, 10, null).getRecords().get(0);

        assertEquals("周杰伦、五月天", vo.getArtistName());
        assertEquals(2, vo.getArtists().size());
    }

    @Test
    void listActivitiesIncludesPublishedTourSummary() {
        Page<Activity> page = new Page<>(1, 10, 0);
        page.setRecords(Collections.emptyList());
        when(activityMapper.selectPage(any(), any())).thenReturn(page);
        Tour tour = new Tour();
        tour.setId(30L);
        tour.setTitle("城市先公布巡演");
        tour.setPoster("/poster.jpg");
        tour.setReviewStatus("announced");
        tour.setStatus(1);
        Page<Tour> tourPage = new Page<>(1, 10, 1);
        tourPage.setRecords(List.of(tour));
        when(tourMapper.selectPage(any(), any())).thenReturn(tourPage);
        Station station = new Station();
        station.setId(40L);
        station.setTourId(30L);
        station.setCity("北京");
        station.setPublishStatus("published");
        station.setStatus(1);
        when(stationMapper.selectList(any())).thenReturn(List.of(station), List.of(station));
        Activity stationActivity = new Activity();
        stationActivity.setId(50L);
        stationActivity.setStationId(40L);
        stationActivity.setPublishStatus("published");
        stationActivity.setStatus(1);
        when(activityMapper.selectList(any())).thenReturn(List.of(stationActivity));
        Session session = new Session();
        session.setId(60L);
        session.setActivityId(50L);
        session.setStartTime(LocalDateTime.of(2026, 7, 1, 20, 0));
        when(sessionMapper.selectList(any())).thenReturn(List.of(session));
        TicketType ticketType = new TicketType();
        ticketType.setId(70L);
        ticketType.setSessionId(60L);
        ticketType.setPrice(new BigDecimal("280.00"));
        ticketType.setStatus(1);
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));

        ActivityService service = new ActivityService(activityMapper, categoryMapper, artistMapper, sessionMapper,
                venueMapper, ticketTypeMapper, activityArtistService, tourMapper, stationMapper);

        ActivityVO vo = service.listActivities(1, 10, null).getRecords().get(0);

        assertEquals(30L, vo.getId());
        assertEquals("tour", vo.getItemType());
        assertEquals("城市先公布巡演", vo.getName());
        assertEquals("北京", vo.getVenueCity());
        assertEquals(LocalDateTime.of(2026, 7, 1, 20, 0), vo.getStartTime());
        assertEquals(new BigDecimal("280.00"), vo.getMinPrice());
        assertEquals(1, vo.getStatus());
    }

    @Test
    void listActivitiesIncludesAnnouncedTourBeforeStationPublished() {
        Page<Activity> page = new Page<>(1, 10, 0);
        page.setRecords(Collections.emptyList());
        when(activityMapper.selectPage(any(), any())).thenReturn(page);
        Tour tour = new Tour();
        tour.setId(31L);
        tour.setTitle("鍩庡競瀹樺宸℃紨");
        tour.setReviewStatus("announced");
        tour.setStatus(1);
        Page<Tour> tourPage = new Page<>(1, 10, 1);
        tourPage.setRecords(List.of(tour));
        when(tourMapper.selectPage(any(), any())).thenReturn(tourPage);
        Station station = new Station();
        station.setId(41L);
        station.setTourId(31L);
        station.setCity("涓婃捣");
        station.setPublishStatus("city_announced");
        station.setStatus(1);
        when(stationMapper.selectList(any())).thenReturn(List.of(station));

        ActivityService service = new ActivityService(activityMapper, categoryMapper, artistMapper, sessionMapper,
                venueMapper, ticketTypeMapper, activityArtistService, tourMapper, stationMapper);

        Page<ActivityVO> result = service.listActivities(1, 10, null);

        ActivityVO vo = result.getRecords().get(0);
        assertEquals(31L, vo.getId());
        assertEquals("tour", vo.getItemType());
        assertEquals("涓婃捣", vo.getVenueCity());
        assertEquals(2, vo.getStatus());
    }

    @Test
    void searchActivitiesFiltersByKeywordCityPriceAndRealName() {
        ActivitySearchProvider searchProvider = request -> {
            assertEquals(1, request.getPage());
            assertEquals(10, request.getSize());
            assertEquals("周杰伦", request.getKeyword());
            assertEquals("上海", request.getCity());
            assertEquals(LocalDate.of(2026, 6, 1), request.getDateFrom());
            assertEquals(LocalDate.of(2026, 6, 30), request.getDateTo());
            assertEquals(new BigDecimal("180.00"), request.getMinPrice());
            assertEquals(new BigDecimal("580.00"), request.getMaxPrice());
            assertEquals("on_sale", request.getSaleStatus());
            assertEquals(true, request.getRealNameRequired());
            assertEquals("price_asc", request.getSort());
            ActivityVO vo = new ActivityVO();
            vo.setId(10L);
            vo.setName("周末演唱会");
            Page<ActivityVO> result = new Page<>(1, 10, 1);
            result.setRecords(List.of(vo));
            return result;
        };
        ActivityService service = new ActivityService(activityMapper, categoryMapper, artistMapper, sessionMapper,
                venueMapper, ticketTypeMapper, activityArtistService, null, null, null, searchProvider);

        Page<ActivityVO> result = service.searchActivities(1, 10, null, "周杰伦", "上海",
                LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30),
                new BigDecimal("180.00"), new BigDecimal("580.00"),
                "on_sale", null, true, "price_asc");

        assertEquals(1, result.getTotal());
        assertEquals("周末演唱会", result.getRecords().get(0).getName());
    }

    @Test
    void getActivityDetailReturnsPublicLineup() {
        Activity activity = new Activity();
        activity.setId(10L);
        activity.setArtistId(99L);
        activity.setStatus(1);
        activity.setPublishStatus("published");
        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(artistMapper.selectById(99L)).thenReturn(artist(99L, "旧单艺人"));
        when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());
        when(activityArtistService.listPublicLineup(10L)).thenReturn(List.of(lineup("周杰伦"), lineup("五月天")));
        ActivityService service = new ActivityService(activityMapper, categoryMapper, artistMapper, sessionMapper, venueMapper, ticketTypeMapper, activityArtistService);

        ActivityDetailVO detail = service.getActivityDetail(10L);

        assertEquals(2, detail.getArtists().size());
        assertEquals("周杰伦", detail.getArtists().get(0).getName());
    }

    @Test
    void getActivityDetailRejectsDraftActivity() {
        Activity activity = new Activity();
        activity.setId(10L);
        activity.setStatus(1);
        activity.setPublishStatus("draft");
        when(activityMapper.selectById(10L)).thenReturn(activity);
        ActivityService service = new ActivityService(activityMapper, categoryMapper, artistMapper, sessionMapper, venueMapper, ticketTypeMapper, activityArtistService);

        BusinessException error = assertThrows(BusinessException.class, () -> service.getActivityDetail(10L));

        assertEquals(404, error.getCode());
    }

    private Artist artist(Long id, String name) {
        Artist artist = new Artist();
        artist.setId(id);
        artist.setName(name);
        return artist;
    }

    private ActivityArtistDto lineup(String name) {
        ActivityArtistDto dto = new ActivityArtistDto();
        dto.setName(name);
        dto.setVisibility("public");
        return dto;
    }
}
