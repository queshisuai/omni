# Feign API Refactor Task Plan

## Goal

Create a detailed implementation plan for extracting all Spring Cloud OpenFeign clients and their direct contract DTOs into a shared Maven module named `feign-api`.

## Current Status

- [x] Confirmed Java services already use OpenFeign for internal calls.
- [x] Confirmed no current Java `RestTemplate` usage in the searched source set.
- [x] Confirmed Feign clients and contract DTOs are duplicated across service modules.
- [x] Create the detailed implementation plan document.
- [ ] Wait for user approval before implementation.

## Scope

Planning only. Do not modify production Java code in this phase.

## Output

- `docs/superpowers/plans/2026-05-27-feign-api-refactor.md`

