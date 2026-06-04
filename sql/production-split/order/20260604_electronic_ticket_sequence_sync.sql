-- owner: java-order
-- Keep the electronic ticket sequence ahead of imported/backfilled rows.

SELECT setval(
    'electronic_ticket_id_seq',
    GREATEST(COALESCE((SELECT MAX(id) FROM electronic_ticket), 1), 1),
    true
);
