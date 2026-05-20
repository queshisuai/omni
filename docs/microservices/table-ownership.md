# Table Ownership

This project is still deployed on one PostgreSQL database, but table ownership follows service boundaries.

| Table / Group | Owner | Notes |
|:---|:---|:---|
| `"user"` | `java-user` | User identity, role, account status |
| `user_auth` | `java-user` | User authentication tokens |
| `sms_code` | `java-user` | SMS verification codes |
| `organizer_application` | `java-user` | Organizer application workflow |
| `category`, `artist` | `java-ticket` | Ticket catalog metadata |
| `tour`, `station` | `java-ticket` | Tour/station catalog |
| `activity`, `session`, `ticket_type`, `ticket_type_area`, `session_seat` | `java-ticket` | Activity, schedule, inventory, ticket areas, seats |
| `venue`, `venue_area`, `venue_seat`, `venue_application` | `java-ticket` | Venue, sections, seats, and organizer venue requests |
| `stock_log` | `java-ticket` | Inventory change log |
| `reservation` | `java-ticket` | Legacy reservation (superseded by order) |
| `seat` | `java-ticket` | Legacy seat (superseded by session_seat) |
| `review` | `java-ticket` | Legacy review (feature removed from C-end) |
| `moment` | `java-ticket` | Legacy moment (feature removed from C-end) |
| `venue_seat_layout_template`, `venue_seat_layout_template_section` | `java-ticket` | SeatCraft: reusable venue layout templates |
| `venue_default_layout`, `venue_default_layout_section` | `java-ticket` | SeatCraft: default venue layouts |
| `activity_seat_layout`, `activity_seat_layout_section` | `java-ticket` | SeatCraft: per-activity seat layouts |
| `session_seat_layout`, `session_seat_layout_section` | `java-ticket` | SeatCraft: per-session seat layouts |
| `seat_block`, `seat_override`, `ticket_group` | `java-ticket` | SeatCraft: block auto-generation, seat overrides, pricing groups |
| `"order"`, `order_seat` | `java-order` | Orders and seat selections |
| `order_snapshot` | `java-order` | Immutable order display snapshot from ticket quote |
| `payment` | `java-payment` | Payment transactions |
| `refund_request` | `java-payment` | Refund requests |
| `notification` | `java-notification` | Notifications |
