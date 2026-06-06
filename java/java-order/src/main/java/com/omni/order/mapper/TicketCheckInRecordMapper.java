package com.omni.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.order.dto.TicketCheckInOverviewResponse;
import com.omni.order.dto.TicketCheckInRecordResponse;
import com.omni.order.entity.TicketCheckInRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TicketCheckInRecordMapper extends BaseMapper<TicketCheckInRecord> {

    @Select("SELECT * FROM ticket_check_in_record WHERE request_id = #{requestId}")
    TicketCheckInRecord selectByRequestId(@Param("requestId") String requestId);

    @Select({"<script>",
            "SELECT id, request_id AS requestId, ticket_id AS ticketId, ticket_no AS ticketNo, order_id AS orderId,",
            "user_id AS userId, session_id AS sessionId, ticket_type_id AS ticketTypeId, device_code AS deviceCode,",
            "operator_user_id AS operatorUserId, channel, result, failure_reason AS failureReason,",
            "checked_in_at AS checkedInAt, create_time AS createTime",
            "FROM ticket_check_in_record",
            "WHERE session_id = #{sessionId}",
            "<if test='result != null and result != \"\"'>AND result = #{result}</if>",
            "ORDER BY create_time DESC, id DESC LIMIT #{size} OFFSET #{offset}",
            "</script>"})
    List<TicketCheckInRecordResponse> selectRecords(@Param("sessionId") Long sessionId,
                                                    @Param("result") String result,
                                                    @Param("offset") int offset,
                                                    @Param("size") int size);

    @Select("SELECT #{sessionId} AS sessionId, " +
            "COALESCE(COUNT(et.id), 0) AS totalTickets, " +
            "COALESCE(SUM(CASE WHEN et.status = 2 THEN 1 ELSE 0 END), 0) AS checkedInCount, " +
            "COALESCE(SUM(CASE WHEN et.status = 1 THEN 1 ELSE 0 END), 0) AS unusedCount, " +
            "COALESCE((SELECT COUNT(*) FROM ticket_check_in_record r WHERE r.session_id = #{sessionId} AND r.result = 'FAILED'), 0) AS failedCount, " +
            "COALESCE((SELECT COUNT(*) FROM ticket_check_in_record r WHERE r.session_id = #{sessionId} AND r.result = 'DUPLICATE'), 0) AS duplicateCount " +
            "FROM electronic_ticket et WHERE et.session_id = #{sessionId}")
    TicketCheckInOverviewResponse selectOverview(@Param("sessionId") Long sessionId);
}
