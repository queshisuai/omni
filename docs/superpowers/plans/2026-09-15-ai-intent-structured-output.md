# AI Intent Structured Output + Semantic Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ticket Finder intent generation structurally reliable and semantically constrained while preserving legacy客服 behavior.

**Architecture:** Add an optional response-format value to the generic AI request. `OllamaAiModelClient` emits native Ollama `format` only when explicitly requested, leaving legacy payloads unchanged. `TicketIntentParser` requests the Finder JSON schema, keeps strict Jackson parsing, and deterministically removes model-inferred sale status, sorting, dates, and prices that are not supported by the original query.

**Tech Stack:** Java 21, Spring Boot, Jackson, JUnit 5, native Ollama `/api/chat`.

---

### Task 1: Inspect and lock existing contracts

**Files:**
- Inspect: `java/java-ai-core/src/main/java/com/omni/ai/dto/AiRequest.java`
- Inspect: `java/java-ai-core/src/main/java/com/omni/ai/client/OllamaAiModelClient.java`
- Inspect: `java/java-ticket/src/main/java/com/omni/ticket/ai/TicketIntentParser.java`
- Inspect: `java/java-ticket/src/main/resources/prompts/ticket-finder-intent-v1.txt`

- [ ] Confirm current constructor, builder, serialization, and parser call paths before edits.
- [ ] Confirm legacy客服 call sites pass no response format.

### Task 2: Add core response-format contract with tests

**Files:**
- Modify: `java/java-ai-core/src/main/java/com/omni/ai/dto/AiRequest.java`
- Modify: `java/java-ai-core/src/main/java/com/omni/ai/client/OllamaAiModelClient.java`
- Test: `java/java-ai-core/src/test/java/com/omni/ai/client/OllamaAiModelClientTest.java`
- Test: `java/java-ai-core/src/test/java/com/omni/ai/dto/AiDtoTest.java`

- [ ] Add a failing test proving `responseFormat=null` omits native `format` and preserves the old payload.
- [ ] Add a failing test proving JSON/schema format is serialized as native Ollama `format`.
- [ ] Implement the smallest immutable request field/API compatible with current builder usage.
- [ ] Run core tests and verify the new tests pass without changing old behavior.

### Task 3: Add Finder schema and parser semantic tests

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/ai/TicketIntentParser.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/ai/TicketIntentModelOutput.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/ai/TicketIntent.java`
- Modify: `java/java-ticket/src/main/resources/prompts/ticket-finder-intent-v1.txt`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/ai/TicketIntentParserTest.java`

- [ ] Add failing tests for sale-status hallucination vs explicit status.
- [ ] Add failing tests for sort hallucination vs explicit price/time/recommendation language.
- [ ] Add failing tests for model-generated dates and prices being discarded when unsupported by the query.
- [ ] Add failing tests for adjacent seats without people count returning clarification.
- [ ] Add failing tests for prompt-injection text not changing parser constraints.
- [ ] Implement deterministic semantic normalization using the original query and existing `Clock`.
- [ ] Keep strict unknown-field/type/date/enum validation and no string slicing recovery.
- [ ] Request the Finder schema through the optional core response format.

### Task 4: Verify compatibility and runtime behavior

**Files:**
- Modify: `implementation-notes.md`

- [ ] Run java-ai-core tests.
- [ ] Run java-ticket Finder tests and full java-ticket tests.
- [ ] Run Maven compile.
- [ ] Restart java-ticket only; keep Gateway route unchanged at 35 seconds.
- [ ] Call direct and Gateway Finder endpoints for the required five real queries without printing credentials.
- [ ] Record results and remaining risks in `implementation-notes.md`.
- [ ] Run `git diff --check` and `git status`; do not commit, push, or merge.
