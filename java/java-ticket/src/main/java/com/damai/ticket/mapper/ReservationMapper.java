package com.damai.ticket.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.damai.ticket.entity.Reservation;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ReservationMapper extends BaseMapper<Reservation> {
}
