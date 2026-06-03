package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.ticket.search.ActivitySearchIndexService;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SearchIndexInternalControllerTest {
    private final ActivitySearchIndexService indexService = mock(ActivitySearchIndexService.class);
    private final SearchIndexInternalController controller =
            new SearchIndexInternalController(indexService, "test-internal-token");

    @Test
    void rebuildRejectsMissingToken() {
        Result<Map<String, Object>> result = controller.rebuild(null);

        assertEquals(403, result.getCode());
        assertEquals("无权限", result.getMessage());
        verifyNoInteractions(indexService);
    }

    @Test
    void rebuildEnsuresIndexAndReturnsIndexedCountWhenTokenMatches() {
        when(indexService.rebuildAll()).thenReturn(3);

        Result<Map<String, Object>> result = controller.rebuild("test-internal-token");

        assertEquals(200, result.getCode());
        assertEquals(3, result.getData().get("indexedCount"));
        verify(indexService).ensureIndex();
        verify(indexService).rebuildAll();
    }
}
