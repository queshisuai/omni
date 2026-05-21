# Cross-Service Database Constraint Inventory

The system still uses one PostgreSQL database. This document identifies constraints that will block future schema/database isolation.

## Classification

- `same-owner`: child and referenced tables are owned by the same service; safe to keep when splitting inside that service boundary.
- `cross-owner`: child and referenced tables are owned by different services; must be replaced or made optional before physical split.
- `legacy-unused`: table belongs to a removed or superseded feature; keep inventoried until a cleanup migration explicitly removes it.

## Known Cross-Owner Constraints

| SQL File | Child Table / Column | References | Current Runtime Replacement | Proposed Treatment |
|:---|:---|:---|:---|:---|
| `sql/init.sql`, `sql/migrations/shared/20260518_create_venue_application.sql` | `venue_application.applicant_id` | `"user"(id)` | `java-ticket -> java-user` internal API for applicant role/status checks | Keep during shared DB; replace with application validation before schema split |
| `sql/init.sql`, `sql/migrations/shared/20260518_create_venue_application.sql` | `venue_application.reviewer_id` | `"user"(id)` | `java-ticket -> java-user` internal API for reviewer role/status checks | Keep during shared DB; store copied reviewer id without FK before schema split |
| `sql/init.sql` | `activity.organizer_id` | `"user"(id)` | `java-ticket -> java-user` internal API for organizer role/status | Keep during shared DB; replace with application validation before schema split |
| `sql/init.sql` | `reservation.user_id` | `"user"(id)` | Legacy table; no current primary runtime path | Mark as `legacy-unused`; review for cleanup before schema split |
| `sql/init.sql` | `"order".user_id` | `"user"(id)` | JWT user id and order service user context | Keep during shared DB; add explicit user validation if needed before physical split |
| `sql/init.sql` | `"order".session_id` | `session(id)` | `java-order -> java-ticket` quote API and `order_snapshot` | Candidate to drop before schema split after order create tests cover missing session |
| `sql/init.sql` | `"order".ticket_type_id` | `ticket_type(id)` | `java-order -> java-ticket` quote API | Candidate to drop before schema split after order create tests cover missing ticket type |
| `sql/init.sql`, `sql/migrations/shared/20260518_create_order_seat.sql` | `order_seat.session_seat_id` | `session_seat(id)` | `java-order -> java-ticket` seat lock/confirm APIs | Candidate to replace with copied seat id only before schema split |
| `sql/init.sql`, `sql/migrations/shared/20260518_create_session_seat.sql` | `session_seat.order_id` | `"order"(id)` | `java-ticket` seat state is changed through ticket internal APIs called by `java-order` | Review before split; avoid ticket-owned table FK to order-owned table |
| `sql/init.sql` | `payment.order_id` | `"order"(id)` | `java-payment -> java-order` internal API | Candidate to drop before schema split after payment create validates order through API |
| `sql/init.sql`, `sql/migrations/shared/20260517_create_refund_request.sql` | `refund_request.order_id` | `"order"(id)` | `java-payment -> java-order` internal API | Candidate to drop before schema split after refund create validates order through API |
| `sql/init.sql`, `sql/migrations/shared/20260517_create_refund_request.sql` | `refund_request.user_id` | `"user"(id)` | Applicant identity comes from order/user context | Review before split; likely store copied user id without FK |
| `sql/init.sql`, `sql/migrations/shared/20260517_create_refund_request.sql` | `refund_request.reviewer_id` | `"user"(id)` | `java-payment -> java-user` internal API for reviewer role checks | Store copied reviewer id without FK before schema split |
| `sql/init.sql` | `notification.user_id` | `"user"(id)` | Notification should use copied target user id from event/input | Replace with copied id before notification schema split |
| `sql/init.sql` | `notification.order_id` | `"order"(id)` | Notification should use copied order id from event/input | Replace with copied id before notification schema split |
| `sql/init.sql` | `stock_log.order_id` | `"order"(id)` | Ticket stock changes are coordinated through order/ticket service calls | Review before split; keep as copied order id or move stock audit ownership |
| `sql/init.sql` | `review.user_id` | `"user"(id)` | Legacy removed feature | Mark as `legacy-unused`; cleanup candidate |
| `sql/init.sql` | `review.order_id` | `"order"(id)` | Legacy removed feature | Mark as `legacy-unused`; cleanup candidate |
| `sql/init.sql` | `moment.user_id` | `"user"(id)` | Legacy removed feature | Mark as `legacy-unused`; cleanup candidate |

## Same-Owner Constraint Summary

The following groups are same-owner constraints and do not block a service-level split by themselves:

| Owner | Constraint Groups |
|:---|:---|
| `java-user` | `organizer_application -> "user"`, `user_auth -> "user"` |
| `java-ticket` | `activity -> category/artist`, `session -> activity/venue`, `ticket_type -> session`, `venue_area -> venue`, `venue_seat -> venue/venue_area`, `session_seat -> session/venue/venue_area/venue_seat/ticket_type/layout_section`, `ticket_type_area -> session/ticket_type/venue_area`, `reservation -> session`, `seat -> session/ticket_type`, `venue_seat_layout_template -> venue`, `venue_seat_layout_template_section -> venue_seat_layout_template`, `activity_seat_layout -> activity/venue_default_layout`, `activity_seat_layout_section -> activity_seat_layout`, `session_seat_layout -> session/activity_seat_layout`, `session_seat_layout_section -> session_seat_layout/activity_seat_layout_section/ticket_type`, `venue_default_layout -> venue`, `venue_default_layout_section -> venue_default_layout`, `seat_override -> seat_block`, `station -> tour`, `stock_log -> session/ticket_type`, `review -> activity` |
| `java-order` | `order_seat -> "order"`, `order_snapshot -> "order"` |
| `java-payment` | `refund_request.payment_id -> payment` |

## Open Questions

No unresolved ownership questions were found in the current SQL inventory.

## Next Migration Strategy

1. Do not drop constraints in the current phase.
2. Keep code-level service boundaries enforced by `scripts/check-service-boundaries.ps1`.
3. Add or keep tests proving services reject invalid cross-owner ids through internal APIs.
4. Convert cross-owner FK columns into copied ids only after runtime API validation is explicit.
5. Treat legacy removed feature tables (`review`, `moment`, old `reservation`) as cleanup candidates before schema isolation.
6. Start schema isolation in a local-only profile before any staging or production split.
7. Local FK removal experiments must use `sql/local/20260520_drop_cross_owner_fks_local_only.sql`; this file is a candidate script only and must not be wired into production migrations.
8. Production FK removal is blocked until the Production Migration Safety Gate in `docs/microservices/service-boundaries.md` passes.

## Schema Isolation Readiness Checklist

- [ ] Boundary script passes with no production code violations.
- [ ] `java-user`, `java-ticket`, `java-order`, and `java-payment` tests pass independently.
- [ ] Every cross-owner FK has a documented runtime API validation path.
- [ ] No production service depends on database joins across owner boundaries.
- [ ] A local-only schema split profile is planned before any staging/production split.
- [ ] Production Migration Safety Gate has passed before any staging/production FK removal.

## Verification

Cross-owner FK inventory is verified by scanning raw SQL text, without connecting to a database:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
```

- The script scans `sql/*.sql` for `REFERENCES` declarations.
- Each FK is classified as same-owner, cross-owner, or legacy based on the service ownership map.
- Detected cross-owner FKs are matched against the known inventory in this document.
- New or unclassified cross-owner references cause the script to exit non-zero.
- **Policy:** Any SQL migration introducing a new cross-owner FK must first update this document's Known Cross-Owner Constraints table and add the new entry to the script's allowlist; otherwise `check-cross-owner-fks.ps1` will fail.

When applying the local-only drop candidate on a disposable database, also run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
```

From `java/`:

```powershell
mvn test -pl java-payment,java-ticket,java-order -am --% -Dsurefire.failIfNoSpecifiedTests=false
```

`sql/local/20260520_drop_cross_owner_fks_local_only.sql` is not part of production schema migration. It exists only to support local schema isolation trials documented in `docs/microservices/schema-isolation-runbook.md`.
