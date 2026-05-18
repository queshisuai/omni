package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.VenueSeat;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.VenueSeatMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class SessionSeatService {
    private final SessionMapper sessionMapper;
    private final VenueSeatMapper venueSeatMapper;
    private final SessionSeatMapper sessionSeatMapper;

    public SessionSeatService(SessionMapper sessionMapper,
                              VenueSeatMapper venueSeatMapper,
                              SessionSeatMapper sessionSeatMapper) {
        this.sessionMapper = sessionMapper;
        this.venueSeatMapper = venueSeatMapper;
        this.sessionSeatMapper = sessionSeatMapper;
    }

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
        List<VenueSeat> venueSeats = venueSeatMapper.selectList(new LambdaQueryWrapper<VenueSeat>()
                .eq(VenueSeat::getVenueId, session.getVenueId())
                .eq(VenueSeat::getStatus, 1)
                .orderByAsc(VenueSeat::getAreaId)
                .orderByAsc(VenueSeat::getRowNo)
                .orderByAsc(VenueSeat::getSeatNo));
        LocalDateTime now = LocalDateTime.now();
        for (VenueSeat venueSeat : venueSeats) {
            SessionSeat sessionSeat = new SessionSeat();
            sessionSeat.setSessionId(sessionId);
            sessionSeat.setVenueId(session.getVenueId());
            sessionSeat.setAreaId(venueSeat.getAreaId());
            sessionSeat.setVenueSeatId(venueSeat.getId());
            sessionSeat.setRowNo(venueSeat.getRowNo());
            sessionSeat.setSeatNo(venueSeat.getSeatNo());
            sessionSeat.setSeatLabel(venueSeat.getSeatLabel());
            sessionSeat.setStatus(1);
            sessionSeat.setCreateTime(now);
            sessionSeat.setUpdateTime(now);
            sessionSeatMapper.insert(sessionSeat);
        }
        return venueSeats.size();
    }
}
