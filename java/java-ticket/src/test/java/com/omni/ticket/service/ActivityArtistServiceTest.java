package com.omni.ticket.service;

import com.omni.ticket.dto.ActivityArtistDto;
import com.omni.ticket.entity.ActivityArtist;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.mapper.ActivityArtistMapper;
import com.omni.ticket.mapper.ArtistMapper;
import com.omni.ticket.mapper.SessionMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.AutowiredAnnotationBeanPostProcessor;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ActivityArtistServiceTest {
    @Mock ActivityArtistMapper activityArtistMapper;
    @Mock ArtistMapper artistMapper;

    @Test
    void springCanCreateActivityArtistServiceWithConstructorInjection() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.registerBean(AutowiredAnnotationBeanPostProcessor.class);
            context.registerBean(ActivityArtistMapper.class, () -> mock(ActivityArtistMapper.class));
            context.registerBean(ArtistMapper.class, () -> mock(ArtistMapper.class));
            context.registerBean(SessionMapper.class, () -> mock(SessionMapper.class));
            context.registerBean(com.omni.ticket.client.OrderInternalClient.class, () -> mock(com.omni.ticket.client.OrderInternalClient.class));
            context.registerBean(com.omni.ticket.mq.NotificationMqProducer.class, () -> mock(com.omni.ticket.mq.NotificationMqProducer.class));
            context.registerBean(ActivityArtistService.class);

            context.refresh();

            assertNotNull(context.getBean(ActivityArtistService.class));
        }
    }

    @Test
    void saveLineupMovesPrimaryToFirstAndPersistsRows() {
        ActivityArtistService service = new ActivityArtistService(activityArtistMapper, artistMapper);
        Artist a1 = artist(1L, "五月天");
        Artist a2 = artist(2L, "周杰伦");
        when(artistMapper.selectBatchIds(List.of(1L, 2L))).thenReturn(List.of(a1, a2));

        ActivityArtistDto first = new ActivityArtistDto();
        first.setArtistId(1L);
        first.setRoleType("co_headliner");
        first.setRoleName("联合主演");
        first.setVisibility("public");
        first.setSort(1);
        ActivityArtistDto second = new ActivityArtistDto();
        second.setArtistId(2L);
        second.setPrimary(true);
        second.setRoleType("primary");
        second.setRoleName("主艺人");
        second.setVisibility("public");
        second.setSort(2);

        service.saveLineup(10L, List.of(first, second));

        ArgumentCaptor<ActivityArtist> captor = ArgumentCaptor.forClass(ActivityArtist.class);
        verify(activityArtistMapper, times(2)).insert(captor.capture());
        assertEquals(2L, captor.getAllValues().get(0).getArtistId());
        assertTrue(captor.getAllValues().get(0).getPrimary());
        assertEquals(1, captor.getAllValues().get(0).getSort());
        assertEquals(1L, captor.getAllValues().get(1).getArtistId());
        assertFalse(captor.getAllValues().get(1).getPrimary());
        assertEquals(2, captor.getAllValues().get(1).getSort());
    }

    @Test
    void saveLineupRejectsDuplicateArtist() {
        ActivityArtistService service = new ActivityArtistService(activityArtistMapper, artistMapper);
        ActivityArtistDto one = new ActivityArtistDto();
        one.setArtistId(1L);
        ActivityArtistDto two = new ActivityArtistDto();
        two.setArtistId(1L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.saveLineup(10L, List.of(one, two)));

        assertEquals("同一活动不能重复选择同一艺人", ex.getMessage());
        verify(activityArtistMapper, never()).insert(any());
    }

    @Test
    void listPublicLineupFiltersHiddenArtists() {
        ActivityArtistService service = new ActivityArtistService(activityArtistMapper, artistMapper);
        ActivityArtist publicArtist = row(10L, 1L, 1, true, "public");
        ActivityArtist hiddenArtist = row(10L, 2L, 2, false, "hidden");
        when(activityArtistMapper.selectList(any())).thenReturn(List.of(publicArtist, hiddenArtist));
        when(artistMapper.selectBatchIds(List.of(1L, 2L))).thenReturn(List.of(artist(1L, "周杰伦"), artist(2L, "保密嘉宾")));

        List<ActivityArtistDto> result = service.listPublicLineup(10L);

        assertEquals(1, result.size());
        assertEquals("周杰伦", result.get(0).getName());
    }

    private Artist artist(Long id, String name) {
        Artist artist = new Artist();
        artist.setId(id);
        artist.setName(name);
        artist.setStatus(1);
        return artist;
    }

    private ActivityArtist row(Long activityId, Long artistId, int sort, boolean primary, String visibility) {
        ActivityArtist row = new ActivityArtist();
        row.setActivityId(activityId);
        row.setArtistId(artistId);
        row.setSort(sort);
        row.setPrimary(primary);
        row.setRoleType(primary ? "primary" : "special_guest");
        row.setRoleName(primary ? "主艺人" : "特邀嘉宾");
        row.setVisibility(visibility);
        row.setStatus(1);
        return row;
    }
}
