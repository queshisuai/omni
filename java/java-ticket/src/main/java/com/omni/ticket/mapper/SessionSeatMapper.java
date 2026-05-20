package com.omni.ticket.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.ticket.entity.SessionSeat;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SessionSeatMapper extends BaseMapper<SessionSeat> {
    @Select("SELECT COUNT(*) FROM session_seat ss WHERE ss.session_id = #{sessionId} " +
            "AND (ss.status IN (2, 3) OR ss.order_id IS NOT NULL " +
            "OR EXISTS (SELECT 1 FROM order_seat os WHERE os.session_seat_id = ss.id))")
    Long countTradingSeats(@Param("sessionId") Long sessionId);

    @Delete("DELETE FROM session_seat ss WHERE ss.session_id = #{sessionId} " +
            "AND NOT EXISTS (SELECT 1 FROM session_seat guard WHERE guard.session_id = #{sessionId} " +
            "AND (guard.status IN (2, 3) OR guard.order_id IS NOT NULL " +
            "OR EXISTS (SELECT 1 FROM order_seat os WHERE os.session_seat_id = guard.id)))")
    int deleteSyncableBySessionId(@Param("sessionId") Long sessionId);

    @org.apache.ibatis.annotations.Update("UPDATE session_seat SET status = 4, update_time = CURRENT_TIMESTAMP " +
            "WHERE venue_seat_id = #{venueSeatId} AND status = 1 AND order_id IS NULL " +
            "AND NOT EXISTS (SELECT 1 FROM order_seat os WHERE os.session_seat_id = session_seat.id)")
    int disableAvailableByVenueSeatId(@Param("venueSeatId") Long venueSeatId);

    @org.apache.ibatis.annotations.Update("UPDATE session_seat SET ticket_type_id = #{ticketTypeId}, update_time = CURRENT_TIMESTAMP " +
            "WHERE session_id = #{sessionId} AND layout_section_id = #{layoutSectionId} " +
            "AND status = 1 AND order_id IS NULL " +
            "AND NOT EXISTS (SELECT 1 FROM order_seat os WHERE os.session_seat_id = session_seat.id)")
    int updateTicketTypeByLayoutSection(@Param("sessionId") Long sessionId,
                                        @Param("layoutSectionId") Long layoutSectionId,
                                        @Param("ticketTypeId") Long ticketTypeId);

    @Select("SELECT COUNT(*) FROM session_seat WHERE session_id = #{sessionId} " +
            "AND layout_section_id = #{layoutSectionId} AND status = 1 AND order_id IS NULL " +
            "AND NOT EXISTS (SELECT 1 FROM order_seat os WHERE os.session_seat_id = session_seat.id)")
    Long countAvailableByLayoutSection(@Param("sessionId") Long sessionId,
                                        @Param("layoutSectionId") Long layoutSectionId);

    @Select("SELECT COUNT(*) FROM session_seat WHERE session_id = #{sessionId} " +
            "AND ticket_group_key = #{ticketGroupKey} AND status = 1 AND order_id IS NULL " +
            "AND NOT EXISTS (SELECT 1 FROM order_seat os WHERE os.session_seat_id = session_seat.id)")
    Long countAvailableByTicketGroupKey(@Param("sessionId") Long sessionId,
                                        @Param("ticketGroupKey") String ticketGroupKey);
}
