package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.entity.Reservation;
import com.omni.ticket.service.ReservationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReservationControllerTest {

    @Mock
    private ReservationService reservationService;

    @Test
    void createReservationUsesAuthorizationToken() {
        ReservationController controller = new ReservationController(reservationService);

        Result<Void> result = controller.createReservation(token(), Map.of("userId", 9999L, "sessionId", 10L));

        assertEquals(200, result.getCode());
        verify(reservationService).createReservation(2004L, 10L);
        verify(reservationService, never()).createReservation(9999L, 10L);
    }

    @Test
    void listReservationsUsesAuthorizationToken() {
        ReservationController controller = new ReservationController(reservationService);
        Reservation reservation = new Reservation();
        reservation.setUserId(2004L);
        when(reservationService.listReservations(2004L)).thenReturn(List.of(reservation));

        Result<List<Reservation>> result = controller.listReservations(token(), 9999L);

        assertEquals(200, result.getCode());
        assertEquals(1, result.getData().size());
        verify(reservationService).listReservations(2004L);
        verify(reservationService, never()).listReservations(9999L);
    }

    @Test
    void listReservationsRejectsMissingAuthorization() {
        ReservationController controller = new ReservationController(reservationService);

        Result<List<Reservation>> result = controller.listReservations(null, 9999L);

        assertEquals(401, result.getCode());
        verify(reservationService, never()).listReservations(9999L);
    }

    private String token() {
        return "Bearer " + JwtUtil.generateToken(2004L, "13800000004", "user");
    }
}
