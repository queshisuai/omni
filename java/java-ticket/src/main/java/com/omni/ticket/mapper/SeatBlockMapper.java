package com.omni.ticket.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.ticket.entity.SeatBlock;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SeatBlockMapper extends BaseMapper<SeatBlock> {
    @Select("SELECT id, owner_type, owner_id, block_type, ticket_group_key, status FROM seat_block WHERE id = #{id}")
    SeatBlock selectSalesBindingById(@Param("id") Long id);
}
