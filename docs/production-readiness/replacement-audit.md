# 生产前可替换与重命名清单

> 阶段 0 输出物。当前项目未进入生产，允许对临时实现做替换、重命名和结构调整。本文只记录审计结论，不直接修改业务代码或数据库。

## 审计结论

当前系统功能覆盖面已经比较宽，真正需要生产前处理的是“临时实现长期化”的风险：搜索、网关、通知、鉴权、命名、前端入口、种子数据和观测能力。

## P0：建议优先替换

| 对象 | 当前证据 | 建议方向 | 原因 |
|:---|:---|:---|:---|
| 活动搜索 | `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityService.java` 的 `searchActivities()` 先取 `listActivities(1, fetchSize)` 再内存过滤排序分页 | 替换为 ES 活动搜索索引 | 高频搜索不能依赖内存过滤；分页总数和排序应由搜索引擎负责。 |
| Gateway | `java/java-gateway/src/main/resources/application.yml` 主要是基础 routes，已有 Sentinel 但缺 trace、route 级耗时、统一鉴权、差异化超时 | 升级为可观测、可限流、可鉴权、可诊断网关 | 现在服务联动慢需要先定位，再治理。 |
| 固定验证码 | `UserController` 使用 `MOCK_SMS_CODE = "666666"` 并打印验证码 | Redis 验证码 + SMS 渠道适配器 | 登录和找回密码不能把固定验证码带到生产前验收。 |
| 沙盒通知渠道 | `NotificationService` 标注短信/邮件日志打印 | 通知事件中台 + IN_APP 默认投递 + SMS/Email 适配器 | 抢票、退款、改期、客服回复都应统一走事件投递。 |
| 默认 JWT 密钥 | `nestjs/grab-service/src/auth/jwt-auth.guard.ts` 有 `DEFAULT_JWT_SECRET` fallback | 生产环境强制配置 `JWT_SECRET`，启动时校验 | 默认密钥适合本地，不适合生产前验收。 |
| 分散鉴权 | `java-user` `SecurityConfig` 对所有请求 `permitAll()` | Gateway/Filter 统一鉴权，Controller 只做业务校验 | 手工校验分散，后续维护和审计成本高。 |
| mock 活动降级 | 首页/搜索仍存在 mock 数据降级 | 生产前改为真实失败态、重试和真实缓存 | 假活动会误导用户和验收。 |

## P1：建议重命名或结构调整

| 对象 | 当前证据 | 建议方向 | 原因 |
|:---|:---|:---|:---|
| `organizer_admin` | 第一轮已把用户可见文案、菜单、审计展示、基线中文名和 real-demo seed 昵称收口为“平台主办方运营员”；内部 role code、SQL 权限和账号服务仍兼容使用 `organizer_admin` | 短期继续兼容 `organizer_admin`；后续如拆岗位，可迁移到 `organizer_ops_agent` / `organizer_ops_manager` | 当前定位是平台级运营角色，不是主办方租户管理员；生产前允许重命名，但需要兼容迁移。 |
| 评价/问答 | 第一轮已正式化为 `activity_review` / `activity_question`：评价提交绑定 `orderId` 并通过 order internal API 校验，后台已有审核、隐藏、恢复、举报处理和问答回复入口 | 继续作为活动评价与购前问答模块演进 | 第一轮已完成正式化主链路和标准 Gateway / 浏览器复测；后续继续补运营统计和更细审核策略。 |
| 前端 API 聚合 | `frontend/src/lib/api.ts` 聚合大量业务 API，客服上下文接入后 support、order、payment、grab、notification 类型继续集中在单文件 | 按领域拆分：user、ticket、order、payment、support、console、grab | 后续接 ES、通知和评价后台时，单文件维护成本会继续上升。 |
| 种子数据体系 | `sql/seeds/prod-split-real-demo` 已有真实演示 seed，`sql/seed.sql` 仍是历史共享库 seed | 以 real-demo seed 为主，历史 seed 归档或明确仅共享库兼容 | 防止开发者误用旧共享库种子数据。 |

## P2：可评估接入

| 对象 | 建议方向 | 注意点 |
|:---|:---|:---|
| Sentry | 前后端错误监控 | 先接低侵入错误聚合，避免泄露 token 和隐私字段。 |
| PostHog | 曝光、搜索、详情、下单、支付、退款漏斗 | 需要用户隐私策略和事件命名规范。 |
| Resend | Email 渠道 | 只能作为通知中台渠道适配器，不直接写进业务服务。 |
| Clerk | 外部认证候选 | 只接认证层试点，本地 `java-user` 继续承载业务用户、角色和权限。 |
| Pinecone | 客服知识库语义召回 | 不替代 ES 活动搜索。 |

## 暂不建议替换

- PostgreSQL：继续作为权威业务数据源。
- 五库拆分：继续保持当前 prod-split 方向，不回退到共享库。
- `Result<T>`：继续作为统一响应，避免前后端协议大面积震荡。
- Seata：保留在票务、订单、支付关键一致性链路，不扩大到所有业务。
- 宿主机 PostgreSQL：本机继续使用 `localhost:5432` 五库，不恢复 Docker PostgreSQL 默认路径。

## 后续动作

1. 先做 ES 搜索详细实施计划。
2. 并行补 Gateway 直连和经网关延迟基线脚本。
3. 客服上下文已完成标准端口和 Gateway `8088` 复测；后续跨服务联动验收仍要先确认真实运行态，避免把旧进程误判为网关问题。
4. 评价系统第一轮已完成订单校验、审核、举报、问答管理、前端入口和标准 Gateway / 浏览器复测。
5. 入场核验同步第一阶段已完成只读入口、核验记录和 real-demo seed；后续只在设备/人员鉴权、异常补录和备用扫码页上继续增强。
6. 如要改 role code，再设计 `organizer_admin` 到 `organizer_ops_agent` / `organizer_ops_manager` 的兼容迁移。
7. 把 mock 降级、固定验证码、默认密钥列入生产前清理任务。
