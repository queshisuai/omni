package com.omni.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.order.dto.TicketWalletItemResponse;
import com.omni.order.entity.ElectronicTicket;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface ElectronicTicketMapper extends BaseMapper<ElectronicTicket> {

    @Select("SELECT COALESCE(COUNT(*), 0) FROM electronic_ticket WHERE order_id = #{orderId}")
    Long countByOrderId(@Param("orderId") Long orderId);

    @Select("SELECT nextval('electronic_ticket_id_seq')")
    Long nextId();

    @Insert("INSERT INTO electronic_ticket (" +
            "id, ticket_no, order_id, order_seat_id, user_id, original_user_id, session_id, ticket_type_id, " +
            "attendee_user_profile_id, real_name, id_type, id_no_mask, phone, seat_label, status, create_time, update_time" +
            ") VALUES (" +
            "#{id}, #{ticketNo}, #{orderId}, #{orderSeatId}, #{userId}, #{originalUserId}, #{sessionId}, #{ticketTypeId}, " +
            "#{attendeeUserProfileId}, #{realName}, #{idType}, #{idNoMask}, #{phone}, #{seatLabel}, #{status}, #{createTime}, #{updateTime}" +
            ") ON CONFLICT (ticket_no) DO NOTHING")
    int insertIgnoreTicketNo(ElectronicTicket ticket);

    @Select("SELECT * FROM electronic_ticket WHERE id = #{id} FOR UPDATE")
    ElectronicTicket selectByIdForUpdate(@Param("id") Long id);

    @Select("SELECT et.id AS ticketId, et.ticket_no AS ticketNo, et.order_id AS orderId, " +
            "et.order_seat_id AS orderSeatId, et.session_id AS sessionId, et.ticket_type_id AS ticketTypeId, " +
            "os.activity_name AS activityName, os.activity_poster AS activityPoster, os.venue_name AS venueName, " +
            "os.session_time AS sessionTime, os.ticket_name AS ticketName, et.seat_label AS seatLabel, " +
            "et.real_name AS realName, et.id_no_mask AS idNoMask, et.status, et.checked_in_at AS checkedInAt " +
            "FROM electronic_ticket et " +
            "LEFT JOIN order_snapshot os ON os.order_id = et.order_id " +
            "WHERE et.user_id = #{userId} " +
            "ORDER BY os.session_time DESC NULLS LAST, et.id DESC")
    List<TicketWalletItemResponse> selectWalletItemsByUserId(@Param("userId") Long userId);

    @Update("UPDATE electronic_ticket SET status = #{nextStatus}, checked_in_at = CURRENT_TIMESTAMP, update_time = CURRENT_TIMESTAMP " +
            "WHERE id = #{id} AND status = #{expectedStatus}")
    int updateStatusIfCurrent(@Param("id") Long id,
                              @Param("expectedStatus") Integer expectedStatus,
                              @Param("nextStatus") Integer nextStatus);

    @Update("UPDATE electronic_ticket SET status = #{nextStatus}, update_time = CURRENT_TIMESTAMP " +
            "WHERE id = #{id} AND status = #{expectedStatus}")
    int updateStatusOnlyIfCurrent(@Param("id") Long id,
                                  @Param("expectedStatus") Integer expectedStatus,
                                  @Param("nextStatus") Integer nextStatus);

    @Update("UPDATE electronic_ticket SET status = 3, invalid_reason = #{reason}, update_time = CURRENT_TIMESTAMP " +
            "WHERE order_id = #{orderId} AND status = 1")
    int invalidateUnusedByOrderId(@Param("orderId") Long orderId, @Param("reason") String reason);

    @Update({"<script>",
            "UPDATE electronic_ticket SET status = 3, invalid_reason = #{reason}, update_time = CURRENT_TIMESTAMP",
            "WHERE order_id = #{orderId} AND status = 1",
            "AND order_seat_id IN",
            "<foreach collection='orderSeatIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
            "</script>"})
    int invalidateUnusedByOrderSeatIds(@Param("orderId") Long orderId,
                                       @Param("orderSeatIds") List<Long> orderSeatIds,
                                       @Param("reason") String reason);

    @Update("WITH picked AS (" +
            "SELECT id FROM electronic_ticket WHERE order_id = #{orderId} AND status = 1 ORDER BY id LIMIT #{quantity}" +
            ") UPDATE electronic_ticket SET status = 3, invalid_reason = #{reason}, update_time = CURRENT_TIMESTAMP " +
            "WHERE id IN (SELECT id FROM picked)")
    int invalidateFirstUnusedByOrderId(@Param("orderId") Long orderId,
                                       @Param("quantity") Integer quantity,
                                       @Param("reason") String reason);
}
