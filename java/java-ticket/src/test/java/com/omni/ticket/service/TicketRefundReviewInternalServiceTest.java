package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.dto.TicketRefundReviewPermissionResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TicketRefundReviewInternalServiceTest {

    @Test
    void organizerMatchReturnsAllowedTrue() {
        SessionMapper sessionMapper = mock(SessionMapper.class);
        ActivityMapper activityMapper = mock(ActivityMapper.class);
        TicketRefundReviewInternalService service = new TicketRefundReviewInternalService(sessionMapper, activityMapper);

        Session session = new Session();
        session.setId(3001L);
        session.setActivityId(5001L);
        when(sessionMapper.selectById(3001L)).thenReturn(session);

        Activity activity = new Activity();
        activity.setId(5001L);
        activity.setOrganizerId(2003L);
        when(activityMapper.selectById(5001L)).thenReturn(activity);

        TicketRefundReviewPermissionResponse result = service.checkPermission(3001L, 2003L);

        assertTrue(result.getAllowed());
        assertEquals(3001L, result.getSessionId());
        assertEquals(5001L, result.getActivityId());
        assertEquals(2003L, result.getOrganizerId());
        assertNull(result.getReason());
    }

    @Test
    void organizerMismatchReturnsAllowedFalse() {
        SessionMapper sessionMapper = mock(SessionMapper.class);
        ActivityMapper activityMapper = mock(ActivityMapper.class);
        TicketRefundReviewInternalService service = new TicketRefundReviewInternalService(sessionMapper, activityMapper);

        Session session = new Session();
        session.setId(3001L);
        session.setActivityId(5001L);
        when(sessionMapper.selectById(3001L)).thenReturn(session);

        Activity activity = new Activity();
        activity.setId(5001L);
        activity.setOrganizerId(2003L);
        when(activityMapper.selectById(5001L)).thenReturn(activity);

        TicketRefundReviewPermissionResponse result = service.checkPermission(3001L, 9999L);

        assertFalse(result.getAllowed());
        assertEquals("审核人不是活动主办方", result.getReason());
    }

    @Test
    void sessionNotFoundReturnsAllowedFalse() {
        SessionMapper sessionMapper = mock(SessionMapper.class);
        ActivityMapper activityMapper = mock(ActivityMapper.class);
        TicketRefundReviewInternalService service = new TicketRefundReviewInternalService(sessionMapper, activityMapper);

        when(sessionMapper.selectById(9999L)).thenReturn(null);

        TicketRefundReviewPermissionResponse result = service.checkPermission(9999L, 2003L);

        assertFalse(result.getAllowed());
        assertEquals("场次不存在", result.getReason());
    }

    @Test
    void activityNotFoundReturnsAllowedFalse() {
        SessionMapper sessionMapper = mock(SessionMapper.class);
        ActivityMapper activityMapper = mock(ActivityMapper.class);
        TicketRefundReviewInternalService service = new TicketRefundReviewInternalService(sessionMapper, activityMapper);

        Session session = new Session();
        session.setId(3001L);
        session.setActivityId(9999L);
        when(sessionMapper.selectById(3001L)).thenReturn(session);

        when(activityMapper.selectById(9999L)).thenReturn(null);

        TicketRefundReviewPermissionResponse result = service.checkPermission(3001L, 2003L);

        assertFalse(result.getAllowed());
        assertEquals("活动不存在", result.getReason());
    }

    @Test
    void sessionActivityIdNullReturnsAllowedFalse() {
        SessionMapper sessionMapper = mock(SessionMapper.class);
        ActivityMapper activityMapper = mock(ActivityMapper.class);
        TicketRefundReviewInternalService service = new TicketRefundReviewInternalService(sessionMapper, activityMapper);

        Session session = new Session();
        session.setId(3001L);
        session.setActivityId(null);
        when(sessionMapper.selectById(3001L)).thenReturn(session);

        TicketRefundReviewPermissionResponse result = service.checkPermission(3001L, 2003L);

        assertFalse(result.getAllowed());
        assertEquals("场次未关联活动", result.getReason());
    }

    @Test
    void nullSessionIdThrowsException() {
        SessionMapper sessionMapper = mock(SessionMapper.class);
        ActivityMapper activityMapper = mock(ActivityMapper.class);
        TicketRefundReviewInternalService service = new TicketRefundReviewInternalService(sessionMapper, activityMapper);

        assertThrows(BusinessException.class, () -> service.checkPermission(null, 2003L));
    }

    @Test
    void nullReviewerIdThrowsException() {
        SessionMapper sessionMapper = mock(SessionMapper.class);
        ActivityMapper activityMapper = mock(ActivityMapper.class);
        TicketRefundReviewInternalService service = new TicketRefundReviewInternalService(sessionMapper, activityMapper);

        Session session = new Session();
        session.setId(3001L);
        session.setActivityId(5001L);
        when(sessionMapper.selectById(3001L)).thenReturn(session);

        Activity activity = new Activity();
        activity.setId(5001L);
        activity.setOrganizerId(2003L);
        when(activityMapper.selectById(5001L)).thenReturn(activity);

        assertThrows(BusinessException.class, () -> service.checkPermission(3001L, null));
    }
}
