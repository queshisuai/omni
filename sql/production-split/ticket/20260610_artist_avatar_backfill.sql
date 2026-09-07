-- owner: java-ticket
-- 将后台艺人档案补齐为仓库内可部署的本地头像资源。

UPDATE artist
SET avatar = CASE id
    WHEN 3 THEN '/avatars/artists/artist-3.webp'
    WHEN 4 THEN '/avatars/artists/artist-4.webp'
    WHEN 6 THEN '/avatars/artists/artist-6.webp'
    WHEN 7 THEN '/avatars/artists/artist-7.webp'
    WHEN 11 THEN '/avatars/artists/artist-11.webp'
    WHEN 12 THEN '/avatars/artists/artist-12.webp'
    WHEN 14 THEN '/avatars/artists/artist-14.webp'
    WHEN 18 THEN '/avatars/artists/artist-18.webp'
    WHEN 19 THEN '/avatars/artists/artist-19.webp'
    WHEN 25 THEN '/avatars/artists/artist-25.webp'
    WHEN 901008 THEN '/avatars/artists/artist-901008.webp'
    WHEN 901010 THEN '/avatars/artists/artist-901010.webp'
    WHEN 901023 THEN '/avatars/artists/artist-901023.webp'
    WHEN 901027 THEN '/avatars/artists/artist-901027.webp'
    WHEN 901030 THEN '/avatars/artists/artist-901030.webp'
    WHEN 901034 THEN '/avatars/artists/artist-901034.webp'
    WHEN 901035 THEN '/avatars/artists/artist-901035.webp'
    WHEN 901041 THEN '/avatars/artists/artist-901041.webp'
END,
source_note = CASE
    WHEN source_note IS NULL OR source_note = '' THEN '头像已本地归档'
    WHEN source_note LIKE '%头像已本地归档%' THEN source_note
    ELSE source_note || '；头像已本地归档'
END,
update_time = CURRENT_TIMESTAMP
WHERE id IN (3, 4, 6, 7, 11, 12, 14, 18, 19, 25, 901008, 901010, 901023, 901027, 901030, 901034, 901035, 901041);
