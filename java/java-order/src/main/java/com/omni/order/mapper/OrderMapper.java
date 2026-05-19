package com.omni.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.order.dto.OrderListItemResponse;
import com.omni.order.entity.Order;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface OrderMapper extends BaseMapper<Order> {
    @Select("SELECT o.id, o.order_no AS orderNo, o.user_id AS userId, o.session_id AS sessionId, " +
            "o.ticket_type_id AS ticketTypeId, o.quantity, o.amount, o.status, o.create_time AS createTime, " +
            "o.update_time AS updateTime, a.id AS activityId, a.name AS activityName, a.poster AS activityPoster, " +
            "v.name AS venueName, s.start_time AS sessionTime, tt.name AS ticketName, tt.price AS unitPrice " +
            "FROM \"order\" o " +
            "LEFT JOIN session s ON s.id = o.session_id " +
            "LEFT JOIN activity a ON a.id = s.activity_id " +
            "LEFT JOIN venue v ON v.id = s.venue_id " +
            "LEFT JOIN ticket_type tt ON tt.id = o.ticket_type_id " +
            "WHERE o.user_id = #{userId} " +
            "ORDER BY o.create_time DESC")
    List<OrderListItemResponse> selectOrderListItems(Long userId);

    @Select({"<script>",
            "SELECT COUNT(*) FROM \"order\" WHERE status = 2",
            "AND session_id IN",
            "<foreach collection='sessionIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
            "</script>"})
    Long countPaidOrdersBySessions(@Param("sessionIds") List<Long> sessionIds);

    @Update("UPDATE \"order\" SET status = #{nextStatus}, update_time = CURRENT_TIMESTAMP WHERE id = #{id} AND status = #{expectedStatus}")
    int updateStatusIfCurrent(@Param("id") Long id,
                              @Param("expectedStatus") Integer expectedStatus,
                              @Param("nextStatus") Integer nextStatus);
}
