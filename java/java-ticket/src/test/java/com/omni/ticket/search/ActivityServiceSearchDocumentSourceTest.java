package com.omni.ticket.search;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.service.ActivityService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ActivityServiceSearchDocumentSourceTest {

    private final ActivityService activityService = mock(ActivityService.class);
    private final ActivityServiceSearchDocumentSource source = new ActivityServiceSearchDocumentSource(activityService);

    @Test
    void listAllSearchDocumentsBuildsDocumentsFromActivityProjection() {
        when(activityService.listActivities(1, 500, null))
                .thenReturn(page(activity(10L, "activity"), activity(31L, "tour")));

        List<ActivitySearchDocument> documents = source.listAllSearchDocuments();

        assertEquals(2, documents.size());
        assertEquals("activity:10", documents.get(0).getDocumentId());
        assertEquals("tour:31", documents.get(1).getDocumentId());
    }

    @Test
    void findTourDocumentUsesExistingSearchProjection() {
        when(activityService.listActivities(1, 500, null))
                .thenReturn(page(activity(10L, "activity"), activity(31L, "tour")));

        Optional<ActivitySearchDocument> document = source.findTourDocument(31L);

        assertTrue(document.isPresent());
        assertEquals("tour:31", document.get().getDocumentId());
    }

    private Page<ActivityVO> page(ActivityVO... records) {
        Page<ActivityVO> page = new Page<>(1, 500, records.length);
        page.setRecords(List.of(records));
        page.setTotal(records.length);
        return page;
    }

    private ActivityVO activity(Long id, String itemType) {
        ActivityVO vo = new ActivityVO();
        vo.setId(id);
        vo.setItemType(itemType);
        vo.setName("演唱会" + id);
        vo.setArtistName("歌手");
        vo.setVenueCity("上海");
        vo.setStartTime(LocalDateTime.of(2026, 6, 20, 19, 30));
        vo.setMinPrice(new BigDecimal("380.00"));
        vo.setSeatMapVisibility("published");
        vo.setRealNameRequired(true);
        vo.setTicketTransferAllowed(true);
        vo.setStatus(1);
        return vo;
    }
}
