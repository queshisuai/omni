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
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
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
            List<SeatBlock> blocks = activeBlocks(sessionId);
            return generateMissingBlockSeats(session, blocks, overridesByBlock(blocks), LocalDateTime.now());
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

    private int generateMissingBlockSeats(Session session, List<SeatBlock> blocks,
                                          Map<Long, List<SeatOverride>> overridesByBlock, LocalDateTime now) {
        if (blocks == null || blocks.isEmpty()) {
            return 0;
        }
        List<SessionSeat> existingSeats = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, session.getId()));
        Set<String> existingSeatKeys = (existingSeats == null ? Collections.<SessionSeat>emptyList() : existingSeats).stream()
                .filter(Objects::nonNull)
                .filter(seat -> seat.getSeatBlockId() != null)
                .filter(this::blocksRegeneration)
                .map(this::seatKey)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Set<Long> blocksWithUnknownSeatCoordinates = (existingSeats == null ? Collections.<SessionSeat>emptyList() : existingSeats).stream()
                .filter(Objects::nonNull)
                .filter(seat -> seat.getSeatBlockId() != null)
                .filter(seat -> seatKey(seat) == null)
                .map(SessionSeat::getSeatBlockId)
                .collect(Collectors.toSet());
        List<TicketType> activeTicketTypes = activeTicketTypes(session.getId());
        Map<String, TicketType> reusableTicketTypes = new HashMap<>();
        Map<String, TicketGroup> groups = activeGroups(session.getId()).stream()
                .collect(Collectors.toMap(TicketGroup::getGroupKey, group -> group, (a, b) -> a));
        int generatedSeats = 0;
        for (SeatBlock block : blocks) {
            if (block.getId() == null) {
                continue;
            }
            if (blocksWithUnknownSeatCoordinates.contains(block.getId())) {
                continue;
            }
            TicketGroup group = groups.get(block.getTicketGroupKey());
            if (group == null) {
                continue;
            }
            String ticketTypeKey = ticketTypeCacheKey(group);
            TicketType ticketType = reusableTicketTypes.get(ticketTypeKey);
            if (ticketType == null) {
                ticketType = findReusableTicketType(group, activeTicketTypes);
                if (ticketType == null) {
                    ticketType = buildTicketType(session.getId(), group,
                            geometryService.countSellableSeats(block, overridesByBlock.getOrDefault(block.getId(), Collections.emptyList())), now);
                    ticketTypeMapper.insert(ticketType);
                    activeTicketTypes = new ArrayList<>(activeTicketTypes);
                    activeTicketTypes.add(ticketType);
                }
                reusableTicketTypes.put(ticketTypeKey, ticketType);
            }
            for (SeatBlockGeometryService.GeneratedSeat seat : geometryService.generateSeats(block, overridesByBlock.getOrDefault(block.getId(), Collections.emptyList()))) {
                if (existingSeatKeys.contains(generatedSeatKey(seat))) {
                    continue;
                }
                sessionSeatMapper.insert(buildSessionSeat(session, ticketType.getId(), seat, now));
                generatedSeats++;
            }
        }
        return generatedSeats;
    }

    private boolean blocksRegeneration(SessionSeat seat) {
        return Integer.valueOf(1).equals(seat.getStatus())
                || Integer.valueOf(2).equals(seat.getStatus())
                || Integer.valueOf(3).equals(seat.getStatus());
    }

    private TicketType findReusableTicketType(TicketGroup group, List<TicketType> ticketTypes) {
        BigDecimal expectedPrice = groupPrice(group);
        List<TicketType> matches = (ticketTypes == null ? Collections.<TicketType>emptyList() : ticketTypes).stream()
                .filter(ticketType -> ticketType != null)
                .filter(ticketType -> Objects.equals(ticketType.getName(), group.getName()))
                .filter(ticketType -> samePrice(ticketType.getPrice(), expectedPrice))
                .collect(Collectors.toList());
        if (matches.size() > 1) {
            throw new BusinessException(400, "同名同价票档不唯一，无法安全绑定座位区域。");
        }
        return matches.isEmpty() ? null : matches.get(0);
    }

    private boolean samePrice(BigDecimal left, BigDecimal right) {
        return defaultPrice(left).compareTo(defaultPrice(right)) == 0;
    }

    private String ticketTypeCacheKey(TicketGroup group) {
        return group.getName() + "|" + groupPrice(group).stripTrailingZeros().toPlainString();
    }

    private BigDecimal groupPrice(TicketGroup group) {
        return group.getActivityPrice() != null ? group.getActivityPrice() : defaultPrice(group.getDefaultPrice());
    }

    private String seatKey(SessionSeat seat) {
        Integer rowNo = seat.getGeneratedRowNo() != null ? seat.getGeneratedRowNo() : seat.getRowNo();
        Integer seatNo = seat.getGeneratedSeatNo() != null ? seat.getGeneratedSeatNo() : seat.getSeatNo();
        if (rowNo == null || seatNo == null) {
            return null;
        }
        return seat.getSeatBlockId() + ":" + rowNo + ":" + seatNo;
    }

    private String generatedSeatKey(SeatBlockGeometryService.GeneratedSeat seat) {
        return seat.getBlockId() + ":" + seat.getRowNo() + ":" + seat.getSeatNo();
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

    private List<TicketType> activeTicketTypes(Long sessionId) {
        List<TicketType> ticketTypes = ticketTypeMapper.selectList(new LambdaQueryWrapper<TicketType>()
                .eq(TicketType::getSessionId, sessionId)
                .eq(TicketType::getStatus, 1));
        return ticketTypes == null ? Collections.emptyList() : ticketTypes;
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
        ticketType.setPrice(groupPrice(group));
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
