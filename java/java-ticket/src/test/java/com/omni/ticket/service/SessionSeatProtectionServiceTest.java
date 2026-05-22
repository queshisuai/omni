package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.SessionSeatUsageItemResponse;
import com.omni.ticket.dto.SessionSeatUsageRequest;
import com.omni.ticket.dto.SessionSeatUsageResponse;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionSeatProtectionServiceTest {
    @Mock
    private SessionSeatMapper sessionSeatMapper;
    @Mock
    private OrderInternalClient orderInternalClient;

    private SessionSeatProtectionService service;

    @BeforeEach
    void setUp() {
        service = new SessionSeatProtectionService(sessionSeatMapper, orderInternalClient, "test-token");
    }

    @Test
    void findProtectedSeatIdsCombinesLocalProtectedSeatsAndOrderUsage() {
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(
                seat(11L, 1, null),
                seat(12L, 2, null),
                seat(13L, 3, null),
                seat(14L, 1, 9001L),
                seat(15L, 1, null)
        ));
        when(orderInternalClient.inspectSessionSeatUsage(any(SessionSeatUsageRequest.class), eq("test-token")))
                .thenReturn(Result.success(new SessionSeatUsageResponse(List.of(
                        new SessionSeatUsageItemResponse(11L, true, false, 7001L, 2),
                        new SessionSeatUsageItemResponse(15L, false, false, null, null)
                ))));

        Set<Long> protectedSeatIds = service.findProtectedSeatIds(101L);

        assertEquals(Set.of(11L, 12L, 13L, 14L, 15L), protectedSeatIds);
        ArgumentCaptor<SessionSeatUsageRequest> requestCaptor = ArgumentCaptor.forClass(SessionSeatUsageRequest.class);
        verify(orderInternalClient).inspectSessionSeatUsage(requestCaptor.capture(), eq("test-token"));
        assertEquals(List.of(11L, 12L, 13L, 14L, 15L), requestCaptor.getValue().getSessionSeatIds());
    }

    @Test
    void findProtectedSeatIdsFailsClosedWhenOrderClientUnavailable() {
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(
                seat(21L, 1, null),
                seat(22L, 2, null),
                seat(23L, 1, 9002L)
        ));
        when(orderInternalClient.inspectSessionSeatUsage(any(SessionSeatUsageRequest.class), eq("test-token")))
                .thenThrow(new RuntimeException("order unavailable"));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.findProtectedSeatIds(102L));

        assertEquals(503, exception.getCode());
        assertEquals("无法确认订单座位占用状态，请稍后重试。", exception.getMessage());
    }

    @Test
    void findProtectedSeatIdsFailsClosedWhenInternalTokenMissing() {
        service = new SessionSeatProtectionService(sessionSeatMapper, orderInternalClient, "");
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(seat(31L, 1, null)));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.findProtectedSeatIds(103L));

        assertEquals(503, exception.getCode());
        assertEquals("无法确认订单座位占用状态，请稍后重试。", exception.getMessage());
    }

    @Test
    void findProtectedSeatIdsFailsClosedWhenOrderUsageResultFails() {
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(seat(41L, 1, null)));
        when(orderInternalClient.inspectSessionSeatUsage(any(SessionSeatUsageRequest.class), eq("test-token")))
                .thenReturn(Result.fail(403, "无权限"));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.findProtectedSeatIds(104L));

        assertEquals(503, exception.getCode());
        assertEquals("无法确认订单座位占用状态，请稍后重试。", exception.getMessage());
    }

    private SessionSeat seat(Long id, Integer status, Long orderId) {
        SessionSeat seat = new SessionSeat();
        seat.setId(id);
        seat.setSessionId(101L);
        seat.setStatus(status);
        seat.setOrderId(orderId);
        return seat;
    }
}
