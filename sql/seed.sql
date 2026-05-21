-- Omni 万象抢票平台演示种子数据
-- 密码均为 123456 的 BCrypt 哈希；保留 CLAUDE.md 中约定的测试账号 ID。

TRUNCATE TABLE
    moment,
    review,
    user_auth,
    stock_log,
    notification,
    refund_request,
    payment,
    order_snapshot,
    order_seat,
    seat,
    reservation,
    "order",
    ticket_type_area,
    session_seat,
    ticket_type,
    session,
    activity,
    seat_override,
    ticket_group,
    seat_block,
    venue_default_layout_section,
    venue_default_layout,
    venue_seat,
    venue_area,
    venue_application,
    venue,
    artist,
    category,
    organizer_application,
    sms_code,
    "user"
RESTART IDENTITY CASCADE;

-- ========== 用户与主办方 ==========
INSERT INTO "user" (id, phone, password, nickname, role, organizer_status, organizer_name, status) VALUES
(2002, '13800000001', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '平台管理员', 'admin', 0, NULL, 1),
(2003, '13800000002', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '星河演艺主办方', 'organizer', 1, '星河演艺集团', 1),
(2004, '13900000001', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '普通用户小明', 'user', 0, NULL, 1),
(2005, '13800000003', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '城市剧场联盟', 'organizer', 1, '城市剧场联盟', 1),
(2006, '13800000004', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '运动赛事运营', 'organizer', 1, '华夏体育赛事运营', 1),
(2007, '13800000005', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '亲子展览主办方', 'organizer', 1, '童梦展演文化', 1),
(2008, '13900000002', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '观演用户小夏', 'user', 0, NULL, 1),
(2009, '13900000003', '$2a$10$h7kXQJ5yFmmf69sBnqawduYVZGdal5BXEv0o.XeFBVUZt5Gwq8fQ2', '曾被取消主办方', 'user', 3, '旧日演出工作室', 1);

INSERT INTO organizer_application (id, user_id, organizer_name, subject_type, contact_name, contact_phone, contact_email, license_no, business_scope, description, status, reviewer_id, review_note, review_time) VALUES
(1, 2003, '星河演艺集团', 'enterprise', '林星', '13800000002', 'contact@xinghe.example', '91110000XINGHE', '演唱会、音乐节、音乐会', '全国巡演主办方', 1, 2002, '资质完整，审核通过', CURRENT_TIMESTAMP - INTERVAL '40 days'),
(2, 2005, '城市剧场联盟', 'enterprise', '周南', '13800000003', 'service@theatre.example', '91310000THEATRE', '话剧、舞蹈、戏曲', '多城市剧场演出联盟', 1, 2002, '审核通过', CURRENT_TIMESTAMP - INTERVAL '35 days'),
(3, 2006, '华夏体育赛事运营', 'enterprise', '陈竞', '13800000004', 'sports@example.com', '91440000SPORTS', '体育赛事、电竞赛事', '体育赛事综合运营', 1, 2002, '审核通过', CURRENT_TIMESTAMP - INTERVAL '30 days'),
(4, 2007, '童梦展演文化', 'enterprise', '赵童', '13800000005', 'kids@example.com', '91510000KIDS', '儿童剧、亲子展、展览', '亲子和展览活动主办方', 1, 2002, '审核通过', CURRENT_TIMESTAMP - INTERVAL '25 days'),
(5, 2009, '旧日演出工作室', 'enterprise', '吴旧', '13900000003', 'old@example.com', '91610000OLD', '小型演出', '历史资质已取消', 1, 2002, '曾通过，后续被取消资格', CURRENT_TIMESTAMP - INTERVAL '120 days');

SELECT setval('user_id_seq', 2009, true);
SELECT setval('organizer_application_id_seq', 5, true);

-- ========== 分类 ==========
INSERT INTO category (id, name, icon, sort, status) VALUES
(1, '演唱会', NULL, 1, 1),
(2, '话剧歌剧', NULL, 2, 1),
(3, '体育', NULL, 3, 1),
(4, '儿童亲子', NULL, 4, 1),
(5, '展览休闲', NULL, 5, 1),
(6, '音乐会', NULL, 6, 1),
(7, '曲苑杂坛', NULL, 7, 1),
(8, '舞蹈芭蕾', NULL, 8, 1),
(9, '二次元', NULL, 9, 1),
(10, '旅游展览', NULL, 10, 1);
SELECT setval('category_id_seq', 10, true);

-- ========== 艺人/团队 ==========
INSERT INTO artist (id, name, description, avatar, status) VALUES
(1, '林川', '华语流行唱作人', NULL, 1),
(2, '银河电台', '城市流行乐队', NULL, 1),
(3, '仲夏音乐节阵容', '多组独立音乐人联合演出', NULL, 1),
(4, '城市剧场话剧团', '现实主义话剧团队', NULL, 1),
(5, '海上歌剧中心', '经典歌剧制作团队', NULL, 1),
(6, '开心制造喜剧社', '都市喜剧团队', NULL, 1),
(7, '成都猎鹰篮球俱乐部', '职业篮球俱乐部', NULL, 1),
(8, '深圳竞速电竞联盟', '电竞赛事运营团队', NULL, 1),
(9, '西安城墙马拉松组委会', '城市路跑赛事组委会', NULL, 1),
(10, '童梦剧团', '原创亲子儿童剧团队', NULL, 1),
(11, '奇妙科学秀', '亲子科学互动团队', NULL, 1),
(12, '森林马戏团', '亲子马戏演出团队', NULL, 1),
(13, '未来城市策展组', '城市科技展策展团队', NULL, 1),
(14, '国风生活市集', '传统文化市集品牌', NULL, 1),
(15, '重庆山城影像展', '城市影像策展团队', NULL, 1),
(16, '杭州爱乐室内乐团', '古典室内乐团', NULL, 1),
(17, '南京交响乐团', '城市交响乐团', NULL, 1),
(18, '广州爵士四重奏', '爵士乐团', NULL, 1),
(19, '德云新声相声社', '青年相声团队', NULL, 1),
(20, '江南评弹社', '传统评弹团队', NULL, 1),
(21, '山城脱口秀联盟', '脱口秀厂牌', NULL, 1),
(22, '白鹭现代舞团', '现代舞团', NULL, 1),
(23, '锦城芭蕾舞团', '古典芭蕾舞团', NULL, 1),
(24, '长安国风舞集', '国风舞蹈团队', NULL, 1),
(25, '次元夏日企划', '动漫音乐企划', NULL, 1),
(26, '星环电竞嘉年华', '二次元电竞嘉年华', NULL, 1),
(27, '幻境声优见面会', '声优见面会企划', NULL, 1),
(28, '江南水乡旅行节', '文旅节庆活动', NULL, 1),
(29, '巴蜀非遗体验展', '非遗体验策展团队', NULL, 1),
(30, '丝路城市旅游展', '旅游目的地联合展', NULL, 1);
SELECT setval('artist_id_seq', 30, true);

-- ========== 城市公共场馆 ==========
INSERT INTO venue (id, name, city, address, capacity, status) VALUES
(1, '北京星河体育馆', '北京', '北京市朝阳区星河路88号', 18000, 1),
(2, '北京东城剧院', '北京', '北京市东城区剧场街12号', 1200, 1),
(3, '上海海风音乐中心', '上海', '上海市浦东新区滨江大道500号', 12000, 1),
(4, '上海艺海剧场', '上海', '上海市黄浦区人民大道300号', 1600, 1),
(5, '广州珠江体育馆', '广州', '广州市天河区体育东路66号', 15000, 1),
(6, '深圳湾演艺中心', '深圳', '深圳市南山区滨海大道100号', 9000, 1),
(7, '成都锦城剧院', '成都', '成都市高新区天府大道188号', 1800, 1),
(8, '杭州西子音乐厅', '杭州', '杭州市西湖区曙光路28号', 2000, 1),
(9, '南京奥体中心体育馆', '南京', '南京市建邺区江东中路222号', 13000, 1),
(10, '武汉江城会展中心', '武汉', '武汉市汉阳区鹦鹉大道88号', 10000, 1),
(11, '西安长安剧场', '西安', '西安市碑林区南大街99号', 1400, 1),
(12, '重庆山城文化中心', '重庆', '重庆市渝中区嘉陵江滨江路70号', 3000, 1);
SELECT setval('venue_id_seq', 12, true);

-- ========== 场馆区域与座位模板 ==========
INSERT INTO venue_area (id, venue_id, name, row_count, seats_per_row, row_start, seat_start, color, sort, status) VALUES
(1, 1, 'VIP区', 5, 12, 1, 1, '#ff5a8a', 1, 1), (2, 1, 'A区', 8, 16, 1, 1, '#ffb020', 2, 1), (3, 1, '看台区', 10, 20, 1, 1, '#4f8cff', 3, 1),
(4, 2, 'VIP区', 4, 10, 1, 1, '#ff5a8a', 1, 1), (5, 2, 'A区', 6, 12, 1, 1, '#ffb020', 2, 1), (6, 2, 'B区', 8, 14, 1, 1, '#4f8cff', 3, 1),
(7, 3, 'VIP区', 5, 12, 1, 1, '#ff5a8a', 1, 1), (8, 3, 'A区', 8, 15, 1, 1, '#ffb020', 2, 1), (9, 3, '看台区', 10, 18, 1, 1, '#4f8cff', 3, 1),
(10, 4, 'VIP区', 4, 10, 1, 1, '#ff5a8a', 1, 1), (11, 4, 'A区', 7, 12, 1, 1, '#ffb020', 2, 1), (12, 4, 'B区', 8, 14, 1, 1, '#4f8cff', 3, 1),
(13, 5, 'VIP区', 5, 12, 1, 1, '#ff5a8a', 1, 1), (14, 5, 'A区', 8, 16, 1, 1, '#ffb020', 2, 1), (15, 5, '看台区', 10, 20, 1, 1, '#4f8cff', 3, 1),
(16, 6, 'VIP区', 5, 10, 1, 1, '#ff5a8a', 1, 1), (17, 6, 'A区', 8, 14, 1, 1, '#ffb020', 2, 1), (18, 6, '看台区', 10, 18, 1, 1, '#4f8cff', 3, 1),
(19, 7, 'VIP区', 4, 10, 1, 1, '#ff5a8a', 1, 1), (20, 7, 'A区', 6, 12, 1, 1, '#ffb020', 2, 1), (21, 7, 'B区', 8, 14, 1, 1, '#4f8cff', 3, 1),
(22, 8, 'VIP区', 4, 10, 1, 1, '#ff5a8a', 1, 1), (23, 8, 'A区', 7, 12, 1, 1, '#ffb020', 2, 1), (24, 8, 'B区', 8, 14, 1, 1, '#4f8cff', 3, 1),
(25, 9, 'VIP区', 5, 12, 1, 1, '#ff5a8a', 1, 1), (26, 9, 'A区', 8, 16, 1, 1, '#ffb020', 2, 1), (27, 9, '看台区', 10, 20, 1, 1, '#4f8cff', 3, 1),
(28, 10, 'VIP区', 5, 10, 1, 1, '#ff5a8a', 1, 1), (29, 10, 'A区', 8, 14, 1, 1, '#ffb020', 2, 1), (30, 10, '看台区', 10, 18, 1, 1, '#4f8cff', 3, 1),
(31, 11, 'VIP区', 4, 10, 1, 1, '#ff5a8a', 1, 1), (32, 11, 'A区', 6, 12, 1, 1, '#ffb020', 2, 1), (33, 11, 'B区', 8, 14, 1, 1, '#4f8cff', 3, 1),
(34, 12, 'VIP区', 4, 10, 1, 1, '#ff5a8a', 1, 1), (35, 12, 'A区', 7, 12, 1, 1, '#ffb020', 2, 1), (36, 12, 'B区', 9, 14, 1, 1, '#4f8cff', 3, 1);
SELECT setval('venue_area_id_seq', 36, true);

INSERT INTO venue_seat (venue_id, area_id, row_no, seat_no, seat_label, x, y, status)
SELECT
    va.venue_id,
    va.id,
    r.row_no,
    s.seat_no,
    '第' || r.row_no || '排' || s.seat_no || '座',
    va.sort * 260 + s.seat_no * 18,
    r.row_no * 24,
    1
FROM venue_area va
CROSS JOIN LATERAL generate_series(va.row_start, va.row_start + va.row_count - 1) AS r(row_no)
CROSS JOIN LATERAL generate_series(va.seat_start, va.seat_start + va.seats_per_row - 1) AS s(seat_no)
ORDER BY va.id, r.row_no, s.seat_no;

SELECT setval('venue_seat_id_seq', COALESCE((SELECT MAX(id) FROM venue_seat), 1), true);

-- ========== 场馆 SeatCraft 默认座位图 ==========
INSERT INTO venue_default_layout (id, venue_id, name, template_type, stage_title, stage_x, stage_y, canvas_width, canvas_height, status)
SELECT id, id, name || ' SeatCraft 座位图', 'concert', '舞台', 80, 40, 960, 720, 1
FROM venue
ORDER BY id;

INSERT INTO ticket_group (owner_type, owner_id, group_key, name, source_block_ids, sort, status)
SELECT 'venue', venue_id, 'area-' || id, name, 'area-' || id, sort, 1
FROM venue_area
WHERE status = 1
ORDER BY venue_id, sort, id;

INSERT INTO seat_block (owner_type, owner_id, block_key, name, block_type, ticket_group_key, x, y, rows, cols, row_spacing, seat_spacing, color, sort, status)
SELECT
    'venue',
    venue_id,
    'area-' || id,
    name,
    'gridBlock',
    'area-' || id,
    120 + (sort - 1) * 240,
    180,
    row_count,
    seats_per_row,
    20,
    18,
    color,
    sort,
    1
FROM venue_area
WHERE status = 1
ORDER BY venue_id, sort, id;

SELECT setval('venue_default_layout_id_seq', COALESCE((SELECT MAX(id) FROM venue_default_layout), 1), true);
SELECT setval('seat_block_id_seq', COALESCE((SELECT MAX(id) FROM seat_block), 1), true);
SELECT setval('ticket_group_id_seq', COALESCE((SELECT MAX(id) FROM ticket_group), 1), true);

-- ========== 活动 ==========
INSERT INTO activity (id, category_id, artist_id, organizer_id, name, description, poster, status) VALUES
(1, 1, 1, 2003, '林川「重逢在星河」巡回演唱会 北京站', '华语流行唱作人林川全新巡演，适合座位选座购票演示。', 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a', 1),
(2, 1, 2, 2003, '银河电台「午夜频率」演唱会 上海站', '城市流行乐队银河电台年度专场。', 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f', 1),
(3, 1, 3, 2003, '仲夏音乐节 广州站', '多舞台音乐节，分区域票档售卖。', 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea', 1),
(4, 2, 4, 2005, '话剧《下一站，春天》北京站', '都市现实主义话剧，剧场座位图演示。', 'https://images.unsplash.com/photo-1503095396549-807759245b35', 1),
(5, 2, 5, 2005, '经典歌剧《茶花女》上海站', '经典歌剧制作，剧院分区票档。', 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf', 1),
(6, 2, 6, 2005, '开心制造喜剧夜 成都站', '轻松都市喜剧专场。', 'https://images.unsplash.com/photo-1527224857830-43a7acc85260', 1),
(7, 3, 7, 2006, '成都猎鹰篮球主场揭幕战', '职业篮球主场赛事。', 'https://images.unsplash.com/photo-1546519638-68e109498ffc', 1),
(8, 3, 8, 2006, '深圳竞速电竞冠军赛', '电竞决赛线下观赛。', 'https://images.unsplash.com/photo-1542751371-adc38448a05e', 1),
(9, 3, 9, 2006, '西安城墙马拉松开幕式', '城市马拉松开幕活动。', 'https://images.unsplash.com/photo-1502904550040-7534597429ae', 1),
(10, 4, 10, 2007, '儿童剧《月亮邮局》成都站', '原创亲子儿童剧。', 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9', 1),
(11, 4, 11, 2007, '奇妙科学秀 杭州站', '互动科学亲子舞台。', 'https://images.unsplash.com/photo-1532094349884-543bc11b234d', 1),
(12, 4, 12, 2007, '森林马戏团 南京站', '适合全家观看的亲子马戏。', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819', 1),
(13, 5, 13, 2007, '未来城市科技展 武汉站', '科技互动展览。', 'https://images.unsplash.com/photo-1518005020951-eccb494ad742', 1),
(14, 5, 14, 2007, '国风生活市集 重庆站', '传统文化与生活方式市集。', 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622', 1),
(15, 5, 15, 2007, '山城影像艺术展 重庆站', '城市影像主题展。', 'https://images.unsplash.com/photo-1531058020387-3be344556be6', 1),
(16, 6, 16, 2003, '杭州爱乐室内乐音乐会', '古典室内乐精选曲目。', 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6', 1),
(17, 6, 17, 2003, '南京交响乐团新年音乐会', '交响乐团年度音乐会。', 'https://images.unsplash.com/photo-1507838153414-b4b713384a76', 1),
(18, 6, 18, 2003, '广州爵士四重奏现场', '爵士乐现场演出。', 'https://images.unsplash.com/photo-1511192336575-5a79af67a629', 1),
(19, 7, 19, 2005, '德云新声相声大会 北京站', '青年相声专场。', 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b', 1),
(20, 7, 20, 2005, '江南评弹雅集 上海站', '传统评弹演出。', 'https://images.unsplash.com/photo-1499364615650-ec38552f4f34', 1),
(21, 7, 21, 2005, '山城脱口秀周末秀 重庆站', '城市脱口秀现场。', 'https://images.unsplash.com/photo-1527224857830-43a7acc85260', 1),
(22, 8, 22, 2005, '白鹭现代舞《风从海上来》深圳站', '现代舞剧场作品。', 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad', 1),
(23, 8, 23, 2005, '锦城芭蕾《天鹅湖》成都站', '经典芭蕾舞剧。', 'https://images.unsplash.com/photo-1518834107812-67b0b7c58434', 1),
(24, 8, 24, 2005, '长安国风舞集 西安站', '国风舞蹈专场。', 'https://images.unsplash.com/photo-1508807526345-15e9b5f4eaff', 1),
(25, 9, 25, 2003, '次元夏日动漫音乐会 上海站', '动漫音乐现场。', 'https://images.unsplash.com/photo-1511512578047-dfb367046420', 1),
(26, 9, 26, 2006, '星环电竞嘉年华 深圳站', '二次元电竞嘉年华。', 'https://images.unsplash.com/photo-1511882150382-421056c89033', 1),
(27, 9, 27, 2003, '幻境声优见面会 南京站', '声优互动见面会。', 'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b', 1),
(28, 10, 28, 2007, '江南水乡旅行节 杭州站', '文旅节庆体验活动。', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee', 1),
(29, 10, 29, 2007, '巴蜀非遗体验展 成都站', '非遗体验与展演。', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e', 1),
(30, 10, 30, 2007, '丝路城市旅游展 西安站', '多目的地旅游展。', 'https://images.unsplash.com/photo-1488646953014-85cb44e25828', 1);
SELECT setval('activity_id_seq', 30, true);

-- ========== 未来场次；同一场馆时间错开 ==========
INSERT INTO session (id, activity_id, venue_id, start_time, end_time, status) VALUES
(1, 1, 1, CURRENT_DATE + INTERVAL '35 days 19 hours 30 minutes', CURRENT_DATE + INTERVAL '35 days 22 hours', 1),
(2, 2, 3, CURRENT_DATE + INTERVAL '38 days 19 hours 30 minutes', CURRENT_DATE + INTERVAL '38 days 22 hours', 1),
(3, 3, 5, CURRENT_DATE + INTERVAL '41 days 18 hours', CURRENT_DATE + INTERVAL '41 days 22 hours', 1),
(4, 4, 2, CURRENT_DATE + INTERVAL '44 days 19 hours 30 minutes', CURRENT_DATE + INTERVAL '44 days 21 hours 40 minutes', 1),
(5, 5, 4, CURRENT_DATE + INTERVAL '47 days 19 hours 30 minutes', CURRENT_DATE + INTERVAL '47 days 22 hours', 1),
(6, 6, 7, CURRENT_DATE + INTERVAL '50 days 20 hours', CURRENT_DATE + INTERVAL '50 days 22 hours', 1),
(7, 7, 7, CURRENT_DATE + INTERVAL '53 days 19 hours', CURRENT_DATE + INTERVAL '53 days 21 hours 30 minutes', 1),
(8, 8, 6, CURRENT_DATE + INTERVAL '56 days 14 hours', CURRENT_DATE + INTERVAL '56 days 19 hours', 1),
(9, 9, 11, CURRENT_DATE + INTERVAL '59 days 18 hours', CURRENT_DATE + INTERVAL '59 days 21 hours', 1),
(10, 10, 7, CURRENT_DATE + INTERVAL '62 days 10 hours 30 minutes', CURRENT_DATE + INTERVAL '62 days 12 hours', 1),
(11, 11, 8, CURRENT_DATE + INTERVAL '65 days 15 hours', CURRENT_DATE + INTERVAL '65 days 17 hours', 1),
(12, 12, 9, CURRENT_DATE + INTERVAL '68 days 10 hours', CURRENT_DATE + INTERVAL '68 days 12 hours', 1),
(13, 13, 10, CURRENT_DATE + INTERVAL '71 days 9 hours', CURRENT_DATE + INTERVAL '71 days 17 hours', 1),
(14, 14, 12, CURRENT_DATE + INTERVAL '74 days 10 hours', CURRENT_DATE + INTERVAL '74 days 18 hours', 1),
(15, 15, 12, CURRENT_DATE + INTERVAL '77 days 10 hours', CURRENT_DATE + INTERVAL '77 days 18 hours', 1),
(16, 16, 8, CURRENT_DATE + INTERVAL '80 days 19 hours 30 minutes', CURRENT_DATE + INTERVAL '80 days 21 hours 30 minutes', 1),
(17, 17, 9, CURRENT_DATE + INTERVAL '83 days 19 hours 30 minutes', CURRENT_DATE + INTERVAL '83 days 21 hours 30 minutes', 1),
(18, 18, 5, CURRENT_DATE + INTERVAL '86 days 20 hours', CURRENT_DATE + INTERVAL '86 days 22 hours', 1),
(19, 19, 2, CURRENT_DATE + INTERVAL '89 days 19 hours 30 minutes', CURRENT_DATE + INTERVAL '89 days 21 hours 30 minutes', 1),
(20, 20, 4, CURRENT_DATE + INTERVAL '92 days 19 hours 30 minutes', CURRENT_DATE + INTERVAL '92 days 21 hours 30 minutes', 1),
(21, 21, 12, CURRENT_DATE + INTERVAL '95 days 20 hours', CURRENT_DATE + INTERVAL '95 days 22 hours', 1),
(22, 22, 6, CURRENT_DATE + INTERVAL '98 days 19 hours 30 minutes', CURRENT_DATE + INTERVAL '98 days 21 hours 30 minutes', 1),
(23, 23, 7, CURRENT_DATE + INTERVAL '101 days 19 hours 30 minutes', CURRENT_DATE + INTERVAL '101 days 21 hours 30 minutes', 1),
(24, 24, 11, CURRENT_DATE + INTERVAL '104 days 19 hours 30 minutes', CURRENT_DATE + INTERVAL '104 days 21 hours 30 minutes', 1),
(25, 25, 3, CURRENT_DATE + INTERVAL '107 days 19 hours', CURRENT_DATE + INTERVAL '107 days 21 hours', 1),
(26, 26, 6, CURRENT_DATE + INTERVAL '110 days 14 hours', CURRENT_DATE + INTERVAL '110 days 18 hours', 1),
(27, 27, 9, CURRENT_DATE + INTERVAL '113 days 15 hours', CURRENT_DATE + INTERVAL '113 days 17 hours', 1),
(28, 28, 8, CURRENT_DATE + INTERVAL '116 days 10 hours', CURRENT_DATE + INTERVAL '116 days 18 hours', 1),
(29, 29, 7, CURRENT_DATE + INTERVAL '119 days 10 hours', CURRENT_DATE + INTERVAL '119 days 18 hours', 1),
(30, 30, 11, CURRENT_DATE + INTERVAL '122 days 10 hours', CURRENT_DATE + INTERVAL '122 days 18 hours', 1);
SELECT setval('session_id_seq', 30, true);

-- ========== 场次座位快照 ==========
INSERT INTO session_seat (session_id, venue_id, area_id, venue_seat_id, row_no, seat_no, seat_label, status)
SELECT s.id, s.venue_id, vs.area_id, vs.id, vs.row_no, vs.seat_no, vs.seat_label, 1
FROM session s
JOIN venue_seat vs ON vs.venue_id = s.venue_id
ORDER BY s.id, vs.area_id, vs.row_no, vs.seat_no;
SELECT setval('session_seat_id_seq', COALESCE((SELECT MAX(id) FROM session_seat), 1), true);

-- ========== 票档与区域绑定；库存等于绑定区域座位数 ==========
DO $$
DECLARE
    sess RECORD;
    vip_area BIGINT;
    a_area BIGINT;
    normal_area BIGINT;
    vip_count INTEGER;
    a_count INTEGER;
    normal_count INTEGER;
    base_price NUMERIC(10, 2);
    vip_ticket BIGINT;
    a_ticket BIGINT;
    normal_ticket BIGINT;
BEGIN
    FOR sess IN
        SELECT s.id AS session_id, s.venue_id, a.category_id
        FROM session s
        JOIN activity a ON a.id = s.activity_id
        ORDER BY s.id
    LOOP
        SELECT id INTO vip_area FROM venue_area WHERE venue_id = sess.venue_id AND name = 'VIP区' AND status = 1;
        SELECT id INTO a_area FROM venue_area WHERE venue_id = sess.venue_id AND name = 'A区' AND status = 1;
        SELECT id INTO normal_area FROM venue_area WHERE venue_id = sess.venue_id AND name IN ('B区', '看台区') AND status = 1 ORDER BY sort LIMIT 1;

        SELECT COUNT(*) INTO vip_count FROM session_seat WHERE session_id = sess.session_id AND area_id = vip_area AND status = 1;
        SELECT COUNT(*) INTO a_count FROM session_seat WHERE session_id = sess.session_id AND area_id = a_area AND status = 1;
        SELECT COUNT(*) INTO normal_count FROM session_seat WHERE session_id = sess.session_id AND area_id = normal_area AND status = 1;

        base_price := CASE sess.category_id
            WHEN 1 THEN 380
            WHEN 2 THEN 180
            WHEN 3 THEN 160
            WHEN 4 THEN 120
            WHEN 5 THEN 90
            WHEN 6 THEN 220
            WHEN 7 THEN 100
            WHEN 8 THEN 240
            WHEN 9 THEN 180
            WHEN 10 THEN 80
            ELSE 120
        END;

        vip_ticket := sess.session_id * 3 - 2;
        a_ticket := sess.session_id * 3 - 1;
        normal_ticket := sess.session_id * 3;

        INSERT INTO ticket_type (id, session_id, name, price, total_stock, remain_stock, status)
        VALUES
        (vip_ticket, sess.session_id, 'VIP票', base_price * 2.5, vip_count, vip_count, 1),
        (a_ticket, sess.session_id, 'A区票', base_price * 1.5, a_count, a_count, 1),
        (normal_ticket, sess.session_id, '普通票', base_price, normal_count, normal_count, 1);

        INSERT INTO ticket_type_area (ticket_type_id, session_id, area_id)
        VALUES
        (vip_ticket, sess.session_id, vip_area),
        (a_ticket, sess.session_id, a_area),
        (normal_ticket, sess.session_id, normal_area);
    END LOOP;
END $$;

SELECT setval('ticket_type_id_seq', COALESCE((SELECT MAX(id) FROM ticket_type), 1), true);
SELECT setval('ticket_type_area_id_seq', COALESCE((SELECT MAX(id) FROM ticket_type_area), 1), true);

-- ========== 场次级 SeatCraft 座位图与真实座位关联 ==========
INSERT INTO session_seat_layout (id, session_id, name, template_type, stage_title, stage_x, stage_y, canvas_width, canvas_height, status)
SELECT s.id, s.id, a.name || ' 场次座位图', 'concert', '舞台', 80, 40, 960, 720, 1
FROM session s
JOIN activity a ON a.id = s.activity_id
ORDER BY s.id;

INSERT INTO ticket_group (owner_type, owner_id, group_key, name, source_block_ids, sort, status)
SELECT 'session', tta.session_id, 'area-' || tta.area_id, tt.name, 'area-' || tta.area_id, va.sort, 1
FROM ticket_type_area tta
JOIN ticket_type tt ON tt.id = tta.ticket_type_id
JOIN venue_area va ON va.id = tta.area_id
ORDER BY tta.session_id, va.sort, va.id;

INSERT INTO seat_block (owner_type, owner_id, block_key, name, block_type, ticket_group_key, x, y, rows, cols, row_spacing, seat_spacing, color, sort, status)
SELECT
    'session',
    tta.session_id,
    'area-' || va.id,
    va.name,
    'gridBlock',
    'area-' || va.id,
    120 + (va.sort - 1) * 240,
    180,
    va.row_count,
    va.seats_per_row,
    20,
    18,
    va.color,
    va.sort,
    1
FROM ticket_type_area tta
JOIN venue_area va ON va.id = tta.area_id
ORDER BY tta.session_id, va.sort, va.id;

INSERT INTO session_seat_layout_section (id, session_layout_id, ticket_type_id, section_key, name, rows, cols, x, y, color, type, layout, seat_count, sort, status)
SELECT
    tt.id,
    ssl.id,
    tt.id,
    'area-' || va.id,
    va.name,
    va.row_count,
    va.seats_per_row,
    120 + (va.sort - 1) * 240,
    180,
    va.color,
    'core',
    'grid',
    va.row_count * va.seats_per_row,
    va.sort,
    1
FROM ticket_type_area tta
JOIN ticket_type tt ON tt.id = tta.ticket_type_id
JOIN venue_area va ON va.id = tta.area_id
JOIN session_seat_layout ssl ON ssl.session_id = tta.session_id
ORDER BY tta.session_id, va.sort, va.id;

UPDATE session_seat ss
SET ticket_type_id = tta.ticket_type_id,
    layout_section_id = ssls.id,
    seat_block_id = sb.id,
    ticket_group_key = 'area-' || ss.area_id,
    generated_row_no = ss.row_no,
    generated_seat_no = ss.seat_no,
    update_time = CURRENT_TIMESTAMP
FROM ticket_type_area tta
JOIN session_seat_layout ssl ON ssl.session_id = tta.session_id
JOIN session_seat_layout_section ssls ON ssls.session_layout_id = ssl.id AND ssls.ticket_type_id = tta.ticket_type_id
JOIN seat_block sb ON sb.owner_type = 'session' AND sb.owner_id = tta.session_id AND sb.block_key = 'area-' || tta.area_id
WHERE ss.session_id = tta.session_id
  AND ss.area_id = tta.area_id;

SELECT setval('session_seat_layout_id_seq', COALESCE((SELECT MAX(id) FROM session_seat_layout), 1), true);
SELECT setval('session_seat_layout_section_id_seq', COALESCE((SELECT MAX(id) FROM session_seat_layout_section), 1), true);
SELECT setval('seat_block_id_seq', COALESCE((SELECT MAX(id) FROM seat_block), 1), true);
SELECT setval('ticket_group_id_seq', COALESCE((SELECT MAX(id) FROM ticket_group), 1), true);

-- ========== 真实订单示例：1 笔已支付 + 1 笔已退款历史 ==========
DO $$
DECLARE
    paid_order BIGINT := 1;
    refunded_order BIGINT := 2;
    paid_seat_id BIGINT;
    refunded_seat_id BIGINT;
    paid_seat_label TEXT;
    refunded_seat_label TEXT;
BEGIN
    SELECT ss.id, ss.seat_label INTO paid_seat_id, paid_seat_label
    FROM session_seat ss
    WHERE ss.session_id = 1 AND ss.area_id = 1 AND ss.status = 1
    ORDER BY ss.row_no, ss.seat_no
    LIMIT 1;

    SELECT ss.id, ss.seat_label INTO refunded_seat_id, refunded_seat_label
    FROM session_seat ss
    WHERE ss.session_id = 4 AND ss.area_id = 5 AND ss.status = 1
    ORDER BY ss.row_no, ss.seat_no
    LIMIT 1;

    INSERT INTO "order" (id, order_no, user_id, session_id, ticket_type_id, quantity, amount, status, create_time, update_time)
    VALUES
    (paid_order, 'DMSEED202605210001', 2004, 1, 1, 1, (SELECT price FROM ticket_type WHERE id = 1), 2, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'),
    (refunded_order, 'DMSEED202605210002', 2008, 4, 11, 1, (SELECT price FROM ticket_type WHERE id = 11), 4, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day');

    INSERT INTO order_seat (order_id, session_seat_id, session_id, ticket_type_id, status, create_time, update_time)
    VALUES
    (paid_order, paid_seat_id, 1, 1, 1, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'),
    (refunded_order, refunded_seat_id, 4, 11, 4, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day');

    UPDATE session_seat
    SET status = 3, order_id = paid_order, ticket_type_id = 1, update_time = CURRENT_TIMESTAMP - INTERVAL '3 days'
    WHERE id = paid_seat_id;

    UPDATE session_seat
    SET status = 4, order_id = refunded_order, ticket_type_id = 11, update_time = CURRENT_TIMESTAMP - INTERVAL '1 day'
    WHERE id = refunded_seat_id;

    UPDATE ticket_type SET remain_stock = remain_stock - 1 WHERE id = 1;

    INSERT INTO payment (id, order_id, payment_no, payment_method, out_trade_no, trade_no, buyer_id, amount, status, pay_time, create_time)
    VALUES
    (1, paid_order, 'PAYSEED202605210001', 'ALIPAY', 'DMSEED202605210001', 'ALI-SEED-0001', '2004', (SELECT amount FROM "order" WHERE id = paid_order), 1, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days'),
    (2, refunded_order, 'PAYSEED202605210002', 'ALIPAY', 'DMSEED202605210002', 'ALI-SEED-0002', '2008', (SELECT amount FROM "order" WHERE id = refunded_order), 1, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days');

    INSERT INTO refund_request (id, order_id, user_id, payment_id, refund_no, amount, reason, status, reviewer_id, review_note, alipay_refund_no, raw_response, create_time, review_time, refund_time)
    VALUES
    (1, refunded_order, 2008, 2, 'REFSEED202605210001', (SELECT amount FROM "order" WHERE id = refunded_order), '演示历史订单已完成退款', 1, 2002, '演示种子自动退款闭环', 'ALI-REFUND-SEED-0001', '{"seed":true,"status":"refunded"}', CURRENT_TIMESTAMP - INTERVAL '1 day 6 hours', CURRENT_TIMESTAMP - INTERVAL '1 day 5 hours', CURRENT_TIMESTAMP - INTERVAL '1 day 4 hours');

    INSERT INTO order_snapshot (order_id, activity_id, activity_name, activity_poster, tour_id, station_id, session_id, session_time, venue_name, ticket_type_id, ticket_name, unit_price, quantity, seat_labels, create_time, update_time)
    SELECT o.id, a.id, a.name, a.poster, a.tour_id, a.station_id, o.session_id, s.start_time, v.name, tt.id, tt.name, tt.price, o.quantity,
           CASE WHEN o.id = paid_order THEN paid_seat_label ELSE refunded_seat_label END,
           o.create_time, o.update_time
    FROM "order" o
    JOIN session s ON s.id = o.session_id
    JOIN activity a ON a.id = s.activity_id
    JOIN venue v ON v.id = s.venue_id
    JOIN ticket_type tt ON tt.id = o.ticket_type_id
    WHERE o.id IN (paid_order, refunded_order);
END $$;

SELECT setval('order_id_seq', COALESCE((SELECT MAX(id) FROM "order"), 1), true);
SELECT setval('order_seat_id_seq', COALESCE((SELECT MAX(id) FROM order_seat), 1), true);
SELECT setval('payment_id_seq', COALESCE((SELECT MAX(id) FROM payment), 1), true);
SELECT setval('refund_request_id_seq', COALESCE((SELECT MAX(id) FROM refund_request), 1), true);
SELECT setval('order_snapshot_id_seq', COALESCE((SELECT MAX(id) FROM order_snapshot), 1), true);

-- ========== 示例场馆申请 ==========
INSERT INTO venue_application (id, applicant_id, venue_id, venue_name, city, address, capacity, contact_name, contact_phone, qualification_no, business_scope, description, status, reviewer_id, review_note, review_time) VALUES
(1, 2005, 4, '上海艺海剧场', '上海', '上海市黄浦区人民大道300号', 1600, '周南', '13800000003', 'VENUE-SH-001', '话剧歌剧演出', '已关联公共场馆，供主办方创建场次使用。', 1, 2002, '已关联公共场馆', CURRENT_TIMESTAMP - INTERVAL '20 days'),
(2, 2007, NULL, '苏州亲子艺术中心', '苏州', '苏州市工业园区星湖街66号', 1200, '赵童', '13800000005', 'VENUE-SZ-001', '儿童亲子演出', '待审核示例申请。', 0, NULL, NULL, NULL);
SELECT setval('venue_application_id_seq', 2, true);

-- 种子订单保留真实票档、座位、快照、支付和退款记录；已支付统计与已售座位保持 1:1。
