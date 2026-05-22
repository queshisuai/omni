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
    activity_artist,
    activity,
    station,
    tour,
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
INSERT INTO artist (id, name, description, avatar, status, alias, birth_date, birth_year, gender, artist_type, country_or_region, agency, representative_works, category_tags, external_links, source_note, risk_status) VALUES
(1, '周杰伦', '华语流行音乐人、创作歌手。', NULL, 1, 'Jay Chou', '1979-01-18', 1979, 'male', '个人', '中国台湾', '杰威尔音乐', '七里香,青花瓷,稻香', '歌手,创作人,流行', 'https://zh.wikipedia.org/wiki/周杰伦', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(2, '五月天', '华语摇滚乐团。', NULL, 1, 'Mayday', NULL, NULL, NULL, '乐队', '中国台湾', '相信音乐', '突然好想你,倔强,知足', '乐队,摇滚,流行', 'https://zh.wikipedia.org/wiki/五月天', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(3, '林俊杰', '华语流行创作歌手。', NULL, 1, 'JJ Lin', '1981-03-27', 1981, 'male', '个人', '新加坡', NULL, '江南,修炼爱情,可惜没如果', '歌手,创作人,流行', 'https://zh.wikipedia.org/wiki/林俊杰', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(4, '开心麻花', '中国喜剧舞台剧和影视制作团队。', NULL, 1, 'Mahua FunAge', NULL, NULL, NULL, '剧团', '中国大陆', NULL, '乌龙山伯爵,夏洛特烦恼', '话剧,喜剧,舞台剧', 'https://zh.wikipedia.org/wiki/开心麻花', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(5, '上海歌剧院', '综合性歌剧艺术院团。', NULL, 1, 'Shanghai Opera House', NULL, NULL, NULL, '院团', '中国大陆', NULL, '茶花女,卡门', '歌剧,音乐剧,古典', 'https://zh.wikipedia.org/wiki/上海歌剧院', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(6, '孟京辉戏剧工作室', '当代戏剧创作团队。', NULL, 1, NULL, NULL, NULL, NULL, '剧团', '中国大陆', NULL, '恋爱的犀牛,两只狗的生活意见', '话剧,先锋戏剧', 'https://zh.wikipedia.org/wiki/孟京辉', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(7, '郭艾伦', '中国篮球运动员。', NULL, 1, NULL, '1993-11-14', 1993, 'male', '运动员', '中国大陆', NULL, 'CBA,中国男篮', '篮球,体育', 'https://zh.wikipedia.org/wiki/郭艾伦', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(8, '英雄联盟职业联赛', '中国大陆英雄联盟职业电竞联赛。', NULL, 1, 'LPL', NULL, NULL, NULL, '赛事品牌', '中国大陆', NULL, '英雄联盟职业联赛', '电竞,赛事', 'https://zh.wikipedia.org/wiki/英雄联盟职业联赛', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(9, '中国田径协会', '中国田径运动全国性组织。', NULL, 1, 'CAA', NULL, NULL, NULL, '组织', '中国大陆', NULL, '路跑赛事,田径赛事', '体育,马拉松', 'https://zh.wikipedia.org/wiki/中国田径协会', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(10, '中国儿童艺术剧院', '国家级儿童艺术院团。', NULL, 1, 'China National Theatre for Children', NULL, NULL, NULL, '剧团', '中国大陆', NULL, '儿童剧,亲子剧', '儿童剧,亲子', 'https://zh.wikipedia.org/wiki/中国儿童艺术剧院', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(11, '科学队长', '面向青少年的科学教育内容品牌。', NULL, 1, NULL, NULL, NULL, NULL, '团队', '中国大陆', NULL, '科学实验秀,科普课程', '科学,亲子,互动', NULL, '公开资料整理；模拟档期非真实售票', 'normal'),
(12, '广州长隆国际大马戏', '大型马戏演艺品牌。', NULL, 1, 'Chimelong International Circus', NULL, NULL, NULL, '演艺团队', '中国大陆', NULL, '国际大马戏', '马戏,亲子,演艺', 'https://zh.wikipedia.org/wiki/广州长隆旅游度假区', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(13, 'teamLab', '国际艺术团体。', NULL, 1, 'teamLab', NULL, NULL, NULL, '艺术团队', '日本', NULL, '无界美术馆,数字艺术展', '数字艺术,展览,沉浸式', 'https://zh.wikipedia.org/wiki/TeamLab', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(14, '故宫博物院', '中国综合性博物馆。', NULL, 1, 'The Palace Museum', NULL, NULL, NULL, '机构', '中国大陆', NULL, '故宫,文创,传统文化展', '国风,展览,传统文化', 'https://zh.wikipedia.org/wiki/故宫博物院', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(15, '中国摄影家协会', '全国性摄影艺术组织。', NULL, 1, NULL, NULL, NULL, NULL, '组织', '中国大陆', NULL, '摄影展,影像艺术', '摄影,影像,展览', 'https://zh.wikipedia.org/wiki/中国摄影家协会', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(16, '中国爱乐乐团', '中国交响乐团。', NULL, 1, 'China Philharmonic Orchestra', NULL, NULL, NULL, '乐团', '中国大陆', NULL, '交响音乐会,室内乐', '古典,交响,音乐会', 'https://zh.wikipedia.org/wiki/中国爱乐乐团', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(17, '上海交响乐团', '中国历史悠久的交响乐团。', NULL, 1, 'Shanghai Symphony Orchestra', NULL, NULL, NULL, '乐团', '中国大陆', NULL, '新年音乐会,交响音乐会', '古典,交响,音乐会', 'https://zh.wikipedia.org/wiki/上海交响乐团', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(18, '李泉', '华语音乐人、爵士流行歌手。', NULL, 1, NULL, '1969-10-12', 1969, 'male', '个人', '中国大陆', NULL, '走钢索的人,岛中央', '爵士,流行,音乐会', 'https://zh.wikipedia.org/wiki/李泉', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(19, '德云社', '相声演出团体。', NULL, 1, 'Deyun Club', NULL, NULL, NULL, '曲艺团体', '中国大陆', NULL, '相声大会,小剧场演出', '相声,曲艺', 'https://zh.wikipedia.org/wiki/德云社', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(20, '上海评弹团', '评弹艺术表演团体。', NULL, 1, NULL, NULL, NULL, NULL, '曲艺团体', '中国大陆', NULL, '评弹,苏州评弹', '评弹,曲艺,传统文化', NULL, '公开资料整理；模拟档期非真实售票', 'normal'),
(21, '笑果文化', '脱口秀内容与演出厂牌。', NULL, 1, NULL, NULL, NULL, NULL, '厂牌', '中国大陆', NULL, '脱口秀大会,线下喜剧', '脱口秀,喜剧', 'https://zh.wikipedia.org/wiki/笑果文化', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(22, '陶身体剧场', '中国现代舞团。', NULL, 1, 'TAO Dance Theater', NULL, NULL, NULL, '舞团', '中国大陆', NULL, '数字系列,现代舞剧场', '现代舞,舞蹈', 'https://zh.wikipedia.org/wiki/陶身体剧场', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(23, '中央芭蕾舞团', '中国国家芭蕾舞团。', NULL, 1, 'National Ballet of China', NULL, NULL, NULL, '舞团', '中国大陆', NULL, '天鹅湖,红色娘子军', '芭蕾,舞蹈', 'https://zh.wikipedia.org/wiki/中央芭蕾舞团', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(24, '中国歌剧舞剧院', '国家级艺术院团。', NULL, 1, 'China National Opera and Dance Drama Theater', NULL, NULL, NULL, '院团', '中国大陆', NULL, '孔子,李白,舞剧', '国风,舞蹈,舞剧', 'https://zh.wikipedia.org/wiki/中国歌剧舞剧院', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(25, '初音未来', '虚拟歌手。', NULL, 1, 'Hatsune Miku', NULL, NULL, NULL, '虚拟艺人', '日本', 'Crypton Future Media', 'Tell Your World,世界第一的公主殿下', '二次元,虚拟歌手,演唱会', 'https://zh.wikipedia.org/wiki/初音未来', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(26, '哔哩哔哩', '综合性视频社区及二次元文化品牌。', NULL, 1, 'Bilibili', NULL, NULL, NULL, '平台品牌', '中国大陆', NULL, 'Bilibili Macro Link,电竞嘉年华', '二次元,电竞,嘉年华', 'https://zh.wikipedia.org/wiki/哔哩哔哩', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(27, '山口胜平', '日本男性声优。', NULL, 1, 'Kappei Yamaguchi', '1965-05-23', 1965, 'male', '个人', '日本', NULL, '名侦探柯南,犬夜叉,海贼王', '声优,二次元,见面会', 'https://zh.wikipedia.org/wiki/山口胜平', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(28, '乌镇旅游股份有限公司', '乌镇景区运营与文化旅游机构。', NULL, 1, 'Wuzhen Tourism', NULL, NULL, NULL, '机构', '中国大陆', NULL, '乌镇戏剧节,江南水乡', '文旅,节庆,旅行', 'https://zh.wikipedia.org/wiki/乌镇镇', '公开百科资料整理；模拟档期非真实售票', 'normal'),
(29, '成都非遗博览园', '非遗展示与体验园区。', NULL, 1, NULL, NULL, NULL, NULL, '机构', '中国大陆', NULL, '非遗体验,传统手作', '非遗,展览,文旅', NULL, '公开资料整理；模拟档期非真实售票', 'normal'),
(30, '中国旅游集团', '综合性旅游产业集团。', NULL, 1, 'China Tourism Group', NULL, NULL, NULL, '机构', '中国大陆', NULL, '城市旅游展,目的地推广', '旅游,展览,文旅', 'https://zh.wikipedia.org/wiki/中国旅游集团', '公开百科资料整理；模拟档期非真实售票', 'normal');
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
(1, 1, 1, 2003, '周杰伦「嘉年华」世界巡回演唱会 北京站', '模拟档期演示数据，非真实售票；适合座位选座购票演示。', '/seed-posters/activity-01.jpg', 1),
(2, 1, 2, 2003, '五月天「回到那一天」巡回演唱会 上海站', '模拟档期演示数据，非真实售票；城市体育馆演唱会场景。', '/seed-posters/activity-02.jpg', 1),
(3, 1, 1, 2003, '华语音乐联合演唱会 广州站', '周杰伦、五月天、林俊杰联合阵容模拟演示，含站区票档。', '/seed-posters/activity-03.jpg', 1),
(4, 2, 4, 2005, '开心麻花爆笑舞台剧《乌龙山伯爵》北京站', '模拟档期演示数据，非真实售票；剧场座位图演示。', '/seed-posters/activity-04.jpg', 1),
(5, 2, 5, 2005, '经典歌剧《茶花女》上海站', '经典歌剧制作，剧院分区票档。', '/seed-posters/activity-05.jpg', 1),
(6, 2, 6, 2005, '孟京辉经典戏剧《恋爱的犀牛》成都站', '模拟档期演示数据，非真实售票；先锋话剧剧场演出。', '/seed-posters/activity-06.jpg', 1),
(7, 3, 7, 2006, '郭艾伦篮球明星挑战赛 成都站', '模拟档期演示数据，非真实售票；体育赛事票档演示。', '/seed-posters/activity-07.jpg', 1),
(8, 3, 8, 2006, 'LPL 英雄联盟职业联赛总决赛 深圳站', '模拟档期演示数据，非真实售票；电竞线下观赛。', '/seed-posters/activity-08.jpg', 1),
(9, 3, 9, 2006, '中国田径协会城市路跑嘉年华 西安站', '模拟档期演示数据，非真实售票；路跑开幕活动。', '/seed-posters/activity-09.jpg', 1),
(10, 4, 10, 2007, '中国儿童艺术剧院儿童剧《小王子》成都站', '模拟档期演示数据，非真实售票；亲子儿童剧。', '/seed-posters/activity-10.jpg', 1),
(11, 4, 11, 2007, '科学队长亲子科学实验秀 杭州站', '模拟档期演示数据，非真实售票；互动科普舞台。', '/seed-posters/activity-11.jpg', 1),
(12, 4, 12, 2007, '广州长隆国际大马戏巡演 南京站', '模拟档期演示数据，非真实售票；亲子马戏演出。', '/seed-posters/activity-12.jpg', 1),
(13, 5, 13, 2007, 'teamLab 数字艺术沉浸展 武汉站', '模拟档期演示数据，非真实售票；数字艺术展览。', '/seed-posters/activity-13.jpg', 1),
(14, 5, 14, 2007, '故宫博物院国风生活美学展 重庆站', '模拟档期演示数据，非真实售票；传统文化主题展。', '/seed-posters/activity-14.jpg', 1),
(15, 5, 15, 2007, '中国摄影家协会城市影像艺术展 重庆站', '模拟档期演示数据，非真实售票；摄影影像展。', '/seed-posters/activity-15.jpg', 1),
(16, 6, 16, 2003, '中国爱乐乐团室内乐音乐会 杭州站', '模拟档期演示数据，非真实售票；古典室内乐精选。', '/seed-posters/activity-16.jpg', 1),
(17, 6, 17, 2003, '上海交响乐团新年音乐会 南京站', '模拟档期演示数据，非真实售票；交响音乐会。', '/seed-posters/activity-17.jpg', 1),
(18, 6, 18, 2003, '李泉爵士流行音乐会 广州站', '模拟档期演示数据，非真实售票；爵士流行现场。', '/seed-posters/activity-18.jpg', 1),
(19, 7, 19, 2005, '德云社相声大会 北京站', '模拟档期演示数据，非真实售票；曲艺相声专场。', '/seed-posters/activity-19.jpg', 1),
(20, 7, 20, 2005, '上海评弹团经典评弹雅集 上海站', '模拟档期演示数据，非真实售票；传统评弹演出。', '/seed-posters/activity-20.jpg', 1),
(21, 7, 21, 2005, '笑果文化脱口秀周末秀 重庆站', '模拟档期演示数据，非真实售票；城市脱口秀现场。', '/seed-posters/activity-21.jpg', 1),
(22, 8, 22, 2005, '陶身体剧场现代舞《13》深圳站', '模拟档期演示数据，非真实售票；现代舞剧场作品。', '/seed-posters/activity-22.jpg', 1),
(23, 8, 23, 2005, '中央芭蕾舞团《天鹅湖》成都站', '模拟档期演示数据，非真实售票；经典芭蕾舞剧。', '/seed-posters/activity-23.jpg', 1),
(24, 8, 24, 2005, '中国歌剧舞剧院舞剧《李白》西安站', '模拟档期演示数据，非真实售票；国风舞剧专场。', '/seed-posters/activity-24.jpg', 1),
(25, 9, 25, 2003, '初音未来未来有你演唱会 上海站', '模拟档期演示数据，非真实售票；虚拟歌手演唱会。', '/seed-posters/activity-25.jpg', 1),
(26, 9, 26, 2006, 'Bilibili 二次元电竞嘉年华 深圳站', '模拟档期演示数据，非真实售票；二次元电竞嘉年华。', '/seed-posters/activity-26.jpg', 1),
(27, 9, 27, 2003, '山口胜平声优见面会 南京站', '模拟档期演示数据，非真实售票；声优互动见面会。', '/seed-posters/activity-27.jpg', 1),
(28, 10, 28, 2007, '乌镇江南水乡旅行节 杭州站', '模拟档期演示数据，非真实售票；文旅节庆体验活动。', '/seed-posters/activity-28.jpg', 1),
(29, 10, 29, 2007, '成都非遗博览园体验展 成都站', '模拟档期演示数据，非真实售票；非遗体验与展演。', '/seed-posters/activity-29.jpg', 1),
(30, 10, 30, 2007, '中国旅游集团丝路城市旅游展 西安站', '模拟档期演示数据，非真实售票；多目的地旅游展。', '/seed-posters/activity-30.jpg', 1);
UPDATE activity SET seat_map_visibility = 'hidden' WHERE id IN (1, 2, 3);
UPDATE activity SET seat_map_visibility = 'published' WHERE id IN (4, 5);
SELECT setval('activity_id_seq', 30, true);

-- ========== 巡演与城市站 demo ==========
INSERT INTO tour (id, title, artist_id, category_id, poster, description, organizer_id, review_status, status) VALUES
(1, '伍佰 ROCK STAR 2 巡回演唱会', NULL, 1, '/seed-posters/activity-01.jpg', '多城市巡演 demo，仅用于城市公布流程展示，不关联现有活动。', 2003, 'draft', 1)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    artist_id = EXCLUDED.artist_id,
    category_id = EXCLUDED.category_id,
    poster = EXCLUDED.poster,
    description = EXCLUDED.description,
    organizer_id = EXCLUDED.organizer_id,
    review_status = EXCLUDED.review_status,
    status = EXCLUDED.status,
    update_time = CURRENT_TIMESTAMP;

INSERT INTO station (id, tour_id, city, station_name, poster, description, venue_application_id, publish_status, status) VALUES
(1, 1, '哈尔滨', '伍佰 ROCK STAR 2 巡回演唱会 哈尔滨站', '/seed-posters/activity-01.jpg', '城市已公布，场馆待确认。', NULL, 'city_announced', 1),
(2, 1, '西安', '伍佰 ROCK STAR 2 巡回演唱会 西安站', '/seed-posters/activity-01.jpg', '城市已公布，场馆待确认。', NULL, 'city_announced', 1),
(3, 1, '济南', '伍佰 ROCK STAR 2 巡回演唱会 济南站', '/seed-posters/activity-01.jpg', '城市已公布，场馆待确认。', NULL, 'city_announced', 1),
(4, 1, '佛山', '伍佰 ROCK STAR 2 巡回演唱会 佛山站', '/seed-posters/activity-01.jpg', '城市已公布，场馆待确认。', NULL, 'city_announced', 1),
(5, 1, '南京', '伍佰 ROCK STAR 2 巡回演唱会 南京站', '/seed-posters/activity-01.jpg', '城市已公布，场馆待确认。', NULL, 'city_announced', 1)
ON CONFLICT (id) DO UPDATE SET
    tour_id = EXCLUDED.tour_id,
    city = EXCLUDED.city,
    station_name = EXCLUDED.station_name,
    poster = EXCLUDED.poster,
    description = EXCLUDED.description,
    venue_application_id = EXCLUDED.venue_application_id,
    publish_status = EXCLUDED.publish_status,
    status = EXCLUDED.status,
    update_time = CURRENT_TIMESTAMP;

SELECT setval('tour_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM tour), 1), 1), true);
SELECT setval('station_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM station), 1), 5), true);

INSERT INTO activity_artist (activity_id, artist_id, sort, is_primary, role_type, role_name, visibility, status) VALUES
(1, 1, 1, TRUE, 'primary', '主艺人', 'public', 1),
(1, 3, 2, FALSE, 'special_guest', '特邀嘉宾', 'hidden', 1),
(2, 2, 1, TRUE, 'primary', '主艺人', 'public', 1),
(3, 1, 1, FALSE, 'co_headliner', '联合主艺人', 'public', 1),
(3, 2, 2, FALSE, 'co_headliner', '联合主艺人', 'public', 1),
(3, 3, 3, FALSE, 'co_headliner', '联合主艺人', 'public', 1),
(4, 4, 1, TRUE, 'primary', '主演团队', 'public', 1),
(5, 5, 1, TRUE, 'primary', '演出院团', 'public', 1),
(6, 6, 1, TRUE, 'primary', '导演团队', 'public', 1),
(7, 7, 1, TRUE, 'primary', '明星球员', 'public', 1),
(8, 8, 1, TRUE, 'primary', '赛事品牌', 'public', 1),
(9, 9, 1, TRUE, 'primary', '赛事组织', 'public', 1),
(10, 10, 1, TRUE, 'primary', '演出院团', 'public', 1),
(11, 11, 1, TRUE, 'primary', '科普团队', 'public', 1),
(12, 12, 1, TRUE, 'primary', '演艺团队', 'public', 1),
(13, 13, 1, TRUE, 'primary', '艺术团队', 'public', 1),
(14, 14, 1, TRUE, 'primary', '文化机构', 'public', 1),
(15, 15, 1, TRUE, 'primary', '策展机构', 'public', 1),
(16, 16, 1, TRUE, 'primary', '演奏乐团', 'public', 1),
(17, 17, 1, TRUE, 'primary', '演奏乐团', 'public', 1),
(18, 18, 1, TRUE, 'primary', '主艺人', 'public', 1),
(19, 19, 1, TRUE, 'primary', '演出团体', 'public', 1),
(20, 20, 1, TRUE, 'primary', '演出团体', 'public', 1),
(21, 21, 1, TRUE, 'primary', '喜剧厂牌', 'public', 1),
(22, 22, 1, TRUE, 'primary', '舞团', 'public', 1),
(23, 23, 1, TRUE, 'primary', '舞团', 'public', 1),
(24, 24, 1, TRUE, 'primary', '演出院团', 'public', 1),
(25, 25, 1, TRUE, 'primary', '虚拟艺人', 'public', 1),
(26, 26, 1, TRUE, 'primary', '活动品牌', 'public', 1),
(27, 27, 1, TRUE, 'primary', '嘉宾声优', 'public', 1),
(28, 28, 1, TRUE, 'primary', '文旅机构', 'public', 1),
(29, 29, 1, TRUE, 'primary', '展览机构', 'public', 1),
(30, 30, 1, TRUE, 'primary', '展览机构', 'public', 1);
SELECT setval('activity_artist_id_seq', COALESCE((SELECT MAX(id) FROM activity_artist), 1), true);

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

INSERT INTO ticket_group (owner_type, owner_id, group_key, name, activity_price, source_block_ids, sort, status)
SELECT 'session', tta.session_id, 'area-' || tta.area_id, tt.name, tt.price, 'area-' || tta.area_id, va.sort, 1
FROM ticket_type_area tta
JOIN ticket_type tt ON tt.id = tta.ticket_type_id
JOIN venue_area va ON va.id = tta.area_id
ORDER BY tta.session_id, va.sort, va.id;

INSERT INTO ticket_group (owner_type, owner_id, group_key, name, activity_price, source_block_ids, sort, status)
VALUES ('session', 3, 'standing-3', '站区票', 280.00, 'standing-3', 99, 1);

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

INSERT INTO seat_block (owner_type, owner_id, block_key, name, block_type, ticket_group_key, x, y, capacity, color, sort, status)
VALUES ('session', 3, 'standing-3', '站区', 'standingBlock', 'standing-3', 120, 470, 300, '#7c3aed', 99, 1);

-- 音乐节演示站区：独立票档与价格，不生成座位号。
INSERT INTO ticket_type (id, session_id, name, price, total_stock, remain_stock, seat_block_id, ticket_group_key, status)
SELECT 91, 3, '站区票', 280.00, sb.capacity, sb.capacity, sb.id, sb.ticket_group_key, 1
FROM seat_block sb
WHERE sb.owner_type = 'session'
  AND sb.owner_id = 3
  AND sb.block_key = 'standing-3';
SELECT setval('ticket_type_id_seq', COALESCE((SELECT MAX(id) FROM ticket_type), 1), true);

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
    UPDATE ticket_type
    SET total_stock = GREATEST(total_stock - 1, 0),
        remain_stock = GREATEST(remain_stock - 1, 0)
    WHERE id = 11;

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
