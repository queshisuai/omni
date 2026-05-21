package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.mapper.SessionSeatMapper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

@Service
public class SeatCraftLegacyLayoutMigrationService {

    private final SessionSeatMapper sessionSeatMapper;

    public SeatCraftLegacyLayoutMigrationService(SessionSeatMapper sessionSeatMapper) {
        this.sessionSeatMapper = sessionSeatMapper;
    }

    public SeatCraftLayoutDtos.LayoutResponse buildFromLegacySeats(Long sessionId) {
        List<SessionSeat> seats = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, sessionId)
                .orderByAsc(SessionSeat::getRowNo)
                .orderByAsc(SessionSeat::getSeatNo)
                .orderByAsc(SessionSeat::getId));

        SeatCraftLayoutDtos.LayoutResponse layout = new SeatCraftLayoutDtos.LayoutResponse();
        layout.setSessionId(sessionId);
        layout.setName("历史座位图");
        layout.setTemplateType("legacy-migrated");
        layout.setStageTitle("舞台");
        layout.setStageX(360);
        layout.setStageY(40);
        layout.setCanvasWidth(960);
        layout.setCanvasHeight(720);
        if (seats == null || seats.isEmpty()) {
            return layout;
        }

        int maxRow = seats.stream().map(SessionSeat::getRowNo).filter(Objects::nonNull).max(Integer::compareTo).orElse(1);
        int maxCol = seats.stream().map(SessionSeat::getSeatNo).filter(Objects::nonNull).max(Integer::compareTo).orElse(seats.size());
        Long ticketTypeId = seats.stream()
                .map(SessionSeat::getTicketTypeId)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);

        SeatCraftLayoutDtos.SectionResponse section = new SeatCraftLayoutDtos.SectionResponse();
        section.setId(0L);
        section.setSectionKey("legacy-default");
        section.setName("默认区域");
        section.setRows(maxRow);
        section.setCols(maxCol);
        section.setX(160);
        section.setY(160);
        section.setColor("#7c3aed");
        section.setType("seats");
        section.setLayout("grid");
        section.setRadius(0);
        section.setArcSpan(0);
        section.setRotation(0);
        section.setPrimeRowStart(1);
        section.setPrimeRowEnd(maxRow);
        section.setPrimeColStart(1);
        section.setPrimeColEnd(maxCol);
        section.setSort(1);
        section.setSeatCount((int) seats.stream().filter(seat -> Integer.valueOf(1).equals(seat.getStatus())).count());
        section.setTicketTypeId(ticketTypeId);
        layout.getSections().add(section);
        return layout;
    }
}
