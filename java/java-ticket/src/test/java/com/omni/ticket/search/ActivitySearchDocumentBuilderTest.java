package com.omni.ticket.search;

import com.omni.ticket.dto.ActivityArtistDto;
import com.omni.ticket.dto.ActivityVO;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ActivitySearchDocumentBuilderTest {

    @Test
    void buildsActivityDocumentWithSearchTextAndFilters() {
        ActivityVO vo = activity(10L, "周末演唱会", "周杰伦", "上海", "演唱会",
                LocalDateTime.of(2026, 6, 20, 19, 30), new BigDecimal("380.00"), 1);
        vo.setRealNameRequired(true);
        vo.setSeatMapVisibility("published");
        vo.setTicketTransferAllowed(true);

        ActivitySearchDocument document = ActivitySearchDocumentBuilder.fromActivityVo(vo);

        assertEquals("activity:10", document.getDocumentId());
        assertEquals("activity", document.getItemType());
        assertEquals("周末演唱会", document.getName());
        assertEquals("上海", document.getVenueCity());
        assertEquals("on_sale", document.getSaleStatus());
        assertTrue(document.getSearchText().contains("周杰伦"));
        assertTrue(document.getSearchText().contains("演唱会"));
        assertEquals(List.of("周杰伦"), document.getArtistNames());
    }

    @Test
    void buildsTourDocumentWithTourDocumentIdAndCities() {
        ActivityVO vo = activity(31L, "巡演", "歌手", "北京 / 上海", "演唱会", null, null, 2);
        vo.setItemType("tour");
        vo.setArtists(List.of(artist("歌手"), artist("嘉宾")));

        ActivitySearchDocument document = ActivitySearchDocumentBuilder.fromActivityVo(vo);

        assertEquals("tour:31", document.getDocumentId());
        assertEquals("tour", document.getItemType());
        assertEquals(List.of("北京", "上海"), document.getCities());
        assertEquals("coming_soon", document.getSaleStatus());
        assertEquals(List.of("歌手", "嘉宾"), document.getArtistNames());
    }

    private ActivityVO activity(Long id, String name, String artistName, String city, String categoryName,
                                LocalDateTime startTime, BigDecimal minPrice, Integer status) {
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
        return vo;
    }

    private ActivityArtistDto artist(String name) {
        ActivityArtistDto artist = new ActivityArtistDto();
        artist.setName(name);
        return artist;
    }
}
