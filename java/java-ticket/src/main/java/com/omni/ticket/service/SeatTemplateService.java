package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.VenueSeatRequest;
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

    public VenueSeat createSeat(VenueSeatRequest request) {
        validateSeatUserId(request == null ? null : request.getUserId());
        requireAdmin(request.getUserId());
        validateSeatRequest(request);
        ensureNoActiveSeatConflict(null, request.getAreaId(), request.getRowNo(), request.getSeatNo());
        VenueSeat disabledSeat = findDisabledSeat(request.getAreaId(), request.getRowNo(), request.getSeatNo());
        if (disabledSeat != null) {
            applySeatRequest(disabledSeat, request, true);
            disabledSeat.setStatus(request.getStatus() == null ? 1 : request.getStatus());
            venueSeatMapper.updateById(disabledSeat);
            return disabledSeat;
        }
        VenueSeat seat = new VenueSeat();
        applySeatRequest(seat, request, true);
        seat.setCreateTime(LocalDateTime.now());
        venueSeatMapper.insert(seat);
        return seat;
    }

    public VenueSeat updateSeat(Long seatId, VenueSeatRequest request) {
        validateSeatUserId(request == null ? null : request.getUserId());
        requireAdmin(request.getUserId());
        Long validSeatId = requirePositiveLong(seatId, "座位ID不正确");
        validateSeatRequest(request);
        VenueSeat seat = venueSeatMapper.selectById(validSeatId);
        if (seat == null) {
            throw new BusinessException(404, "座位不存在");
        }
        if (!request.getVenueId().equals(seat.getVenueId())) {
            throw new BusinessException(400, "座位不能切换场馆");
        }
        ensureNoActiveSeatConflict(validSeatId, request.getAreaId(), request.getRowNo(), request.getSeatNo());
        applySeatRequest(seat, request, false);
        venueSeatMapper.updateById(seat);
        return seat;
    }

    public VenueSeat deleteSeat(Long userId, Long seatId) {
        validateSeatUserId(userId);
        requireAdmin(userId);
        Long validSeatId = requirePositiveLong(seatId, "座位ID不正确");
        VenueSeat seat = venueSeatMapper.selectById(validSeatId);
        if (seat == null) {
            throw new BusinessException(404, "座位不存在");
        }
        seat.setStatus(0);
        venueSeatMapper.updateById(seat);
        return seat;
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

    private void validateSeatRequest(VenueSeatRequest request) {
        if (request == null) {
            throw new BusinessException(400, "参数不能为空");
        }
        requirePositiveLong(request.getVenueId(), "场馆ID不正确");
        requirePositiveLong(request.getAreaId(), "区域ID不正确");
        requirePositiveInt(request.getRowNo(), "排号必须大于0");
        requirePositiveInt(request.getSeatNo(), "座号必须大于0");
        requireNonNegativeInt(request.getX(), "横坐标不能小于0");
        requireNonNegativeInt(request.getY(), "纵坐标不能小于0");
        if (request.getStatus() != null && !Integer.valueOf(0).equals(request.getStatus()) && !Integer.valueOf(1).equals(request.getStatus())) {
            throw new BusinessException(400, "座位状态不正确");
        }
        Venue venue = venueMapper.selectById(request.getVenueId());
        if (venue == null || !Integer.valueOf(1).equals(venue.getStatus())) {
            throw new BusinessException(400, "场馆不存在或已停用");
        }
        VenueArea area = venueAreaMapper.selectById(request.getAreaId());
        if (area == null || !request.getVenueId().equals(area.getVenueId())) {
            throw new BusinessException(400, "区域不存在或不属于该场馆");
        }
    }

    private void validateSeatUserId(Long userId) {
        if (userId == null || userId <= 0) {
            throw new BusinessException(400, "用户ID不正确");
        }
    }

    private void applySeatRequest(VenueSeat seat, VenueSeatRequest request, boolean creating) {
        seat.setVenueId(request.getVenueId());
        seat.setAreaId(request.getAreaId());
        seat.setRowNo(request.getRowNo());
        seat.setSeatNo(request.getSeatNo());
        String label = trim(request.getSeatLabel());
        seat.setSeatLabel(label == null || label.isEmpty() ? request.getRowNo() + "排" + request.getSeatNo() + "座" : label);
        seat.setX(request.getX() == null ? 0 : request.getX());
        seat.setY(request.getY() == null ? 0 : request.getY());
        if (request.getStatus() != null) {
            seat.setStatus(request.getStatus());
        } else if (creating) {
            seat.setStatus(1);
        }
    }

    private VenueSeat findDisabledSeat(Long areaId, Integer rowNo, Integer seatNo) {
        List<VenueSeat> seats = venueSeatMapper.selectList(new LambdaQueryWrapper<VenueSeat>()
                .eq(VenueSeat::getAreaId, areaId)
                .eq(VenueSeat::getRowNo, rowNo)
                .eq(VenueSeat::getSeatNo, seatNo)
                .eq(VenueSeat::getStatus, 0));
        return seats == null || seats.isEmpty() ? null : seats.get(0);
    }

    private void ensureNoActiveSeatConflict(Long currentSeatId, Long areaId, Integer rowNo, Integer seatNo) {
        List<VenueSeat> seats = venueSeatMapper.selectList(new LambdaQueryWrapper<VenueSeat>()
                .eq(VenueSeat::getAreaId, areaId)
                .eq(VenueSeat::getRowNo, rowNo)
                .eq(VenueSeat::getSeatNo, seatNo)
                .eq(VenueSeat::getStatus, 1));
        if (seats == null || seats.isEmpty()) {
            return;
        }
        boolean conflict = seats.stream().anyMatch(seat -> currentSeatId == null || !currentSeatId.equals(seat.getId()));
        if (conflict) {
            throw new BusinessException(400, "同区域排座已存在");
        }
    }

    private Long requirePositiveLong(Long value, String message) {
        if (value == null || value <= 0) {
            throw new BusinessException(400, message);
        }
        return value;
    }

    private Integer requirePositiveInt(Integer value, String message) {
        if (value == null || value <= 0) {
            throw new BusinessException(400, message);
        }
        return value;
    }

    private void requireNonNegativeInt(Integer value, String message) {
        if (value != null && value < 0) {
            throw new BusinessException(400, message);
        }
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
