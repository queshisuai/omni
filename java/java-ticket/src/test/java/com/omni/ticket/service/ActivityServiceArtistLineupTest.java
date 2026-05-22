package com.omni.ticket.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.dto.ActivityArtistDto;
import com.omni.ticket.dto.ActivityDetailVO;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ArtistMapper;
import com.omni.ticket.mapper.CategoryMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
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

    @Test
    void listActivitiesUsesPublicLineupSummaryAndArtists() {
        Activity activity = new Activity();
        activity.setId(10L);
        activity.setName("公开阵容活动");
        activity.setArtistId(99L);
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
    void getActivityDetailReturnsPublicLineup() {
        Activity activity = new Activity();
        activity.setId(10L);
        activity.setArtistId(99L);
        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(artistMapper.selectById(99L)).thenReturn(artist(99L, "旧单艺人"));
        when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());
        when(activityArtistService.listPublicLineup(10L)).thenReturn(List.of(lineup("周杰伦"), lineup("五月天")));
        ActivityService service = new ActivityService(activityMapper, categoryMapper, artistMapper, sessionMapper, venueMapper, ticketTypeMapper, activityArtistService);

        ActivityDetailVO detail = service.getActivityDetail(10L);

        assertEquals(2, detail.getArtists().size());
        assertEquals("周杰伦", detail.getArtists().get(0).getName());
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
