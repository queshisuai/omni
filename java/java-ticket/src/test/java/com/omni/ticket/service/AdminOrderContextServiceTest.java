package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.AdminRecentOrderContextResponse;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.dto.OrderInfoResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminOrderContextServiceTest {

    @Mock
    private OrderInternalClient orderInternalClient;
    @Mock
    private UserAccessService userAccessService;

    private AdminOrderContextService service;

    @BeforeEach
    void setUp() {
        service = new AdminOrderContextService(orderInternalClient, userAccessService, "internal-token");
    }

    @Test
    void mapsAtMostTwoRecentOrdersForPlatformAdmin() {
        InternalUserRefResponse admin = user("admin");
        when(userAccessService.requireUser(9001L)).thenReturn(admin);
        when(userAccessService.isAdmin(admin)).thenReturn(true);
        when(orderInternalClient.listInternalUserOrders(7001L, 2, "internal-token"))
                .thenReturn(Result.success(List.of(order(1L, 2, "演唱会A", "周六 19:30", "看台A", "1排1座", "ORD-1"),
                        order(2L, 4, "演唱会B", "周日 20:00", "内场", "2排3座", "ORD-2"),
                        order(3L, 1, "演唱会C", "周一 20:00", "普通票", null, "ORD-3"))));

        AdminRecentOrderContextResponse response = service.getRecentOrderContext(7001L, 9001L);

        assertEquals(7001L, response.getUserId());
        assertEquals(2, response.getOrders().size());
        AdminRecentOrderContextResponse.OrderSummary first = response.getOrders().get(0);
        assertEquals("ORD-1", first.getOrderNo());
        assertEquals("演唱会A", first.getActivityName());
        assertEquals(LocalDateTime.of(2026, 9, 13, 19, 30), first.getSessionTime());
        assertEquals("看台A", first.getTicketName());
        assertEquals("1排1座", first.getSeatLabels());
        assertEquals("已出票", first.getFulfillmentStatus());
        verify(orderInternalClient).listInternalUserOrders(7001L, 2, "internal-token");
    }

    @Test
    void rejectsOrdinaryUserBeforeCallingOrderService() {
        InternalUserRefResponse user = user("user");
        when(userAccessService.requireUser(9002L)).thenReturn(user);
        when(userAccessService.isAdmin(user)).thenReturn(false);
        when(userAccessService.hasAnyPermission(9002L, "support.conversation.view", "cs.manage", "cs.review"))
                .thenReturn(false);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.getRecentOrderContext(7001L, 9002L));

        assertEquals(403, exception.getCode());
        verify(orderInternalClient, never()).listInternalUserOrders(any(), any(), any());
    }

    @Test
    void returnsEmptyContextWhenOrderServiceFails() {
        InternalUserRefResponse agent = user("user");
        when(userAccessService.requireUser(9003L)).thenReturn(agent);
        when(userAccessService.isAdmin(agent)).thenReturn(false);
        when(userAccessService.hasAnyPermission(9003L, "support.conversation.view", "cs.manage", "cs.review"))
                .thenReturn(true);
        when(orderInternalClient.listInternalUserOrders(7001L, 2, "internal-token"))
                .thenThrow(new RuntimeException("order service unavailable"));

        AdminRecentOrderContextResponse response = service.getRecentOrderContext(7001L, 9003L);

        assertEquals(7001L, response.getUserId());
        assertEquals(List.of(), response.getOrders());
    }

    private InternalUserRefResponse user(String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setRole(role);
        return user;
    }

    private OrderInfoResponse order(Long id, Integer status, String activityName, String sessionName,
                                    String ticketName, String seatLabels, String orderNo) {
        OrderInfoResponse order = new OrderInfoResponse();
        order.setId(id);
        order.setUserId(7001L);
        order.setStatus(status);
        order.setActivityName(activityName);
        order.setSessionTime(LocalDateTime.of(2026, 9, 13, 19, 30));
        order.setTicketName(ticketName);
        order.setSeatLabels(seatLabels);
        order.setOrderNo(orderNo);
        return order;
    }
}
