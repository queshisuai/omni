package com.omni.ticket.service;

import com.omni.ticket.mapper.ActivityMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class OrganizerOnsaleSummaryServiceTest {

    private final ActivityMapper activityMapper = mock(ActivityMapper.class);
    private final UserAccessService userAccessService = mock(UserAccessService.class);
    private final OrganizerOnsaleSummaryService service =
            new OrganizerOnsaleSummaryService(activityMapper, userAccessService);

    @BeforeEach
    void allowOrganizerOperations() {
        when(userAccessService.hasPlatformPermission(2002L, "organizer.review", "organizer.account.manage"))
                .thenReturn(true);
    }

    @Test
    void batchSummaryAggregatesOnlyOnsaleActivitiesByOrganizer() {
        when(activityMapper.selectMaps(any())).thenReturn(List.of(
                Map.of("organizerId", 2003L, "count", 4L),
                Map.of("organizerId", 2005L, "count", 1L)));

        Map<Long, Long> result = service.batchSummary(2002L, List.of(2003L, 2005L));

        assertEquals(4L, result.get(2003L));
        assertEquals(1L, result.get(2005L));
    }

    @Test
    void emptyOrganizerIdsDoesNotQueryDatabase() {
        assertTrue(service.batchSummary(2002L, List.of()).isEmpty());
        verify(activityMapper, never()).selectMaps(any());
    }
}
