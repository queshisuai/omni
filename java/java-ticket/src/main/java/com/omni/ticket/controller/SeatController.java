package com.omni.ticket.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatMapResponse;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.TicketTypeArea;
import com.omni.ticket.entity.VenueArea;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketTypeAreaMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueAreaMapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ticket")
public class SeatController {
    private final TicketTypeMapper ticketTypeMapper;
    private final TicketTypeAreaMapper ticketTypeAreaMapper;
    private final VenueAreaMapper venueAreaMapper;
    private final SessionSeatMapper sessionSeatMapper;

    public SeatController(TicketTypeMapper ticketTypeMapper,
                          TicketTypeAreaMapper ticketTypeAreaMapper,
                          VenueAreaMapper venueAreaMapper,
                          SessionSeatMapper sessionSeatMapper) {
        this.ticketTypeMapper = ticketTypeMapper;
        this.ticketTypeAreaMapper = ticketTypeAreaMapper;
        this.venueAreaMapper = venueAreaMapper;
        this.sessionSeatMapper = sessionSeatMapper;
    }

    @GetMapping("/sessions/{sessionId}/ticket-types/{ticketTypeId}/seats")
    public Result<SeatMapResponse> getSeatMap(@PathVariable Long sessionId, @PathVariable Long ticketTypeId) {
        TicketType ticketType = ticketTypeMapper.selectById(ticketTypeId);
        if (ticketType == null || !sessionId.equals(ticketType.getSessionId())) {
            throw new BusinessException(404, "票档不存在");
        }
        List<TicketTypeArea> relations = ticketTypeAreaMapper.selectList(new LambdaQueryWrapper<TicketTypeArea>()
                .eq(TicketTypeArea::getSessionId, sessionId)
                .eq(TicketTypeArea::getTicketTypeId, ticketTypeId));
        List<Long> areaIds = relations.stream().map(TicketTypeArea::getAreaId).collect(Collectors.toList());
        if (areaIds.isEmpty()) {
            return Result.success(SeatMapResponse.of(sessionId, ticketType, Collections.emptyList(), Collections.emptyList()));
        }
        List<VenueArea> areas = venueAreaMapper.selectBatchIds(areaIds);
        List<SessionSeat> seats = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, sessionId)
                .in(SessionSeat::getAreaId, areaIds)
                .orderByAsc(SessionSeat::getAreaId)
                .orderByAsc(SessionSeat::getRowNo)
                .orderByAsc(SessionSeat::getSeatNo));
        return Result.success(SeatMapResponse.of(sessionId, ticketType, areas, seats));
    }
}
