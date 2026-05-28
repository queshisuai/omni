# Feign API Refactor Findings

## Existing Feign Clients

- `java-order`: `UserInternalClient`, `TicketSalesInternalClient`, `PaymentInternalClient`
- `java-ticket`: `UserInternalClient`, `OrderInternalClient`, `PaymentInternalClient`, `NotificationInternalClient`
- `java-payment`: `UserInternalClient`, `OrderClient`, `TicketRefundReviewInternalClient`

## Existing OpenFeign Setup

- `java-ticket`, `java-payment`, and `java-notification` use broad `@EnableFeignClients`.
- `java-order` enables Feign through `OrderFeignClientConfiguration` nested in `PaymentInternalClient.java`.
- `java-notification` has OpenFeign dependency and annotation, but no current Feign client consumption was found.

## Important Design Finding

`feign-api` should not be scanned wholesale in every service. Each service should explicitly register only the clients it consumes with `@EnableFeignClients(clients = {...})`, otherwise unused clients and duplicate same-service clients can be registered.

## DTO Duplication Examples

- `InternalUserRefResponse` exists in user/order/ticket/payment.
- `PaymentSyncDecisionResponse` exists in order/payment.
- `DirectRefundRequest` and `DirectRefundResponse` exist in ticket/payment.
- `OrderInfoResponse` exists in ticket/payment while order exposes compatible internal JSON from other DTO/entity types.

