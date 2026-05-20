package com.omni.ticket.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.ticket.entity.SessionSeat;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import java.time.LocalDateTime;
import java.util.List;

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

    @Update("UPDATE session_seat SET status = 2, ticket_type_id = #{ticketTypeId}, " +
            "lock_expire_time = #{lockExpireTime}, update_time = CURRENT_TIMESTAMP " +
            "WHERE id = #{seatId} AND session_id = #{sessionId} AND status = 1")
    int lockSeat(@Param("seatId") Long seatId,
                 @Param("sessionId") Long sessionId,
                 @Param("ticketTypeId") Long ticketTypeId,
                 @Param("lockExpireTime") LocalDateTime lockExpireTime);

    @Update("UPDATE session_seat SET status = 3, order_id = #{orderId}, update_time = CURRENT_TIMESTAMP " +
            "WHERE id = #{seatId} AND session_id = #{sessionId} AND status = 2")
    int markSeatSold(@Param("seatId") Long seatId,
                     @Param("sessionId") Long sessionId,
                     @Param("orderId") Long orderId);

    @Update("UPDATE session_seat SET status = 1, order_id = NULL, ticket_type_id = NULL, lock_expire_time = NULL, update_time = CURRENT_TIMESTAMP " +
            "WHERE id = #{seatId} AND session_id = #{sessionId} AND status = 2")
    int releaseLockedSeat(@Param("seatId") Long seatId,
                          @Param("sessionId") Long sessionId);

    @Update("UPDATE session_seat SET status = 1, order_id = NULL, ticket_type_id = NULL, lock_expire_time = NULL, update_time = CURRENT_TIMESTAMP " +
            "WHERE id = #{seatId} AND session_id = #{sessionId} AND status = 3")
    int restoreSoldSeat(@Param("seatId") Long seatId,
                        @Param("sessionId") Long sessionId);

    @Update("UPDATE session_seat SET status = 4, update_time = CURRENT_TIMESTAMP " +
            "WHERE id = #{seatId} AND session_id = #{sessionId} AND status = 3")
    int markRefundedSeatUnavailable(@Param("seatId") Long seatId,
                                    @Param("sessionId") Long sessionId);

    @Select("SELECT start_time FROM session WHERE id = #{sessionId}")
    LocalDateTime selectSessionStartTime(@Param("sessionId") Long sessionId);

    @Select("SELECT EXISTS(" +
            "SELECT 1 FROM session s JOIN activity a ON a.id = s.activity_id " +
            "WHERE s.id = #{sessionId} AND s.status = 1 AND a.status = 1)")
    Boolean selectSessionSellable(@Param("sessionId") Long sessionId);

    @Select({"<script>",
            "SELECT COALESCE(seat_label, row_no::TEXT || '-' || seat_no::TEXT) FROM session_seat WHERE id IN",
            "<foreach collection='seatIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
            "ORDER BY id",
            "</script>"})
    List<String> selectSeatLabelsByIds(@Param("seatIds") List<Long> seatIds);
}
