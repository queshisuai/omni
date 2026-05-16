# 万象 (Omni) 抢票平台 - 沙盒版设计

## 项目概述
万象 (Omni) 综合票务平台，支持演唱会、体育赛事、戏剧等所有需要门票的场景。采用微服务架构，采用 **"B端主导，C端参与"** 的双层模式：

- **B端（主办方后台）**：独立管理页面，主办方通过标准流程上传演出数据（活动、场次、票档、场馆、艺人）
- **C端（用户前台）**：浏览活动、购票、支付。C端用户可在特定位置发布评价和动态作为补充信息

## 技术栈
- **后端**：Java Spring Cloud Alibaba + NestJS
- **数据库**：PostgreSQL + Redis
- **前端**：Next.js 16 + React 19 + shadcn/ui (PC 端，1:1 复刻万象网)
- **注册中心**：Nacos
- **服务间通信**：OpenFeign
- **消息队列**：RocketMQ（生产版）/ Redis 延迟队列（沙盒版）

## 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                     前端 (Next.js + React + shadcn/ui)                    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────────┐
│     Java 微服务集群      │     │            NestJS 服务               │
│     (BFF/聚合层)        │     │         (抢票核心/库存)              │
│                         │     │                                     │
│  - 用户服务             │     │  - 库存扣减 (Redis + Lua)            │
│  - 票务服务             │     │  - 座位锁定                          │
│  - 订单服务             │     │  - 超卖保护                          │
│  - 支付服务             │     │  - WebSocket 推送                   │
│  - 通知服务             │     │                                     │
└───────────┬─────────────┘     └──────────────┬────────────────────┘
            │                                  │
            └──────────────┬───────────────────┘
                           ▼
              ┌─────────────────────────┐
              │       Redis             │
              │  - 库存缓存             │
              │  - 分布式锁             │
              │  - 延迟队列             │
              └────────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │     PostgreSQL          │
              └─────────────────────────┘
```

## 微服务模块职责

| 服务 | 端口 | 职责 | 技术方案 |
|:---|:---|:---|:---|
| java-gateway | 8088 | API 网关，统一路由、鉴权 | Spring Cloud Gateway |
| java-user | 8081 | 注册登录、权限管理、用户信息 | JWT + Spring Security |
| java-ticket | 8082 | 活动管理 CRUD、场次/座位查询 | Redis 缓存热点数据 |
| java-order | 8083 | 订单状态管理、超时自动取消 | Redis 延迟队列自动取消 |
| java-payment | 8084 | 模拟支付处理、回调通知 | 沙盒版模拟支付 |
| java-notification | 8085 | 短信/邮件异步通知 | 消息队列异步处理 |
| grab-service (NestJS) | 3000 | 库存原子扣减、超卖保护 | Redis Lua + Socket.IO |

## 服务间通信

Java 微服务之间通过 **OpenFeign** 声明式 HTTP 调用：
- 订单服务 → 库存服务：创建订单前预扣库存
- 订单服务 → 支付服务：创建订单后发起支付
- 支付服务 → 订单服务：支付回调更新订单状态
- 通知服务 → 用户服务：查询用户联系方式

前端通过 Nginx/Gateway 统一入口访问所有微服务。

## API 接口约定

### 通用响应格式
```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

### 状态码规范
| code | 说明 |
|:---|:---|
| 200 | 成功 |
| 400 | 参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 409 | 冲突（库存不足、重复抢票等） |
| 429 | 请求过于频繁 |
| 500 | 服务内部错误 |

### 主要接口列表

#### 用户服务 `/api/user`
| 方法 | 路径 | 说明 |
|:---|:---|:---|
| POST | /api/user/send-code | 发送短信验证码 |
| POST | /api/user/login | 手机号+验证码登录 |
| GET | /api/user/info | 获取当前用户信息 |
| PUT | /api/user/info | 更新用户信息 |

#### 票务服务 `/api/ticket`
| 方法 | 路径 | 说明 |
|:---|:---|:---|
| GET | /api/ticket/activities | 活动列表（分页+分类筛选） |
| GET | /api/ticket/activities/{id} | 活动详情（含场次+票档） |
| GET | /api/ticket/sessions/{id}/seats | 场次座位状态 |
| GET | /api/ticket/categories | 分类列表 |
| POST | /api/ticket/reservations | 预约抢票 |
| GET | /api/ticket/reservations | 我的预约列表 |

#### 订单服务 `/api/order`
| 方法 | 路径 | 说明 |
|:---|:---|:---|
| POST | /api/order/create | 创建订单 |
| GET | /api/order/user/{userId} | 用户订单列表 |
| GET | /api/order/{id} | 订单详情 |
| DELETE | /api/order/{id} | 取消订单 |
| POST | /api/order/{id}/pay | 发起支付 |

#### 支付服务 `/api/payment`
| 方法 | 路径 | 说明 |
|:---|:---|:---|
| POST | /api/payment/pay | 模拟支付 |
| POST | /api/payment/callback | 支付回调（内部） |
| GET | /api/payment/record/{orderId} | 查询支付记录 |

#### 抢票服务 `/grab`（NestJS，直连）
| 方法 | 路径 | 说明 |
|:---|:---|:---|
| POST | /grab/ticket | 执行抢票 |
| POST | /grab/init-stock | 初始化库存到 Redis |
| GET | /grab/stock | 查询 Redis 实时库存 |

## 抢票流程（高并发场景）

```
1. 用户预约活动 → 生成预约记录
2. 开抢前 10 分钟 → 同步库存到 Redis（启动预热）
3. 用户点击抢购 → 库存服务预扣减（Redis Lua 原子操作）
4. 预扣成功 → 锁定座位（随机分配）
5. 预扣失败 → 返回售罄
6. 订单服务创建订单 → 进入待支付状态
7. 支付超时（15分钟）→ 延迟队列触发取消 → 释放库存
8. 支付成功 → 订单状态变更 → 通知服务异步推送
```

### 抢票规则
- **限购**：每人每场次限购 2 张
- **选座**：沙盒版系统随机分配座位，无需用户手动选座
- **防重**：同一用户同一场次 5 分钟内不可重复抢票
- **防刷**：IP 频率限制 + 用户请求间隔限制 + 图形验证码

## 防刷/风控设计（基础防护）

### IP 频率限制
- 使用 Redis 滑动窗口记录每个 IP 的请求次数
- 单 IP 每秒最多 10 次抢票请求
- 超限返回 429，30 秒后解除

### 用户请求间隔
- 同一用户两次抢票请求间隔 ≥ 2 秒

### 验证码
- 抢票前弹出滑块/图形验证码
- 沙盒版使用简单的数字运算验证码

## 库存服务 - 高并发关键设计

### 超卖防护
- **Redis Lua 脚本**：原子扣减库存，保证并发安全
- **乐观锁**：数据库层 version 字段，防止重复扣减
- **库存预占**：先占库存，支付成功后确认，超时后释放

### 分布式锁
```
-- Lua 脚本：原子扣减库存
local stock_key = KEYS[1]          -- 库存 key
local dedup_key = KEYS[2]          -- 去重 key（用户+场次+票档）
local quantity = tonumber(ARGV[1])
local max_per_user = tonumber(ARGV[2])  -- 每人限购数量

-- 检查是否重复抢票
local already_grabbed = tonumber(redis.call('GET', dedup_key))
if already_grabbed and already_grabbed >= max_per_user then
    return -2  -- 已达限购上限
end

-- 检查库存
local current = tonumber(redis.call('GET', stock_key))
if current >= quantity then
    redis.call('DECRBY', stock_key, quantity)
    redis.call('INCRBY', dedup_key, quantity)
    redis.call('EXPIRE', dedup_key, 300)  -- 5分钟去重窗口
    return 1  -- 成功
else
    return -1  -- 库存不足
end
```

### 库存回滚场景
1. 支付超时自动取消
2. 支付失败
3. 用户主动取消订单

## 缓存策略

### 缓存预热
- 应用启动时全量加载活动分类、场馆列表到 Redis
- 开抢前 10 分钟，将当天热门场次的库存同步到 Redis

### 缓存雪崩防护
- 不同 key 设置随机 TTL（基础 TTL ± 随机偏差）
- Redis 持久化开启 RDB + AOF

### 缓存穿透防护
- 不存在的活动 ID 返回空对象并缓存短 TTL（60秒）
- 布隆过滤器（可选，沙盒版暂不引入）

### 缓存击穿防护
- 热点 key 使用互斥锁（Redis SetNX）防止大量请求同时穿透到 DB

## 订单超时自动取消

- 使用 Redis 延迟队列实现
- 下单时写入延迟队列，TTL 15 分钟
- 消费者监听取消消息，触发订单取消和库存回滚

## 数据模型

### 用户模块
- `user`: id, 手机号, 密码(加密), 昵称, 邮箱, 头像, 创建时间
- `user_auth`: id, 用户id, 认证类型, 认证标识(微信/支付宝)

### 票务模块（支持扩展）
- `category`: id, 类型名称（演唱会/体育/戏剧/展览等）
- `artist`: id, 艺人名称, 简介, 头像
- `activity`: id, 分类id, 艺人id, 名称, 简介, 海报, 状态
- `venue`: id, 场馆名称, 城市, 地址, 座位数
- `session`: id, 活动id, 场馆id, 演出时间, 状态
- `ticket_type`: id, 场次id, 档位名称, 价格, 总库存, 剩余库存
- `seat`: id, 场次id, 票档id, 座位号, 状态（已售/可用/锁定）

### 预约抢购模块
- `reservation`: id, 用户id, 场次id, 预约时间, 状态

### 订单模块
- `order`: id, 用户id, 场次id, 票档id, 订单号, 金额, 数量, 状态, 创建时间, 支付时间
- `order_seat`: id, 订单id, 座位id（订单-座位关联表）

### 支付模块
- `payment`: id, 订单id, 支付流水号, 支付方式, 支付金额, 支付状态, 支付时间, 回调原始数据, 创建时间

### 通知模块
- `notification`: id, 用户id, 通知类型(短信/邮件), 通知内容, 发送状态, 关联订单id, 创建时间

### 库存模块
- `stock_log`: id, 场次id, 票档id, 变更数量, 变更类型(预占/释放/退款), 关联订单id, 创建时间

## 用户角色体系

| 角色 | 说明 | 权限 |
|:---|:---|:---|
| `user` | C端普通用户 | 浏览活动、购票、发布评价/动态 |
| `organizer` | B端商户（主办方） | 仅管理自己主办的活动（场次/票档），查看自己活动的订单，只读场馆 |
| `admin` | B端平台管理员 | 全平台数据增删改查，管理所有活动和场馆 |

**权限矩阵：**

| 操作 | user | organizer | admin |
|:---|:---:|:---:|:---:|
| 浏览/购票 | ✓ | ✓ | ✓ |
| 发布评价/动态 | ✓ | ✓ | ✓ |
| 管理自己的活动 | ✗ | ✓ | ✓ |
| 管理他人活动 | ✗ | ✗ | ✓ |
| 创建/编辑场馆 | ✗ | ✗ | ✓ |
| 查看全平台订单 | ✗ | ✗ | ✓ |
| 查看自己活动订单 | ✗ | ✓ | ✓ |

user 表新增字段：
```sql
role VARCHAR(20) NOT NULL DEFAULT 'user',         -- 'user' | 'organizer' | 'admin'
organizer_status INT DEFAULT 0,                    -- 0:待审核 1:已认证 2:已拒绝
organizer_name VARCHAR(100),                       -- 主办方名称
```

## B端主办方后台 `/console`

### 路由规划
| 路由 | 页面 | 说明 |
|:---|:---|:---|
| `/console` | 后台首页 | 数据概览（我的活动数、订单数、收入统计） |
| `/console/activities` | 活动管理 | 活动列表 + 新建/编辑/下架 |
| `/console/activities/new` | 新建活动 | 三步向导（活动信息 → 场次 → 票档） |
| `/console/activities/[id]/edit` | 编辑活动 | 编辑已有活动 |
| `/console/sessions` | 场次管理 | 场次列表 |
| `/console/orders` | 订单查看 | 查看自己发布活动的订单 |
| `/console/venue` | 场馆管理 | 场馆列表 + 新建/编辑 |

### 活动发布流程（3步向导）
```
步骤1: 活动基本信息（名称、分类、艺人、海报、简介）
  ↓
步骤2: 场次设置（选择场馆、起止时间），可添加多个场次
  ↓
步骤3: 票档设置（每个场次：票档名称、价格、库存数量）
  ↓
提交 → 审核通过 → 上架到C端
```

### B端管理接口 `/api/ticket/admin`
| 方法 | 路径 | 说明 |
|:---|:---|:---|
| POST | /api/ticket/admin/activities | 创建活动（含场次+票档） |
| PUT | /api/ticket/admin/activities/{id} | 更新活动 |
| PUT | /api/ticket/admin/activities/{id}/status | 上架/下架活动 |
| DELETE | /api/ticket/admin/activities/{id} | 删除活动 |
| GET | /api/ticket/admin/activities | 我的活动列表 |
| POST | /api/ticket/admin/sessions | 添加场次 |
| PUT | /api/ticket/admin/sessions/{id} | 更新场次 |
| DELETE | /api/ticket/admin/sessions/{id} | 删除场次 |
| POST | /api/ticket/admin/ticket-types | 添加票档 |
| PUT | /api/ticket/admin/ticket-types/{id} | 更新票档 |
| POST | /api/ticket/admin/venues | 创建场馆 |
| PUT | /api/ticket/admin/venues/{id} | 更新场馆 |
| GET | /api/ticket/admin/venues | 我的场馆列表 |

## C端补充功能（评价 + 动态）

### 评价系统

数据库新表：
```sql
CREATE TABLE review (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    order_id BIGINT,           -- 关联订单（购票后才能评价）
    rating INT NOT NULL CHECK(rating >= 1 AND rating <= 5),
    content TEXT,
    images TEXT,               -- JSON数组，最多9张图
    like_count INT DEFAULT 0,
    status INT DEFAULT 1,      -- 1:正常 0:隐藏
    create_time TIMESTAMP DEFAULT NOW()
);
```

评价接口：
| 方法 | 路径 | 说明 |
|:---|:---|:---|
| GET | /api/ticket/activities/{id}/reviews | 活动评价列表（分页） |
| POST | /api/ticket/reviews | 发布评价（需登录+已购票） |
| DELETE | /api/ticket/reviews/{id} | 删除自己的评价 |

### 动态系统

数据库新表：
```sql
CREATE TABLE moment (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    activity_id BIGINT,          -- 关联活动（可选）
    content TEXT NOT NULL,
    images TEXT,                 -- JSON数组
    like_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    status INT DEFAULT 1,
    create_time TIMESTAMP DEFAULT NOW()
);
```

动态接口：
| 方法 | 路径 | 说明 |
|:---|:---|:---|
| GET | /api/ticket/activities/{id}/moments | 活动关联动态列表 |
| POST | /api/ticket/moments | 发布动态 |
| DELETE | /api/ticket/moments/{id} | 删除自己的动态 |

## 活动分类（可扩展）

| 分类 | 说明 |
|:---|:---|
| 演唱会 | 歌手演唱会、音乐节 |
| 体育 | 足球、篮球、网球等赛事 |
| 戏剧 | 话剧、歌剧、舞剧 |
| 展览 | 艺术展、科技展 |
| 儿童亲子 | 儿童剧、亲子活动 |
| 其他 | 其他票务场景 |

## 订单状态机

```
              ┌──────────┐
              │  PENDING │ ← 创建订单
              └────┬─────┘
                   │ 支付成功
              ┌────▼─────┐
              │   PAID   │
              └────┬─────┘
                   │ 退款申请
              ┌────▼─────┐
              │ REFUNDED │
              └──────────┘

              ┌──────────┐
              │  PENDING │
              └────┬─────┘
        支付超时/用户取消
              ┌────▼─────┐
              │ CANCELLED│ → 库存回滚
              └──────────┘
```

| 状态 | 说明 |
|:---|:---|
| PENDING | 待支付（15分钟超时） |
| PAID | 已支付 |
| CANCELLED | 已取消（库存已释放） |
| REFUNDED | 已退款 |

## 分布式事务（沙盒阶段）

沙盒版暂不引入 Seata 等分布式事务框架，采用以下简化方案：
1. 订单创建时，先调用 NestJS 扣减 Redis 库存（同步调用）
2. 库存扣减成功后才写入 PostgreSQL 订单表
3. 库存扣减失败直接返回错误，不创建订单
4. 订单取消失败时通过定时任务补偿（每分钟扫描一次超时订单）

## 消息队列设计

### 业务消息
| 消息类型 | 说明 | 消费者 |
|:---|:---|:---|
| OrderCreated | 订单创建 | 通知服务 |
| OrderPaid | 支付成功 | 通知服务、库存服务 |
| OrderCancelled | 订单取消 | 库存服务 |
| StockRollback | 库存回滚 | 库存服务 |

## 测试方案

### 单元测试
- Java 服务：JUnit 5 + Mockito
- NestJS 服务：Jest
- 目标覆盖率：核心业务逻辑 > 80%

### 压力测试
- 工具：JMeter / Wrk
- 目标 QPS：1000（单场次同时抢购人数）
- 压测场景：
  - 1000 并发抢 500 张票 → 500 成功、500 售罄
  - 同一用户重复抢票 → 全部被防重机制拦截
  - 库存为 0 时抢票 → 全部返回售罄

### 集成测试
- Postman / Newman 自动化 API 测试
- 完整抢票链路端到端测试

## 项目结构

```
Omni/
├── java/                          # Java 微服务
│   ├── java-gateway/              # API 网关
│   ├── java-user/                 # 用户服务（含角色体系）
│   ├── java-ticket/               # 票务服务（活动CRUD + 评价 + 动态）
│   ├── java-order/                # 订单服务
│   ├── java-payment/              # 支付服务
│   ├── java-notification/         # 通知服务
│   └── java-common/               # 公共模块
├── nestjs/grab-service/           # NestJS 抢票核心
├── frontend/src/app/
│   ├── page.tsx                   # C端首页
│   ├── activity/[id]/page.tsx     # 活动详情（+评价区+动态区）
│   ├── search/page.tsx            # 搜索
│   ├── orders/page.tsx            # 订单（+评价按钮）
│   ├── login/                     # 登录
│   ├── register/                  # 注册
│   └── console/                   # ★ B端主办方后台
│       ├── layout.tsx             # 后台布局（侧边栏）
│       ├── page.tsx               # 后台首页
│       ├── activities/            # 活动管理
│       │   ├── page.tsx           # 活动列表
│       │   └── new/page.tsx       # 新建活动（3步向导）
│       ├── sessions/page.tsx      # 场次管理
│       ├── orders/page.tsx        # 订单查看
│       └── venue/page.tsx         # 场馆管理
├── sql/
│   ├── init.sql                   # 建表（含 review/moment 表）
│   └── seed.sql                   # 种子数据
└── docs/specs/                    # 设计文档
```

## 部署方案

### Docker Compose 编排

```
┌─────────────────────────────────────────────────────┐
│                  docker-compose.yml                  │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │ Nacos    │ │PostgreSQL│ │     Redis        │    │
│  │ :8848    │ │  :5432   │ │     :6379        │    │
│  └──────────┘ └──────────┘ └──────────────────┘    │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Gateway  │ │ User Svc │ │Ticket Svc│            │
│  │  :8088   │ │  :8081   │ │  :8082   │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │Order Svc │ │Payment   │ │Notify Svc│            │
│  │  :8083   │ │  :8084   │ │  :8085   │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                     │
│  ┌──────────┐ ┌──────────┐                         │
│  │NestJS    │ │ Next.js  │                         │
│  │  :3000   │ │  :80     │                         │
│  └──────────┘ └──────────┘                         │
└─────────────────────────────────────────────────────┘
```

### 启动依赖顺序
1. Nacos + PostgreSQL + Redis（基础设施先启）
2. java-gateway + java-user + java-ticket（基础服务）
3. java-order + java-payment + java-notification（业务服务）
4. grab-service (NestJS)（抢票核心）
5. frontend (Next.js/Nginx)（前端）

## 沙盒版本范围

### 已实现
- [x] 用户服务：注册登录（手机号+密码/验证码）、JWT 鉴权
- [x] 票务服务：活动/场次查询、分类管理、活动详情（含场次+票档）
- [x] 订单服务：订单创建、查询、取消、支付发起
- [x] 支付服务：模拟支付、回调处理
- [x] 通知服务：异步通知（日志输出）
- [x] 基础数据：16张表 + 种子数据（28活动/28场次/168票档/28艺人/21场馆）
- [x] 前端首页：分类导航、活动列表、轮播Banner
- [x] 前端搜索：分类/时间筛选、排序
- [x] 前端活动详情：场次选择、票档选择、下单弹窗
- [x] 前端订单：订单列表、状态标签

### 待实现

#### 用户角色体系
- [ ] user 表增加 role 字段（user / organizer / admin）
- [ ] 主办方申请入口和审核流程
- [ ] Gateway 权限拦截（B端接口仅 organizer/admin 可访问）
- [ ] 登录后按角色分流跳转

#### B端主办方后台 `/console`
- [ ] B端后台框架（ConsoleLayout：侧边栏 + 顶部栏）
- [ ] 后台首页数据概览
- [ ] 活动管理：列表 + 新建/编辑/下架
- [ ] 活动发布三步向导（基本信息 → 场次 → 票档）
- [ ] 场次管理：列表 + 新建/编辑/删除
- [ ] 票档管理：列表 + 新建/编辑/删除
- [ ] 场馆管理：列表 + 新建/编辑
- [ ] 订单查看：查看自己发布活动的订单

#### B端后端管理接口
- [ ] POST/PUT/DELETE /api/ticket/admin/activities 活动CRUD
- [ ] POST/PUT/DELETE /api/ticket/admin/sessions 场次CRUD
- [ ] POST/PUT/DELETE /api/ticket/admin/ticket-types 票档CRUD
- [ ] POST/PUT/GET /api/ticket/admin/venues 场馆CRUD

#### C端评价+动态
- [ ] review / moment 数据库表
- [ ] GET/POST/DELETE /api/ticket/activities/{id}/reviews 评价接口
- [ ] GET/POST/DELETE /api/ticket/activities/{id}/moments 动态接口
- [ ] 活动详情页评价区域组件（评分统计 + 列表 + 发布）
- [ ] 活动详情页动态区域组件（列表 + 发布）
- [ ] 订单页评价入口

#### 高并发核心
- [ ] 库存服务：Redis Lua 原子扣减、分布式锁、启动预热
- [ ] NestJS 抢票服务完整对接
- [ ] 订单超时自动取消（Redis 延迟队列）
- [ ] 库存回滚
- [ ] 预约抢购完整链路
- [ ] WebSocket 实时推送（库存变更通知）
- [ ] 基础防刷：IP 频率限制 + 用户请求间隔
- [ ] 验证码：抢票前图形/滑块验证码

#### 运维
- [ ] Docker Compose 一键部署
- [ ] 1000 QPS 压力测试

### 后续扩展
- [ ] 熔断/限流（Sentinel）
- [ ] 消息队列削峰（RocketMQ）
- [ ] 引入 Seata 分布式事务
- [ ] 接入万象开放平台 API
- [ ] 多渠道支付（微信/支付宝）
- [ ] 完整风控（设备指纹、黑名单、行为分析）
- [ ] 可视化选座功能
- [ ] ELK 日志中心 + Prometheus 监控 + SkyWalking 链路追踪
