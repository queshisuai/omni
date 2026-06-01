package com.omni.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.order.entity.TicketTransfer;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface TicketTransferMapper extends BaseMapper<TicketTransfer> {

    @Select("SELECT * FROM ticket_transfer WHERE transfer_code = #{transferCode} FOR UPDATE")
    TicketTransfer selectByTransferCodeForUpdate(@Param("transferCode") String transferCode);

    @Select("SELECT * FROM ticket_transfer WHERE ticket_id = #{ticketId} AND status = 1 ORDER BY id DESC LIMIT 1 FOR UPDATE")
    TicketTransfer selectPendingByTicketIdForUpdate(@Param("ticketId") Long ticketId);

    @Update("UPDATE ticket_transfer SET status = #{nextStatus}, update_time = CURRENT_TIMESTAMP " +
            "WHERE id = #{id} AND status = #{expectedStatus}")
    int updateStatusIfCurrent(@Param("id") Long id,
                              @Param("expectedStatus") Integer expectedStatus,
                              @Param("nextStatus") Integer nextStatus);

    @Update("UPDATE ticket_transfer SET status = 2, to_user_id = #{toUserId}, new_ticket_id = #{newTicketId}, " +
            "claimed_at = CURRENT_TIMESTAMP, update_time = CURRENT_TIMESTAMP WHERE id = #{id} AND status = 1")
    int updateClaimed(@Param("id") Long id,
                      @Param("toUserId") Long toUserId,
                      @Param("newTicketId") Long newTicketId);
}
