package com.omni.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.order.entity.OrderSeat;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface OrderSeatMapper extends BaseMapper<OrderSeat> {

    @Select("SELECT * FROM order_seat WHERE order_id = #{orderId} AND status = 2 ORDER BY id")
    List<OrderSeat> selectRefundableSeatsByOrderId(@Param("orderId") Long orderId);

    @Select("SELECT COUNT(*) FROM order_seat WHERE order_id = #{orderId} AND status = 3")
    Integer countRefundedSeatsByOrderId(@Param("orderId") Long orderId);

    @Select("SELECT * FROM order_seat WHERE order_id = #{orderId} AND status IN (1, 2) ORDER BY id")
    List<OrderSeat> selectLockedAndSoldSeatsByOrderId(@Param("orderId") Long orderId);

    @Update({"<script>",
            "UPDATE order_seat SET status = 3, update_time = CURRENT_TIMESTAMP",
            "WHERE order_id = #{orderId} AND status = 2 AND id IN",
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
            "</script>"})
    int updateRefundedStatusByOrderIdAndIds(@Param("orderId") Long orderId, @Param("ids") List<Long> ids);
}
