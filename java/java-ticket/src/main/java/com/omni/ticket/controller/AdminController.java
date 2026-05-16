package com.omni.ticket.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.result.Result;
import com.omni.ticket.entity.*;
import com.omni.ticket.mapper.*;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * B端管理接口 - 角色分级权限
 * admin（平台管理员）：全部数据增删改查
 * organizer（商户/主办方）：只能管理自己上传的活动，查看自己的订单
 */
@RestController
@RequestMapping("/api/ticket/admin")
public class AdminController {

    private final ActivityMapper activityMapper;
    private final SessionMapper sessionMapper;
    private final TicketTypeMapper ticketTypeMapper;
    private final VenueMapper venueMapper;
    private final UserRefMapper userRefMapper;

    public AdminController(ActivityMapper activityMapper, SessionMapper sessionMapper,
                           TicketTypeMapper ticketTypeMapper, VenueMapper venueMapper,
                           UserRefMapper userRefMapper) {
        this.activityMapper = activityMapper;
        this.sessionMapper = sessionMapper;
        this.ticketTypeMapper = ticketTypeMapper;
        this.venueMapper = venueMapper;
        this.userRefMapper = userRefMapper;
    }

    /** 获取用户角色，非admin/organizer返回null并拒绝 */
    private String checkRole(Long userId) {
        UserRef user = userRefMapper.selectById(userId);
        if (user == null) return null;
        String role = user.getRole();
        if (!"admin".equals(role) && !"organizer".equals(role)) return null;
        return role;
    }

    /** 检查organizer是否拥有此活动 */
    private boolean ownsActivity(Long activityId, Long userId) {
        Activity a = activityMapper.selectById(activityId);
        return a != null && userId.equals(a.getOrganizerId());
    }

    // ========== 活动管理 ==========

    @PostMapping("/activities")
    public Result<Activity> createActivity(@RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        Activity activity = new Activity();
        activity.setCategoryId(Long.valueOf(body.get("categoryId").toString()));
        activity.setArtistId(Long.valueOf(body.get("artistId").toString()));
        activity.setName(body.get("name").toString());
        activity.setDescription(body.get("description") != null ? body.get("description").toString() : null);
        activity.setPoster(body.get("poster") != null ? body.get("poster").toString() : null);
        activity.setStatus(1);
        activity.setOrganizerId(userId); // 记录创建者
        activityMapper.insert(activity);
        return Result.success(activity);
    }

    @PutMapping("/activities/{id}")
    public Result<Activity> updateActivity(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        Activity activity = activityMapper.selectById(id);
        if (activity == null) return Result.fail(404, "活动不存在");

        // organizer只能修改自己的活动
        if ("organizer".equals(role) && !userId.equals(activity.getOrganizerId()))
            return Result.fail(403, "只能修改自己主办的活动");

        if (body.containsKey("name")) activity.setName(body.get("name").toString());
        if (body.containsKey("description")) activity.setDescription(body.get("description") != null ? body.get("description").toString() : null);
        if (body.containsKey("poster")) activity.setPoster(body.get("poster") != null ? body.get("poster").toString() : null);
        if (body.containsKey("categoryId")) activity.setCategoryId(Long.valueOf(body.get("categoryId").toString()));
        if (body.containsKey("artistId")) activity.setArtistId(Long.valueOf(body.get("artistId").toString()));
        activityMapper.updateById(activity);
        return Result.success(activity);
    }

    @PutMapping("/activities/{id}/status")
    public Result<Void> updateActivityStatus(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        Activity activity = activityMapper.selectById(id);
        if (activity == null) return Result.fail(404, "活动不存在");

        if ("organizer".equals(role) && !userId.equals(activity.getOrganizerId()))
            return Result.fail(403, "只能管理自己主办的活动");

        activity.setStatus(Integer.valueOf(body.get("status").toString()));
        activityMapper.updateById(activity);
        return Result.success();
    }

    @DeleteMapping("/activities/{id}")
    public Result<Void> deleteActivity(@RequestParam Long userId, @PathVariable Long id) {
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        Activity activity = activityMapper.selectById(id);
        if (activity == null) return Result.fail(404, "活动不存在");

        if ("organizer".equals(role) && !userId.equals(activity.getOrganizerId()))
            return Result.fail(403, "只能删除自己主办的活动");

        activityMapper.deleteById(id);
        return Result.success();
    }

    @GetMapping("/activities")
    public Result<Page<Activity>> listAdminActivities(
            @RequestParam Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        LambdaQueryWrapper<Activity> wrapper = new LambdaQueryWrapper<>();
        // organizer 只能看自己的活动，admin 看全部
        if ("organizer".equals(role)) {
            wrapper.eq(Activity::getOrganizerId, userId);
        }
        wrapper.orderByDesc(Activity::getCreateTime);
        return Result.success(activityMapper.selectPage(new Page<>(page, size), wrapper));
    }

    // ========== 场次管理（权限继承自活动） ==========

    @PostMapping("/sessions")
    public Result<Session> createSession(@RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        Long activityId = Long.valueOf(body.get("activityId").toString());
        if ("organizer".equals(role) && !ownsActivity(activityId, userId))
            return Result.fail(403, "只能管理自己主办的场次");

        Session session = new Session();
        session.setActivityId(activityId);
        session.setVenueId(Long.valueOf(body.get("venueId").toString()));
        session.setStartTime(LocalDateTime.parse(body.get("startTime").toString().replace(" ", "T")));
        session.setEndTime(body.get("endTime") != null ? LocalDateTime.parse(body.get("endTime").toString().replace(" ", "T")) : null);
        session.setStatus(1);
        sessionMapper.insert(session);
        return Result.success(session);
    }

    @PutMapping("/sessions/{id}")
    public Result<Session> updateSession(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        Session session = sessionMapper.selectById(id);
        if (session == null) return Result.fail(404, "场次不存在");

        if ("organizer".equals(role) && !ownsActivity(session.getActivityId(), userId))
            return Result.fail(403, "只能管理自己主办的场次");

        if (body.containsKey("venueId")) session.setVenueId(Long.valueOf(body.get("venueId").toString()));
        if (body.containsKey("startTime")) session.setStartTime(LocalDateTime.parse(body.get("startTime").toString().replace(" ", "T")));
        if (body.containsKey("endTime") && body.get("endTime") != null) session.setEndTime(LocalDateTime.parse(body.get("endTime").toString().replace(" ", "T")));
        if (body.containsKey("status")) session.setStatus(Integer.valueOf(body.get("status").toString()));
        sessionMapper.updateById(session);
        return Result.success(session);
    }

    @DeleteMapping("/sessions/{id}")
    public Result<Void> deleteSession(@RequestParam Long userId, @PathVariable Long id) {
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        Session session = sessionMapper.selectById(id);
        if (session == null) return Result.fail(404, "场次不存在");

        if ("organizer".equals(role) && !ownsActivity(session.getActivityId(), userId))
            return Result.fail(403, "只能删除自己主办的场次");

        sessionMapper.deleteById(id);
        return Result.success();
    }

    // ========== 票档管理（权限继承自活动） ==========

    @PostMapping("/ticket-types")
    public Result<TicketType> createTicketType(@RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        Long sessionId = Long.valueOf(body.get("sessionId").toString());
        Session session = sessionMapper.selectById(sessionId);
        if (session == null) return Result.fail(404, "场次不存在");

        if ("organizer".equals(role) && !ownsActivity(session.getActivityId(), userId))
            return Result.fail(403, "只能管理自己主办的票档");

        TicketType tt = new TicketType();
        tt.setSessionId(sessionId);
        tt.setName(body.get("name").toString());
        tt.setPrice(new java.math.BigDecimal(body.get("price").toString()));
        tt.setTotalStock(Integer.valueOf(body.get("totalStock").toString()));
        tt.setRemainStock(Integer.valueOf(body.get("totalStock").toString()));
        tt.setStatus(1);
        ticketTypeMapper.insert(tt);
        return Result.success(tt);
    }

    @PutMapping("/ticket-types/{id}")
    public Result<TicketType> updateTicketType(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        TicketType tt = ticketTypeMapper.selectById(id);
        if (tt == null) return Result.fail(404, "票档不存在");

        Session session = sessionMapper.selectById(tt.getSessionId());
        if ("organizer".equals(role) && !ownsActivity(session.getActivityId(), userId))
            return Result.fail(403, "只能管理自己主办的票档");

        if (body.containsKey("name")) tt.setName(body.get("name").toString());
        if (body.containsKey("price")) tt.setPrice(new java.math.BigDecimal(body.get("price").toString()));
        if (body.containsKey("totalStock")) {
            int diff = Integer.valueOf(body.get("totalStock").toString()) - tt.getTotalStock();
            tt.setTotalStock(Integer.valueOf(body.get("totalStock").toString()));
            tt.setRemainStock(tt.getRemainStock() + diff);
        }
        if (body.containsKey("status")) tt.setStatus(Integer.valueOf(body.get("status").toString()));
        ticketTypeMapper.updateById(tt);
        return Result.success(tt);
    }

    @DeleteMapping("/ticket-types/{id}")
    public Result<Void> deleteTicketType(@RequestParam Long userId, @PathVariable Long id) {
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        TicketType tt = ticketTypeMapper.selectById(id);
        if (tt == null) return Result.fail(404, "票档不存在");

        Session session = sessionMapper.selectById(tt.getSessionId());
        if ("organizer".equals(role) && !ownsActivity(session.getActivityId(), userId))
            return Result.fail(403, "只能删除自己主办的票档");

        ticketTypeMapper.deleteById(id);
        return Result.success();
    }

    // ========== 场馆管理（admin全权限，organizer只读） ==========

    @PostMapping("/venues")
    public Result<Venue> createVenue(@RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");
        if ("organizer".equals(role)) return Result.fail(403, "仅平台管理员可创建场馆");

        Venue venue = new Venue();
        venue.setName(body.get("name").toString());
        venue.setCity(body.get("city") != null ? body.get("city").toString() : null);
        venue.setAddress(body.get("address") != null ? body.get("address").toString() : null);
        venue.setCapacity(body.get("capacity") != null ? Integer.valueOf(body.get("capacity").toString()) : null);
        venue.setStatus(1);
        venueMapper.insert(venue);
        return Result.success(venue);
    }

    @PutMapping("/venues/{id}")
    public Result<Venue> updateVenue(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");
        if ("organizer".equals(role)) return Result.fail(403, "仅平台管理员可修改场馆");

        Venue venue = venueMapper.selectById(id);
        if (venue == null) return Result.fail(404, "场馆不存在");
        if (body.containsKey("name")) venue.setName(body.get("name").toString());
        if (body.containsKey("city")) venue.setCity(body.get("city") != null ? body.get("city").toString() : null);
        if (body.containsKey("address")) venue.setAddress(body.get("address") != null ? body.get("address").toString() : null);
        if (body.containsKey("capacity")) venue.setCapacity(body.get("capacity") != null ? Integer.valueOf(body.get("capacity").toString()) : null);
        venueMapper.updateById(venue);
        return Result.success(venue);
    }

    @GetMapping("/venues")
    public Result<List<Venue>> listAdminVenues(@RequestParam Long userId) {
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");
        return Result.success(venueMapper.selectList(null));
    }
}
