-- owner: java-order
-- Keep the electronic ticket sequence ahead of imported/backfilled rows.

ALTER TABLE electronic_ticket
    ALTER COLUMN id SET DEFAULT nextval('electronic_ticket_id_seq');

ALTER SEQUENCE electronic_ticket_id_seq OWNED BY electronic_ticket.id;

SELECT setval(
    'electronic_ticket_id_seq',
    GREATEST(COALESCE((SELECT MAX(id) FROM electronic_ticket), 1), 1),
    true
);
