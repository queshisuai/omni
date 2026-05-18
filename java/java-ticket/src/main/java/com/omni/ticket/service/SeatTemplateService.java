package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatTemplateResponse;
import com.omni.ticket.entity.UserRef;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.entity.VenueArea;
import com.omni.ticket.entity.VenueSeat;
import com.omni.ticket.mapper.UserRefMapper;
import com.omni.ticket.mapper.VenueAreaMapper;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.mapper.VenueSeatMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class SeatTemplateService {
    private final VenueMapper venueMapper;
    private final VenueAreaMapper venueAreaMapper;
    private final VenueSeatMapper venueSeatMapper;
    private final UserRefMapper userRefMapper;

    public SeatTemplateService(VenueMapper venueMapper,
                               VenueAreaMapper venueAreaMapper,
                               VenueSeatMapper venueSeatMapper,
                               UserRefMapper userRefMapper) {
        this.venueMapper = venueMapper;
        this.venueAreaMapper = venueAreaMapper;
        this.venueSeatMapper = venueSeatMapper;
        this.userRefMapper = userRefMapper;
    }

    public SeatTemplateResponse createArea(Map<String, Object> body) {
        requireAdmin(toLong(body.get("userId")));
        Long venueId = toLong(body.get("venueId"));
        Venue venue = venueMapper.selectById(venueId);
        if (venue == null || !Integer.valueOf(1).equals(venue.getStatus())) {
            throw new BusinessException(400, "场馆不存在或已停用");
        }
        VenueArea area = new VenueArea();
        area.setVenueId(venueId);
        area.setName(trim(body.get("name")));
        area.setRowCount(toPositiveInt(body.get("rowCount"), "排数必须大于0"));
        area.setSeatsPerRow(toPositiveInt(body.get("seatsPerRow"), "每排座位数必须大于0"));
        area.setRowStart(body.get("rowStart") == null ? 1 : toPositiveInt(body.get("rowStart"), "起始排号必须大于0"));
        area.setSeatStart(body.get("seatStart") == null ? 1 : toPositiveInt(body.get("seatStart"), "起始座号必须大于0"));
        area.setColor(trim(body.get("color")) == null ? "#ff1268" : trim(body.get("color")));
        area.setSort(body.get("sort") == null ? 0 : Integer.valueOf(body.get("sort").toString()));
        area.setStatus(1);
        area.setCreateTime(LocalDateTime.now());
        area.setUpdateTime(LocalDateTime.now());
        venueAreaMapper.insert(area);
        int count = generateSeats(area);
        return new SeatTemplateResponse(area, count);
    }

    public List<VenueArea> listAreas(Long userId, Long venueId) {
        requireConsoleUser(userId);
        return venueAreaMapper.selectList(new LambdaQueryWrapper<VenueArea>()
                .eq(VenueArea::getVenueId, venueId)
                .orderByAsc(VenueArea::getSort)
                .orderByAsc(VenueArea::getId));
    }

    public List<VenueSeat> listSeats(Long userId, Long venueId) {
        requireAdmin(userId);
        return venueSeatMapper.selectList(new LambdaQueryWrapper<VenueSeat>()
                .eq(VenueSeat::getVenueId, venueId)
                .orderByAsc(VenueSeat::getAreaId)
                .orderByAsc(VenueSeat::getRowNo)
                .orderByAsc(VenueSeat::getSeatNo));
    }

    private int generateSeats(VenueArea area) {
        int count = 0;
        for (int rowIndex = 0; rowIndex < area.getRowCount(); rowIndex++) {
            int rowNo = area.getRowStart() + rowIndex;
            for (int seatIndex = 0; seatIndex < area.getSeatsPerRow(); seatIndex++) {
                int seatNo = area.getSeatStart() + seatIndex;
                VenueSeat seat = new VenueSeat();
                seat.setVenueId(area.getVenueId());
                seat.setAreaId(area.getId());
                seat.setRowNo(rowNo);
                seat.setSeatNo(seatNo);
                seat.setSeatLabel(rowNo + "排" + seatNo + "座");
                seat.setX(seatIndex * 32);
                seat.setY(rowIndex * 32);
                seat.setStatus(1);
                seat.setCreateTime(LocalDateTime.now());
                venueSeatMapper.insert(seat);
                count++;
            }
        }
        return count;
    }

    private void requireAdmin(Long userId) {
        UserRef user = userRefMapper.selectById(userId);
        if (user == null || !"admin".equals(user.getRole())) {
            throw new BusinessException(403, "仅平台管理员可配置座位模板");
        }
    }

    private void requireConsoleUser(Long userId) {
        UserRef user = userRefMapper.selectById(userId);
        if (user == null || (!"admin".equals(user.getRole()) && !"organizer".equals(user.getRole()))) {
            throw new BusinessException(403, "无权限");
        }
    }

    private Long toLong(Object value) {
        if (value == null) {
            throw new BusinessException(400, "参数不能为空");
        }
        return Long.valueOf(value.toString());
    }

    private Integer toPositiveInt(Object value, String message) {
        if (value == null) {
            throw new BusinessException(400, message);
        }
        int number = Integer.parseInt(value.toString());
        if (number <= 0) {
            throw new BusinessException(400, message);
        }
        return number;
    }

    private String trim(Object value) {
        return value == null ? null : value.toString().trim();
    }
}
