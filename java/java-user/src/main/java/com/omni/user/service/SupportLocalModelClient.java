package com.omni.user.service;

import java.util.Optional;

@FunctionalInterface
public interface SupportLocalModelClient {

    Optional<String> answer(String question, String projectKnowledge);
}
