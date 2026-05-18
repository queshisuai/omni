package com.omni.ticket.service;

import com.omni.ticket.entity.UserRef;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.mapper.UserRefMapper;
import com.omni.ticket.mapper.VenueAreaMapper;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.mapper.VenueSeatMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeatTemplateServiceTest {

    @Mock
    private VenueMapper venueMapper;
    @Mock
    private VenueAreaMapper venueAreaMapper;
    @Mock
    private VenueSeatMapper venueSeatMapper;
    @Mock
    private UserRefMapper userRefMapper;

    private SeatTemplateService service;

    @BeforeEach
    void setUp() {
        service = new SeatTemplateService(venueMapper, venueAreaMapper, venueSeatMapper, userRefMapper);
    }

    @Test
    void createAreaGeneratesSeatTemplateForAllRowsAndSeats() {
        when(userRefMapper.selectById(2002L)).thenReturn(user(2002L, "admin"));
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

    private UserRef user(Long id, String role) {
        UserRef user = new UserRef();
        user.setId(id);
        user.setRole(role);
        return user;
    }

    private Venue venue(Long id) {
        Venue venue = new Venue();
        venue.setId(id);
        venue.setStatus(1);
        return venue;
    }
}
