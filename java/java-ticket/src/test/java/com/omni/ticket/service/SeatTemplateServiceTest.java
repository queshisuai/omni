package com.omni.ticket.service;

import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.dto.VenueSeatRequest;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.entity.VenueSeat;
import com.omni.ticket.mapper.VenueAreaMapper;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.mapper.VenueSeatMapper;
import com.omni.ticket.service.UserAccessService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import com.omni.exception.BusinessException;

@ExtendWith(MockitoExtension.class)
class SeatTemplateServiceTest {

    @Mock
    private VenueMapper venueMapper;
    @Mock
    private VenueAreaMapper venueAreaMapper;
    @Mock
    private VenueSeatMapper venueSeatMapper;
    @Mock
    private UserAccessService userAccessService;

    private SeatTemplateService service;

    @BeforeEach
    void setUp() {
        service = new SeatTemplateService(venueMapper, venueAreaMapper, venueSeatMapper, userAccessService);
    }

    @Test
    void createAreaGeneratesSeatTemplateForAllRowsAndSeats() {
        setupAdminUser();
        when(venueMapper.selectById(1L)).thenReturn(venue(1L));

        Map<String, Object> body = new HashMap<>();
        body.put("userId", 2002L);
        body.put("venueId", 1L);
        body.put("name", "A区");
        body.put("rowCount", 2);
        body.put("seatsPerRow", 3);
        body.put("rowStart", 1);
        body.put("seatStart", 1);
        body.put("color", "#ff1268");
        body.put("sort", 1);

        assertEquals(6, service.createArea(body).getGeneratedSeatCount());
        verify(venueAreaMapper).insert(any());
        verify(venueSeatMapper, times(6)).insert(any());
    }

    @Test
    void updateSeatUpdatesEditableFieldsById() {
        setupAdminUser();
        when(venueSeatMapper.selectById(9L)).thenReturn(seat(9L));
        when(venueMapper.selectById(1L)).thenReturn(venue(1L));
        when(venueAreaMapper.selectById(12L)).thenReturn(area(12L, 1L));

        VenueSeatRequest request = new VenueSeatRequest();
        request.setUserId(2002L);
        request.setVenueId(1L);
        request.setAreaId(12L);
        request.setRowNo(3);
        request.setSeatNo(8);
        request.setSeatLabel("VIP-3-8");
        request.setX(96);
        request.setY(64);
        request.setStatus(0);

        VenueSeat updated = service.updateSeat(9L, request);

        assertEquals(3, updated.getRowNo());
        assertEquals(8, updated.getSeatNo());
        assertEquals("VIP-3-8", updated.getSeatLabel());
        assertEquals(96, updated.getX());
        assertEquals(64, updated.getY());
        assertEquals(0, updated.getStatus());
        verify(venueSeatMapper).updateById(argThat(seat ->
                Long.valueOf(9L).equals(seat.getId())
                        && Integer.valueOf(3).equals(seat.getRowNo())
                        && Integer.valueOf(8).equals(seat.getSeatNo())
                        && "VIP-3-8".equals(seat.getSeatLabel())
                        && Integer.valueOf(96).equals(seat.getX())
                        && Integer.valueOf(64).equals(seat.getY())
                        && Integer.valueOf(0).equals(seat.getStatus())));
    }

    @Test
    void updateSeatRejectsMovingSeatToAnotherVenue() {
        setupAdminUser();
        when(venueSeatMapper.selectById(9L)).thenReturn(seat(9L));
        when(venueMapper.selectById(2L)).thenReturn(venue(2L));
        when(venueAreaMapper.selectById(21L)).thenReturn(area(21L, 2L));
        VenueSeatRequest request = validSeatRequest();
        request.setVenueId(2L);
        request.setAreaId(21L);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.updateSeat(9L, request));

        assertEquals(400, exception.getCode());
        assertEquals("座位不能切换场馆", exception.getMessage());
    }

    @Test
    void createSeatReactivatesDisabledSeatAtSamePosition() {
        setupAdminUser();
        when(venueMapper.selectById(1L)).thenReturn(venue(1L));
        when(venueAreaMapper.selectById(11L)).thenReturn(area(11L, 1L));
        VenueSeat disabled = seat(9L);
        disabled.setStatus(0);
        when(venueSeatMapper.selectList(any())).thenReturn(java.util.List.of(), java.util.List.of(disabled));

        VenueSeatRequest request = validSeatRequest();
        request.setSeatLabel("恢复座位");
        VenueSeat restored = service.createSeat(request);

        assertEquals(9L, restored.getId());
        assertEquals(1, restored.getStatus());
        assertEquals("恢复座位", restored.getSeatLabel());
        verify(venueSeatMapper).updateById(disabled);
    }

    @Test
    void createSeatRejectsActiveSeatAtSamePosition() {
        setupAdminUser();
        when(venueMapper.selectById(1L)).thenReturn(venue(1L));
        when(venueAreaMapper.selectById(11L)).thenReturn(area(11L, 1L));
        when(venueSeatMapper.selectList(any())).thenReturn(java.util.List.of(seat(9L)));

        BusinessException exception = assertThrows(BusinessException.class, () -> service.createSeat(validSeatRequest()));

        assertEquals(400, exception.getCode());
        assertEquals("同区域排座已存在", exception.getMessage());
    }

    @Test
    void createSeatRejectsInvalidUserIdAsBadRequest() {
        VenueSeatRequest request = validSeatRequest();
        request.setUserId(-1L);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.createSeat(request));

        assertEquals(400, exception.getCode());
        assertEquals("用户ID不正确", exception.getMessage());
    }

    @Test
    void updateSeatRejectsInvalidUserIdAsBadRequest() {
        VenueSeatRequest request = validSeatRequest();
        request.setUserId(null);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.updateSeat(9L, request));

        assertEquals(400, exception.getCode());
        assertEquals("用户ID不正确", exception.getMessage());
    }

    @Test
    void deleteSeatRejectsInvalidUserIdAsBadRequest() {
        BusinessException exception = assertThrows(BusinessException.class, () -> service.deleteSeat(0L, 9L));

        assertEquals(400, exception.getCode());
        assertEquals("用户ID不正确", exception.getMessage());
    }

    @Test
    void createSeatRejectsStatusOutsideZeroOrOne() {
        setupAdminUser();
        VenueSeatRequest request = validSeatRequest();
        request.setStatus(2);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.createSeat(request));

        assertEquals(400, exception.getCode());
        assertEquals("座位状态不正确", exception.getMessage());
    }

    @Test
    void deleteSeatDisablesSeatInsteadOfPhysicalDelete() {
        setupAdminUser();
        when(venueSeatMapper.selectById(9L)).thenReturn(seat(9L));

        VenueSeat deleted = service.deleteSeat(2002L, 9L);

        assertEquals(0, deleted.getStatus());
        verify(venueSeatMapper).updateById(argThat(seat -> Long.valueOf(9L).equals(seat.getId()) && Integer.valueOf(0).equals(seat.getStatus())));
    }

    private void setupAdminUser() {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(2002L);
        user.setRole("admin");
        when(userAccessService.requireUser(2002L)).thenReturn(user);
        when(userAccessService.isAdmin(user)).thenReturn(true);
    }

    private Venue venue(Long id) {
        Venue venue = new Venue();
        venue.setId(id);
        venue.setStatus(1);
        return venue;
    }

    private VenueSeat seat(Long id) {
        VenueSeat seat = new VenueSeat();
        seat.setId(id);
        seat.setVenueId(1L);
        seat.setAreaId(11L);
        seat.setRowNo(1);
        seat.setSeatNo(1);
        seat.setSeatLabel("1排1座");
        seat.setX(0);
        seat.setY(0);
        seat.setStatus(1);
        return seat;
    }

    private com.omni.ticket.entity.VenueArea area(Long id, Long venueId) {
        com.omni.ticket.entity.VenueArea area = new com.omni.ticket.entity.VenueArea();
        area.setId(id);
        area.setVenueId(venueId);
        area.setStatus(1);
        return area;
    }

    private VenueSeatRequest validSeatRequest() {
        VenueSeatRequest request = new VenueSeatRequest();
        request.setUserId(2002L);
        request.setVenueId(1L);
        request.setAreaId(11L);
        request.setRowNo(1);
        request.setSeatNo(1);
        request.setX(0);
        request.setY(0);
        request.setStatus(1);
        return request;
    }
}
