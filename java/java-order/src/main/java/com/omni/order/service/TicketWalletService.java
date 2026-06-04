package com.omni.order.service;

import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.order.dto.TicketCheckInResponse;
import com.omni.order.dto.TicketEntryCodeResponse;
import com.omni.order.dto.TicketTransferClaimResponse;
import com.omni.order.dto.TicketTransferCreateResponse;
import com.omni.order.dto.TicketTransferRevokeResponse;
import com.omni.order.dto.TicketWalletItemResponse;
import com.omni.order.entity.ElectronicTicket;
import com.omni.order.entity.Order;
import com.omni.order.entity.OrderAttendee;
import com.omni.order.entity.OrderSnapshot;
import com.omni.order.entity.OrderSeat;
import com.omni.order.entity.TicketTransfer;
import com.omni.order.mapper.ElectronicTicketMapper;
import com.omni.order.mapper.OrderAttendeeMapper;
import com.omni.order.mapper.OrderSeatMapper;
import com.omni.order.mapper.OrderSnapshotMapper;
import com.omni.order.mapper.TicketTransferMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
public class TicketWalletService {
    public static final int STATUS_UNUSED = 1;
    public static final int STATUS_CHECKED_IN = 2;
    public static final int STATUS_INVALID = 3;
    public static final int STATUS_TRANSFERRED = 4;
    public static final int TRANSFER_PENDING = 1;
    public static final int TRANSFER_CLAIMED = 2;
    public static final int TRANSFER_REVOKED = 3;
    public static final int TRANSFER_EXPIRED = 4;

    private static final String CODE_VERSION = "v1";
    private static final int ENTRY_CODE_TTL_SECONDS = 60;
    private static final int TRANSFER_TTL_HOURS = 24;

    private final ElectronicTicketMapper electronicTicketMapper;
    private final OrderAttendeeMapper orderAttendeeMapper;
    private final OrderSeatMapper orderSeatMapper;
    private final TicketTransferMapper ticketTransferMapper;
    private final OrderSnapshotMapper orderSnapshotMapper;
    private final String entryCodeSecret;

    public TicketWalletService(ElectronicTicketMapper electronicTicketMapper,
                               OrderAttendeeMapper orderAttendeeMapper,
                               OrderSeatMapper orderSeatMapper,
                               TicketTransferMapper ticketTransferMapper,
                               OrderSnapshotMapper orderSnapshotMapper,
                               @Value("${omni.ticket.entry-code-secret:${OMNI_TICKET_ENTRY_CODE_SECRET:omni-ticket-entry-code-secret}}") String entryCodeSecret) {
        this.electronicTicketMapper = electronicTicketMapper;
        this.orderAttendeeMapper = orderAttendeeMapper;
        this.orderSeatMapper = orderSeatMapper;
        this.ticketTransferMapper = ticketTransferMapper;
        this.orderSnapshotMapper = orderSnapshotMapper;
        this.entryCodeSecret = entryCodeSecret;
    }

    @Transactional(rollbackFor = Exception.class)
    public void issueForPaidOrder(Order order) {
        if (order == null || order.getId() == null || order.getUserId() == null
                || !Integer.valueOf(OrderService.STATUS_PAID).equals(order.getStatus())) {
            return;
        }
        Long existing = electronicTicketMapper.countByOrderId(order.getId());
        if (existing != null && existing > 0) {
            return;
        }

        List<OrderAttendee> attendees = orderAttendeeMapper != null
                ? orderAttendeeMapper.selectByOrderIds(List.of(order.getId()))
                : Collections.emptyList();
        List<OrderSeat> seats = orderSeatMapper != null
                ? orderSeatMapper.selectLockedAndSoldSeatsByOrderId(order.getId())
                : Collections.emptyList();
        int quantity = resolveTicketQuantity(order, attendees, seats);
        LocalDateTime now = LocalDateTime.now();
        for (int i = 0; i < quantity; i++) {
            OrderAttendee attendee = attendees != null && i < attendees.size() ? attendees.get(i) : null;
            OrderSeat seat = seats != null && i < seats.size() ? seats.get(i) : null;
            ElectronicTicket ticket = new ElectronicTicket();
            ticket.setTicketNo(buildTicketNo(order.getId(), i + 1));
            ticket.setOrderId(order.getId());
            ticket.setOrderSeatId(seat != null ? seat.getId() : null);
            ticket.setUserId(order.getUserId());
            ticket.setOriginalUserId(order.getUserId());
            ticket.setSessionId(order.getSessionId());
            ticket.setTicketTypeId(order.getTicketTypeId());
            ticket.setAttendeeUserProfileId(attendee != null ? attendee.getAttendeeUserProfileId() : null);
            ticket.setRealName(attendee != null ? attendee.getRealName() : null);
            ticket.setIdType(attendee != null ? attendee.getIdType() : null);
            ticket.setIdNoMask(attendee != null ? attendee.getIdNoMask() : null);
            ticket.setPhone(attendee != null ? attendee.getPhone() : null);
            ticket.setSeatLabel(seat != null ? seat.getSeatLabel() : null);
            ticket.setStatus(STATUS_UNUSED);
            ticket.setCreateTime(now);
            ticket.setUpdateTime(now);
            electronicTicketMapper.insertIgnoreTicketNo(ticket);
        }
    }

    public List<TicketWalletItemResponse> listMyTickets(Long userId) {
        if (userId == null) {
            return Collections.emptyList();
        }
        List<TicketWalletItemResponse> tickets = electronicTicketMapper.selectWalletItemsByUserId(userId);
        if (tickets == null) {
            return Collections.emptyList();
        }
        for (TicketWalletItemResponse ticket : tickets) {
            ticket.setStatusText(statusText(ticket.getStatus()));
        }
        return tickets;
    }

    public int invalidateUnusedTicketsForOrder(Long orderId, String reason) {
        if (orderId == null) {
            return 0;
        }
        return electronicTicketMapper.invalidateUnusedByOrderId(orderId, reason);
    }

    public int invalidateUnusedTicketsByOrderSeats(Long orderId, List<Long> orderSeatIds, String reason) {
        if (orderId == null || orderSeatIds == null || orderSeatIds.isEmpty()) {
            return 0;
        }
        return electronicTicketMapper.invalidateUnusedByOrderSeatIds(orderId, orderSeatIds, reason);
    }

    public int invalidateUnusedTicketsByQuantity(Long orderId, int quantity, String reason) {
        if (orderId == null || quantity <= 0) {
            return 0;
        }
        return electronicTicketMapper.invalidateFirstUnusedByOrderId(orderId, quantity, reason);
    }

    public TicketEntryCodeResponse createEntryCode(Long userId, Long ticketId) {
        if (userId == null || ticketId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "电子票信息无效");
        }
        ElectronicTicket ticket = electronicTicketMapper.selectById(ticketId);
        if (ticket == null || !userId.equals(ticket.getUserId())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "电子票不存在");
        }
        if (!Integer.valueOf(STATUS_UNUSED).equals(ticket.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "电子票状态不允许生成入场码");
        }
        long expiresAt = Instant.now().plusSeconds(ENTRY_CODE_TTL_SECONDS).getEpochSecond();
        String payload = CODE_VERSION + ":" + ticketId + ":" + userId + ":" + expiresAt;
        TicketEntryCodeResponse response = new TicketEntryCodeResponse();
        response.setTicketId(ticketId);
        response.setExpiresAt(LocalDateTime.ofInstant(Instant.ofEpochSecond(expiresAt), ZoneId.systemDefault()));
        response.setEntryCode(payload + ":" + sign(payload));
        return response;
    }

    @Transactional(rollbackFor = Exception.class)
    public TicketTransferCreateResponse createTransfer(Long userId, Long ticketId) {
        ElectronicTicket ticket = requireOwnedUnusedTicket(userId, ticketId);
        requireTransferAllowed(ticket);

        LocalDateTime now = LocalDateTime.now();
        TicketTransfer pending = ticketTransferMapper.selectPendingByTicketIdForUpdate(ticketId);
        if (pending != null) {
            if (pending.getExpiresAt() != null && pending.getExpiresAt().isBefore(now)) {
                ticketTransferMapper.updateStatusIfCurrent(pending.getId(), TRANSFER_PENDING, TRANSFER_EXPIRED);
            } else {
                return toCreateTransferResponse(pending);
            }
        }

        TicketTransfer transfer = new TicketTransfer();
        transfer.setTransferCode(UUID.randomUUID().toString().replace("-", ""));
        transfer.setTicketId(ticket.getId());
        transfer.setFromUserId(userId);
        transfer.setStatus(TRANSFER_PENDING);
        transfer.setExpiresAt(now.plusHours(TRANSFER_TTL_HOURS));
        transfer.setCreateTime(now);
        transfer.setUpdateTime(now);
        ticketTransferMapper.insert(transfer);
        return toCreateTransferResponse(transfer);
    }

    @Transactional(rollbackFor = Exception.class)
    public TicketTransferClaimResponse claimTransfer(Long toUserId, String transferCode) {
        if (toUserId == null || !StringUtils.hasText(transferCode)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "转赠信息无效");
        }
        TicketTransfer transfer = ticketTransferMapper.selectByTransferCodeForUpdate(transferCode);
        if (transfer == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "转赠不存在");
        }
        if (!Integer.valueOf(TRANSFER_PENDING).equals(transfer.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "转赠状态不允许领取");
        }
        LocalDateTime now = LocalDateTime.now();
        if (transfer.getExpiresAt() != null && transfer.getExpiresAt().isBefore(now)) {
            ticketTransferMapper.updateStatusIfCurrent(transfer.getId(), TRANSFER_PENDING, TRANSFER_EXPIRED);
            throw new BusinessException(ResultCode.BAD_REQUEST, "转赠已过期");
        }
        if (toUserId.equals(transfer.getFromUserId())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "不能领取自己发起的转赠");
        }

        ElectronicTicket original = electronicTicketMapper.selectByIdForUpdate(transfer.getTicketId());
        if (original == null || !transfer.getFromUserId().equals(original.getUserId())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "电子票不存在");
        }
        if (!Integer.valueOf(STATUS_UNUSED).equals(original.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "电子票状态不允许转赠");
        }

        ElectronicTicket recipientTicket = copyForRecipient(original, transfer, toUserId, now);
        electronicTicketMapper.insert(recipientTicket);
        int updatedOriginal = electronicTicketMapper.updateStatusOnlyIfCurrent(original.getId(), STATUS_UNUSED, STATUS_TRANSFERRED);
        if (updatedOriginal != 1) {
            throw new BusinessException(ResultCode.CONFLICT, "电子票状态已变化");
        }
        int updatedTransfer = ticketTransferMapper.updateClaimed(transfer.getId(), toUserId, recipientTicket.getId());
        if (updatedTransfer != 1) {
            throw new BusinessException(ResultCode.CONFLICT, "转赠状态已变化");
        }

        TicketTransferClaimResponse response = new TicketTransferClaimResponse();
        response.setTransferId(transfer.getId());
        response.setOriginalTicketId(original.getId());
        response.setTicketId(recipientTicket.getId());
        response.setStatus(TRANSFER_CLAIMED);
        response.setStatusText(transferStatusText(TRANSFER_CLAIMED));
        return response;
    }

    @Transactional(rollbackFor = Exception.class)
    public TicketTransferRevokeResponse revokeTransfer(Long userId, Long ticketId) {
        if (userId == null || ticketId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "转赠信息无效");
        }
        TicketTransfer transfer = ticketTransferMapper.selectPendingByTicketIdForUpdate(ticketId);
        if (transfer == null || !userId.equals(transfer.getFromUserId())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "未找到可撤回的转赠");
        }
        int updated = ticketTransferMapper.updateStatusIfCurrent(transfer.getId(), TRANSFER_PENDING, TRANSFER_REVOKED);
        if (updated != 1) {
            throw new BusinessException(ResultCode.CONFLICT, "转赠状态已变化");
        }
        TicketTransferRevokeResponse response = new TicketTransferRevokeResponse();
        response.setTransferId(transfer.getId());
        response.setTicketId(ticketId);
        response.setStatus(TRANSFER_REVOKED);
        response.setStatusText(transferStatusText(TRANSFER_REVOKED));
        return response;
    }

    @Transactional(rollbackFor = Exception.class)
    public TicketCheckInResponse checkIn(String entryCode) {
        CodePayload payload = parseAndVerify(entryCode);
        ElectronicTicket ticket = electronicTicketMapper.selectByIdForUpdate(payload.ticketId);
        if (ticket == null || !payload.userId.equals(ticket.getUserId())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "电子票不存在");
        }
        if (!Integer.valueOf(STATUS_UNUSED).equals(ticket.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "电子票状态不允许核销");
        }
        int updated = electronicTicketMapper.updateStatusIfCurrent(ticket.getId(), STATUS_UNUSED, STATUS_CHECKED_IN);
        if (updated != 1) {
            throw new BusinessException(ResultCode.CONFLICT, "电子票状态已变化");
        }
        TicketCheckInResponse response = new TicketCheckInResponse();
        response.setTicketId(ticket.getId());
        response.setTicketNo(ticket.getTicketNo());
        response.setOrderId(ticket.getOrderId());
        response.setUserId(ticket.getUserId());
        response.setStatus(STATUS_CHECKED_IN);
        response.setCheckedInAt(LocalDateTime.now());
        return response;
    }

    private ElectronicTicket requireOwnedUnusedTicket(Long userId, Long ticketId) {
        if (userId == null || ticketId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "电子票信息无效");
        }
        ElectronicTicket ticket = electronicTicketMapper.selectByIdForUpdate(ticketId);
        if (ticket == null || !userId.equals(ticket.getUserId())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "电子票不存在");
        }
        if (!Integer.valueOf(STATUS_UNUSED).equals(ticket.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "电子票状态不允许转赠");
        }
        return ticket;
    }

    private void requireTransferAllowed(ElectronicTicket ticket) {
        OrderSnapshot snapshot = orderSnapshotMapper != null ? orderSnapshotMapper.selectByOrderId(ticket.getOrderId()) : null;
        if (snapshot != null && Boolean.FALSE.equals(snapshot.getTicketTransferAllowed())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "该活动不允许转赠");
        }
    }

    private TicketTransferCreateResponse toCreateTransferResponse(TicketTransfer transfer) {
        TicketTransferCreateResponse response = new TicketTransferCreateResponse();
        response.setTransferId(transfer.getId());
        response.setTicketId(transfer.getTicketId());
        response.setTransferCode(transfer.getTransferCode());
        response.setStatus(transfer.getStatus());
        response.setStatusText(transferStatusText(transfer.getStatus()));
        response.setExpiresAt(transfer.getExpiresAt());
        return response;
    }

    private ElectronicTicket copyForRecipient(ElectronicTicket original,
                                              TicketTransfer transfer,
                                              Long toUserId,
                                              LocalDateTime now) {
        ElectronicTicket ticket = new ElectronicTicket();
        ticket.setTicketNo(buildTransferredTicketNo(original.getTicketNo(), transfer.getId()));
        ticket.setOrderId(original.getOrderId());
        ticket.setOrderSeatId(original.getOrderSeatId());
        ticket.setUserId(toUserId);
        ticket.setOriginalUserId(original.getOriginalUserId());
        ticket.setSessionId(original.getSessionId());
        ticket.setTicketTypeId(original.getTicketTypeId());
        ticket.setAttendeeUserProfileId(original.getAttendeeUserProfileId());
        ticket.setRealName(original.getRealName());
        ticket.setIdType(original.getIdType());
        ticket.setIdNoMask(original.getIdNoMask());
        ticket.setPhone(original.getPhone());
        ticket.setSeatLabel(original.getSeatLabel());
        ticket.setStatus(STATUS_UNUSED);
        ticket.setCreateTime(now);
        ticket.setUpdateTime(now);
        return ticket;
    }

    private int resolveTicketQuantity(Order order, List<OrderAttendee> attendees, List<OrderSeat> seats) {
        if (attendees != null && !attendees.isEmpty()) {
            return attendees.size();
        }
        if (seats != null && !seats.isEmpty()) {
            return seats.size();
        }
        return order.getQuantity() != null && order.getQuantity() > 0 ? order.getQuantity() : 1;
    }

    private String buildTicketNo(Long orderId, int index) {
        return "ET" + orderId + String.format("%03d", index);
    }

    private String buildTransferredTicketNo(String ticketNo, Long transferId) {
        String source = StringUtils.hasText(ticketNo) ? ticketNo : "ET";
        String suffix = transferId != null ? String.valueOf(transferId) : UUID.randomUUID().toString().substring(0, 8);
        String candidate = source + "T" + suffix;
        return candidate.length() <= 64 ? candidate : candidate.substring(0, 64);
    }

    private String statusText(Integer status) {
        if (Integer.valueOf(STATUS_CHECKED_IN).equals(status)) {
            return "已验票";
        }
        if (Integer.valueOf(STATUS_INVALID).equals(status)) {
            return "已失效";
        }
        if (Integer.valueOf(STATUS_TRANSFERRED).equals(status)) {
            return "已转赠";
        }
        return "未入场";
    }

    private String transferStatusText(Integer status) {
        if (Integer.valueOf(TRANSFER_CLAIMED).equals(status)) {
            return "已领取";
        }
        if (Integer.valueOf(TRANSFER_REVOKED).equals(status)) {
            return "已撤回";
        }
        if (Integer.valueOf(TRANSFER_EXPIRED).equals(status)) {
            return "已过期";
        }
        return "待领取";
    }

    private CodePayload parseAndVerify(String entryCode) {
        if (!StringUtils.hasText(entryCode)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入场码无效");
        }
        String[] parts = entryCode.split(":");
        if (parts.length != 5 || !CODE_VERSION.equals(parts[0])) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入场码无效");
        }
        String payload = parts[0] + ":" + parts[1] + ":" + parts[2] + ":" + parts[3];
        if (!sign(payload).equals(parts[4])) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入场码无效");
        }
        long expiresAt;
        try {
            expiresAt = Long.parseLong(parts[3]);
        } catch (NumberFormatException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入场码无效");
        }
        if (Instant.now().getEpochSecond() > expiresAt) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入场码已过期");
        }
        return new CodePayload(parseLong(parts[1]), parseLong(parts[2]));
    }

    private Long parseLong(String value) {
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入场码无效");
        }
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(entryCodeSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "入场码生成失败");
        }
    }

    private static class CodePayload {
        private final Long ticketId;
        private final Long userId;

        private CodePayload(Long ticketId, Long userId) {
            this.ticketId = ticketId;
            this.userId = userId;
        }
    }
}
