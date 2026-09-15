package com.omni.ticket.ai;

import java.util.List;

public class TicketIntentParseResult {
    private final String requestId;
    private final TicketIntent intent;
    private final List<String> clarificationQuestions;

    public TicketIntentParseResult(String requestId, TicketIntent intent, List<String> clarificationQuestions) {
        this.requestId = requestId;
        this.intent = intent;
        this.clarificationQuestions = clarificationQuestions == null
                ? List.of()
                : List.copyOf(clarificationQuestions);
    }

    public String getRequestId() { return requestId; }
    public TicketIntent getIntent() { return intent; }
    public List<String> getClarificationQuestions() { return clarificationQuestions; }

    public boolean requiresClarification() {
        return !clarificationQuestions.isEmpty();
    }
}
