# Service Boundaries

## Goal

当前阶段采用逻辑解耦优先策略：服务仍共用同一个 PostgreSQL 实例，但生产代码必须遵守服务数据所有权，不能通过 Mapper 或 SQL 直接读取其他服务拥有的表。

## Ownership

| Service | Owns |
|:---|:---|
| java-user | `user`, `organizer_application` |
| java-ticket | `tour`, `station`, `activity`, `venue`, `venue_application`, `session`, `ticket_type`, `session_seat`, SeatCraft tables |
| java-order | `order`, `order_seat` |
| java-payment | payment and refund transaction tables |
| java-notification | notification tables |
| java-gateway | no business tables |

## Rules

- `java-ticket` must call `java-user` internal API for user role and status.
- `java-order` must call `java-ticket` internal API for ticket price, stock, and seat changes.
- `java-payment` must call `java-order` internal API for order status changes.
- New internal endpoints must require `X-Internal-Token`.
- Empty internal token configuration is invalid for cross-service calls.
- New SQL migration files must include an owner comment at the top.

## Current Exceptions

- `java-order` still reads ticket tables during the next phase until inventory internal APIs are introduced.
- `java-order` still joins ticket tables for order list display until order snapshots are introduced.

## Verification

- After Phase B, `java-ticket` production code must not reference `UserRefMapper`.
- After Phase C, `java-order` production code must not reference ticket inventory mappers.
