package com.damai.ticket.controller;

import com.damai.common.result.Result;
import com.damai.ticket.entity.Reservation;
import com.damai.ticket.service.ReservationService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 预约接口
 */
@RestController
@RequestMapping("/api/ticket")
public class ReservationController {

    private final ReservationService reservationService;

    public ReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    /**
     * 创建预约
     */
    @PostMapping("/reservations")
    public Result<Void> createReservation(@RequestBody Map<String, Long> body) {
        Long userId = body.get("userId");
        Long sessionId = body.get("sessionId");
        reservationService.createReservation(userId, sessionId);
        return Result.success();
    }

    /**
     * 我的预约列表
     */
    @GetMapping("/reservations")
    public Result<List<Reservation>> listReservations(@RequestParam Long userId) {
        List<Reservation> reservations = reservationService.listReservations(userId);
        return Result.success(reservations);
    }
}
