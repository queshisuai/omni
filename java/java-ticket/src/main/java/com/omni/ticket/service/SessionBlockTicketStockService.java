package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.SeatOverride;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.TicketGroup;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.mapper.SeatBlockMapper;
import com.omni.ticket.mapper.SeatOverrideMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketGroupMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class SessionBlockTicketStockService {
    private final SessionMapper sessionMapper;
    private final SeatBlockMapper seatBlockMapper;
    private final SeatOverrideMapper seatOverrideMapper;
    private final TicketGroupMapper ticketGroupMapper;
    private final TicketTypeMapper ticketTypeMapper;
    private final SessionSeatMapper sessionSeatMapper;
    private final SeatBlockGeometryService geometryService;

    public SessionBlockTicketStockService(SessionMapper sessionMapper,
                                          SeatBlockMapper seatBlockMapper,
                                          SeatOverrideMapper seatOverrideMapper,
                                          TicketGroupMapper ticketGroupMapper,
                                          TicketTypeMapper ticketTypeMapper,
                                          SessionSeatMapper sessionSeatMapper,
                                          SeatBlockGeometryService geometryService) {
        this.sessionMapper = sessionMapper;
        this.seatBlockMapper = seatBlockMapper;
        this.seatOverrideMapper = seatOverrideMapper;
        this.ticketGroupMapper = ticketGroupMapper;
        this.ticketTypeMapper = ticketTypeMapper;
        this.sessionSeatMapper = sessionSeatMapper;
        this.geometryService = geometryService;
    }

    @Transactional
    public int generateForSession(Long sessionId) {
        Session session = sessionMapper.selectById(sessionId);
        if (session == null) {
            throw new BusinessException(404, "场次不存在");
        }
        Long existingCount = sessionSeatMapper.selectCount(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, sessionId));
        if (existingCount != null && existingCount > 0) {
            return 0;
        }
        List<SeatBlock> blocks = activeBlocks(sessionId);
        if (blocks.isEmpty()) {
            return 0;
        }
        Map<String, TicketGroup> groups = activeGroups(sessionId).stream()
                .collect(Collectors.toMap(TicketGroup::getGroupKey, group -> group, (a, b) -> a));
        Map<Long, List<SeatOverride>> overridesByBlock = overridesByBlock(blocks);
        LocalDateTime now = LocalDateTime.now();
        int generatedSeats = 0;
        for (TicketGroup group : groups.values()) {
            List<SeatBlock> groupBlocks = blocks.stream()
                    .filter(block -> group.getGroupKey().equals(block.getTicketGroupKey()))
                    .collect(Collectors.toList());
            if (groupBlocks.isEmpty()) {
                continue;
            }
            int stock = groupBlocks.stream()
                    .mapToInt(block -> geometryService.countSellableSeats(block, overridesByBlock.getOrDefault(block.getId(), Collections.emptyList())))
                    .sum();
            TicketType ticketType = buildTicketType(sessionId, group, stock, now);
            ticketTypeMapper.insert(ticketType);
            for (SeatBlock block : groupBlocks) {
                List<SeatBlockGeometryService.GeneratedSeat> seats = geometryService.generateSeats(block, overridesByBlock.getOrDefault(block.getId(), Collections.emptyList()));
                for (SeatBlockGeometryService.GeneratedSeat seat : seats) {
                    sessionSeatMapper.insert(buildSessionSeat(session, ticketType.getId(), seat, now));
                    generatedSeats++;
                }
            }
        }
        return generatedSeats;
    }

    private List<SeatBlock> activeBlocks(Long sessionId) {
        List<SeatBlock> blocks = seatBlockMapper.selectList(new LambdaQueryWrapper<SeatBlock>()
                .eq(SeatBlock::getOwnerType, "session")
                .eq(SeatBlock::getOwnerId, sessionId)
                .eq(SeatBlock::getStatus, 1)
                .orderByAsc(SeatBlock::getSort));
        return blocks == null ? Collections.emptyList() : blocks;
    }

    private List<TicketGroup> activeGroups(Long sessionId) {
        List<TicketGroup> groups = ticketGroupMapper.selectList(new LambdaQueryWrapper<TicketGroup>()
                .eq(TicketGroup::getOwnerType, "session")
                .eq(TicketGroup::getOwnerId, sessionId)
                .eq(TicketGroup::getStatus, 1)
                .orderByAsc(TicketGroup::getSort));
        return groups == null ? Collections.emptyList() : groups;
    }

    private Map<Long, List<SeatOverride>> overridesByBlock(List<SeatBlock> blocks) {
        List<Long> blockIds = blocks.stream().map(SeatBlock::getId).collect(Collectors.toList());
        List<SeatOverride> overrides = seatOverrideMapper.selectList(new LambdaQueryWrapper<SeatOverride>()
                .in(SeatOverride::getBlockId, blockIds));
        if (overrides == null || overrides.isEmpty()) {
            return Collections.emptyMap();
        }
        return overrides.stream().collect(Collectors.groupingBy(SeatOverride::getBlockId));
    }

    private TicketType buildTicketType(Long sessionId, TicketGroup group, int stock, LocalDateTime now) {
        TicketType ticketType = new TicketType();
        ticketType.setSessionId(sessionId);
        ticketType.setName(group.getName());
        ticketType.setPrice(group.getActivityPrice() != null ? group.getActivityPrice() : defaultPrice(group.getDefaultPrice()));
        ticketType.setTotalStock(stock);
        ticketType.setRemainStock(stock);
        ticketType.setStatus(1);
        ticketType.setCreateTime(now);
        return ticketType;
    }

    private BigDecimal defaultPrice(BigDecimal price) {
        return price == null ? BigDecimal.ZERO : price;
    }

    private SessionSeat buildSessionSeat(Session session, Long ticketTypeId, SeatBlockGeometryService.GeneratedSeat generated, LocalDateTime now) {
        SessionSeat seat = new SessionSeat();
        seat.setSessionId(session.getId());
        seat.setVenueId(session.getVenueId());
        seat.setSeatBlockId(generated.getBlockId());
        seat.setTicketGroupKey(generated.getTicketGroupKey());
        seat.setGeneratedRowNo(generated.getRowNo());
        seat.setGeneratedSeatNo(generated.getSeatNo());
        seat.setRowNo(generated.getRowNo());
        seat.setSeatNo(generated.getSeatNo());
        seat.setSeatLabel(generated.getLabel());
        seat.setStatus(1);
        seat.setTicketTypeId(ticketTypeId);
        seat.setCreateTime(now);
        seat.setUpdateTime(now);
        return seat;
    }
}
