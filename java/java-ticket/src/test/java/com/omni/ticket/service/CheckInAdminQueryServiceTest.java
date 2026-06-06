package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.CheckInOverviewRequest;
import com.omni.ticket.dto.CheckInOverviewResponse;
import com.omni.ticket.dto.CheckInRecordQueryRequest;
import com.omni.ticket.dto.CheckInRecordResponse;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CheckInAdminQueryServiceTest {
    @Mock
    private UserAccessService userAccessService;
    @Mock
    private ActivityMapper activityMapper;
    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private OrderInternalClient orderInternalClient;

    private CheckInAdminQueryService service;

    @BeforeEach
    void setUp() {
        service = new CheckInAdminQueryService(userAccessService, activityMapper, sessionMapper,
                orderInternalClient, "test-token");
    }

    @Test
    void organizerCanQueryOwnSessionOverview() {
        allowAccess(2003L, "organizer");
        when(sessionMapper.selectById(101L)).thenReturn(session(101L, 1001L));
        when(activityMapper.selectById(1001L)).thenReturn(activity(1001L, 2003L));
        CheckInOverviewResponse response = overview(101L);
        when(orderInternalClient.getCheckInOverview(any(CheckInOverviewRequest.class), eq("test-token")))
                .thenReturn(Result.success(response));

        CheckInOverviewResponse result = service.getOverview(2003L, 101L);

        assertEquals(response, result);
        ArgumentCaptor<CheckInOverviewRequest> captor = ArgumentCaptor.forClass(CheckInOverviewRequest.class);
        verify(orderInternalClient).getCheckInOverview(captor.capture(), eq("test-token"));
        assertEquals(101L, captor.getValue().getSessionId());
    }

    @Test
    void organizerCannotQueryOtherOrganizerSession() {
        allowAccess(2003L, "organizer");
        when(sessionMapper.selectById(101L)).thenReturn(session(101L, 1001L));
        when(activityMapper.selectById(1001L)).thenReturn(activity(1001L, 9999L));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.getOverview(2003L, 101L));

        assertEquals(ResultCode.FORBIDDEN.getCode(), exception.getCode());
        verify(orderInternalClient, never()).getCheckInOverview(any(), any());
    }

    @Test
    void platformOperatorWithCheckInPermissionCanQueryRecords() {
        allowAccess(3008L, "platform_operator");
        CheckInRecordResponse record = record("REQ-1");
        when(orderInternalClient.listCheckInRecords(any(CheckInRecordQueryRequest.class), eq("test-token")))
                .thenReturn(Result.success(List.of(record)));

        List<CheckInRecordResponse> result = service.listRecords(3008L, 101L, "SUCCESS", 1, 20);

        assertEquals(List.of(record), result);
        ArgumentCaptor<CheckInRecordQueryRequest> captor = ArgumentCaptor.forClass(CheckInRecordQueryRequest.class);
        verify(orderInternalClient).listCheckInRecords(captor.capture(), eq("test-token"));
        assertEquals(101L, captor.getValue().getSessionId());
        assertEquals("SUCCESS", captor.getValue().getResult());
    }

    @Test
    void userWithoutPermissionIsRejected() {
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2004L, "checkin.view", "order.view"))
                .thenThrow(new BusinessException(ResultCode.FORBIDDEN, "无权限"));

        assertThrows(BusinessException.class, () -> service.getOverview(2004L, 101L));

        verify(orderInternalClient, never()).getCheckInOverview(any(), any());
    }

    @Test
    void orderInternalFailureUsesStableChineseMessage() {
        allowAccess(3008L, "platform_operator");
        when(orderInternalClient.listCheckInRecords(any(CheckInRecordQueryRequest.class), eq("test-token")))
                .thenReturn(Result.fail(500, "order down"));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.listRecords(3008L, 101L, null, 1, 20));

        assertEquals(ResultCode.INTERNAL_ERROR.getCode(), exception.getCode());
        assertEquals("入场核验记录暂不可用", exception.getMessage());
    }

    private void allowAccess(Long userId, String role) {
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(userId, "checkin.view", "order.view"))
                .thenReturn(user(userId, role));
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(id);
        user.setRole(role);
        user.setStatus(1);
        return user;
    }

    private Session session(Long id, Long activityId) {
        Session session = new Session();
        session.setId(id);
        session.setActivityId(activityId);
        return session;
    }

    private Activity activity(Long id, Long organizerId) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setOrganizerId(organizerId);
        return activity;
    }

    private CheckInOverviewResponse overview(Long sessionId) {
        CheckInOverviewResponse response = new CheckInOverviewResponse();
        response.setSessionId(sessionId);
        response.setTotalTickets(100L);
        response.setCheckedInCount(60L);
        response.setUnusedCount(40L);
        response.setFailedCount(2L);
        response.setDuplicateCount(1L);
        return response;
    }

    private CheckInRecordResponse record(String requestId) {
        CheckInRecordResponse response = new CheckInRecordResponse();
        response.setRequestId(requestId);
        response.setTicketNo("ET3001");
        response.setResult("SUCCESS");
        return response;
    }
}
