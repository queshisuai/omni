package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.SearchHistoryRequest;
import com.omni.ticket.dto.SearchTrendingItem;
import com.omni.ticket.service.SearchHistoryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SearchControllerTest {

    @Mock
    private SearchHistoryService searchHistoryService;

    @Test
    void getHistoryRejectsMissingAuthorization() {
        SearchController controller = new SearchController(searchHistoryService);

        Result<List<String>> result = controller.getHistory(null);

        assertEquals(401, result.getCode());
        verify(searchHistoryService, never()).listHistory(2004L);
    }

    @Test
    void addHistoryUsesAuthorizationUserId() {
        SearchController controller = new SearchController(searchHistoryService);
        SearchHistoryRequest request = new SearchHistoryRequest();
        request.setKeyword("交响音乐会");
        when(searchHistoryService.addHistory(2004L, request)).thenReturn(List.of("交响音乐会"));

        Result<List<String>> result = controller.addHistory(token(), request);

        assertEquals(200, result.getCode());
        assertEquals(List.of("交响音乐会"), result.getData());
        verify(searchHistoryService).addHistory(2004L, request);
    }

    @Test
    void clearHistoryUsesAuthorizationUserId() {
        SearchController controller = new SearchController(searchHistoryService);

        Result<Void> result = controller.clearHistory(token());

        assertEquals(200, result.getCode());
        verify(searchHistoryService).clearHistory(2004L);
    }

    @Test
    void trendingIsPublicAndDynamic() {
        SearchController controller = new SearchController(searchHistoryService);
        SearchTrendingItem item = new SearchTrendingItem();
        item.setRank(1);
        item.setKeyword("年度音乐会");
        item.setTagType("BURST");
        when(searchHistoryService.listTrending()).thenReturn(List.of(item));

        Result<List<SearchTrendingItem>> result = controller.getTrending();

        assertEquals(200, result.getCode());
        assertEquals("年度音乐会", result.getData().get(0).getKeyword());
    }

    private String token() {
        return "Bearer " + JwtUtil.generateToken(2004L, "13800000004", "user");
    }
}

