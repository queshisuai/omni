package com.omni.ticket.search;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.dto.ActivityVO;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DatabaseActivitySearchRepositoryTest {

    @Test
    void filtersByKeywordCityPriceRealNameAndSortsByPrice() {
        DatabaseActivitySearchRepository repository = new DatabaseActivitySearchRepository();
        ActivityVO match = activity(10L, "周末演唱会", "周杰伦", "上海", "演唱会",
                LocalDateTime.of(2026, 6, 20, 19, 30), new BigDecimal("380.00"), 1, true);
        ActivityVO miss = activity(11L, "话剧", "剧团", "北京", "话剧",
                LocalDateTime.of(2026, 6, 21, 19, 30), new BigDecimal("180.00"), 1, false);
        Page<ActivityVO> source = new Page<ActivityVO>(1, 10, 2).setRecords(List.of(match, miss));

        Page<ActivityVO> result = repository.filter(source, ActivitySearchRequest.builder()
                .page(1)
                .size(10)
                .keyword("周杰伦")
                .city("上海")
                .minPrice(new BigDecimal("300"))
                .maxPrice(new BigDecimal("500"))
                .realNameRequired(true)
                .sort("price_asc")
                .build());

        assertEquals(1, result.getTotal());
        assertEquals(10L, result.getRecords().get(0).getId());
    }

    private ActivityVO activity(Long id, String name, String artistName, String city, String categoryName,
                                LocalDateTime startTime, BigDecimal minPrice, Integer status,
                                boolean realNameRequired) {
        ActivityVO vo = new ActivityVO();
        vo.setId(id);
        vo.setItemType("activity");
        vo.setName(name);
        vo.setArtistName(artistName);
        vo.setVenueCity(city);
        vo.setCategoryName(categoryName);
        vo.setStartTime(startTime);
        vo.setMinPrice(minPrice);
        vo.setStatus(status);
        vo.setRealNameRequired(realNameRequired);
        return vo;
    }
}
