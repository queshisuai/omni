-- owner: java-user

INSERT INTO rbac_role_permission (role_code, permission_code) VALUES
    ('organizer_admin', 'activity.manage'),
    ('organizer_admin', 'tour.manage'),
    ('organizer_admin', 'session.manage'),
    ('organizer_admin', 'artist.manage'),
    ('organizer_admin', 'order.view'),
    ('organizer_admin', 'refund.review'),
    ('organizer_admin', 'venue.manage'),
    ('organizer_admin', 'organizer.review'),
    ('organizer_admin', 'organizer.account.manage'),
    ('organizer_admin', 'venue.review'),
    ('organizer_admin', 'audit.view')
ON CONFLICT DO NOTHING;
