# Team Grab Implementation Planning

## Goal

Create a concrete implementation plan for first-version team grab: 2-6 confirmed members, leader-managed strategy, any member can trigger one team grab, one leader-paid order, and member seat assignments after payment.

## Current Status

- [x] Confirmed current grab-service already has async queue and `request_type` support for `TEAM_GRAB`.
- [x] Confirmed current ticket-service has internal lock APIs but no strategy-based group seat selection yet.
- [x] Confirmed order-service already supports seat orders and payment-time confirmation/release flows.
- [x] Confirmed first version should use leader unified payment, not split member payments.
- [x] Create detailed implementation plan document.
- [x] Incorporate review corrections for transaction boundaries, lock ownership, order-owned seat labels, manifest updates, retry rules, and pnpm frontend checks.
- [ ] Wait for user approval before implementation.

## Scope

Planning only. Do not implement team grab production code in this phase.

## Output

- `docs/superpowers/plans/2026-05-30-team-grab.md`

## Historical Note

Previous root planning files covered Feign API refactor. That plan remains at `docs/superpowers/plans/2026-05-27-feign-api-refactor.md`.
