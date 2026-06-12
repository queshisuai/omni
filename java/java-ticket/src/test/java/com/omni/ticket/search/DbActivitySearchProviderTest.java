package com.omni.ticket.search;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.dto.ActivityVO;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DbActivitySearchProviderTest {

    @Test
    void filtersKeywordCityDatePriceSeatMapRealNameAndSortsByPrice() {
        DbActivitySearchProvider provider = new DbActivitySearchProvider((page, size, categoryId) -> pageOf(List.of(
                activity(1L, "摇滚音乐节 上海站", "演唱会", "乐队", "上海",
                        LocalDateTime.of(2026, 7, 1, 19, 30), "280.00", "published", false, 1),
                activity(2L, "周杰伦「嘉年华」世界巡回演唱会 北京站", "演唱会", "周杰伦", "北京",
                        LocalDateTime.of(2026, 7, 2, 19, 30), "580.00", "published", true, 1),
                activity(3L, "周杰伦「嘉年华」世界巡回演唱会 北京加场", "演唱会", "周杰伦", "北京",
                        LocalDateTime.of(2026, 7, 3, 19, 30), "380.00", "hidden", true, 1)
        )));

        Page<ActivityVO> result = provider.search(ActivitySearchRequest.builder()
                .page(1)
                .size(10)
                .keyword("周杰伦")
                .city("北京")
                .dateFrom(LocalDate.of(2026, 7, 1))
                .dateTo(LocalDate.of(2026, 7, 31))
                .minPrice(new BigDecimal("300"))
                .maxPrice(new BigDecimal("600"))
                .seatMapOnly(true)
                .realNameRequired(true)
                .sort("price_asc")
                .build());

        assertEquals(1, result.getTotal());
        assertEquals(1, result.getRecords().size());
        assertEquals(2L, result.getRecords().get(0).getId());
        assertEquals("周杰伦「嘉年华」世界巡回演唱会 北京站", result.getRecords().get(0).getName());
    }

    @Test
    void paginatesFilteredResultsAfterSorting() {
        DbActivitySearchProvider provider = new DbActivitySearchProvider((page, size, categoryId) -> pageOf(List.of(
                activity(1L, "A 演唱会", "演唱会", "歌手", "北京",
                        LocalDateTime.of(2026, 7, 1, 19, 30), "100.00", "published", false, 1),
                activity(2L, "B 演唱会", "演唱会", "歌手", "北京",
                        LocalDateTime.of(2026, 7, 2, 19, 30), "200.00", "published", false, 1),
                activity(3L, "C 演唱会", "演唱会", "歌手", "北京",
                        LocalDateTime.of(2026, 7, 3, 19, 30), "300.00", "published", false, 1)
        )));

        Page<ActivityVO> result = provider.search(ActivitySearchRequest.builder()
                .page(2)
                .size(1)
                .sort("price_asc")
                .build());

        assertEquals(3, result.getTotal());
        assertEquals(3, result.getPages());
        assertEquals(1, result.getRecords().size());
        assertEquals(2L, result.getRecords().get(0).getId());
    }

    private static Page<ActivityVO> pageOf(List<ActivityVO> records) {
        Page<ActivityVO> page = new Page<>(1, records.size(), records.size());
        page.setRecords(records);
        return page;
    }

    private static ActivityVO activity(Long id,
                                       String name,
                                       String categoryName,
                                       String artistName,
                                       String city,
                                       LocalDateTime startTime,
                                       String minPrice,
                                       String seatMapVisibility,
                                       boolean realNameRequired,
                                       int status) {
        ActivityVO vo = new ActivityVO();
        vo.setId(id);
        vo.setName(name);
        vo.setCategoryName(categoryName);
        vo.setArtistName(artistName);
        vo.setVenueCity(city);
        vo.setStartTime(startTime);
        vo.setMinPrice(new BigDecimal(minPrice));
        vo.setSeatMapVisibility(seatMapVisibility);
        vo.setRealNameRequired(realNameRequired);
        vo.setStatus(status);
        return vo;
    }
}
