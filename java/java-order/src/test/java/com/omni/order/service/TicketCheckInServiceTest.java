package com.omni.order.service;

import com.omni.order.dto.TicketCheckInRecordResponse;
import com.omni.order.dto.TicketCheckInSyncRequest;
import com.omni.order.entity.CheckInDevice;
import com.omni.order.entity.ElectronicTicket;
import com.omni.order.entity.TicketCheckInRecord;
import com.omni.order.mapper.CheckInDeviceMapper;
import com.omni.order.mapper.ElectronicTicketMapper;
import com.omni.order.mapper.TicketCheckInRecordMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketCheckInServiceTest {

    @Mock
    private ElectronicTicketMapper electronicTicketMapper;

    @Mock
    private TicketCheckInRecordMapper recordMapper;

    @Mock
    private CheckInDeviceMapper deviceMapper;

    private TicketEntryCodeCodec codec;
    private TicketCheckInService service;

    @BeforeEach
    void setUp() {
        codec = new TicketEntryCodeCodec("ticket-check-in-test-secret");
        service = new TicketCheckInService(electronicTicketMapper, recordMapper, deviceMapper, codec);
    }

    @Test
    void syncCheckInRecordsSuccess() {
        String entryCode = codec.create(3001L, 2004L, 60).getEntryCode();
        TicketCheckInSyncRequest request = request("REQ-1", entryCode, "DEVICE-1", "INTERNAL_SYNC");
        when(recordMapper.selectByRequestId("REQ-1")).thenReturn(null);
        when(deviceMapper.selectByDeviceCode("DEVICE-1")).thenReturn(device("DEVICE-1", 1));
        when(electronicTicketMapper.selectByIdForUpdate(3001L)).thenReturn(ticket(3001L, 2004L, 9001L, 1));
        when(electronicTicketMapper.updateStatusIfCurrent(3001L, 1, 2)).thenReturn(1);

        TicketCheckInRecordResponse response = service.syncCheckIn(request);

        assertEquals("SUCCESS", response.getResult());
        assertEquals(3001L, response.getTicketId());
        ArgumentCaptor<TicketCheckInRecord> captor = ArgumentCaptor.forClass(TicketCheckInRecord.class);
        verify(recordMapper).insert(captor.capture());
        assertEquals("REQ-1", captor.getValue().getRequestId());
        assertEquals("SUCCESS", captor.getValue().getResult());
        assertEquals("DEVICE-1", captor.getValue().getDeviceCode());
        verify(electronicTicketMapper).updateStatusIfCurrent(3001L, 1, 2);
    }

    @Test
    void syncCheckInReturnsExistingRecordForSameRequestId() {
        TicketCheckInRecord existing = record("REQ-1", 3001L, "SUCCESS");
        when(recordMapper.selectByRequestId("REQ-1")).thenReturn(existing);

        TicketCheckInRecordResponse response = service.syncCheckIn(request("REQ-1", "entry-code", "DEVICE-1", "INTERNAL_SYNC"));

        assertEquals("SUCCESS", response.getResult());
        assertEquals(3001L, response.getTicketId());
        verify(electronicTicketMapper, never()).updateStatusIfCurrent(any(), any(), any());
        verify(recordMapper, never()).insert(any());
    }

    @Test
    void syncCheckInRecordsDuplicateForAlreadyCheckedTicket() {
        String entryCode = codec.create(3001L, 2004L, 60).getEntryCode();
        TicketCheckInSyncRequest request = request("REQ-2", entryCode, "DEVICE-1", "INTERNAL_SYNC");
        ElectronicTicket checked = ticket(3001L, 2004L, 9001L, 2);
        checked.setCheckedInAt(LocalDateTime.now().minusMinutes(5));
        when(recordMapper.selectByRequestId("REQ-2")).thenReturn(null);
        when(deviceMapper.selectByDeviceCode("DEVICE-1")).thenReturn(device("DEVICE-1", 1));
        when(electronicTicketMapper.selectByIdForUpdate(3001L)).thenReturn(checked);

        TicketCheckInRecordResponse response = service.syncCheckIn(request);

        assertEquals("DUPLICATE", response.getResult());
        assertEquals(3001L, response.getTicketId());
        ArgumentCaptor<TicketCheckInRecord> captor = ArgumentCaptor.forClass(TicketCheckInRecord.class);
        verify(recordMapper).insert(captor.capture());
        assertEquals("DUPLICATE", captor.getValue().getResult());
        verify(electronicTicketMapper, never()).updateStatusIfCurrent(any(), any(), any());
    }

    @Test
    void syncCheckInRecordsFailedForDisabledDevice() {
        String entryCode = codec.create(3001L, 2004L, 60).getEntryCode();
        TicketCheckInSyncRequest request = request("REQ-3", entryCode, "DEVICE-OFF", "INTERNAL_SYNC");
        when(recordMapper.selectByRequestId("REQ-3")).thenReturn(null);
        when(deviceMapper.selectByDeviceCode("DEVICE-OFF")).thenReturn(device("DEVICE-OFF", 0));

        TicketCheckInRecordResponse response = service.syncCheckIn(request);

        assertEquals("FAILED", response.getResult());
        assertEquals("核验设备已停用", response.getFailureReason());
        verify(electronicTicketMapper, never()).selectByIdForUpdate(any());
        verify(electronicTicketMapper, never()).updateStatusIfCurrent(any(), any(), any());
    }

    private TicketCheckInSyncRequest request(String requestId, String entryCode, String deviceCode, String channel) {
        TicketCheckInSyncRequest request = new TicketCheckInSyncRequest();
        request.setRequestId(requestId);
        request.setEntryCode(entryCode);
        request.setDeviceCode(deviceCode);
        request.setChannel(channel);
        request.setOperatorUserId(3008L);
        return request;
    }

    private CheckInDevice device(String deviceCode, int status) {
        CheckInDevice device = new CheckInDevice();
        device.setDeviceCode(deviceCode);
        device.setDeviceName("入口设备");
        device.setStatus(status);
        return device;
    }

    private ElectronicTicket ticket(Long id, Long userId, Long orderId, int status) {
        ElectronicTicket ticket = new ElectronicTicket();
        ticket.setId(id);
        ticket.setTicketNo("ET" + id);
        ticket.setUserId(userId);
        ticket.setOriginalUserId(userId);
        ticket.setOrderId(orderId);
        ticket.setSessionId(101L);
        ticket.setTicketTypeId(1L);
        ticket.setStatus(status);
        return ticket;
    }

    private TicketCheckInRecord record(String requestId, Long ticketId, String result) {
        TicketCheckInRecord record = new TicketCheckInRecord();
        record.setRequestId(requestId);
        record.setTicketId(ticketId);
        record.setTicketNo("ET" + ticketId);
        record.setOrderId(9001L);
        record.setUserId(2004L);
        record.setSessionId(101L);
        record.setTicketTypeId(1L);
        record.setChannel("INTERNAL_SYNC");
        record.setResult(result);
        record.setCheckedInAt(LocalDateTime.now());
        record.setCreateTime(LocalDateTime.now());
        return record;
    }
}
