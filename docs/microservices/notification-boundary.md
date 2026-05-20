# Notification Service Boundary

## Ownership

`java-notification` owns notification delivery records only. It does not own user identity data or order lifecycle data.

| Owns | Does Not Own |
|:---|:---|
| `notification` table | `"user"`, `"order"`, `payment`, and ticket-owned tables |

## Copied Identifiers

`java-notification` stores `userId` and `orderId` as **copied identifiers** — values received from callers (other services or controllers), not resolved through cross-service joins or direct database access to user/order tables.

- `userId`: identifies the notification recipient. This is a copied reference, not a managed foreign key into `"user"`.
- `orderId`: identifies the related order (where applicable). This is a copied reference, not a managed foreign key into `"order"`.

## Rules

1. `java-notification` must NOT import or reference `java-user` or `java-order` entity classes, mappers, or service beans.
2. `java-notification` must NOT use SQL `JOIN` or `FROM` referencing `"user"`, `"order"`, or any table owned by other services.
3. `java-notification` must NOT define MyBatis-Plus `@TableName` or mapper references pointing to tables outside its ownership.
4. Notification data must arrive with `userId` and `orderId` already resolved by the caller. The notification service stores them as opaque identifiers.
5. Future enhancements that need user/order data (e.g., display name, order status) must receive that data as copied fields from the caller or through an internal API call, not by joining the user or order table locally.

## Current Implementation Status

- `NotificationService` stores copied `userId` and `orderId` directly on the `Notification` entity.
- No user/order Mapper, Entity, or SQL join dependencies exist in production code.
- No tests exist yet for the notification module.

## Local-Only / Runtime-Only Constraints

- `sql/init.sql` contains `notification.user_id -> "user"(id)` and `notification.order_id -> "order"(id)` as schema-level foreign keys.
- These are shared-database deployment constraints, not runtime code dependencies.
- Before schema isolation, these FKs should be replaced with copied-id-only columns.
- The copied-id-only design is already reflected in the production code.

## Verification

Run from repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
```
