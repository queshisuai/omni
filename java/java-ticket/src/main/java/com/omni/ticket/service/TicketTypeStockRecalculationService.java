package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.mapper.SeatBlockMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketGroupMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.search.SearchIndexMqProducer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class TicketTypeStockRecalculationService {
    private final TicketTypeMapper ticketTypeMapper;
    private final SessionSeatMapper sessionSeatMapper;
    private final SeatBlockMapper seatBlockMapper;
    private final SessionMapper sessionMapper;
    private final SearchIndexMqProducer searchIndexMqProducer;

    public TicketTypeStockRecalculationService(TicketTypeMapper ticketTypeMapper,
                                                SessionSeatMapper sessionSeatMapper) {
        this(ticketTypeMapper, sessionSeatMapper, null, null, null, null);
    }

    public TicketTypeStockRecalculationService(TicketTypeMapper ticketTypeMapper,
                                               SessionSeatMapper sessionSeatMapper,
                                               SeatBlockMapper seatBlockMapper,
                                               TicketGroupMapper ticketGroupMapper) {
        this(ticketTypeMapper, sessionSeatMapper, seatBlockMapper, ticketGroupMapper, null, null);
    }

    @Autowired
    public TicketTypeStockRecalculationService(TicketTypeMapper ticketTypeMapper,
                                               SessionSeatMapper sessionSeatMapper,
                                               SeatBlockMapper seatBlockMapper,
                                               TicketGroupMapper ticketGroupMapper,
                                               SessionMapper sessionMapper,
                                               SearchIndexMqProducer searchIndexMqProducer) {
        this.ticketTypeMapper = ticketTypeMapper;
        this.sessionSeatMapper = sessionSeatMapper;
        this.seatBlockMapper = seatBlockMapper;
        this.sessionMapper = sessionMapper;
        this.searchIndexMqProducer = searchIndexMqProducer;
    }

    public void recalculateForSession(Long sessionId) {
        if (sessionId == null) {
            return;
        }

        List<TicketType> ticketTypes = ticketTypeMapper.selectList(new LambdaQueryWrapper<TicketType>()
                .eq(TicketType::getSessionId, sessionId));
        if (ticketTypes == null || ticketTypes.isEmpty()) {
            return;
        }

        List<SessionSeat> seats = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, sessionId));
        Map<Long, List<SessionSeat>> seatsByTicketTypeId = (seats == null ? Collections.<SessionSeat>emptyList() : seats).stream()
                .filter(seat -> seat != null)
                .filter(seat -> seat.getTicketTypeId() != null)
                .collect(Collectors.groupingBy(SessionSeat::getTicketTypeId));
        Map<Long, Integer> standingCapacityByTicketTypeId = standingCapacityByTicketTypeId(sessionId, ticketTypes);

        for (TicketType ticketType : ticketTypes) {
            if (ticketType == null || ticketType.getId() == null) {
                continue;
            }
            List<SessionSeat> ownedSeats = seatsByTicketTypeId.getOrDefault(ticketType.getId(), Collections.emptyList());
            int standingCapacity = standingCapacityByTicketTypeId.getOrDefault(ticketType.getId(), 0);
            ticketType.setTotalStock((int) ownedSeats.stream().filter(this::countsTowardTotalStock).count() + standingCapacity);
            ticketType.setRemainStock((int) ownedSeats.stream().filter(this::countsTowardRemainStock).count() + standingCapacity);
            ticketTypeMapper.updateById(ticketType);
        }
        refreshActivitySearchIndex(sessionId);
    }

    private Map<Long, Integer> standingCapacityByTicketTypeId(Long sessionId, List<TicketType> ticketTypes) {
        List<TicketType> boundStandingTicketTypes = (ticketTypes == null ? Collections.<TicketType>emptyList() : ticketTypes).stream()
                .filter(ticketType -> ticketType != null && ticketType.getId() != null)
                .filter(ticketType -> ticketType.getSeatBlockId() != null)
                .collect(Collectors.toList());
        if (boundStandingTicketTypes.isEmpty()) {
            return Collections.emptyMap();
        }
        if (seatBlockMapper == null) {
            throw new BusinessException(503, "无法确认站区库存配置，请稍后重试。");
        }
        return boundStandingTicketTypes.stream().collect(Collectors.toMap(
                TicketType::getId,
                ticketType -> standingCapacity(sessionId, ticketType),
                Integer::sum));
    }

    private int standingCapacity(Long sessionId, TicketType ticketType) {
        SeatBlock block = seatBlockMapper.selectById(ticketType.getSeatBlockId());
        if (block == null
                || !Objects.equals("session", block.getOwnerType())
                || !Objects.equals(sessionId, block.getOwnerId())
                || !Objects.equals("standingBlock", block.getBlockType())
                || !Integer.valueOf(1).equals(block.getStatus())) {
            throw new BusinessException(400, "站区票档未绑定有效站区，无法重算库存。");
        }
        return requirePositiveCapacity(block.getCapacity());
    }

    private int requirePositiveCapacity(Integer capacity) {
        if (capacity == null || capacity <= 0) {
            throw new BusinessException(400, "站区容量必须大于0");
        }
        return capacity;
    }

    private boolean countsTowardTotalStock(SessionSeat seat) {
        return Integer.valueOf(1).equals(seat.getStatus())
                || Integer.valueOf(2).equals(seat.getStatus())
                || Integer.valueOf(3).equals(seat.getStatus());
    }

    private boolean countsTowardRemainStock(SessionSeat seat) {
        return Integer.valueOf(1).equals(seat.getStatus())
                && seat.getOrderId() == null
                && seat.getLockExpireTime() == null;
    }

    private void refreshActivitySearchIndex(Long sessionId) {
        if (searchIndexMqProducer == null || sessionMapper == null || sessionId == null) {
            return;
        }
        Session session = sessionMapper.selectById(sessionId);
        if (session != null && session.getActivityId() != null) {
            searchIndexMqProducer.refreshActivity(session.getActivityId());
        }
    }
}
