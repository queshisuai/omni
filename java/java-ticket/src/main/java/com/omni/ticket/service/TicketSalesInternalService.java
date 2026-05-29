package com.omni.ticket.service;

import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.TicketSalesLockRequest;
import com.omni.ticket.dto.TicketSalesOrderRequest;
import com.omni.ticket.dto.TicketSalesQuoteRequest;
import com.omni.ticket.dto.TicketSalesQuoteResponse;
import com.omni.ticket.dto.TicketSalesSeatLockResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SeatBlockMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketGroupMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

@Service
public class TicketSalesInternalService {
    private final TicketTypeMapper ticketTypeMapper;
    private final SessionMapper sessionMapper;
    private final ActivityMapper activityMapper;
    private final VenueMapper venueMapper;
    private final SessionSeatMapper sessionSeatMapper;
    private final SeatBlockMapper seatBlockMapper;

    public TicketSalesInternalService(TicketTypeMapper ticketTypeMapper,
                                       SessionMapper sessionMapper,
                                       ActivityMapper activityMapper,
                                       VenueMapper venueMapper,
                                       SessionSeatMapper sessionSeatMapper) {
        this(ticketTypeMapper, sessionMapper, activityMapper, venueMapper, sessionSeatMapper, null, null);
    }

    @Autowired
    public TicketSalesInternalService(TicketTypeMapper ticketTypeMapper,
                                       SessionMapper sessionMapper,
                                       ActivityMapper activityMapper,
                                       VenueMapper venueMapper,
                                       SessionSeatMapper sessionSeatMapper,
                                       SeatBlockMapper seatBlockMapper,
                                       TicketGroupMapper ticketGroupMapper) {
        this.ticketTypeMapper = ticketTypeMapper;
        this.sessionMapper = sessionMapper;
        this.activityMapper = activityMapper;
        this.venueMapper = venueMapper;
        this.sessionSeatMapper = sessionSeatMapper;
        this.seatBlockMapper = seatBlockMapper;
    }

    public TicketSalesQuoteResponse quote(TicketSalesQuoteRequest request) {
        if (request == null || request.getTicketTypeId() == null || request.getSessionId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "票务报价参数不能为空");
        }
        int quantity = request.getSeatIds() != null && !request.getSeatIds().isEmpty()
                ? request.getSeatIds().size()
                : requirePositiveQuantity(request.getQuantity());
        TicketType ticketType = ticketTypeMapper.selectById(request.getTicketTypeId());
        if (ticketType == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "票档不存在");
        }
        if (!request.getSessionId().equals(ticketType.getSessionId())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "票档不属于当前场次");
        }
        if (!Integer.valueOf(1).equals(ticketType.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "票档不可售");
        }

        TicketSalesQuoteResponse response = new TicketSalesQuoteResponse();
        response.setSessionId(request.getSessionId());
        response.setTicketTypeId(request.getTicketTypeId());
        response.setUnitPrice(ticketType.getPrice());
        response.setTicketName(ticketType.getName());
        response.setQuantity(quantity);
        response.setSeatBased(request.getSeatIds() != null && !request.getSeatIds().isEmpty());
        fillSnapshotFields(response, request.getSessionId());
        if (request.getSeatIds() != null && !request.getSeatIds().isEmpty()) {
            response.setSeatLabels(String.join(", ", sessionSeatMapper.selectSeatLabelsByIds(request.getSeatIds())));
        }
        return response;
    }

    @Transactional(rollbackFor = Exception.class)
    public void lockStock(TicketSalesLockRequest request) {
        int quantity = requirePositiveQuantity(request.getQuantity());
        int updated = ticketTypeMapper.decreaseRemainStockIfEnough(request.getTicketTypeId(), quantity);
        if (updated != 1) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "票档库存不足");
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public TicketSalesSeatLockResponse lockSeats(TicketSalesLockRequest request) {
        List<Long> seatIds = request.getSeatIds();
        if ((seatIds == null || seatIds.isEmpty()) && Boolean.TRUE.equals(request.getAllocateRandom())) {
            int quantity = requirePositiveQuantity(request.getQuantity());
            seatIds = sessionSeatMapper.selectRandomAvailableSeatIds(request.getSessionId(), request.getTicketTypeId(), quantity);
            if (seatIds == null || seatIds.size() < quantity) {
                requireSeatlessStandingTicketType(request.getSessionId(), request.getTicketTypeId());
                int updated = ticketTypeMapper.decreaseRemainStockIfEnough(request.getTicketTypeId(), quantity);
                if (updated != 1) {
                    throw new BusinessException(ResultCode.BAD_REQUEST, "票档库存不足");
                }
                TicketSalesSeatLockResponse response = new TicketSalesSeatLockResponse();
                response.setLockedSeatIds(Collections.emptyList());
                response.setSeatLabels(List.of("系统分配站区票 x" + quantity));
                return response;
            }
        }
        if (seatIds == null || seatIds.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "座位不能为空");
        }
        for (Long seatId : seatIds) {
            int updated = sessionSeatMapper.lockSeat(seatId, request.getSessionId(), request.getTicketTypeId(), request.getLockExpireTime());
            if (updated != 1) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "座位已锁定或不可售");
            }
        }
        TicketSalesSeatLockResponse response = new TicketSalesSeatLockResponse();
        response.setLockedSeatIds(seatIds);
        response.setSeatLabels(sessionSeatMapper.selectSeatLabelsByIds(seatIds));
        return response;
    }

    private void requireSeatlessStandingTicketType(Long sessionId, Long ticketTypeId) {
        if (seatBlockMapper == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "票档库存不足");
        }
        TicketType ticketType = ticketTypeMapper.selectById(ticketTypeId);
        if (ticketType == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "票档不存在");
        }
        if (ticketType.getSeatBlockId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "票档库存不足");
        }
        SeatBlock block = seatBlockMapper.selectById(ticketType.getSeatBlockId());
        if (block == null
                || !Objects.equals("session", block.getOwnerType())
                || !Objects.equals(sessionId, block.getOwnerId())
                || !Objects.equals("standingBlock", block.getBlockType())
                || !Integer.valueOf(1).equals(block.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "票档库存不足");
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void confirmSold(TicketSalesOrderRequest request) {
        if (request.getSeatIds() != null && !request.getSeatIds().isEmpty()) {
            for (Long seatId : request.getSeatIds()) {
                sessionSeatMapper.markSeatSold(seatId, request.getSessionId(), request.getOrderId());
            }
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void release(TicketSalesOrderRequest request) {
        if (request.getSeatIds() != null && !request.getSeatIds().isEmpty()) {
            for (Long seatId : request.getSeatIds()) {
                sessionSeatMapper.releaseLockedSeat(seatId, request.getSessionId());
            }
        } else {
            ticketTypeMapper.increaseRemainStock(request.getTicketTypeId(), requirePositiveQuantity(request.getQuantity()));
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void refund(TicketSalesOrderRequest request) {
        if (request.getSeatIds() != null && !request.getSeatIds().isEmpty()) {
            boolean canResell = canResellRefundedSeats(request.getSessionId(), request.getTicketTypeId());
            int restored = 0;
            for (Long seatId : request.getSeatIds()) {
                if (canResell) {
                    restored += sessionSeatMapper.restoreSoldSeat(seatId, request.getSessionId());
                } else {
                    sessionSeatMapper.markRefundedSeatUnavailable(seatId, request.getSessionId());
                }
            }
            if (restored > 0) {
                ticketTypeMapper.increaseRemainStock(request.getTicketTypeId(), restored);
            }
        } else {
            ticketTypeMapper.increaseRemainStock(request.getTicketTypeId(), requirePositiveQuantity(request.getQuantity()));
        }
    }

    private int requirePositiveQuantity(Integer quantity) {
        if (quantity == null || quantity <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "购买数量不正确");
        }
        return quantity;
    }

    private void fillSnapshotFields(TicketSalesQuoteResponse response, Long sessionId) {
        Session session = sessionMapper.selectById(sessionId);
        if (session == null) {
            return;
        }
        response.setSessionTime(session.getStartTime());
        response.setActivityId(session.getActivityId());
        Activity activity = activityMapper.selectById(session.getActivityId());
        if (activity != null) {
            response.setActivityName(activity.getName());
            response.setActivityPoster(activity.getPoster());
            response.setTourId(activity.getTourId());
            response.setStationId(activity.getStationId());
            response.setPerUserLimit(activity.getPerUserLimit());
        }
        Venue venue = venueMapper.selectById(session.getVenueId());
        if (venue != null) {
            response.setVenueName(venue.getName());
        }
    }

    private boolean canResellRefundedSeats(Long sessionId, Long ticketTypeId) {
        LocalDateTime startTime = sessionSeatMapper.selectSessionStartTime(sessionId);
        if (startTime == null || !startTime.isAfter(LocalDateTime.now().plusHours(24))) {
            return false;
        }
        return Boolean.TRUE.equals(sessionSeatMapper.selectSessionSellable(sessionId))
                && Boolean.TRUE.equals(ticketTypeMapper.selectTicketTypeSellable(ticketTypeId));
    }
}
