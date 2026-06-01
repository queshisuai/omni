package com.omni.order.service;

import com.omni.exception.BusinessException;
import com.omni.order.dto.TicketCheckInResponse;
import com.omni.order.dto.TicketTransferClaimResponse;
import com.omni.order.dto.TicketTransferCreateResponse;
import com.omni.order.entity.ElectronicTicket;
import com.omni.order.entity.Order;
import com.omni.order.entity.OrderAttendee;
import com.omni.order.entity.OrderSeat;
import com.omni.order.entity.OrderSnapshot;
import com.omni.order.entity.TicketTransfer;
import com.omni.order.mapper.ElectronicTicketMapper;
import com.omni.order.mapper.OrderAttendeeMapper;
import com.omni.order.mapper.OrderSeatMapper;
import com.omni.order.mapper.OrderSnapshotMapper;
import com.omni.order.mapper.TicketTransferMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketWalletServiceTest {

    @Mock
    private ElectronicTicketMapper electronicTicketMapper;

    @Mock
    private OrderAttendeeMapper orderAttendeeMapper;

    @Mock
    private OrderSeatMapper orderSeatMapper;

    @Mock
    private TicketTransferMapper ticketTransferMapper;

    @Mock
    private OrderSnapshotMapper orderSnapshotMapper;

    private TicketWalletService service;

    @BeforeEach
    void setUp() {
        service = new TicketWalletService(electronicTicketMapper, orderAttendeeMapper, orderSeatMapper,
                ticketTransferMapper, orderSnapshotMapper,
                "ticket-wallet-test-secret");
    }

    @Test
    void issueForPaidOrderCreatesOneElectronicTicketPerAttendee() {
        Order order = paidOrder(9001L, 2004L, 101L, 1L, 2);
        OrderAttendee alice = attendee(11L, 7001L, "Alice", "110***********011");
        OrderAttendee bob = attendee(12L, 7002L, "Bob", "110***********022");
        OrderSeat seatA = seat(21L, "A-1");
        OrderSeat seatB = seat(22L, "A-2");
        when(electronicTicketMapper.countByOrderId(9001L)).thenReturn(0L);
        when(orderAttendeeMapper.selectByOrderIds(List.of(9001L))).thenReturn(List.of(alice, bob));
        when(orderSeatMapper.selectLockedAndSoldSeatsByOrderId(9001L)).thenReturn(List.of(seatA, seatB));

        service.issueForPaidOrder(order);

        ArgumentCaptor<ElectronicTicket> captor = ArgumentCaptor.forClass(ElectronicTicket.class);
        verify(electronicTicketMapper, org.mockito.Mockito.times(2)).insert(captor.capture());
        List<ElectronicTicket> tickets = captor.getAllValues();
        assertEquals(List.of("Alice", "Bob"), tickets.stream().map(ElectronicTicket::getRealName).collect(Collectors.toList()));
        assertEquals(List.of("A-1", "A-2"), tickets.stream().map(ElectronicTicket::getSeatLabel).collect(Collectors.toList()));
        assertEquals(1, tickets.get(0).getStatus());
        assertNotNull(tickets.get(0).getTicketNo());
    }

    @Test
    void issueForPaidOrderIsIdempotent() {
        Order order = paidOrder(9001L, 2004L, 101L, 1L, 1);
        when(electronicTicketMapper.countByOrderId(9001L)).thenReturn(1L);

        service.issueForPaidOrder(order);

        verify(electronicTicketMapper, never()).insert(any(ElectronicTicket.class));
    }

    @Test
    void checkInMarksUnusedTicketCheckedIn() {
        ElectronicTicket ticket = ticket(3001L, 2004L, 9001L, 1);
        when(electronicTicketMapper.selectById(3001L)).thenReturn(ticket);
        when(electronicTicketMapper.selectByIdForUpdate(3001L)).thenReturn(ticket);
        when(electronicTicketMapper.updateStatusIfCurrent(3001L, 1, 2)).thenReturn(1);
        String code = service.createEntryCode(2004L, 3001L).getEntryCode();

        TicketCheckInResponse response = service.checkIn(code);

        assertEquals(3001L, response.getTicketId());
        assertEquals(2, response.getStatus());
        verify(electronicTicketMapper).updateStatusIfCurrent(3001L, 1, 2);
    }

    @Test
    void checkInRejectsAlreadyCheckedTicket() {
        ElectronicTicket codeTicket = ticket(3001L, 2004L, 9001L, 1);
        ElectronicTicket checkedTicket = ticket(3001L, 2004L, 9001L, 2);
        when(electronicTicketMapper.selectById(3001L)).thenReturn(codeTicket);
        when(electronicTicketMapper.selectByIdForUpdate(3001L)).thenReturn(checkedTicket);
        String code = service.createEntryCode(2004L, 3001L).getEntryCode();

        BusinessException error = assertThrows(BusinessException.class, () -> service.checkIn(code));

        assertEquals("电子票状态不允许核销", error.getMessage());
        verify(electronicTicketMapper, never()).updateStatusIfCurrent(any(), any(), any());
    }

    @Test
    void createTransferReturnsCodeWhenTicketBelongsToUserAndRuleAllows() {
        ElectronicTicket ticket = ticket(3001L, 2004L, 9001L, 1);
        OrderSnapshot snapshot = new OrderSnapshot();
        snapshot.setOrderId(9001L);
        snapshot.setTicketTransferAllowed(true);
        when(electronicTicketMapper.selectByIdForUpdate(3001L)).thenReturn(ticket);
        when(orderSnapshotMapper.selectByOrderId(9001L)).thenReturn(snapshot);

        TicketTransferCreateResponse response = service.createTransfer(2004L, 3001L);

        assertEquals(3001L, response.getTicketId());
        assertNotNull(response.getTransferCode());
        ArgumentCaptor<TicketTransfer> captor = ArgumentCaptor.forClass(TicketTransfer.class);
        verify(ticketTransferMapper).insert(captor.capture());
        assertEquals(2004L, captor.getValue().getFromUserId());
        assertEquals(1, captor.getValue().getStatus());
    }

    @Test
    void claimTransferCreatesRecipientTicketAndMarksOriginalTransferred() {
        ElectronicTicket original = ticket(3001L, 2004L, 9001L, 1);
        TicketTransfer transfer = transfer(8001L, 3001L, 2004L, "gift-code", 1,
                LocalDateTime.now().plusHours(1));
        when(ticketTransferMapper.selectByTransferCodeForUpdate("gift-code")).thenReturn(transfer);
        when(electronicTicketMapper.selectByIdForUpdate(3001L)).thenReturn(original);
        when(electronicTicketMapper.updateStatusOnlyIfCurrent(3001L, 1, 4)).thenReturn(1);
        when(electronicTicketMapper.insert(any(ElectronicTicket.class))).thenAnswer(invocation -> {
            ElectronicTicket inserted = invocation.getArgument(0);
            inserted.setId(3009L);
            return 1;
        });
        when(ticketTransferMapper.updateClaimed(8001L, 3008L, 3009L)).thenReturn(1);

        TicketTransferClaimResponse response = service.claimTransfer(3008L, "gift-code");

        assertEquals(3001L, response.getOriginalTicketId());
        assertEquals(3009L, response.getTicketId());
        ArgumentCaptor<ElectronicTicket> captor = ArgumentCaptor.forClass(ElectronicTicket.class);
        verify(electronicTicketMapper).insert(captor.capture());
        verify(electronicTicketMapper).updateStatusOnlyIfCurrent(3001L, 1, 4);
        ElectronicTicket recipientTicket = captor.getValue();
        assertEquals(3008L, recipientTicket.getUserId());
        assertEquals(2004L, recipientTicket.getOriginalUserId());
        assertEquals(1, recipientTicket.getStatus());
        assertEquals("Alice", recipientTicket.getRealName());
    }

    @Test
    void createTransferRejectsDisabledActivityRule() {
        ElectronicTicket ticket = ticket(3001L, 2004L, 9001L, 1);
        OrderSnapshot snapshot = new OrderSnapshot();
        snapshot.setOrderId(9001L);
        snapshot.setTicketTransferAllowed(false);
        when(electronicTicketMapper.selectByIdForUpdate(3001L)).thenReturn(ticket);
        when(orderSnapshotMapper.selectByOrderId(9001L)).thenReturn(snapshot);

        BusinessException error = assertThrows(BusinessException.class, () -> service.createTransfer(2004L, 3001L));

        assertEquals("该活动不允许转赠", error.getMessage());
        verify(ticketTransferMapper, never()).insert(any());
    }

    @Test
    void createEntryCodeRejectsTicketOwnedByAnotherUser() {
        ElectronicTicket ticket = ticket(3001L, 2004L, 9001L, 1);
        when(electronicTicketMapper.selectById(3001L)).thenReturn(ticket);

        BusinessException error = assertThrows(BusinessException.class, () -> service.createEntryCode(3008L, 3001L));

        assertEquals("电子票不存在", error.getMessage());
    }

    private Order paidOrder(Long id, Long userId, Long sessionId, Long ticketTypeId, int quantity) {
        Order order = new Order();
        order.setId(id);
        order.setOrderNo("DM" + id);
        order.setUserId(userId);
        order.setSessionId(sessionId);
        order.setTicketTypeId(ticketTypeId);
        order.setQuantity(quantity);
        order.setAmount(new BigDecimal("200.00"));
        order.setStatus(OrderService.STATUS_PAID);
        return order;
    }

    private OrderAttendee attendee(Long id, Long profileId, String name, String mask) {
        OrderAttendee attendee = new OrderAttendee();
        attendee.setId(id);
        attendee.setAttendeeUserProfileId(profileId);
        attendee.setRealName(name);
        attendee.setIdType("ID_CARD");
        attendee.setIdNoMask(mask);
        attendee.setPhone("13900000001");
        return attendee;
    }

    private OrderSeat seat(Long id, String label) {
        OrderSeat seat = new OrderSeat();
        seat.setId(id);
        seat.setSeatLabel(label);
        return seat;
    }

    private ElectronicTicket ticket(Long id, Long userId, Long orderId, int status) {
        ElectronicTicket ticket = new ElectronicTicket();
        ticket.setId(id);
        ticket.setTicketNo("ET" + id);
        ticket.setUserId(userId);
        ticket.setOriginalUserId(userId);
        ticket.setOrderId(orderId);
        ticket.setSessionId(101L);
        ticket.setTicketTypeId(1L);
        ticket.setAttendeeUserProfileId(7001L);
        ticket.setRealName("Alice");
        ticket.setIdType("ID_CARD");
        ticket.setIdNoMask("110***********011");
        ticket.setPhone("13900000001");
        ticket.setSeatLabel("A-1");
        ticket.setStatus(status);
        ticket.setCreateTime(LocalDateTime.now());
        ticket.setUpdateTime(LocalDateTime.now());
        return ticket;
    }

    private TicketTransfer transfer(Long id, Long ticketId, Long fromUserId, String code, int status, LocalDateTime expiresAt) {
        TicketTransfer transfer = new TicketTransfer();
        transfer.setId(id);
        transfer.setTicketId(ticketId);
        transfer.setFromUserId(fromUserId);
        transfer.setTransferCode(code);
        transfer.setStatus(status);
        transfer.setExpiresAt(expiresAt);
        return transfer;
    }
}
