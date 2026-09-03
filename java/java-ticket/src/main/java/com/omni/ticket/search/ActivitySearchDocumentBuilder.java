package com.omni.ticket.search;

import com.omni.ticket.dto.ActivityVO;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Component
public class ActivitySearchDocumentBuilder {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    public ActivitySearchDocument fromActivityVo(ActivityVO vo) {
        if (vo == null) {
            throw new IllegalArgumentException("活动搜索文档来源不能为空");
        }
        ActivitySearchDocument document = new ActivitySearchDocument();
        String itemType = StringUtils.hasText(vo.getItemType()) ? vo.getItemType() : "activity";
        if (vo.getId() != null) {
            document.setId(itemType + ":" + vo.getId());
            if ("tour".equals(itemType)) {
                document.setTourId(vo.getId());
            } else {
                document.setActivityId(vo.getId());
            }
        }
        document.setCategoryId(vo.getCategoryId());
        document.setOrganizerId(vo.getOrganizerId());
        document.setItemType(itemType);
        document.setActivityName(vo.getName());
        document.setPoster(vo.getPoster());
        document.setArtistName(vo.getArtistName());
        document.setCategoryName(vo.getCategoryName());
        document.setCity(vo.getVenueCity());
        document.setVenueName(vo.getVenueName());
        document.setStartTime(formatDateTime(vo.getStartTime()));
        document.setMinPrice(vo.getMinPrice());
        document.setMaxPrice(vo.getMaxPrice() == null ? vo.getMinPrice() : vo.getMaxPrice());
        document.setSaleStatus(resolveSaleStatus(vo));
        document.setSeatMapVisibility(vo.getSeatMapVisibility());
        document.setRealNameRequired(vo.getRealNameRequired());
        document.setTicketTransferAllowed(vo.getTicketTransferAllowed());
        document.setSubscriptionCount(0L);
        document.setPaidOrderCount(0L);
        document.setHotScore(resolveHotScore(vo));
        document.setUpdatedAt(formatDateTime(LocalDateTime.now()));
        return document;
    }

    private String formatDateTime(LocalDateTime value) {
        return value == null ? null : DATE_TIME_FORMATTER.format(value);
    }

    private String resolveSaleStatus(ActivityVO vo) {
        Integer status = vo.getStatus();
        if (Integer.valueOf(1).equals(status)) return "on_sale";
        if (Integer.valueOf(2).equals(status) || vo.getMinPrice() == null) return "coming_soon";
        if (Integer.valueOf(0).equals(status) || Integer.valueOf(3).equals(status)) return "sold_out";
        return "unknown";
    }

    private double resolveHotScore(ActivityVO vo) {
        if (Integer.valueOf(1).equals(vo.getStatus())) return 100D;
        if (Integer.valueOf(2).equals(vo.getStatus())) return 50D;
        return 0D;
    }
}
