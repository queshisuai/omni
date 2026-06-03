package com.omni.ticket.search;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.service.ActivityService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ActivityServiceSearchDocumentSource implements ActivitySearchDocumentSource {

    private static final int PAGE_SIZE = 500;

    private final ActivityService activityService;

    public ActivityServiceSearchDocumentSource(ActivityService activityService) {
        this.activityService = activityService;
    }

    @Override
    public List<ActivitySearchDocument> listAllSearchDocuments() {
        List<ActivityVO> records = new ArrayList<>();
        int pageNo = 1;
        while (true) {
            Page<ActivityVO> page = activityService.listActivities(pageNo, PAGE_SIZE, null);
            if (page == null || page.getRecords() == null || page.getRecords().isEmpty()) {
                break;
            }
            records.addAll(page.getRecords());
            if (page.getPages() > 0 && pageNo >= page.getPages()) {
                break;
            }
            if (page.getRecords().size() < PAGE_SIZE) {
                break;
            }
            pageNo++;
        }
        return records.stream()
                .map(ActivitySearchDocumentBuilder::fromActivityVo)
                .filter(document -> document.getId() != null)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<ActivitySearchDocument> findActivityDocument(Long activityId) {
        if (activityId == null) {
            return Optional.empty();
        }
        return findDocument("activity", activityId);
    }

    @Override
    public Optional<ActivitySearchDocument> findTourDocument(Long tourId) {
        if (tourId == null) {
            return Optional.empty();
        }
        return findDocument("tour", tourId);
    }

    private Optional<ActivitySearchDocument> findDocument(String itemType, Long itemId) {
        return listAllSearchDocuments().stream()
                .filter(document -> itemType.equals(document.getItemType()))
                .filter(document -> itemId.equals(document.getId()))
                .findFirst();
    }
}
