package com.omni.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.order.entity.SessionSeat;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

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

    @Update("UPDATE session_seat SET status = 1, order_id = NULL, ticket_type_id = NULL, lock_expire_time = NULL, update_time = CURRENT_TIMESTAMP " +
            "WHERE id = #{id} AND status = 2 AND order_id = #{orderId}")
    int releaseLockedSeatForOrder(@Param("id") Long id, @Param("orderId") Long orderId);
}
