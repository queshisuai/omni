package com.omni.ticket.search;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.dto.ActivityVO;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ActivitySearchFacadeTest {

    @Test
    void fallsBackToDatabaseWhenEsDisabled() {
        SearchProperties properties = new SearchProperties();
        properties.getEs().setEnabled(false);
        ElasticsearchActivitySearchRepository esRepository = mock(ElasticsearchActivitySearchRepository.class);
        ActivitySearchFacade facade = new ActivitySearchFacade(properties, esRepository);

        Page<ActivityVO> result = facade.search(ActivitySearchRequest.builder().page(1).size(10).build(),
                () -> pageOf(10L));

        assertEquals(10L, result.getRecords().get(0).getId());
        verifyNoInteractions(esRepository);
    }

    @Test
    void fallsBackToDatabaseWhenEsThrows() {
        SearchProperties properties = new SearchProperties();
        properties.getEs().setEnabled(true);
        ElasticsearchActivitySearchRepository esRepository = mock(ElasticsearchActivitySearchRepository.class);
        when(esRepository.search(any())).thenThrow(new IllegalStateException("ES不可用"));
        ActivitySearchFacade facade = new ActivitySearchFacade(properties, esRepository);

        Page<ActivityVO> result = facade.search(ActivitySearchRequest.builder().page(1).size(10).build(),
                () -> pageOf(11L));

        assertEquals(11L, result.getRecords().get(0).getId());
    }

    @Test
    void usesEsWhenEnabled() {
        SearchProperties properties = new SearchProperties();
        properties.getEs().setEnabled(true);
        ElasticsearchActivitySearchRepository esRepository = mock(ElasticsearchActivitySearchRepository.class);
        when(esRepository.search(any())).thenReturn(pageOf(12L));
        ActivitySearchFacade facade = new ActivitySearchFacade(properties, esRepository);

        Page<ActivityVO> result = facade.search(ActivitySearchRequest.builder().page(1).size(10).build(),
                () -> pageOf(13L));

        assertEquals(12L, result.getRecords().get(0).getId());
    }

    private Page<ActivityVO> pageOf(Long id) {
        ActivityVO vo = new ActivityVO();
        vo.setId(id);
        Page<ActivityVO> page = new Page<>(1, 10, 1);
        page.setRecords(java.util.List.of(vo));
        return page;
    }
}
