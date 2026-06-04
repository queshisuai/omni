package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.service.SessionSeatLayoutService;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.service.UserAccessService;
import com.omni.ticket.mapper.VenueMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Transactional;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
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
    private UserAccessService userAccessService;
    @Mock
    private TicketTypeMapper ticketTypeMapper;
    @Mock
    private SessionSeatMapper sessionSeatMapper;
    @Mock
    private SessionSeatService sessionSeatService;
    @Mock
    private SessionSeatLayoutService sessionSeatLayoutService;

    private SessionAdminService service;

    @BeforeEach
    void setUp() {
        service = new SessionAdminService(activityMapper, sessionMapper, venueMapper, userAccessService, ticketTypeMapper, sessionSeatService, sessionSeatLayoutService, sessionSeatMapper);
    }

    @Test
    void createSessionGeneratesSeatSnapshotAfterInsert() {
        allowSessionManager(2003L, "organizer");
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
        allowSessionManager(2003L, "organizer");
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
        allowSessionManager(2003L, "organizer");
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
        allowSessionManager(2003L, "organizer");
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
        allowSessionManager(2003L, "organizer");
        Session session = new Session();
        session.setId(50L);
        session.setActivityId(10L);
        session.setVenueId(101L);
        session.setStartTime(LocalDateTime.of(2026, 6, 1, 20, 0));
        session.setEndTime(LocalDateTime.of(2026, 6, 1, 22, 0));
        when(sessionMapper.selectById(50L)).thenReturn(session);
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));

        service.deleteSession(2003L, 50L);

        verify(ticketTypeMapper).delete(any());
        verify(sessionSeatService).deleteBySessionId(50L);
        verify(sessionSeatLayoutService).deleteBySessionId(50L);
        verify(sessionMapper).deleteById(50L);
    }

    @Test
    void deleteSessionIsTransactional() throws NoSuchMethodException {
        assertTrue(SessionAdminService.class
                .getMethod("deleteSession", Long.class, Long.class)
                .isAnnotationPresent(Transactional.class));
    }

    @Test
    void listSessionsIncludesTicketTypesForManagement() {
        allowSessionManager(2002L, "admin");
        Session session = new Session();
        session.setId(501L);
        session.setActivityId(10L);
        session.setVenueId(101L);
        session.setStartTime(LocalDateTime.of(2026, 6, 1, 20, 0));
        session.setEndTime(LocalDateTime.of(2026, 6, 1, 22, 0));
        session.setStatus(1);
        Page<Session> page = new Page<>(1, 10, 1);
        page.setRecords(List.of(session));
        when(sessionMapper.selectPage(any(), any())).thenReturn(page);
        when(activityMapper.selectBatchIds(any())).thenReturn(List.of(activity(10L, 2003L)));
        when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue(101L)));
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType(801L, 501L, "VIP票", 980, 60, 58)));

        Page<com.omni.ticket.dto.SessionAdminResponse> result = service.listSessions(2002L, 1, 10, null, null, null);

        assertEquals(1, result.getRecords().size());
        assertEquals(1, result.getRecords().get(0).getTicketTypes().size());
        assertEquals(801L, result.getRecords().get(0).getTicketTypes().get(0).getId());
        assertEquals("VIP票", result.getRecords().get(0).getTicketTypes().get(0).getName());
    }

    @Test
    void listSessionsUsesSeatStatusesForSeatBasedStockSummary() {
        allowSessionManager(2002L, "admin");
        Session session = new Session();
        session.setId(501L);
        session.setActivityId(10L);
        session.setVenueId(101L);
        session.setStartTime(LocalDateTime.of(2026, 6, 1, 20, 0));
        session.setEndTime(LocalDateTime.of(2026, 6, 1, 22, 0));
        session.setStatus(1);
        Page<Session> page = new Page<>(1, 10, 1);
        page.setRecords(List.of(session));
        TicketType seatedTicketType = ticketType(801L, 501L, "普通票", 380, 112, 112);
        when(sessionMapper.selectPage(any(), any())).thenReturn(page);
        when(activityMapper.selectBatchIds(any())).thenReturn(List.of(activity(10L, 2003L)));
        when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue(101L)));
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(seatedTicketType));
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(
                sessionSeat(1L, 501L, 801L, 1),
                sessionSeat(2L, 501L, 801L, 1),
                sessionSeat(3L, 501L, 801L, 3),
                sessionSeat(4L, 501L, 801L, 4)
        ));

        Page<com.omni.ticket.dto.SessionAdminResponse> result = service.listSessions(2002L, 1, 10, null, null, null);

        com.omni.ticket.dto.SessionAdminResponse response = result.getRecords().get(0);
        assertEquals(3, response.getTotalStock());
        assertEquals(2, response.getRemainStock());
        assertEquals(1, response.getSoldStock());
    }

    @Test
    void listSessionsFallsBackToTicketStockWhenPaidOrderHasNoSeatState() {
        allowSessionManager(2002L, "admin");
        Session session = new Session();
        session.setId(501L);
        session.setActivityId(10L);
        session.setVenueId(101L);
        session.setStartTime(LocalDateTime.of(2026, 6, 1, 20, 0));
        session.setEndTime(LocalDateTime.of(2026, 6, 1, 22, 0));
        session.setStatus(1);
        Page<Session> page = new Page<>(1, 10, 1);
        page.setRecords(List.of(session));
        TicketType ticketType = ticketType(801L, 501L, "普通票", 380, 10, 8);
        when(sessionMapper.selectPage(any(), any())).thenReturn(page);
        when(activityMapper.selectBatchIds(any())).thenReturn(List.of(activity(10L, 2003L)));
        when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue(101L)));
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(
                sessionSeat(1L, 501L, null, 1),
                sessionSeat(2L, 501L, null, 1),
                sessionSeat(3L, 501L, null, 1)
        ));

        Page<com.omni.ticket.dto.SessionAdminResponse> result = service.listSessions(2002L, 1, 10, null, null, null);

        com.omni.ticket.dto.SessionAdminResponse response = result.getRecords().get(0);
        assertEquals(10, response.getTotalStock());
        assertEquals(8, response.getRemainStock());
        assertEquals(2, response.getSoldStock());
    }

    @Test
    void organizerAdminWithSessionPermissionCanListSessionsWithoutOrganizerOwnerFilter() {
        allowSessionManager(2100L, "organizer_admin");
        Session session = new Session();
        session.setId(501L);
        session.setActivityId(10L);
        session.setVenueId(101L);
        session.setStartTime(LocalDateTime.of(2026, 6, 1, 20, 0));
        session.setEndTime(LocalDateTime.of(2026, 6, 1, 22, 0));
        session.setStatus(1);
        Page<Session> page = new Page<>(1, 10, 1);
        page.setRecords(List.of(session));
        when(sessionMapper.selectPage(any(), any())).thenReturn(page);
        when(activityMapper.selectBatchIds(any())).thenReturn(List.of(activity(10L, 2003L)));
        when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue(101L)));
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of());

        Page<com.omni.ticket.dto.SessionAdminResponse> result = service.listSessions(2100L, 1, 10, null, null, null);

        assertEquals(1, result.getRecords().size());
        verify(activityMapper, never()).selectList(any());
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

    private TicketType ticketType(Long id, Long sessionId, String name, int price, int totalStock, int remainStock) {
        TicketType ticketType = new TicketType();
        ticketType.setId(id);
        ticketType.setSessionId(sessionId);
        ticketType.setName(name);
        ticketType.setPrice(BigDecimal.valueOf(price));
        ticketType.setTotalStock(totalStock);
        ticketType.setRemainStock(remainStock);
        ticketType.setStatus(1);
        return ticketType;
    }

    private SessionSeat sessionSeat(Long id, Long sessionId, Long ticketTypeId, int status) {
        SessionSeat seat = new SessionSeat();
        seat.setId(id);
        seat.setSessionId(sessionId);
        seat.setTicketTypeId(ticketTypeId);
        seat.setStatus(status);
        return seat;
    }

    private void allowSessionManager(Long userId, String role) {
        InternalUserRefResponse user = user(userId, role);
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(userId, "session.manage")).thenReturn(user);
        when(userAccessService.isOrganizer(user)).thenReturn("organizer".equals(role));
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(id);
        user.setRole(role);
        user.setStatus(1);
        return user;
    }
}
