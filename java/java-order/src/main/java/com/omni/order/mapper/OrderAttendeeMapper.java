package com.omni.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.order.entity.OrderAttendee;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface OrderAttendeeMapper extends BaseMapper<OrderAttendee> {

    @Select({"<script>",
            "SELECT * FROM order_attendee WHERE order_id IN",
            "<foreach collection='orderIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
            "ORDER BY order_id, id",
            "</script>"})
    List<OrderAttendee> selectByOrderIds(@Param("orderIds") List<Long> orderIds);

    @Select("SELECT COALESCE(COUNT(*), 0) FROM order_attendee " +
            "WHERE session_id = #{sessionId} AND id_type = #{idType} AND id_no_hash = #{idNoHash} AND status = 1")
    Long countActiveBySessionIdentity(@Param("sessionId") Long sessionId,
                                      @Param("idType") String idType,
                                      @Param("idNoHash") String idNoHash);

    @Update("UPDATE order_attendee SET status = #{status}, update_time = CURRENT_TIMESTAMP WHERE order_id = #{orderId} AND status = 1")
    int updateStatusByOrderId(@Param("orderId") Long orderId, @Param("status") Integer status);

    @Update({"<script>",
            "UPDATE order_attendee SET status = #{status}, update_time = CURRENT_TIMESTAMP",
            "WHERE order_id = #{orderId} AND status = 1 AND order_seat_id IN",
            "<foreach collection='orderSeatIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
            "</script>"})
    int updateStatusByOrderSeatIds(@Param("orderId") Long orderId,
                                   @Param("orderSeatIds") List<Long> orderSeatIds,
                                   @Param("status") Integer status);
}
