package com.omni.user.dto;

public class HelpFaqResponse {

    private String category;
    private String question;
    private String answer;

    public HelpFaqResponse() {
    }

    public HelpFaqResponse(String category, String question, String answer) {
        this.category = category;
        this.question = question;
        this.answer = answer;
    }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
}
