package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.TicketTypeArea;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketTypeAreaMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TicketTypeAreaService {
    private static final int SESSION_SEAT_AVAILABLE = 1;

    private final TicketTypeMapper ticketTypeMapper;
    private final TicketTypeAreaMapper ticketTypeAreaMapper;
    private final SessionSeatMapper sessionSeatMapper;

    public TicketTypeAreaService(TicketTypeMapper ticketTypeMapper,
                                 TicketTypeAreaMapper ticketTypeAreaMapper,
                                 SessionSeatMapper sessionSeatMapper) {
        this.ticketTypeMapper = ticketTypeMapper;
        this.ticketTypeAreaMapper = ticketTypeAreaMapper;
        this.sessionSeatMapper = sessionSeatMapper;
    }

    public TicketType createTicketType(TicketType ticketType, List<Long> areaIds) {
        if (areaIds == null || areaIds.isEmpty()) {
            throw new BusinessException(400, "请选择票档绑定区域");
        }
        List<TicketTypeArea> existing = ticketTypeAreaMapper.selectList(new LambdaQueryWrapper<TicketTypeArea>()
                .eq(TicketTypeArea::getSessionId, ticketType.getSessionId())
                .in(TicketTypeArea::getAreaId, areaIds));
        if (existing != null && !existing.isEmpty()) {
            throw new BusinessException(400, "同一场次区域只能绑定一个票档");
        }
        List<SessionSeat> seats = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, ticketType.getSessionId())
                .in(SessionSeat::getAreaId, areaIds)
                .eq(SessionSeat::getStatus, SESSION_SEAT_AVAILABLE));
        int stock = seats == null ? 0 : seats.size();
        if (stock <= 0) {
            throw new BusinessException(400, "所选区域没有可售座位");
        }
        ticketType.setTotalStock(stock);
        ticketType.setRemainStock(stock);
        ticketType.setStatus(ticketType.getStatus() == null ? 1 : ticketType.getStatus());
        ticketTypeMapper.insert(ticketType);
        for (Long areaId : areaIds) {
            TicketTypeArea relation = new TicketTypeArea();
            relation.setTicketTypeId(ticketType.getId());
            relation.setSessionId(ticketType.getSessionId());
            relation.setAreaId(areaId);
            relation.setCreateTime(LocalDateTime.now());
            ticketTypeAreaMapper.insert(relation);
        }
        return ticketType;
    }
}
