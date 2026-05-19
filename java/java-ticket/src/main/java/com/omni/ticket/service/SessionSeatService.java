package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatTemplateSyncResponse;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.VenueSeat;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.VenueSeatMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class SessionSeatService {
    private final SessionMapper sessionMapper;
    private final VenueSeatMapper venueSeatMapper;
    private final SessionSeatMapper sessionSeatMapper;
    private final SessionSeatLayoutService sessionSeatLayoutService;

    public SessionSeatService(SessionMapper sessionMapper,
                               VenueSeatMapper venueSeatMapper,
                               SessionSeatMapper sessionSeatMapper) {
        this(sessionMapper, venueSeatMapper, sessionSeatMapper, null);
    }

    @Autowired
    public SessionSeatService(SessionMapper sessionMapper,
                              VenueSeatMapper venueSeatMapper,
                              SessionSeatMapper sessionSeatMapper,
                              SessionSeatLayoutService sessionSeatLayoutService) {
        this.sessionMapper = sessionMapper;
        this.venueSeatMapper = venueSeatMapper;
        this.sessionSeatMapper = sessionSeatMapper;
        this.sessionSeatLayoutService = sessionSeatLayoutService;
    }

    public int generateForSession(Long sessionId) {
        if (sessionSeatLayoutService != null && sessionSeatLayoutService.hasLayout(sessionId)) {
            return sessionSeatLayoutService.generateSessionSeats(sessionId);
        }
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

    public boolean canSyncSession(Long sessionId) {
        Long tradingCount = sessionSeatMapper.countTradingSeats(sessionId);
        return tradingCount == null || tradingCount == 0;
    }

    public int disableAvailableSeatsByVenueSeatId(Long venueSeatId) {
        if (venueSeatId == null || venueSeatId <= 0) {
            return 0;
        }
        return sessionSeatMapper.disableAvailableByVenueSeatId(venueSeatId);
    }

    @Transactional
    public int rebuildForSession(Long sessionId) {
        Integer rebuiltCount = rebuildForSessionIfSyncable(sessionId);
        return rebuiltCount == null ? 0 : rebuiltCount;
    }

    private Integer rebuildForSessionIfSyncable(Long sessionId) {
        if (!canSyncSession(sessionId)) {
            return null;
        }
        if (sessionSeatLayoutService != null && sessionSeatLayoutService.hasLayout(sessionId)) {
            return null;
        }
        Session session = sessionMapper.selectById(sessionId);
        if (session == null) {
            throw new BusinessException(404, "场次不存在");
        }
        Long existingCount = sessionSeatMapper.selectCount(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, sessionId));
        int deletedCount = sessionSeatMapper.deleteSyncableBySessionId(sessionId);
        if (existingCount != null && existingCount > 0 && deletedCount != existingCount) {
            return null;
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

    public void deleteBySessionId(Long sessionId) {
        sessionSeatMapper.delete(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, sessionId));
    }

    @Transactional
    public SeatTemplateSyncResponse syncVenueSessions(Long venueId) {
        SeatTemplateSyncResponse response = new SeatTemplateSyncResponse();
        List<Session> sessions = sessionMapper.selectList(new LambdaQueryWrapper<Session>()
                .eq(Session::getVenueId, venueId)
                .orderByAsc(Session::getId));
        for (Session session : sessions) {
            Integer rebuiltCount = rebuildForSessionIfSyncable(session.getId());
            if (rebuiltCount != null) {
                response.setSyncedSessionCount(response.getSyncedSessionCount() + 1);
            } else {
                response.getSkippedSessionIds().add(session.getId());
            }
        }
        response.setSkippedSessionCount(response.getSkippedSessionIds().size());
        return response;
    }
}
