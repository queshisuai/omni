package com.omni.ticket.search;

import java.util.List;
import java.util.Optional;

public interface ActivitySearchDocumentSource {
    List<ActivitySearchDocument> listAllSearchDocuments();

    Optional<ActivitySearchDocument> findActivityDocument(Long activityId);

    Optional<ActivitySearchDocument> findTourDocument(Long tourId);
}
