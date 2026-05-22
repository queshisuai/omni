# Standing Ticket Explicit Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit `ticket_type -> seat_block` binding for standing tickets so standing inventory is auditable without name/capacity guessing.

**Architecture:** Add nullable binding fields to `ticket_type`, keep seated tickets bound through `session_seat`, and update ticket sales/stock recalculation services to use explicit standing block binding. Migrations backfill current standing demo data.

**Tech Stack:** Java Spring Boot, MyBatis-Plus, PostgreSQL, Maven.

---

## Task 1: Schema And Entity

- [ ] Add migrations adding `ticket_type.seat_block_id` and `ticket_type.ticket_group_key`.
- [ ] Backfill existing standing ticket type from same-session standing block where no seat rows exist and capacity matches.
- [ ] Add indexes for `seat_block_id` and `ticket_group_key`.
- [ ] Add fields/getters/setters to `TicketType`.

## Task 2: TDD Sales Binding Logic

- [ ] Add failing `TicketSalesInternalServiceTest` proving unseated ticket without `seat_block_id` is rejected.
- [ ] Add failing test proving unseated ticket with explicit standing block binding is allowed.
- [ ] Update `TicketSalesInternalService` to use explicit binding.

## Task 3: TDD Stock Recalculation

- [ ] Add failing `TicketTypeStockRecalculationServiceTest` proving standing ticket stock uses bound block capacity.
- [ ] Update `TicketTypeStockRecalculationService` to use explicit binding.

## Task 4: Verification And Commit

- [ ] Run focused tests.
- [ ] Run `mvn test -pl java-ticket -am`.
- [ ] Run SQL safety check.
- [ ] Run microservice boundary check.
- [ ] Run `git diff --check`.
- [ ] Commit changes.
