package com.omni.ticket.search;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.dto.ActivityVO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.function.Supplier;

@Service
public class ActivitySearchFacade {

    private static final Logger log = LoggerFactory.getLogger(ActivitySearchFacade.class);

    private final SearchProperties searchProperties;
    private final ElasticsearchActivitySearchRepository elasticsearchRepository;

    public ActivitySearchFacade(SearchProperties searchProperties,
                                ElasticsearchActivitySearchRepository elasticsearchRepository) {
        this.searchProperties = searchProperties;
        this.elasticsearchRepository = elasticsearchRepository;
    }

    public Page<ActivityVO> search(ActivitySearchRequest request, Supplier<Page<ActivityVO>> databaseFallback) {
        if (searchProperties == null || !searchProperties.getEs().isEnabled()) {
            return databaseFallback.get();
        }
        try {
            return elasticsearchRepository.search(request);
        } catch (RuntimeException e) {
            log.warn("ES搜索失败，已降级到数据库搜索: {}", e.getMessage());
            return databaseFallback.get();
        }
    }
}
