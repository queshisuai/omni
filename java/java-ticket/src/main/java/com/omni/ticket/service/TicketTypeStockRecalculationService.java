package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.TicketGroup;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.mapper.SeatBlockMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketGroupMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
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
    private final TicketGroupMapper ticketGroupMapper;

    public TicketTypeStockRecalculationService(TicketTypeMapper ticketTypeMapper,
                                                SessionSeatMapper sessionSeatMapper) {
        this(ticketTypeMapper, sessionSeatMapper, null, null);
    }

    @Autowired
    public TicketTypeStockRecalculationService(TicketTypeMapper ticketTypeMapper,
                                               SessionSeatMapper sessionSeatMapper,
                                               SeatBlockMapper seatBlockMapper,
                                               TicketGroupMapper ticketGroupMapper) {
        this.ticketTypeMapper = ticketTypeMapper;
        this.sessionSeatMapper = sessionSeatMapper;
        this.seatBlockMapper = seatBlockMapper;
        this.ticketGroupMapper = ticketGroupMapper;
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
    }

    private Map<Long, Integer> standingCapacityByTicketTypeId(Long sessionId, List<TicketType> ticketTypes) {
        if (seatBlockMapper == null || ticketGroupMapper == null) {
            if (hasPossibleStandingTicketType(ticketTypes)) {
                throw new BusinessException(503, "无法确认站区库存配置，请稍后重试。");
            }
            return Collections.emptyMap();
        }
        List<SeatBlock> standingBlocks = seatBlockMapper.selectList(new LambdaQueryWrapper<SeatBlock>()
                .eq(SeatBlock::getOwnerType, "session")
                .eq(SeatBlock::getOwnerId, sessionId)
                .eq(SeatBlock::getBlockType, "standingBlock")
                .eq(SeatBlock::getStatus, 1));
        if (standingBlocks == null || standingBlocks.isEmpty()) {
            return Collections.emptyMap();
        }
        List<TicketGroup> groups = ticketGroupMapper.selectList(new LambdaQueryWrapper<TicketGroup>()
                .eq(TicketGroup::getOwnerType, "session")
                .eq(TicketGroup::getOwnerId, sessionId)
                .eq(TicketGroup::getStatus, 1));
        Map<String, TicketGroup> groupsByKey = (groups == null ? Collections.<TicketGroup>emptyList() : groups).stream()
                .filter(group -> group != null && group.getGroupKey() != null)
                .collect(Collectors.toMap(TicketGroup::getGroupKey, group -> group, (first, second) -> first));
        return standingBlocks.stream().collect(Collectors.groupingBy(
                block -> findStandingTicketTypeId(block, groupsByKey, ticketTypes),
                Collectors.summingInt(block -> requirePositiveCapacity(block.getCapacity()))));
    }

    private boolean hasPossibleStandingTicketType(List<TicketType> ticketTypes) {
        return (ticketTypes == null ? Collections.<TicketType>emptyList() : ticketTypes).stream()
                .filter(Objects::nonNull)
                .anyMatch(ticketType -> ticketType.getId() != null
                        && Integer.valueOf(1).equals(ticketType.getStatus())
                        && !hasSeatStock(ticketType));
    }

    private boolean hasSeatStock(TicketType ticketType) {
        return (ticketType.getTotalStock() != null && ticketType.getTotalStock() > 0)
                || (ticketType.getRemainStock() != null && ticketType.getRemainStock() > 0);
    }

    private Long findStandingTicketTypeId(SeatBlock block, Map<String, TicketGroup> groupsByKey, List<TicketType> ticketTypes) {
        TicketGroup group = groupsByKey.get(block.getTicketGroupKey());
        if (group == null) {
            throw new BusinessException(400, "站区未绑定有效票档组，无法重算库存。");
        }
        BigDecimal expectedPrice = groupPrice(group);
        List<TicketType> matches = (ticketTypes == null ? Collections.<TicketType>emptyList() : ticketTypes).stream()
                .filter(ticketType -> ticketType != null && ticketType.getId() != null)
                .filter(ticketType -> Integer.valueOf(1).equals(ticketType.getStatus()))
                .filter(ticketType -> Objects.equals(ticketType.getName(), group.getName()))
                .filter(ticketType -> samePrice(ticketType.getPrice(), expectedPrice))
                .collect(Collectors.toList());
        if (matches.size() != 1) {
            throw new BusinessException(400, "站区票档匹配不唯一，无法安全重算库存。");
        }
        return matches.get(0).getId();
    }

    private int requirePositiveCapacity(Integer capacity) {
        if (capacity == null || capacity <= 0) {
            throw new BusinessException(400, "站区容量必须大于0");
        }
        return capacity;
    }

    private boolean samePrice(BigDecimal left, BigDecimal right) {
        return defaultPrice(left).compareTo(defaultPrice(right)) == 0;
    }

    private BigDecimal groupPrice(TicketGroup group) {
        return group.getActivityPrice() != null ? group.getActivityPrice() : defaultPrice(group.getDefaultPrice());
    }

    private BigDecimal defaultPrice(BigDecimal price) {
        return price == null ? BigDecimal.ZERO : price;
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
}
