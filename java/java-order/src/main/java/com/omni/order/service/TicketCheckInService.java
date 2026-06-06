package com.omni.order.service;

import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.order.dto.TicketCheckInOverviewRequest;
import com.omni.order.dto.TicketCheckInOverviewResponse;
import com.omni.order.dto.TicketCheckInRecordQueryRequest;
import com.omni.order.dto.TicketCheckInRecordResponse;
import com.omni.order.dto.TicketCheckInSyncRequest;
import com.omni.order.entity.CheckInDevice;
import com.omni.order.entity.ElectronicTicket;
import com.omni.order.entity.TicketCheckInRecord;
import com.omni.order.mapper.CheckInDeviceMapper;
import com.omni.order.mapper.ElectronicTicketMapper;
import com.omni.order.mapper.TicketCheckInRecordMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TicketCheckInService {
    public static final String CHANNEL_INTERNAL_SYNC = "INTERNAL_SYNC";
    public static final String RESULT_SUCCESS = "SUCCESS";
    public static final String RESULT_DUPLICATE = "DUPLICATE";
    public static final String RESULT_FAILED = "FAILED";

    private final ElectronicTicketMapper electronicTicketMapper;
    private final TicketCheckInRecordMapper recordMapper;
    private final CheckInDeviceMapper deviceMapper;
    private final TicketEntryCodeCodec entryCodeCodec;

    public TicketCheckInService(ElectronicTicketMapper electronicTicketMapper,
                                TicketCheckInRecordMapper recordMapper,
                                CheckInDeviceMapper deviceMapper,
                                TicketEntryCodeCodec entryCodeCodec) {
        this.electronicTicketMapper = electronicTicketMapper;
        this.recordMapper = recordMapper;
        this.deviceMapper = deviceMapper;
        this.entryCodeCodec = entryCodeCodec;
    }

    @Transactional(rollbackFor = Exception.class)
    public TicketCheckInRecordResponse syncCheckIn(TicketCheckInSyncRequest request) {
        if (request == null || !StringUtils.hasText(request.getRequestId())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "核验请求无效");
        }
        TicketCheckInRecord existing = recordMapper.selectByRequestId(request.getRequestId());
        if (existing != null) {
            return toResponse(existing);
        }

        String channel = normalizeChannel(request.getChannel());
        String deviceFailure = validateDevice(request.getDeviceCode());
        if (deviceFailure != null) {
            return insertFailure(request, channel, null, deviceFailure);
        }

        try {
            TicketEntryCodeCodec.CodePayload payload = entryCodeCodec.parseAndVerify(request.getEntryCode());
            ElectronicTicket ticket = electronicTicketMapper.selectByIdForUpdate(payload.getTicketId());
            if (ticket == null || !payload.getUserId().equals(ticket.getUserId())) {
                return insertFailure(request, channel, null, "电子票不存在");
            }
            if (Integer.valueOf(TicketWalletService.STATUS_CHECKED_IN).equals(ticket.getStatus())) {
                return insertRecord(request, channel, ticket, RESULT_DUPLICATE, null, ticket.getCheckedInAt());
            }
            if (!Integer.valueOf(TicketWalletService.STATUS_UNUSED).equals(ticket.getStatus())) {
                return insertFailure(request, channel, ticket, "电子票状态不允许核销");
            }
            int updated = electronicTicketMapper.updateStatusIfCurrent(
                    ticket.getId(), TicketWalletService.STATUS_UNUSED, TicketWalletService.STATUS_CHECKED_IN);
            if (updated != 1) {
                return insertFailure(request, channel, ticket, "电子票状态已变化");
            }
            return insertRecord(request, channel, ticket, RESULT_SUCCESS, null, LocalDateTime.now());
        } catch (BusinessException e) {
            return insertFailure(request, channel, null, e.getMessage());
        }
    }

    public List<TicketCheckInRecordResponse> listRecords(TicketCheckInRecordQueryRequest request) {
        Long sessionId = request != null ? request.getSessionId() : null;
        if (sessionId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场次信息无效");
        }
        int page = request.getPage() == null || request.getPage() < 1 ? 1 : request.getPage();
        int size = request.getSize() == null || request.getSize() < 1 ? 20 : Math.min(request.getSize(), 100);
        int offset = (page - 1) * size;
        return recordMapper.selectRecords(sessionId, request.getResult(), offset, size);
    }

    public TicketCheckInOverviewResponse getOverview(TicketCheckInOverviewRequest request) {
        Long sessionId = request != null ? request.getSessionId() : null;
        if (sessionId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场次信息无效");
        }
        TicketCheckInOverviewResponse overview = recordMapper.selectOverview(sessionId);
        if (overview != null) {
            return overview;
        }
        TicketCheckInOverviewResponse empty = new TicketCheckInOverviewResponse();
        empty.setSessionId(sessionId);
        empty.setTotalTickets(0L);
        empty.setCheckedInCount(0L);
        empty.setUnusedCount(0L);
        empty.setFailedCount(0L);
        empty.setDuplicateCount(0L);
        return empty;
    }

    private String validateDevice(String deviceCode) {
        if (!StringUtils.hasText(deviceCode) || deviceMapper == null) {
            return null;
        }
        CheckInDevice device = deviceMapper.selectByDeviceCode(deviceCode);
        if (device == null) {
            return "核验设备不存在";
        }
        if (!Integer.valueOf(1).equals(device.getStatus())) {
            return "核验设备已停用";
        }
        return null;
    }

    private TicketCheckInRecordResponse insertFailure(TicketCheckInSyncRequest request,
                                                      String channel,
                                                      ElectronicTicket ticket,
                                                      String reason) {
        return insertRecord(request, channel, ticket, RESULT_FAILED, reason, null);
    }

    private TicketCheckInRecordResponse insertRecord(TicketCheckInSyncRequest request,
                                                    String channel,
                                                    ElectronicTicket ticket,
                                                    String result,
                                                    String failureReason,
                                                    LocalDateTime checkedInAt) {
        TicketCheckInRecord record = new TicketCheckInRecord();
        record.setRequestId(request.getRequestId());
        record.setTicketId(ticket != null ? ticket.getId() : null);
        record.setTicketNo(ticket != null ? ticket.getTicketNo() : null);
        record.setOrderId(ticket != null ? ticket.getOrderId() : null);
        record.setUserId(ticket != null ? ticket.getUserId() : null);
        record.setSessionId(ticket != null ? ticket.getSessionId() : null);
        record.setTicketTypeId(ticket != null ? ticket.getTicketTypeId() : null);
        record.setDeviceCode(request.getDeviceCode());
        record.setOperatorUserId(request.getOperatorUserId());
        record.setChannel(channel);
        record.setResult(result);
        record.setFailureReason(failureReason);
        record.setCheckedInAt(checkedInAt);
        record.setCreateTime(LocalDateTime.now());
        recordMapper.insert(record);
        return toResponse(record);
    }

    private TicketCheckInRecordResponse toResponse(TicketCheckInRecord record) {
        TicketCheckInRecordResponse response = new TicketCheckInRecordResponse();
        response.setId(record.getId());
        response.setRequestId(record.getRequestId());
        response.setTicketId(record.getTicketId());
        response.setTicketNo(record.getTicketNo());
        response.setOrderId(record.getOrderId());
        response.setUserId(record.getUserId());
        response.setSessionId(record.getSessionId());
        response.setTicketTypeId(record.getTicketTypeId());
        response.setDeviceCode(record.getDeviceCode());
        response.setOperatorUserId(record.getOperatorUserId());
        response.setChannel(record.getChannel());
        response.setResult(record.getResult());
        response.setFailureReason(record.getFailureReason());
        response.setCheckedInAt(record.getCheckedInAt());
        response.setCreateTime(record.getCreateTime());
        return response;
    }

    private String normalizeChannel(String channel) {
        return StringUtils.hasText(channel) ? channel : CHANNEL_INTERNAL_SYNC;
    }
}
