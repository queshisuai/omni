package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.UserRef;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.service.SessionSeatLayoutService;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.UserRefMapper;
import com.omni.ticket.mapper.VenueMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
class SessionAdminServiceTest {

    @Mock
    private ActivityMapper activityMapper;
    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private VenueMapper venueMapper;
    @Mock
    private UserRefMapper userRefMapper;
    @Mock
    private SessionSeatService sessionSeatService;
    @Mock
    private SessionSeatLayoutService sessionSeatLayoutService;

    private SessionAdminService service;

    @BeforeEach
    void setUp() {
        service = new SessionAdminService(activityMapper, sessionMapper, venueMapper, userRefMapper, null, sessionSeatService, sessionSeatLayoutService);
    }

    @Test
    void createSessionGeneratesSeatSnapshotAfterInsert() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(venueMapper.selectById(101L)).thenReturn(venue(101L));
        when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());
        doAnswer(invocation -> {
            Session inserted = invocation.getArgument(0);
            inserted.setId(501L);
            return 1;
        }).when(sessionMapper).insert(any());

        Session session = service.createSession(baseBody());

        verify(sessionMapper).insert(session);
        verify(sessionSeatService).generateForSession(501L);
    }

    @Test
    void createSessionCopiesActivityLayoutWhenActivityLayoutIdProvided() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(venueMapper.selectById(101L)).thenReturn(venue(101L));
        when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());
        doAnswer(invocation -> {
            Session inserted = invocation.getArgument(0);
            inserted.setId(602L);
            return 1;
        }).when(sessionMapper).insert(any());

        Map<String, Object> body = baseBody();
        body.put("activityLayoutId", 77L);

        service.createSession(body);

        verify(sessionSeatLayoutService).copyFromActivityLayout(2003L, 602L, 77L);
        verify(sessionSeatLayoutService).generateSessionSeats(602L);
        verify(sessionSeatService, never()).generateForSession(602L);
    }

    @Test
    void createSessionIsTransactional() throws NoSuchMethodException {
        assertTrue(SessionAdminService.class
                .getMethod("createSession", Map.class)
                .isAnnotationPresent(Transactional.class));
    }

    @Test
    void createSessionRejectsWhenEndTimeNotAfterStartTime() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(venueMapper.selectById(101L)).thenReturn(venue(101L));

        Map<String, Object> body = baseBody();
        body.put("endTime", "2026-06-01T19:00");

        BusinessException error = assertThrows(BusinessException.class, () -> service.createSession(body));

        assertEquals("结束时间必须晚于开始时间", error.getMessage());
        verify(sessionMapper, never()).insert(any());
    }

    @Test
    void createSessionRejectsWhenVenueTimeOverlapsActiveSession() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(venueMapper.selectById(101L)).thenReturn(venue(101L));
        Session existing = new Session();
        existing.setId(501L);
        existing.setVenueId(101L);
        existing.setStartTime(LocalDateTime.of(2026, 6, 1, 19, 30));
        existing.setEndTime(LocalDateTime.of(2026, 6, 1, 21, 30));
        existing.setStatus(1);
        when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(existing));

        BusinessException error = assertThrows(BusinessException.class, () -> service.createSession(baseBody()));

        assertEquals("同一场馆该时间段已有场次", error.getMessage());
        verify(sessionMapper, never()).insert(any());
    }

    @Test
    void deleteSessionDeletesSeatsThenSession() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        Session session = new Session();
        session.setId(50L);
        session.setActivityId(10L);
        session.setVenueId(101L);
        session.setStartTime(LocalDateTime.of(2026, 6, 1, 20, 0));
        session.setEndTime(LocalDateTime.of(2026, 6, 1, 22, 0));
        when(sessionMapper.selectById(50L)).thenReturn(session);
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));

        service.deleteSession(2003L, 50L);

        verify(sessionSeatService).deleteBySessionId(50L);
        verify(sessionMapper).deleteById(50L);
    }

    @Test
    void deleteSessionIsTransactional() throws NoSuchMethodException {
        assertTrue(SessionAdminService.class
                .getMethod("deleteSession", Long.class, Long.class)
                .isAnnotationPresent(Transactional.class));
    }

    private Map<String, Object> baseBody() {
        Map<String, Object> body = new HashMap<>();
        body.put("userId", 2003L);
        body.put("activityId", 10L);
        body.put("venueId", 101L);
        body.put("startTime", "2026-06-01T20:00");
        body.put("endTime", "2026-06-01T22:00");
        return body;
    }

    private UserRef user(Long id, String role) {
        UserRef user = new UserRef();
        user.setId(id);
        user.setRole(role);
        return user;
    }

    private Activity activity(Long id, Long organizerId) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setOrganizerId(organizerId);
        activity.setStatus(1);
        return activity;
    }

    private Venue venue(Long id) {
        Venue venue = new Venue();
        venue.setId(id);
        venue.setStatus(1);
        return venue;
    }
}
