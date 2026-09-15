package com.omni.ticket.ai;

import java.util.List;

public class FinderClarification {
    private boolean required;
    private List<String> questions;

    public FinderClarification() {
    }

    public FinderClarification(boolean required, List<String> questions) {
        this.required = required;
        this.questions = questions == null ? List.of() : List.copyOf(questions);
    }

    public boolean isRequired() { return required; }
    public void setRequired(boolean required) { this.required = required; }
    public List<String> getQuestions() { return questions; }
    public void setQuestions(List<String> questions) {
        this.questions = questions == null ? List.of() : List.copyOf(questions);
    }
}
