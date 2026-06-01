package com.omni.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.order.entity.OrderSnapshot;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface OrderSnapshotMapper extends BaseMapper<OrderSnapshot> {
    @Select("SELECT * FROM order_snapshot WHERE order_id = #{orderId}")
    OrderSnapshot selectByOrderId(@Param("orderId") Long orderId);
}
