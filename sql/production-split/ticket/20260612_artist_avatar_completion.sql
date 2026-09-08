-- owner: java-ticket
-- 补齐当前票务库中仍为空的艺人/机构头像。
-- 演示档案优先复用已有的对应活动宣传素材，避免继续使用首字占位。

UPDATE artist AS a
SET avatar = mapping.avatar,
    source_note = CASE
        WHEN a.source_note IS NULL OR a.source_note = '' THEN '头像已本地归档'
        WHEN a.source_note LIKE '%头像已本地归档%' THEN a.source_note
        ELSE a.source_note || '；头像已本地归档'
    END,
    update_time = CURRENT_TIMESTAMP
FROM (VALUES
    (1, '/avatars/artists/artist-1.jpg'),
    (2, '/seed-posters/activity-02.jpg'),
    (5, '/seed-posters/activity-05.jpg'),
    (8, '/seed-posters/activity-08.jpg'),
    (9, '/seed-posters/activity-09.jpg'),
    (10, '/avatars/artists/artist-10.jpg'),
    (13, '/seed-posters/activity-13.jpg'),
    (15, '/avatars/artists/artist-15.jpg'),
    (16, '/seed-posters/activity-16.jpg'),
    (17, '/avatars/artists/artist-17.jpg'),
    (20, '/seed-posters/activity-20.jpg'),
    (21, '/seed-posters/activity-21.jpg'),
    (22, '/seed-posters/activity-22.jpg'),
    (23, '/seed-posters/activity-23.jpg'),
    (24, '/seed-posters/activity-24.jpg'),
    (26, '/seed-posters/activity-26.jpg'),
    (27, '/seed-posters/activity-27.jpg'),
    (28, '/seed-posters/activity-28.jpg'),
    (29, '/seed-posters/activity-29.jpg'),
    (30, '/seed-posters/activity-30.jpg'),
    (901001, '/seed-posters-real/activity-900061.jpg'),
    (901002, '/seed-artist-avatars-real/artist-901002.jpg'),
    (901003, '/seed-artist-avatars-real/artist-901003.jpg'),
    (901004, '/seed-posters-real/activity-900021.jpg'),
    (901005, '/seed-posters-real/activity-900031.png'),
    (901006, '/seed-posters-real/activity-900041.jpg'),
    (901007, '/seed-posters-real/activity-900051.jpg'),
    (901009, '/seed-posters-real/activity-900062.png'),
    (901011, '/seed-posters-real/activity-900012.png'),
    (901012, '/seed-posters-real/activity-900022.png'),
    (901013, '/seed-posters-real/activity-900032.png'),
    (901014, '/seed-posters-real/activity-900042.png'),
    (901015, '/seed-posters-real/activity-900043.jpg'),
    (901016, '/seed-posters-real/activity-900053.jpg'),
    (901017, '/seed-posters-real/activity-900063.png'),
    (901018, '/seed-posters-real/activity-900003.jpg'),
    (901019, '/seed-posters-real/activity-900013.jpg'),
    (901020, '/seed-posters-real/activity-900023.jpg'),
    (901021, '/seed-posters-real/activity-900033.jpg'),
    (901022, '/seed-posters-real/activity-900034.jpg'),
    (901024, '/seed-posters-real/activity-900054.jpg'),
    (901025, '/seed-posters-real/activity-900064.png'),
    (901026, '/seed-posters-real/activity-900004.png'),
    (901028, '/seed-posters-real/activity-900024.jpg'),
    (901029, '/seed-posters-real/activity-900015.jpg'),
    (901031, '/seed-posters-real/activity-900005.jpg'),
    (901032, '/seed-posters-real/activity-900006.jpg'),
    (901033, '/seed-posters-real/activity-900016.jpg'),
    (901036, '/seed-posters-real/activity-900007.jpg'),
    (901037, '/seed-posters-real/activity-900017.jpg'),
    (901038, '/seed-posters-real/activity-900018.jpg'),
    (901039, '/seed-posters-real/activity-900028.jpg'),
    (901040, '/seed-posters-real/activity-900008.jpg'),
    (901042, '/seed-posters-real/activity-900019.jpg'),
    (901043, '/seed-posters-real/activity-900029.jpg'),
    (901044, '/seed-posters-real/activity-900030.jpg'),
    (901045, '/seed-posters-real/activity-900010.jpg'),
    (901046, '/seed-posters-real/activity-900020.jpg')
) AS mapping(id, avatar)
WHERE mapping.id = a.id
  AND NULLIF(BTRIM(a.avatar), '') IS NULL;
