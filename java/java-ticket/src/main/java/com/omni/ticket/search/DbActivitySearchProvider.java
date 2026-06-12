package com.omni.ticket.search;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.dto.ActivityVO;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Collectors;

public class DbActivitySearchProvider implements ActivitySearchProvider {

    private final ActivityPageSource activityPageSource;

    public DbActivitySearchProvider(ActivityPageSource activityPageSource) {
        this.activityPageSource = Objects.requireNonNull(activityPageSource, "activityPageSource");
    }

    @Override
    public Page<ActivityVO> search(ActivitySearchRequest request) {
        ActivitySearchRequest safeRequest = request == null ? ActivitySearchRequest.builder().build() : request;
        int safePage = safeRequest.getPage() == null || safeRequest.getPage() <= 0 ? 1 : safeRequest.getPage();
        int safeSize = safeRequest.getSize() == null || safeRequest.getSize() <= 0 ? 10 : safeRequest.getSize();
        int fetchSize = Math.max(safeSize * safePage, safeSize);

        Page<ActivityVO> source = activityPageSource.listActivities(1, fetchSize, safeRequest.getCategoryId());
        List<ActivityVO> sourceRecords = source.getRecords() == null ? List.of() : source.getRecords();
        List<ActivityVO> filtered = sourceRecords.stream()
                .filter(vo -> matchesKeyword(vo, safeRequest.getKeyword()))
                .filter(vo -> matchesCity(vo, safeRequest.getCity()))
                .filter(vo -> matchesDate(vo, safeRequest.getDateFrom(), safeRequest.getDateTo()))
                .filter(vo -> matchesPrice(vo, safeRequest.getMinPrice(), safeRequest.getMaxPrice()))
                .filter(vo -> matchesSaleStatus(vo, safeRequest.getSaleStatus()))
                .filter(vo -> !Boolean.TRUE.equals(safeRequest.getSeatMapOnly()) || "published".equals(vo.getSeatMapVisibility()))
                .filter(vo -> safeRequest.getRealNameRequired() == null
                        || Boolean.valueOf(safeRequest.getRealNameRequired()).equals(Boolean.TRUE.equals(vo.getRealNameRequired())))
                .collect(Collectors.toList());
        filtered.sort(searchComparator(safeRequest.getSort()));

        int from = Math.min((safePage - 1) * safeSize, filtered.size());
        int to = Math.min(from + safeSize, filtered.size());
        Page<ActivityVO> result = new Page<>(safePage, safeSize, filtered.size());
        result.setRecords(new ArrayList<>(filtered.subList(from, to)));
        result.setTotal(filtered.size());
        result.setPages((filtered.size() + safeSize - 1L) / safeSize);
        return result;
    }

    private boolean matchesKeyword(ActivityVO vo, String keyword) {
        if (!StringUtils.hasText(keyword)) return true;
        String normalized = keyword.trim().toLowerCase(Locale.ROOT);
        return containsText(vo.getName(), normalized)
                || containsText(vo.getArtistName(), normalized)
                || containsText(vo.getVenueCity(), normalized)
                || containsText(vo.getCategoryName(), normalized);
    }

    private boolean matchesCity(ActivityVO vo, String city) {
        return !StringUtils.hasText(city) || containsText(vo.getVenueCity(), city.trim().toLowerCase(Locale.ROOT));
    }

    private boolean matchesDate(ActivityVO vo, LocalDate dateFrom, LocalDate dateTo) {
        if (dateFrom == null && dateTo == null) return true;
        if (vo.getStartTime() == null) return false;
        LocalDate date = vo.getStartTime().toLocalDate();
        if (dateFrom != null && date.isBefore(dateFrom)) return false;
        return dateTo == null || !date.isAfter(dateTo);
    }

    private boolean matchesPrice(ActivityVO vo, BigDecimal minPrice, BigDecimal maxPrice) {
        if (minPrice == null && maxPrice == null) return true;
        if (vo.getMinPrice() == null) return false;
        if (minPrice != null && vo.getMinPrice().compareTo(minPrice) < 0) return false;
        return maxPrice == null || vo.getMinPrice().compareTo(maxPrice) <= 0;
    }

    private boolean matchesSaleStatus(ActivityVO vo, String saleStatus) {
        if (!StringUtils.hasText(saleStatus)) return true;
        String normalized = saleStatus.trim().toLowerCase(Locale.ROOT);
        if ("on_sale".equals(normalized)) return Integer.valueOf(1).equals(vo.getStatus());
        if ("coming_soon".equals(normalized)) return Integer.valueOf(2).equals(vo.getStatus()) || vo.getMinPrice() == null;
        if ("sold_out".equals(normalized)) return Integer.valueOf(0).equals(vo.getStatus()) || Integer.valueOf(3).equals(vo.getStatus());
        return true;
    }

    private Comparator<ActivityVO> searchComparator(String sort) {
        String normalized = StringUtils.hasText(sort) ? sort.trim().toLowerCase(Locale.ROOT) : "";
        Comparator<ActivityVO> byStart = Comparator.comparing(ActivityVO::getStartTime, Comparator.nullsLast(Comparator.naturalOrder()));
        Comparator<ActivityVO> byPrice = Comparator.comparing(ActivityVO::getMinPrice, Comparator.nullsLast(Comparator.naturalOrder()));
        if ("recent".equals(normalized)) return byStart;
        if ("newest".equals(normalized)) return Comparator.comparing(ActivityVO::getId, Comparator.nullsLast(Comparator.reverseOrder()));
        if ("price_asc".equals(normalized)) return byPrice;
        if ("price_desc".equals(normalized)) return byPrice.reversed();
        return Comparator.comparing((ActivityVO vo) -> Integer.valueOf(1).equals(vo.getStatus()) ? 0 : 1)
                .thenComparing(byStart);
    }

    private boolean containsText(String value, String normalizedKeyword) {
        return StringUtils.hasText(value) && value.toLowerCase(Locale.ROOT).contains(normalizedKeyword);
    }

    @FunctionalInterface
    public interface ActivityPageSource {
        Page<ActivityVO> listActivities(Integer page, Integer size, Long categoryId);
    }
}
