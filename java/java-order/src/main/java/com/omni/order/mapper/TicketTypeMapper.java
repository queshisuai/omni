package com.omni.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.order.entity.TicketType;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface TicketTypeMapper extends BaseMapper<TicketType> {

    @Select("SELECT EXISTS(SELECT 1 FROM ticket_type WHERE id = #{ticketTypeId} AND status = 1)")
    Boolean selectTicketTypeSellable(@Param("ticketTypeId") Long ticketTypeId);

    @Update("UPDATE ticket_type SET remain_stock = remain_stock + #{quantity} WHERE id = #{ticketTypeId}")
    int increaseRemainStock(@Param("ticketTypeId") Long ticketTypeId, @Param("quantity") int quantity);

    @Update("UPDATE ticket_type SET remain_stock = remain_stock - #{quantity} " +
            "WHERE id = #{ticketTypeId} AND status = 1 AND remain_stock >= #{quantity}")
    int decreaseRemainStockIfEnough(@Param("ticketTypeId") Long ticketTypeId, @Param("quantity") int quantity);
}
