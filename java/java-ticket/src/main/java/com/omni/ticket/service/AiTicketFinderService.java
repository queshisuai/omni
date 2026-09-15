package com.omni.ticket.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.ai.FinderClarification;
import com.omni.ticket.ai.FinderResponse;
import com.omni.ticket.ai.TicketIntent;
import com.omni.ticket.ai.TicketIntentParseResult;
import com.omni.ticket.ai.TicketIntentParser;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.search.ActivitySearchProvider;
import com.omni.ticket.search.ActivitySearchRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

@Service
public class AiTicketFinderService {
    private static final int CANDIDATE_LIMIT = 100;

    private final TicketIntentParser intentParser;
    private final ActivitySearchProvider activitySearchProvider;
    private final TicketAvailabilityQueryService availabilityQueryService;
    private final TicketResultFormatter resultFormatter;

    public AiTicketFinderService(TicketIntentParser intentParser,
                                 ActivitySearchProvider activitySearchProvider,
                                 TicketAvailabilityQueryService availabilityQueryService,
                                 TicketResultFormatter resultFormatter) {
        this.intentParser = intentParser;
        this.activitySearchProvider = activitySearchProvider;
        this.availabilityQueryService = availabilityQueryService;
        this.resultFormatter = resultFormatter;
    }

    public FinderResponse interpret(String query) {
        TicketIntentParseResult parsed = intentParser.parse(query);
        return baseResponse(parsed);
    }

    public FinderResponse search(String query) {
        TicketIntentParseResult parsed = intentParser.parse(query);
        FinderResponse response = baseResponse(parsed);
        if (parsed.requiresClarification()) {
            return response;
        }
        TicketIntent intent = parsed.getIntent();
        Page<ActivityVO> candidates = activitySearchProvider.search(ActivitySearchRequest.builder()
                .page(1)
                .size(CANDIDATE_LIMIT)
                .keyword(intent.getKeyword())
                .city(intent.getCity())
                .dateFrom(intent.effectiveDateFrom())
                .dateTo(intent.effectiveDateTo())
                .minPrice(intent.getMinPrice())
                .maxPrice(intent.getMaxPrice())
                .saleStatus(intent.getSaleStatus())
                .seatMapOnly(intent.getIsSupportSeat())
                .realNameRequired(intent.getRealNameRequired())
                .sort(null)
                .build());
        List<ActivityVO> candidateRecords = candidates == null || candidates.getRecords() == null
                ? Collections.emptyList()
                : candidates.getRecords();
        List<TicketFinderResult> results = new ArrayList<>(
                availabilityQueryService.findAvailable(candidateRecords, intent));
        results.sort(comparator(intent.getSortPreference()));
        response.setResults(results);
        response.setExplanation(resultFormatter.explain(
                parsed.getRequestId(), results, intent.getPeopleCount()));
        return response;
    }

    private FinderResponse baseResponse(TicketIntentParseResult parsed) {
        FinderResponse response = new FinderResponse();
        response.setRequestId(parsed.getRequestId());
        response.setParsedIntent(parsed.getIntent());
        if (parsed.requiresClarification()) {
            response.setClarification(new FinderClarification(true, parsed.getClarificationQuestions()));
        }
        response.setResults(Collections.emptyList());
        return response;
    }

    private Comparator<TicketFinderResult> comparator(String sortPreference) {
        Comparator<TicketFinderResult> stableId = Comparator
                .comparing(TicketFinderResult::getActivityId, Comparator.nullsLast(Long::compareTo))
                .thenComparing(TicketFinderResult::getSessionId, Comparator.nullsLast(Long::compareTo))
                .thenComparing(TicketFinderResult::getTicketTypeId, Comparator.nullsLast(Long::compareTo));
        Comparator<TicketFinderResult> price = Comparator
                .comparing(TicketFinderResult::getPrice, Comparator.nullsLast(java.math.BigDecimal::compareTo));
        Comparator<TicketFinderResult> time = Comparator
                .comparing(TicketFinderResult::getSessionStartTime, Comparator.nullsLast(java.time.LocalDateTime::compareTo));
        if ("PRICE_ASC".equals(sortPreference)) {
            return price.thenComparing(time).thenComparing(stableId);
        }
        if ("TIME_ASC".equals(sortPreference)) {
            return time.thenComparing(price).thenComparing(stableId);
        }
        return time.thenComparing(price).thenComparing(stableId);
    }
}
