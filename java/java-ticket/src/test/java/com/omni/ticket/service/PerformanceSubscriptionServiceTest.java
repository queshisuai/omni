package com.omni.ticket.service;

import com.omni.ticket.dto.SubscriptionRequest;
import com.omni.ticket.dto.SubscriptionResponse;
import com.omni.common.result.Result;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.entity.PerformanceSubscription;
import com.omni.ticket.entity.Tour;
import com.omni.ticket.client.NotificationInternalClient;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ArtistMapper;
import com.omni.ticket.mapper.PerformanceSubscriptionMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.TourMapper;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.mq.NotificationMqProducer;
import com.omni.common.mq.message.NotificationEventMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
    @Mock
    private NotificationMqProducer notificationProducer;
    @Mock
    private NotificationInternalClient notificationInternalClient;

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
    void createTourCityReminderNotifiesTourOrganizerAboutExtraCityWish() {
        PerformanceSubscriptionService service = service();
        Tour tour = new Tour();
        tour.setId(88L);
        tour.setTitle("夏日巡回演唱会");
        tour.setOrganizerId(2003L);
        when(tourMapper.selectById(88L)).thenReturn(tour);
        when(subscriptionMapper.selectOne(any())).thenReturn(null);
        when(subscriptionMapper.insert(any())).thenAnswer(invocation -> {
            PerformanceSubscription subscription = invocation.getArgument(0);
            subscription.setId(101L);
            return 1;
        });
        when(notificationInternalClient.createInternalEvent(any(), any())).thenReturn(Result.success());

        SubscriptionRequest request = new SubscriptionRequest();
        request.setTargetType("TOUR_CITY_REMINDER");
        request.setTargetId(88L);
        request.setCity("成都");
        SubscriptionResponse response = service.createSubscription(2004L, request);

        assertEquals("TOUR_CITY_REMINDER", response.getTargetType());
        assertEquals("成都", response.getCity());
        ArgumentCaptor<NotificationEventMessage> captor = ArgumentCaptor.forClass(NotificationEventMessage.class);
        verify(notificationProducer).sendNotificationEvent(captor.capture());
        NotificationEventMessage event = captor.getValue();
        verify(notificationInternalClient).createInternalEvent(event, "test-internal-token");
        assertEquals("TOUR_CITY_WISH", event.getEventType());
        assertEquals(2003L, event.getUserId());
        assertEquals("/console/tours/88", event.getActionHref());
        assertEquals("查看巡演", event.getActionLabel());
        assertTrue(event.getAggregateKey().startsWith("TOUR_CITY_WISH:88:成都:"));
        assertTrue(event.getContent().contains("夏日巡回演唱会"));
        assertTrue(event.getContent().contains("成都"));
    }

    @Test
    void performanceSubscriptionServiceDoesNotGenerateLocalCalendarFiles() {
        assertThrows(NoSuchMethodException.class,
                () -> PerformanceSubscriptionService.class.getDeclaredMethod("createCalendar", Long.class));
    }

    private PerformanceSubscriptionService service() {
        PerformanceSubscriptionService service = new PerformanceSubscriptionService(subscriptionMapper, activityMapper, artistMapper, sessionMapper,
                venueMapper, ticketTypeMapper, tourMapper);
        service.setNotificationProducer(notificationProducer);
        service.setNotificationInternalClient(notificationInternalClient);
        service.setInternalApiToken("test-internal-token");
        return service;
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
