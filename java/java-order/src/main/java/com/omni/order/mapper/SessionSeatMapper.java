package com.omni.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.order.entity.SessionSeat;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;

@Mapper
public interface SessionSeatMapper extends BaseMapper<SessionSeat> {

    @Select("SELECT start_time FROM session WHERE id = #{sessionId}")
    LocalDateTime selectSessionStartTime(@Param("sessionId") Long sessionId);

    @Select("SELECT EXISTS(" +
            "SELECT 1 " +
            "FROM session s " +
            "JOIN activity a ON a.id = s.activity_id " +
            "WHERE s.id = #{sessionId} " +
            "AND s.status = 1 " +
            "AND a.status = 1)")
    Boolean selectSessionSellable(@Param("sessionId") Long sessionId);
}
