package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.entity.Reservation;
import com.omni.ticket.service.ReservationService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 预约接口
 */
@RestController
@RequestMapping("/api/ticket")
public class ReservationController {

    private static final String BEARER_PREFIX = "Bearer ";

    private final ReservationService reservationService;

    public ReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    /**
     * 创建预约
     */
    @PostMapping("/reservations")
    public Result<Void> createReservation(@RequestHeader(value = "Authorization", required = false) String authorization,
                                          @RequestBody Map<String, Long> body) {
        Long userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        Long sessionId = body.get("sessionId");
        reservationService.createReservation(userId, sessionId);
        return Result.success();
    }

    /**
     * 我的预约列表
     */
    @GetMapping("/reservations")
    public Result<List<Reservation>> listReservations(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                      @RequestParam(required = false) Long userId) {
        userId = parseUserId(authorization);
        if (userId == null) return Result.fail(ResultCode.UNAUTHORIZED);
        List<Reservation> reservations = reservationService.listReservations(userId);
        return Result.success(reservations);
    }

    private Long parseUserId(String authorization) {
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) return null;
        try {
            return Long.valueOf(JwtUtil.parseToken(authorization.substring(BEARER_PREFIX.length())).getSubject());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
