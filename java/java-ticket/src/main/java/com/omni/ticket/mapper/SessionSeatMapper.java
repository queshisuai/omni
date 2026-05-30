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
            "AND (ss.status IN (2, 3) OR ss.order_id IS NOT NULL)")
    Long countTradingSeats(@Param("sessionId") Long sessionId);

    @Delete("DELETE FROM session_seat ss WHERE ss.session_id = #{sessionId} " +
            "AND NOT EXISTS (SELECT 1 FROM session_seat guard WHERE guard.session_id = #{sessionId} " +
            "AND (guard.status IN (2, 3) OR guard.order_id IS NOT NULL))")
    int deleteSyncableBySessionId(@Param("sessionId") Long sessionId);

    @org.apache.ibatis.annotations.Update("UPDATE session_seat SET status = 4, update_time = CURRENT_TIMESTAMP " +
            "WHERE venue_seat_id = #{venueSeatId} AND status = 1 AND order_id IS NULL " +
            "AND lock_expire_time IS NULL")
    int disableAvailableByVenueSeatId(@Param("venueSeatId") Long venueSeatId);

    @org.apache.ibatis.annotations.Update("UPDATE session_seat SET ticket_type_id = #{ticketTypeId}, update_time = CURRENT_TIMESTAMP " +
            "WHERE session_id = #{sessionId} AND layout_section_id = #{layoutSectionId} " +
            "AND status = 1 AND order_id IS NULL AND lock_expire_time IS NULL")
    int updateTicketTypeByLayoutSection(@Param("sessionId") Long sessionId,
                                        @Param("layoutSectionId") Long layoutSectionId,
                                        @Param("ticketTypeId") Long ticketTypeId);

    @Select("SELECT COUNT(*) FROM session_seat WHERE session_id = #{sessionId} " +
            "AND layout_section_id = #{layoutSectionId} AND status = 1 AND order_id IS NULL " +
            "AND lock_expire_time IS NULL")
    Long countAvailableByLayoutSection(@Param("sessionId") Long sessionId,
                                        @Param("layoutSectionId") Long layoutSectionId);

    @Select("SELECT COUNT(*) FROM session_seat WHERE session_id = #{sessionId} " +
            "AND ticket_group_key = #{ticketGroupKey} AND status = 1 AND order_id IS NULL " +
            "AND lock_expire_time IS NULL")
    Long countAvailableByTicketGroupKey(@Param("sessionId") Long sessionId,
                                         @Param("ticketGroupKey") String ticketGroupKey);

    @Select("SELECT id FROM session_seat WHERE session_id = #{sessionId} " +
            "AND ticket_type_id = #{ticketTypeId} AND status = 1 AND order_id IS NULL " +
            "AND lock_expire_time IS NULL " +
            "ORDER BY random() LIMIT #{quantity}")
    List<Long> selectRandomAvailableSeatIds(@Param("sessionId") Long sessionId,
                                            @Param("ticketTypeId") Long ticketTypeId,
                                            @Param("quantity") Integer quantity);

    @Update("UPDATE session_seat SET status = 2, ticket_type_id = #{ticketTypeId}, " +
            "lock_expire_time = #{lockExpireTime}, update_time = CURRENT_TIMESTAMP " +
            "WHERE id = #{seatId} AND session_id = #{sessionId} AND status = 1")
    int lockSeat(@Param("seatId") Long seatId,
                 @Param("sessionId") Long sessionId,
                 @Param("ticketTypeId") Long ticketTypeId,
                 @Param("lockExpireTime") LocalDateTime lockExpireTime);

    @Update("UPDATE session_seat SET status = 3, order_id = #{orderId}, update_time = CURRENT_TIMESTAMP " +
            ", lock_request_id = NULL " +
            "WHERE id = #{seatId} AND session_id = #{sessionId} AND (status = 2 OR (status = 1 AND order_id IS NULL))")
    int markSeatSold(@Param("seatId") Long seatId,
                     @Param("sessionId") Long sessionId,
                     @Param("orderId") Long orderId);

    @Update("UPDATE session_seat SET status = 1, order_id = NULL, lock_expire_time = NULL, " +
            "lock_request_id = NULL, update_time = CURRENT_TIMESTAMP " +
            "WHERE id = #{seatId} AND session_id = #{sessionId} AND status = 2")
    int releaseLockedSeat(@Param("seatId") Long seatId,
                          @Param("sessionId") Long sessionId);

    @Select("SELECT * FROM session_seat WHERE session_id = #{sessionId} " +
            "AND ticket_type_id = #{ticketTypeId} AND status = 1 AND order_id IS NULL " +
            "AND lock_expire_time IS NULL " +
            "ORDER BY layout_section_id NULLS LAST, seat_block_id NULLS LAST, row_no NULLS LAST, seat_no NULLS LAST, id " +
            "LIMIT #{limit} FOR UPDATE SKIP LOCKED")
    List<SessionSeat> selectAvailableForTeamLock(@Param("sessionId") Long sessionId,
                                                  @Param("ticketTypeId") Long ticketTypeId,
                                                  @Param("limit") Integer limit);

    @Update({"<script>",
            "UPDATE session_seat SET status = 2, lock_expire_time = #{lockExpireTime}, ",
            "lock_request_id = #{lockRequestId}, update_time = CURRENT_TIMESTAMP ",
            "WHERE session_id = #{sessionId} AND ticket_type_id = #{ticketTypeId} ",
            "AND status = 1 AND order_id IS NULL AND lock_expire_time IS NULL AND id IN ",
            "<foreach collection='seatIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
            "</script>"})
    int lockTeamSeatIds(@Param("sessionId") Long sessionId,
                        @Param("ticketTypeId") Long ticketTypeId,
                        @Param("seatIds") List<Long> seatIds,
                        @Param("lockRequestId") String lockRequestId,
                        @Param("lockExpireTime") LocalDateTime lockExpireTime);

    @Select({"<script>",
            "SELECT * FROM session_seat WHERE session_id = #{sessionId} ",
            "AND ticket_type_id = #{ticketTypeId} AND status = 2 ",
            "AND lock_request_id = #{lockRequestId} AND lock_expire_time > CURRENT_TIMESTAMP AND id IN ",
            "<foreach collection='seatIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
            "ORDER BY layout_section_id NULLS LAST, seat_block_id NULLS LAST, row_no NULLS LAST, seat_no NULLS LAST, id",
            "</script>"})
    List<SessionSeat> selectLockedByRequest(@Param("sessionId") Long sessionId,
                                            @Param("ticketTypeId") Long ticketTypeId,
                                            @Param("seatIds") List<Long> seatIds,
                                            @Param("lockRequestId") String lockRequestId);

    @Select("SELECT * FROM session_seat WHERE session_id = #{sessionId} " +
            "AND ticket_type_id = #{ticketTypeId} AND status = 2 " +
            "AND lock_request_id = #{lockRequestId} AND lock_expire_time > CURRENT_TIMESTAMP " +
            "ORDER BY layout_section_id NULLS LAST, seat_block_id NULLS LAST, row_no NULLS LAST, seat_no NULLS LAST, id")
    List<SessionSeat> selectLockedByRequestId(@Param("sessionId") Long sessionId,
                                              @Param("ticketTypeId") Long ticketTypeId,
                                              @Param("lockRequestId") String lockRequestId);

    @Update({"<script>",
            "UPDATE session_seat SET status = 1, order_id = NULL, lock_expire_time = NULL, ",
            "lock_request_id = NULL, update_time = CURRENT_TIMESTAMP ",
            "WHERE status = 2 AND lock_request_id = #{lockRequestId} AND id IN ",
            "<foreach collection='seatIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
            "</script>"})
    int releaseTeamSeatLockByRequest(@Param("lockRequestId") String lockRequestId,
                                     @Param("seatIds") List<Long> seatIds);

    @Update("UPDATE session_seat SET status = 1, order_id = NULL, lock_expire_time = NULL, " +
            "lock_request_id = NULL, update_time = CURRENT_TIMESTAMP " +
            "WHERE status = 2 AND lock_request_id = #{lockRequestId}")
    int releaseTeamSeatLockByRequestId(@Param("lockRequestId") String lockRequestId);

    @Update("UPDATE session_seat SET status = 1, order_id = NULL, lock_expire_time = NULL, update_time = CURRENT_TIMESTAMP " +
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
            "WHERE s.id = #{sessionId} AND s.status = 1 AND a.status = 1 " +
            "AND a.publish_status = 'published')")
    Boolean selectSessionSellable(@Param("sessionId") Long sessionId);

    @Select({"<script>",
            "SELECT CONCAT_WS(' ', NULLIF(sb.name, ''), COALESCE(ss.seat_label, ss.row_no::TEXT || '-' || ss.seat_no::TEXT)) ",
            "FROM session_seat ss ",
            "LEFT JOIN seat_block sb ON sb.id = ss.seat_block_id ",
            "WHERE ss.id IN",
            "<foreach collection='seatIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
            "ORDER BY ss.id",
            "</script>"})
    List<String> selectSeatLabelsByIds(@Param("seatIds") List<Long> seatIds);
}
