package com.omni.ticket.service;

import com.omni.ticket.dto.SubscriptionCalendarResponse;
import com.omni.ticket.dto.SubscriptionRequest;
import com.omni.ticket.dto.SubscriptionResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.entity.PerformanceSubscription;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ArtistMapper;
import com.omni.ticket.mapper.PerformanceSubscriptionMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.TourMapper;
import com.omni.ticket.mapper.VenueMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PerformanceSubscriptionServiceTest {

    @Mock
    private PerformanceSubscriptionMapper subscriptionMapper;
    @Mock
    private ActivityMapper activityMapper;
    @Mock
    private ArtistMapper artistMapper;
    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private VenueMapper venueMapper;
    @Mock
    private TicketTypeMapper ticketTypeMapper;
    @Mock
    private TourMapper tourMapper;

    @Test
    void createActivityWantStoresActivitySnapshot() {
        PerformanceSubscriptionService service = service();
        Activity activity = activity();
        when(activityMapper.selectById(7L)).thenReturn(activity);
        when(subscriptionMapper.selectOne(any())).thenReturn(null);
        when(subscriptionMapper.insert(any())).thenAnswer(invocation -> {
            PerformanceSubscription subscription = invocation.getArgument(0);
            subscription.setId(99L);
            return 1;
        });

        SubscriptionRequest request = new SubscriptionRequest();
        request.setTargetType("ACTIVITY_WANT");
        request.setTargetId(7L);
        SubscriptionResponse response = service.createSubscription(2004L, request);

        assertEquals(99L, response.getId());
        assertEquals("ACTIVITY_WANT", response.getTargetType());
        assertEquals("周末演唱会", response.getActivityName());
        ArgumentCaptor<PerformanceSubscription> captor = ArgumentCaptor.forClass(PerformanceSubscription.class);
        verify(subscriptionMapper).insert(captor.capture());
        assertEquals(2004L, captor.getValue().getUserId());
        assertEquals(7L, captor.getValue().getActivityId());
        assertEquals("周末演唱会", captor.getValue().getTargetName());
    }

    @Test
    void createArtistFollowStoresArtistName() {
        PerformanceSubscriptionService service = service();
        Artist artist = new Artist();
        artist.setId(12L);
        artist.setName("示例艺人");
        when(artistMapper.selectById(12L)).thenReturn(artist);
        when(subscriptionMapper.selectOne(any())).thenReturn(null);
        when(subscriptionMapper.insert(any())).thenAnswer(invocation -> {
            PerformanceSubscription subscription = invocation.getArgument(0);
            subscription.setId(100L);
            return 1;
        });

        SubscriptionRequest request = new SubscriptionRequest();
        request.setTargetType("ARTIST_FOLLOW");
        request.setTargetId(12L);
        SubscriptionResponse response = service.createSubscription(2004L, request);

        assertEquals("示例艺人", response.getTargetName());
        assertEquals(12L, response.getArtistId());
    }

    @Test
    void createCalendarIncludesWatchedActivitySessions() {
        PerformanceSubscriptionService service = service();
        PerformanceSubscription subscription = new PerformanceSubscription();
        subscription.setId(99L);
        subscription.setUserId(2004L);
        subscription.setTargetType("ACTIVITY_WANT");
        subscription.setActivityId(7L);
        subscription.setTargetName("周末演唱会");
        subscription.setStatus(1);
        Activity activity = activity();
        Session session = new Session();
        session.setId(33L);
        session.setActivityId(7L);
        session.setVenueId(5L);
        session.setStartTime(LocalDateTime.of(2026, 6, 20, 19, 30));
        session.setEndTime(LocalDateTime.of(2026, 6, 20, 22, 0));
        Venue venue = new Venue();
        venue.setId(5L);
        venue.setName("上海体育馆");
        venue.setCity("上海");
        when(subscriptionMapper.selectList(any())).thenReturn(List.of(subscription));
        when(activityMapper.selectBatchIds(List.of(7L))).thenReturn(List.of(activity));
        when(sessionMapper.selectList(any())).thenReturn(List.of(session));
        when(venueMapper.selectBatchIds(List.of(5L))).thenReturn(List.of(venue));

        SubscriptionCalendarResponse response = service.createCalendar(2004L);

        assertEquals("omni-calendar-2004.ics", response.getFileName());
        assertTrue(response.getContent().contains("SUMMARY:周末演唱会"));
        assertTrue(response.getContent().contains("DTSTART;TZID=Asia/Shanghai:20260620T193000"));
        assertTrue(response.getContent().contains("LOCATION:上海体育馆"));
    }

    private PerformanceSubscriptionService service() {
        return new PerformanceSubscriptionService(subscriptionMapper, activityMapper, artistMapper, sessionMapper,
                venueMapper, ticketTypeMapper, tourMapper);
    }

    private Activity activity() {
        Activity activity = new Activity();
        activity.setId(7L);
        activity.setName("周末演唱会");
        activity.setPoster("/poster.jpg");
        activity.setArtistId(12L);
        activity.setStatus(1);
        activity.setPublishStatus("published");
        return activity;
    }
}
