package com.damai.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.damai.common.result.ResultCode;
import com.damai.exception.BusinessException;
import com.damai.ticket.dto.ActivityDetailVO;
import com.damai.ticket.dto.ActivityVO;
import com.damai.ticket.entity.*;
import com.damai.ticket.mapper.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.BigDecimal;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 活动服务
 */
@Service
public class ActivityService {

    private final ActivityMapper activityMapper;
    private final CategoryMapper categoryMapper;
    private final ArtistMapper artistMapper;
    private final SessionMapper sessionMapper;
    private final VenueMapper venueMapper;
    private final TicketTypeMapper ticketTypeMapper;

    public ActivityService(ActivityMapper activityMapper, CategoryMapper categoryMapper,
                           ArtistMapper artistMapper, SessionMapper sessionMapper,
                           VenueMapper venueMapper, TicketTypeMapper ticketTypeMapper) {
        this.activityMapper = activityMapper;
        this.categoryMapper = categoryMapper;
        this.artistMapper = artistMapper;
        this.sessionMapper = sessionMapper;
        this.venueMapper = venueMapper;
        this.ticketTypeMapper = ticketTypeMapper;
    }

    /**
     * 活动列表（分页 + 分类筛选）
     */
    public Page<ActivityVO> listActivities(Integer page, Integer size, Long categoryId) {
        LambdaQueryWrapper<Activity> wrapper = new LambdaQueryWrapper<>();
        if (categoryId != null) {
            wrapper.eq(Activity::getCategoryId, categoryId);
        }
        wrapper.eq(Activity::getStatus, 1);
        wrapper.orderByDesc(Activity::getCreateTime);

        Page<Activity> activityPage = activityMapper.selectPage(new Page<>(page, size), wrapper);
        List<Activity> records = activityPage.getRecords();
        if (records.isEmpty()) {
            return new Page<ActivityVO>(page, size, activityPage.getTotal()).setRecords(Collections.emptyList());
        }

        // 1. 收集所有的 ID
        Set<Long> categoryIds = records.stream().map(Activity::getCategoryId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> artistIds = records.stream().map(Activity::getArtistId).filter(Objects::nonNull).collect(Collectors.toSet());
        List<Long> activityIds = records.stream().map(Activity::getId).collect(Collectors.toList());

        // 2. 批量查询分类和艺人
        Map<Long, Category> categoryMap = categoryIds.isEmpty() ? Collections.emptyMap() :
                categoryMapper.selectBatchIds(categoryIds).stream().collect(Collectors.toMap(Category::getId, Function.identity()));
        Map<Long, Artist> artistMap = artistIds.isEmpty() ? Collections.emptyMap() :
                artistMapper.selectBatchIds(artistIds).stream().collect(Collectors.toMap(Artist::getId, Function.identity()));

        // 3. 批量查询场次
        LambdaQueryWrapper<Session> sessionWrapper = new LambdaQueryWrapper<>();
        sessionWrapper.in(Session::getActivityId, activityIds).eq(Session::getStatus, 1).orderByAsc(Session::getStartTime);
        List<Session> allSessions = sessionMapper.selectList(sessionWrapper);
        
        // 按活动ID分组场次
        Map<Long, List<Session>> activitySessionMap = allSessions.stream().collect(Collectors.groupingBy(Session::getActivityId));
        
        // 收集所有场馆ID和场次ID
        Set<Long> venueIds = allSessions.stream().map(Session::getVenueId).filter(Objects::nonNull).collect(Collectors.toSet());
        List<Long> sessionIds = allSessions.stream().map(Session::getId).collect(Collectors.toList());

        // 4. 批量查询场馆
        Map<Long, Venue> venueMap = venueIds.isEmpty() ? Collections.emptyMap() :
                venueMapper.selectBatchIds(venueIds).stream().collect(Collectors.toMap(Venue::getId, Function.identity()));

        // 5. 批量查询票档
        Map<Long, List<TicketType>> sessionTicketMap = Collections.emptyMap();
        if (!sessionIds.isEmpty()) {
            LambdaQueryWrapper<TicketType> ttWrapper = new LambdaQueryWrapper<>();
            ttWrapper.in(TicketType::getSessionId, sessionIds).eq(TicketType::getStatus, 1);
            List<TicketType> allTickets = ticketTypeMapper.selectList(ttWrapper);
            sessionTicketMap = allTickets.stream().collect(Collectors.groupingBy(TicketType::getSessionId));
        }

        final Map<Long, List<TicketType>> finalSessionTicketMap = sessionTicketMap;

        // 6. 组装结果
        Page<ActivityVO> voPage = new Page<>(page, size, activityPage.getTotal());
        List<ActivityVO> voList = records.stream().map(activity -> {
            ActivityVO vo = new ActivityVO();
            vo.setId(activity.getId());
            vo.setName(activity.getName());
            vo.setPoster(activity.getPoster());
            vo.setStatus(activity.getStatus());

            Category category = categoryMap.get(activity.getCategoryId());
            if (category != null) vo.setCategoryName(category.getName());

            Artist artist = artistMap.get(activity.getArtistId());
            if (artist != null) vo.setArtistName(artist.getName());

            List<Session> sessions = activitySessionMap.getOrDefault(activity.getId(), Collections.emptyList());
            if (!sessions.isEmpty()) {
                Session firstSession = sessions.get(0);
                vo.setStartTime(firstSession.getStartTime());
                Venue venue = venueMap.get(firstSession.getVenueId());
                if (venue != null) vo.setVenueCity(venue.getCity());

                BigDecimal minPrice = null;
                for (Session s : sessions) {
                    List<TicketType> tickets = finalSessionTicketMap.getOrDefault(s.getId(), Collections.emptyList());
                    for (TicketType t : tickets) {
                        if (minPrice == null || t.getPrice().compareTo(minPrice) < 0) {
                            minPrice = t.getPrice();
                        }
                    }
                }
                vo.setMinPrice(minPrice);
            }
            return vo;
        }).collect(Collectors.toList());

        voPage.setRecords(voList);
        return voPage;
    }

    /**
     * 活动详情
     */
    public ActivityDetailVO getActivityDetail(Long id) {
        Activity activity = activityMapper.selectById(id);
        if (activity == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "活动不存在");
        }

        ActivityDetailVO detail = new ActivityDetailVO();
        detail.setActivity(activity);
        detail.setCategory(categoryMapper.selectById(activity.getCategoryId()));
        detail.setArtist(artistMapper.selectById(activity.getArtistId()));

        // 查询所有场次及票档
        LambdaQueryWrapper<Session> sessionWrapper = new LambdaQueryWrapper<>();
        sessionWrapper.eq(Session::getActivityId, id)
                      .eq(Session::getStatus, 1)
                      .orderByAsc(Session::getStartTime);
        List<Session> sessions = sessionMapper.selectList(sessionWrapper);

        List<ActivityDetailVO.SessionDetail> sessionDetails = new ArrayList<>();
        for (Session session : sessions) {
            ActivityDetailVO.SessionDetail sd = new ActivityDetailVO.SessionDetail();
            sd.setSession(session);
            sd.setVenue(venueMapper.selectById(session.getVenueId()));

            LambdaQueryWrapper<TicketType> ttWrapper = new LambdaQueryWrapper<>();
            ttWrapper.eq(TicketType::getSessionId, session.getId())
                     .eq(TicketType::getStatus, 1)
                     .orderByAsc(TicketType::getPrice);
            sd.setTicketTypes(ticketTypeMapper.selectList(ttWrapper));

            sessionDetails.add(sd);
        }
        detail.setSessions(sessionDetails);

        return detail;
    }

    /**
     * 分类列表
     */
    public List<Category> listCategories() {
        LambdaQueryWrapper<Category> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Category::getStatus, 1).orderByAsc(Category::getSort);
        return categoryMapper.selectList(wrapper);
    }
}
