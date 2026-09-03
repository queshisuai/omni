package com.omni.ticket.search;

import com.omni.ticket.dto.ActivityVO;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ActivitySearchDocumentBuilderTest {

    private final ActivitySearchDocumentBuilder builder = new ActivitySearchDocumentBuilder();

    @Test
    void buildsSearchDocumentFromActivityVo() {
        ActivityVO vo = new ActivityVO();
        vo.setId(900001L);
        vo.setItemType("activity");
        vo.setName("Jay Chou Carnival World Tour Beijing");
        vo.setPoster("/uploads/ticket/activity-poster/2026/09/jay.webp");
        vo.setCategoryId(1001L);
        vo.setOrganizerId(2002L);
        vo.setCategoryName("Concert");
        vo.setArtistName("Jay Chou");
        vo.setVenueCity("Beijing");
        vo.setVenueName("National Stadium");
        vo.setStartTime(LocalDateTime.parse("2026-06-22T19:30:00"));
        vo.setMinPrice(new BigDecimal("580"));
        vo.setMaxPrice(new BigDecimal("1880"));
        vo.setSeatMapVisibility("published");
        vo.setRealNameRequired(true);
        vo.setTicketTransferAllowed(false);
        vo.setStatus(1);

        ActivitySearchDocument document = builder.fromActivityVo(vo);

        assertEquals("activity:900001", document.getId());
        assertEquals(900001L, document.getActivityId());
        assertEquals("activity", document.getItemType());
        assertEquals(1001L, document.getCategoryId());
        assertEquals(2002L, document.getOrganizerId());
        assertEquals("Jay Chou Carnival World Tour Beijing", document.getActivityName());
        assertEquals("/uploads/ticket/activity-poster/2026/09/jay.webp", document.getPoster());
        assertEquals("Concert", document.getCategoryName());
        assertEquals("Jay Chou", document.getArtistName());
        assertEquals("Beijing", document.getCity());
        assertEquals("National Stadium", document.getVenueName());
        assertEquals("2026-06-22T19:30:00", document.getStartTime());
        assertEquals(new BigDecimal("580"), document.getMinPrice());
        assertEquals(new BigDecimal("1880"), document.getMaxPrice());
        assertEquals("published", document.getSeatMapVisibility());
        assertEquals(true, document.getRealNameRequired());
        assertEquals(false, document.getTicketTransferAllowed());
        assertEquals("on_sale", document.getSaleStatus());
    }

    @Test
    void defaultsDocumentIdentityForMissingOptionalFields() {
        ActivityVO vo = new ActivityVO();
        vo.setId(900002L);
        vo.setName("Upcoming Activity");
        vo.setStatus(2);

        ActivitySearchDocument document = builder.fromActivityVo(vo);

        assertEquals("activity:900002", document.getId());
        assertEquals(900002L, document.getActivityId());
        assertEquals("activity", document.getItemType());
        assertEquals("coming_soon", document.getSaleStatus());
    }

    @Test
    void buildsTourDocumentWithTypeScopedIdentity() {
        ActivityVO vo = new ActivityVO();
        vo.setId(5L);
        vo.setItemType("tour");
        vo.setName("巡演项目");
        vo.setStatus(1);

        ActivitySearchDocument document = builder.fromActivityVo(vo);

        assertEquals("tour:5", document.getId());
        assertEquals(5L, document.getTourId());
        assertEquals(null, document.getActivityId());
        assertEquals("tour", document.getItemType());
    }

    @Test
    void mappingResourceDefinesCoreSearchFields() throws Exception {
        try (InputStream inputStream = getClass().getClassLoader()
                .getResourceAsStream("search/omni_activity_v1_mapping.json")) {
            assertNotNull(inputStream);
            String mapping = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);

            assertTrue(mapping.contains("\"activityName\""));
            assertTrue(mapping.contains("\"poster\""));
            assertTrue(mapping.contains("\"artistName\""));
            assertTrue(mapping.contains("\"city\""));
            assertTrue(mapping.contains("\"minPrice\""));
            assertTrue(mapping.contains("\"hotScore\""));
        }
    }
}
