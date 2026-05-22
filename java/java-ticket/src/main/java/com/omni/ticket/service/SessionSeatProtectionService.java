package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.SessionSeatUsageItemResponse;
import com.omni.ticket.dto.SessionSeatUsageRequest;
import com.omni.ticket.dto.SessionSeatUsageResponse;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class SessionSeatProtectionService {
    private final SessionSeatMapper sessionSeatMapper;
    private final OrderInternalClient orderInternalClient;
    private final String internalApiToken;

    public SessionSeatProtectionService(SessionSeatMapper sessionSeatMapper,
                                        OrderInternalClient orderInternalClient,
                                        @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.sessionSeatMapper = sessionSeatMapper;
        this.orderInternalClient = orderInternalClient;
        this.internalApiToken = internalApiToken;
    }

    public Set<Long> findProtectedSeatIds(Long sessionId) {
        if (sessionId == null) {
            return Collections.emptySet();
        }

        List<SessionSeat> seats = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, sessionId)
                .orderByAsc(SessionSeat::getId));
        if (seats == null || seats.isEmpty()) {
            return Collections.emptySet();
        }

        Set<Long> protectedSeatIds = seats.stream()
                .filter(this::isLocallyProtected)
                .map(SessionSeat::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        List<Long> seatIds = seats.stream()
                .filter(Objects::nonNull)
                .map(SessionSeat::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        if (seatIds.isEmpty()) {
            return protectedSeatIds;
        }
        if (orderInternalClient == null || !StringUtils.hasText(internalApiToken)) {
            throw orderUsageUnavailable();
        }

        SessionSeatUsageRequest request = new SessionSeatUsageRequest();
        request.setSessionSeatIds(seatIds);
        try {
            Result<SessionSeatUsageResponse> result = orderInternalClient.inspectSessionSeatUsage(request, internalApiToken);
            if (result == null || result.getCode() != 200 || result.getData() == null || result.getData().getSeats() == null) {
                throw orderUsageUnavailable();
            }
            for (SessionSeatUsageItemResponse item : result.getData().getSeats()) {
                if (item != null && item.getSessionSeatId() != null
                        && (Boolean.TRUE.equals(item.getUsedByOrder()) || Boolean.FALSE.equals(item.getEditable()))) {
                    protectedSeatIds.add(item.getSessionSeatId());
                }
            }
        } catch (BusinessException e) {
            throw e;
        } catch (RuntimeException e) {
            throw orderUsageUnavailable();
        }
        return protectedSeatIds;
    }

    private BusinessException orderUsageUnavailable() {
        return new BusinessException(503, "无法确认订单座位占用状态，请稍后重试。");
    }

    private boolean isLocallyProtected(SessionSeat seat) {
        return seat != null && seat.getId() != null
                && (Integer.valueOf(2).equals(seat.getStatus())
                || Integer.valueOf(3).equals(seat.getStatus())
                || seat.getOrderId() != null);
    }
}
