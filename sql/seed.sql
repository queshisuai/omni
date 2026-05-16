-- omni抢票平台种子数据
-- 基于前端 mock-data.ts 生成

-- ========== 用户角色（演示账号） ==========
-- 密码均为 123456 的 BCrypt 哈希
INSERT INTO "user" (id, phone, password, nickname, role, organizer_name, status) VALUES
(1001, '13800001111', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5Eh', '演唱会主办方', 'organizer', '北京音乐演出有限公司', 1),
(1002, '13800002222', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5Eh', '话剧院线', 'organizer', '开心麻花娱乐文化有限公司', 1),
(1003, '13800003333', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5Eh', '体育赛事运营', 'organizer', '中超联赛运营有限公司', 1),
(2001, '13900001111', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5Eh', '普通用户小明', 'user', NULL, 1);

SELECT setval('user_id_seq', 2001);

-- ========== 分类 (10条) ==========
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

-- 同步序列
SELECT setval('category_id_seq', 10);

-- ========== 艺人 (28条，每个活动一个) ==========
INSERT INTO artist (id, name, description, avatar, status) VALUES
(1, '微博大眼音乐节艺人阵容', '超强阵容', NULL, 1),
(2, 'BY2', '华语流行双胞胎组合', NULL, 1),
(3, '胡夏', '华语流行男歌手', NULL, 1),
(4, '奥森计划艺人阵容', '多元音乐人', NULL, 1),
(5, '民谣30年群星', '民谣歌手集合', NULL, 1),
(6, '良辰·声境如梦乐团', '古典跨界乐团', NULL, 1),
(7, '张泽', 'BEATBOX世界冠军', NULL, 1),
(8, '开心麻花团队', '开心麻花王牌喜剧团队', NULL, 1),
(9, '樊冲', '音乐剧导演/作曲', NULL, 1),
(10, '开心麻花宫廷剧组', '开心麻花宫廷剧团队', NULL, 1),
(11, '狐说臣与仙剧组', '原创音乐剧团队', NULL, 1),
(12, '丁一滕', '新锐戏剧导演', NULL, 1),
(13, '朱洁静、乔振宇', '知名舞蹈演员与演员', NULL, 1),
(14, '谋杀歌谣剧组', '外百老汇原版团队', NULL, 1),
(15, '北京国安足球俱乐部', '中超老牌劲旅', NULL, 1),
(16, '三角洲行动电竞战队', 'FPS职业战队', NULL, 1),
(17, '城市向阳跑组委会', '全民健身赛事', NULL, 1),
(18, '王者荣耀电竞选手', 'KPL职业选手', NULL, 1),
(19, '斯巴达勇士赛组委会', '国际障碍赛品牌', NULL, 1),
(20, '斯巴达勇士赛组委会', '国际障碍赛品牌', NULL, 1),
(21, '山东省齐鲁足球超级联赛组委会', '地方足球赛事', NULL, 1),
(22, '加拿大奇幻马秀团', '国际马戏团队', NULL, 1),
(23, '开心麻花儿童剧组', '开心麻花儿童剧团队', NULL, 1),
(24, '北京儿艺', '北京儿童艺术剧院', NULL, 1),
(25, '白雪公主剧组', '经典童话改编', NULL, 1),
(26, '凯叔讲故事团队', '亲子内容品牌', NULL, 1),
(27, '小猪佩奇舞台剧组', '知名IP改编', NULL, 1),
(28, '快乐六一马戏团', '节日马戏表演', NULL, 1);

SELECT setval('artist_id_seq', 28);

-- ========== 场馆 (22个不同的场馆) ==========
INSERT INTO venue (id, name, city, address, capacity, status) VALUES
(1, '待公布', '北京', '待定', NULL, 1),
(2, '首都体育馆', '北京', '北京市海淀区中关村南大街56号', 17500, 1),
(3, '国家体育馆', '北京', '北京市朝阳区天辰东路9号', 20000, 1),
(4, '奥森公园南区露天剧场', '北京', '北京市朝阳区奥林匹克森林公园南区内', 5000, 1),
(5, '北京喜剧院', '北京', '北京市东城区朝阳门北大街11号', 800, 1),
(6, '北京LIVERSE音宇宙艺术中心', '北京', '北京市朝阳区', 3000, 1),
(7, 'MAO Livehouse北京(东郎店)', '北京', '北京市东城区东郎电影创意产业园', 600, 1),
(8, '保利剧院', '北京', '北京市东城区东直门南大街14号', 1500, 1),
(9, '开心麻花A88剧场', '北京', '北京市朝阳区', 500, 1),
(10, '北京艺术中心-戏剧场', '北京', '北京市通州区城市绿心森林公园内', 1000, 1),
(11, '北京艺术中心-歌剧院', '北京', '北京市通州区城市绿心森林公园内', 1800, 1),
(12, '天桥艺术中心-中剧场', '北京', '北京市西城区天桥南大街9号', 1600, 1),
(13, 'M空间', '北京', '北京市海淀区复兴路69号', 8000, 1),
(14, '北京南海子公园', '北京', '北京市大兴区南海子公园', NULL, 1),
(15, '宝坻体育馆', '天津', '天津市宝坻区', 5000, 1),
(16, '北京延庆奥林匹克园区', '北京', '北京市延庆区张山营镇', NULL, 1),
(17, '山东省体育中心体育场', '济南', '山东省济南市市中区经十路20286号', 50000, 1),
(18, '开心麻花江湖饭局', '北京', '北京市朝阳区', 300, 1),
(19, '南锣剧场', '北京', '北京市东城区南锣鼓巷', 400, 1),
(20, '东图剧场-汇空间', '北京', '北京市东城区', 500, 1),
(21, '北京·隆福寺A99剧场', '北京', '北京市东城区隆福寺街95号', 400, 1);

SELECT setval('venue_id_seq', 21);

-- ========== 活动 (28条) ==========
INSERT INTO activity (id, category_id, artist_id, name, description, poster, status) VALUES
(1, 1, 1, '2026微博大眼音乐节', '2026微博大眼音乐节 - 超强阵容 即将开演', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i1/2251059038/O1CN01wwpkh22GdSmVPmqjQ_!!2251059038.jpg', 1),
(2, 1, 2, '2026 BY2「撇清关系2.0」十七周年演唱会 · 北京站', 'BY2十七周年演唱会北京站', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i1/2251059038/O1CN011T4dOK2GdSmT2mxkU_!!2251059038.jpg', 1),
(3, 1, 3, '2026胡夏【那些年·初见之约】演唱会-北京站', '胡夏演唱会北京站', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i3/2251059038/O1CN01zi0EBO2GdSmFU9a0X_!!2251059038.jpg', 1),
(4, 1, 4, '2026·奥森计划·漾（Awesome·Project·Young）', '奥森计划音乐节', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i1/2251059038/O1CN016KFu7g2GdSmEA7iud_!!2251059038.jpg', 1),
(5, 1, 5, '民谣30年·不如一见演唱会', '民谣30年经典演唱会', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i4/2251059038/O1CN01wwbQzO2GdSmONJqqn_!!2251059038.png', 1),
(6, 1, 6, '2026 「良辰·声境如梦」北京音乐会', '古典跨界音乐会', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i3/2251059038/O1CN01QY8exn2GdSmI1uzvl_!!2251059038.jpg', 1),
(7, 1, 7, '张泽 2026「张嘴就来」BEATBOX 巡演北京站', 'BEATBOX世界冠军巡演', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i3/2251059038/O1CN01e4olzX2GdSmPs2Z8l_!!2251059038.jpg', 1),
(8, 2, 8, '【明星场】喜人集结丨开心麻花王牌爆笑大戏《贼想得到你》', '开心麻花王牌爆笑大戏', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i2/2251059038/O1CN01E45fi92GdSmHuWw4o_!!2251059038.jpg', 1),
(9, 2, 9, '樊冲音乐剧《长安大国医》', '樊冲导演音乐剧作品', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i3/2251059038/O1CN01e74n562GdSmUfQk4p_!!2251059038.png', 1),
(10, 2, 10, '【年度爆剧】开心麻花大型宫廷舞台剧《甄嬛传》沉浸版', '开心麻花宫廷舞台剧沉浸版', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i2/2251059038/O1CN01jOfu4U2GdSmDM2zk1_!!2251059038.jpg', 1),
(11, 2, 11, '音乐剧《狐说臣与仙》', '原创音乐剧', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i3/2251059038/O1CN01iE4Xfx2GdSmXHZwyj_!!2251059038.png', 1),
(12, 2, 12, '丁一滕导演 张维伊、金靖主演 舞台剧《看不见的客人》', '新锐导演悬疑舞台剧', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i1/2251059038/O1CN01SE2rHm2GdSmTsh0QW_!!2251059038.png', 1),
(13, 2, 13, '朱洁静、乔振宇主演话剧《倾城之恋》五周年特别版', '经典话剧五周年特别版', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i1/2251059038/O1CN014FYnGy2GdSmPiajew_!!2251059038.png', 1),
(14, 2, 14, '外百老汇音乐剧《谋杀歌谣》中文版', '外百老汇经典音乐剧中文版', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i3/2251059038/O1CN01pPwjSt2GdSmPrdBNm_!!2251059038.png', 1),
(15, 3, 15, '2026怡宝中超联赛北京国安主场赛事', '2026中超联赛北京国安主场', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i2/2251059038/O1CN01IWgifq2GdSln18hWT_!!2251059038.jpg', 1),
(16, 3, 16, '2026三角洲行动烽火职业联赛春季赛决赛', 'FPS职业联赛春季决赛', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i4/2251059038/O1CN01lIQhdi2GdSmSQ6qJm_!!2251059038.jpg', 1),
(17, 3, 17, '2026「人机共生」城市向阳跑', '城市主题跑步活动', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i4/2251059038/O1CN01UJekCv2GdSmL4tuSj_!!2251059038.png', 1),
(18, 3, 18, '峡谷花开·荣耀宝地——2026王者荣耀宝坻主题电竞嘉年华', '王者荣耀电竞赛事', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i3/2251059038/O1CN013EVj9T2GdSmT9li3e_!!2251059038.jpg', 1),
(19, 3, 19, '2026斯巴达勇士越野周末-北京站 越野赛-21公里', '斯巴达越野赛21公里', 'https://img.alicdn.com/bao/uploaded/i2/2251059038/O1CN01sZHOmf2GdSmVk8QuU_!!4611686018427383646-0-item_pic.jpg', 1),
(20, 3, 20, '2026斯巴达勇士越野周末-北京站 越野赛-10公里', '斯巴达越野赛10公里', 'https://img.alicdn.com/bao/uploaded/i1/2251059038/O1CN01QcZ0312GdSmVqrKxG_!!4611686018427383646-0-item_pic.jpg', 1),
(21, 3, 21, '2026年山东省齐鲁足球超级联赛-济南赛区', '山东齐鲁足球超级联赛', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i4/2251059038/O1CN01ep8vlx2GdSmVMvjTw_!!2251059038.jpg', 1),
(22, 4, 22, '六一快乐-加拿大奇幻马秀一Ethereal灵秀·舞马（亲子马戏）', '加拿大奇幻马戏亲子秀', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i4/2251059038/O1CN01tGOHgY2GdSmP4yD9g_!!2251059038.jpg', 1),
(23, 4, 23, '开心麻花首个沉浸乐园儿童剧《安徒生盛会》', '开心麻花儿童剧', 'https://img.alicdn.com/bao/uploaded/i1/2251059038/O1CN01ok3mgt2GdSmBTnXj2_!!4611686018427383646-0-item_pic.jpg', 1),
(24, 4, 24, '北京儿艺儿童剧--《看得见的敦煌·壁画中的我们》', '北京儿艺儿童剧', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i2/2251059038/O1CN0123oUC62GdSm6PneUl_!!2251059038.jpg', 1),
(25, 4, 25, '【六一特惠】沉浸式亲子互动儿童剧《白雪公主》', '六一特惠白雪公主儿童剧', 'https://img.alicdn.com/bao/uploaded/i2/2251059038/O1CN012Tq6fk2GdSmZ9xEL2_!!4611686018427383646-2-item_pic.png', 1),
(26, 4, 26, '凯叔讲故事·亲子音乐剧《口袋神探》', '凯叔讲故事亲子音乐剧', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i1/2251059038/O1CN01tMJwKw2GdSmNWHsRn_!!2251059038.png', 1),
(27, 4, 27, '开心麻花沉浸式亲子儿童剧《小猪佩奇之奇妙一日游》', '小猪佩奇舞台剧', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i2/2251059038/O1CN01YUnxyO2GdSlpdxaSf_!!2251059038.jpg', 1),
(28, 4, 28, '【五折特惠】快乐六一欢乐马戏小丑嘉年华', '六一马戏小丑嘉年华', 'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i3/2251059038/O1CN01e4njmu2GdSmKrzTOj_!!2251059038.jpg', 1);

SELECT setval('activity_id_seq', 28);

-- ========== 场次 (28条，每个活动1个场次) ==========
INSERT INTO session (id, activity_id, venue_id, start_time, end_time, status) VALUES
(1, 1, 1, '2026-05-30 00:00:00', '2026-05-31 23:59:59', 1),
(2, 2, 2, '2026-05-23 19:30:00', '2026-05-23 22:00:00', 1),
(3, 3, 3, '2026-05-16 18:30:00', '2026-05-16 21:00:00', 1),
(4, 4, 4, '2026-05-16 00:00:00', '2026-05-17 23:59:59', 1),
(5, 5, 5, '2026-05-30 19:30:00', '2026-05-30 22:00:00', 1),
(6, 6, 6, '2026-06-06 18:00:00', '2026-06-06 21:00:00', 1),
(7, 7, 7, '2026-08-08 20:00:00', '2026-08-08 22:30:00', 1),
(8, 8, 1, '2026-05-20 00:00:00', '2026-06-28 23:59:59', 1),
(9, 9, 8, '2026-06-25 00:00:00', '2026-06-28 23:59:59', 1),
(10, 10, 9, '2026-05-15 00:00:00', '2026-06-28 23:59:59', 1),
(11, 11, 8, '2026-06-05 00:00:00', '2026-06-07 23:59:59', 1),
(12, 12, 10, '2026-07-11 00:00:00', '2026-07-12 23:59:59', 1),
(13, 13, 11, '2026-06-12 00:00:00', '2026-06-14 23:59:59', 1),
(14, 14, 12, '2026-05-22 00:00:00', '2026-05-23 23:59:59', 1),
(15, 15, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 1),
(16, 16, 13, '2026-05-16 15:00:00', '2026-05-16 20:00:00', 1),
(17, 17, 14, '2026-06-06 07:30:00', '2026-06-06 12:00:00', 1),
(18, 18, 15, '2026-05-16 00:00:00', '2026-05-17 23:59:59', 1),
(19, 19, 16, '2026-05-23 00:00:00', '2026-05-24 23:59:59', 1),
(20, 20, 16, '2026-05-23 00:00:00', '2026-05-24 23:59:59', 1),
(21, 21, 17, '2026-05-17 15:30:00', '2026-05-17 17:30:00', 1),
(22, 22, 1, '2026-05-01 00:00:00', '2026-06-30 23:59:59', 1),
(23, 23, 18, '2026-05-16 00:00:00', '2026-05-30 23:59:59', 1),
(24, 24, 19, '2026-05-22 00:00:00', '2026-06-14 23:59:59', 1),
(25, 25, 20, '2026-05-16 00:00:00', '2026-06-28 23:59:59', 1),
(26, 26, 8, '2026-06-13 00:00:00', '2026-06-14 23:59:59', 1),
(27, 27, 21, '2026-05-30 00:00:00', '2026-06-01 23:59:59', 1),
(28, 28, 3, '2026-05-30 00:00:00', '2026-05-30 23:59:59', 1);

SELECT setval('session_id_seq', 28);

-- ========== 票档 (每个场次3种票型) ==========
-- 函数辅助生成票档
DO $$
DECLARE
    s RECORD;
    base_price DECIMAL(10,2);
BEGIN
    FOR s IN SELECT id, activity_id FROM session LOOP
        -- 根据活动ID设置基准价格
        CASE s.activity_id
            WHEN 1 THEN base_price := 388;
            WHEN 2 THEN base_price := 380;
            WHEN 3 THEN base_price := 480;
            WHEN 4 THEN base_price := 199;
            WHEN 5 THEN base_price := 100;
            WHEN 6 THEN base_price := 188;
            WHEN 7 THEN base_price := 1;
            WHEN 8 THEN base_price := 80;
            WHEN 9 THEN base_price := 180;
            WHEN 10 THEN base_price := 180;
            WHEN 11 THEN base_price := 180;
            WHEN 12 THEN base_price := 80;
            WHEN 13 THEN base_price := 80;
            WHEN 14 THEN base_price := 180;
            WHEN 15 THEN base_price := 160;
            WHEN 16 THEN base_price := 98;
            WHEN 17 THEN base_price := 159;
            WHEN 18 THEN base_price := 52.8;
            WHEN 19 THEN base_price := 369;
            WHEN 20 THEN base_price := 269;
            WHEN 21 THEN base_price := 9.9;
            WHEN 22 THEN base_price := 90;
            WHEN 23 THEN base_price := 90;
            WHEN 24 THEN base_price := 80;
            WHEN 25 THEN base_price := 99;
            WHEN 26 THEN base_price := 80;
            WHEN 27 THEN base_price := 80;
            WHEN 28 THEN base_price := 100;
            ELSE base_price := 100;
        END CASE;

        -- 普通票(价格=基准价)
        INSERT INTO ticket_type (session_id, name, price, total_stock, remain_stock, status)
        VALUES (s.id, '普通票', base_price, 999, 500, 1);

        -- VIP票(价格=2倍基准价)
        INSERT INTO ticket_type (session_id, name, price, total_stock, remain_stock, status)
        VALUES (s.id, 'VIP', base_price * 2, 300, 150, 1);

        -- 套票(价格=3倍基准价)
        INSERT INTO ticket_type (session_id, name, price, total_stock, remain_stock, status)
        VALUES (s.id, '套票', base_price * 3, 100, 80, 1);
    END LOOP;
END $$;
