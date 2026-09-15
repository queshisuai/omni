package com.omni.ticket.ai;

import com.omni.ticket.service.TicketFinderResult;

import java.util.Collections;
import java.util.List;

public class FinderResponse {
    private String requestId;
    private TicketIntent parsedIntent;
    private FinderClarification clarification;
    private List<TicketFinderResult> results;
    private String explanation;

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public TicketIntent getParsedIntent() { return parsedIntent; }
    public void setParsedIntent(TicketIntent parsedIntent) { this.parsedIntent = parsedIntent; }
    public FinderClarification getClarification() { return clarification; }
    public void setClarification(FinderClarification clarification) { this.clarification = clarification; }
    public List<TicketFinderResult> getResults() {
        return results == null ? Collections.emptyList() : results;
    }
    public void setResults(List<TicketFinderResult> results) {
        this.results = results == null ? Collections.emptyList() : List.copyOf(results);
    }
    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }
}
