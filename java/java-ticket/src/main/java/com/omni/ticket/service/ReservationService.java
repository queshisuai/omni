package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.entity.Reservation;
import com.omni.ticket.entity.Session;
import com.omni.ticket.mapper.ReservationMapper;
import com.omni.ticket.mapper.SessionMapper;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 预约服务
 */
@Service
public class ReservationService {

    private final ReservationMapper reservationMapper;
    private final SessionMapper sessionMapper;

    public ReservationService(ReservationMapper reservationMapper, SessionMapper sessionMapper) {
        this.reservationMapper = reservationMapper;
        this.sessionMapper = sessionMapper;
    }

    /**
     * 创建预约
     */
    public void createReservation(Long userId, Long sessionId) {
        Session session = sessionMapper.selectById(sessionId);
        if (session == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "场次不存在");
        }

        // 检查是否已预约
        LambdaQueryWrapper<Reservation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Reservation::getUserId, userId)
               .eq(Reservation::getSessionId, sessionId);
        if (reservationMapper.selectCount(wrapper) > 0) {
            throw new BusinessException(ResultCode.CONFLICT, "已预约该场次");
        }

        Reservation reservation = new Reservation();
        reservation.setUserId(userId);
        reservation.setSessionId(sessionId);
        reservation.setStatus(1);
        reservationMapper.insert(reservation);
    }

    /**
     * 我的预约列表
     */
    public List<Reservation> listReservations(Long userId) {
        LambdaQueryWrapper<Reservation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Reservation::getUserId, userId)
               .eq(Reservation::getStatus, 1)
               .orderByDesc(Reservation::getCreateTime);
        return reservationMapper.selectList(wrapper);
    }
}
