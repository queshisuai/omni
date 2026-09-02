# Implementation Notes

## 2026-08-13 开题报告第1稿

- 输入模板：`C:\Users\Administrator\Desktop\开题报告\广州工商学院本科毕业论文（设计）开题报告 .docx`。
- 学校规范：`C:\Users\Administrator\Desktop\开题报告\广州工商学院本科毕业论文（设计）规范（修订）.pdf`。
- 交付文件暂定：`C:\Users\Administrator\Desktop\开题报告\202316510149-余凯欣-开题报告-第1稿.docx`。
- 已确认：题目、姓名、学号、学院、专业、指导教师及“硕士”学位。
- 已确认：论文起止日期和各阶段安排写“待学校通知”，不编造日期。
- 已确认：选题来源按“自选课题”处理。
- 格式要求：参考文献不少于 12 篇，全部为近 3 年文献，中文多于外文，外文 2 至 3 篇；正文上标引用；文后不出现 DOI；表格允许跨页断行。
- 源码核验偏离：Graphify 首次查询时仓库没有 `graphify-out/graph.json`，已按本地无联网流程生成图谱；报告仍将用源码和配置抽查，避免知识图谱误收录设计文档。
- 文献核验偏离：公开搜索引擎连接不稳定，文献将优先用 Crossref/OpenAlex 等公开元数据和期刊/出版社页面交叉核验，不使用无法确认作者、题名、年份和来源的条目。
- 源码证据：Java 父项目声明 Spring Boot 2.7.18、Spring Cloud 2021.0.8、Spring Cloud Alibaba 2021.0.5.0、Seata 1.6.1；各服务存在 Nacos、Sentinel、OpenFeign、PostgreSQL 等依赖。NestJS 抢票服务实现幂等排队、自动降档、候补排位和内部服务调用；Next.js 前端存在活动、订单、支付、电子票、抢票、候补和后台管理入口。
- 文献结果：共 13 篇，中文 10 篇、外文 3 篇；出版年份为 2024 至 2026 年。题名中出现“2023”的《2023全国演出市场简报》发布于 2024 年，属于近三年文献。
- 结构验收：正文上标覆盖 `[1]` 至 `[13]`，文后 13 条参考文献；未检出 DOI；表格 XML 中 `cantSplit=0`、固定行高 `trHeight=0`。
- 视觉验收：使用本机 Word/WPS COM 导出为 4 页 A4 PDF，并用 Poppler 渲染为 PNG；第二轮逐页检查未发现裁切、重叠、异常空页或表格跨页失败。
- 模板修正：清除了“职称或学位”中的红色示例格式、教师示例勾选、红色签字提示和示例日期；签字及开题时间保留给学校后续填写。

## 2026-08-14 开题报告第2稿

- 用户确认采用“学术与工程平衡型”表达，只改写“三、研究的目标与研究内容”和“四、研究方法及可行性分析”，其他章节、参考文献和模板格式保持不变。
- 第三部分调整为“研究目标、研究内容、拟解决的关键问题”，研究对象围绕服务边界、票务交易状态、高并发幂等、库存一致性、安全治理及前后端业务闭环。
- 第四部分将文献研究、源码证据分析、领域建模、实验测试和对照分析与实际项目文件对应；评价指标使用吞吐量、P95/P99 响应时间、错误率、超卖数、重复订单数和最终状态一致性，仅作为待测指标，不填写未经执行的结果。
- 可行性从源码基础、技术条件、实验条件和风险控制四方面论证；保留外部支付或部署环境受限时的验证边界说明，避免把框架接入等同于功能验证完成。
- 分页边缘情况：改写内容增长后允许表格自然跨页，继续保留“允许跨页断行”，以实际渲染结果决定是否调整段落密度，不通过缩小字号强行压页。
- 历史内容偏离：结构对比发现第1稿第五部分残留“大语言模型工作流、RAG、视觉智能”等与本课题无关的阶段安排。第2稿未继承该错误内容，依据用户最初要求统一写为“论文起止日期和各阶段安排：待学校通知”；第一、二、六部分继续与第1稿逐字一致。
- 结构验收：第2稿第一、二、六部分与第1稿逐字一致；正文上标继续覆盖 `[1]` 至 `[13]`，文后保留 13 条参考文献，无 DOI；表格未设置 `cantSplit` 或固定行高，页面规格为 A4。
- 渲染偏离：文档技能自带渲染器因本机未安装 LibreOffice 而无法启动，改用已安装的 Office COM 只读打开 DOCX 并导出 PDF，再调用本地 Poppler 渲染 PNG。Office 在 PDF 成功写出后退出 COM 时返回 `0x800706BE`，未影响 PDF 与页面图像，且没有新增遗留 Office 进程。
- 视觉验收：第2稿共 5 页，已逐页检查；第三、四部分跨页续排正常，未发现异常空页、大块非模板留白、文字裁切、重叠或表格断裂。末页保留的审核、签字区域及其后留白属于学校模板结构。

## 2026-08-15 开题报告第3稿

- 用户要求功能模块覆盖实际源码已有的全部业务模块，并保持开题阶段口吻；功能清单按 C 端账户身份、C 端内容互动、C 端购票票券、B 端活动资源、B 端运营治理和平台支撑六组归纳，未恢复已禁止的动态系统。
- 源码核对范围：Next.js `frontend/src/app` 页面路由，Java 用户、票务、订单、支付、通知服务 Controller，以及 NestJS `grab`、`team-grab`、`waitlist` Controller。报告使用“拟实现、拟设计、拟验证”等表述，前期源码只作为可行性证据。
- 段落格式：正文叙述段落和编号条目统一首行缩进 2 字符（12 磅正文对应 24 磅）；一级、二级标题不缩进；参考文献继续使用 2 字符悬挂缩进。
- 文献结构调整为 13 篇：行业报告 1 篇、中文期刊论文 9 篇、外文期刊论文 1 篇、外文会议论文 1 篇、外文专著章节 1 篇；期刊论文共 10 篇，中文 10 篇、外文 3 篇。
- 新增期刊论文经百度学术与万方公开页面核验：何锋等《微服务架构的一体化性能监控SaaS云设计与实现》，2024，41(8)：28-35；李淑霞等《基于Spring Cloud微服务架构的能源互联网营销服务系统设计》，2025(10)：138-145；庞长才《基于云原生技术的管理信息系统微服务架构设计与实现》，2026，28(3)：16-18，24；张健《基于Spring Cloud微服务架构的工业软件多层级组件平台设计》，2026(1)：131-134，139。
- 文后条目不写 DOI；正文研究背景和国内研究综述按新序号重排上标引用，确保 `[1]` 至 `[13]` 均在正文出现。
- 渲染偏离：本机未安装 LibreOffice，沿用 Office COM 只读导出 PDF，再用 Poppler 渲染页面 PNG；该过程未修改最终 DOCX。
- 视觉验收：第3稿共 6 页，已逐页检查。功能模块在第3至第4页自然跨页，参考文献在第5至第6页自然跨页；未发现文字裁切、重叠、乱码、表格断裂或异常大块空白。第6页底部留白属于学校审核与签字区域。

## 2026-09-01 本地 Docker 中间件启动

- 用户计划在 IDEA 中启动 Java 微服务，本次只启动本地基础设施容器，不启动 Java、前端或 NestJS 服务。
- 本机 PostgreSQL `localhost:5432` 可连接，继续按 `prod-split` 本机数据库口径使用。
- 已启动并验证健康的 Docker 容器：`omni-nacos`、`omni-rabbitmq`、`omni-seata`；`omni-seata-config-init` 已完成一次性 Seata 配置发布。
- 运行态偏离：`localhost:6379` 已被本机 `memurai` 进程占用，因此未启动 `omni-redis` 容器；当前 Redis 端口仍可连接，Java 默认 Redis 地址可继续指向 `localhost:6379`。
- IDEA 启动偏离：五个 Java 业务服务使用 `prod-split` 时必须显式传入环境变量；当前失败日志的直接根因为 `java-user` 缺少 `GRAB_SERVICE_URL`，同类必填变量还包括数据库、Nacos、RabbitMQ、internal token、JWT、Seata，以及 `java-payment` 的支付宝占位符。

## 2026-09-01 前后端与本地大模型联调

- 启动前端、Java 后端和本地 Ollama 客服 AI 链路前，确认 `omni-nacos`、`omni-rabbitmq`、`omni-seata` 已运行；`localhost:6379` 仍由本机 `memurai` 提供 Redis。
- 大模型根因：`Qwen2.5:7b` 默认 32768 上下文加载时 Ollama 日志报 `failed to allocate compute pp buffers`，`/api/chat` 返回 500；同一请求显式 `options.num_ctx=2048` 后返回 `模型连通`。
- 代码修复：`java-user` 的 `OllamaSupportLocalModelClient` 默认在请求 payload 写入 `options.num_ctx=2048`，并通过 `OMNI_SUPPORT_AI_CONTEXT_WINDOW` / `OMNI_SUPPORT_AI_LOCAL_CONTEXT_WINDOW` 可调。
- 运行态修复：`OllamaSupportLocalModelClient` 不再在 Spring bean 构造期创建 `java.net.http.HttpClient`，避免本机 JDK 抛出 `Unable to establish loopback connection` 导致 `java-user` 启动失败；实际请求改用 `HttpURLConnection`。
- 启动脚本修复：`start-project.ps1` 为本地 `prod-split` 注入 RabbitMQ、Grab、Seata、搜索 DB fallback、本地 Alipay 占位、AI context-window 和前端 `API_PROXY_TARGET` 默认值；生产配置文件仍保持无 fallback 的安全口径。
- 运行态修复补充：本机 `TEMP` 为 `C:\Users\ADMINI~1\AppData\Local\Temp` 短路径时，JDK 17+ 自动 Unix domain socket pipe 会触发 `Invalid argument: connect`，导致 Netty/Spring Cloud Gateway `Selector.open()` 失败；`start-project.ps1` 现在将本次启动进程及子进程的 `TEMP/TMP` 指向 `runtime\java-tmp`。
- 中间件脚本修复：`scripts/start-infra.ps1` 在 `localhost:6379` 已被非 `omni-redis` 容器占用时，先用 RESP `PING` 校验是否为可用 Redis/Memurai；可用则跳过 Docker Redis，只启动/确认 Docker Nacos。
- 启动脚本修复补充：`start-project.ps1` 将子 PowerShell 的 Maven `-Dspring-boot.run.*` 参数整体单引号传入，避免 PowerShell 将 `spring-boot.run.arguments` 拆坏为 Maven 插件前缀；`-UseDockerInfra` 分支提前初始化 `NACOS_PORT=8848`，Seata 配置发布可访问 `localhost:8848`。
- 前端依赖偏离：`frontend/pnpm-workspace.yaml` 缺少 `packages` 导致 `pnpm dev` 报 `packages field missing or empty`，已补 `packages: ['.']`；前端和 grab-service 的 `node_modules` 仍为旧路径/不完整依赖，离线恢复失败，需要联网安装 npm/pnpm 依赖后继续 3000/3001 联调。
- 用户已授权下载依赖；`frontend` 使用 `pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com` 安装成功，`pnpm typecheck` 通过，Node 版本为 `v24.15.0`，满足前端 Node `>=24` 要求。
- `grab-service` 全局 npm cache 指向 `C:\Program Files\nodejs\node_cache` 且不可写，改用 `D:\Project\omni\runtime\npm-cache` 后安装成功；运行期发现 `node_modules/jsonwebtoken` 残缺缺少 `index.js`，确认镜像 tarball 正常后只清理该可重建依赖目录并重装，`npm run build` 通过。
- 最终启动状态：前端 `http://localhost:3000`、`grab-service` `http://127.0.0.1:3001`、Java 服务端口 `8081/8082/8083/8084/8085/8088` 均处于监听状态；`grab-service` 已连接 RabbitMQ。
- 联调验收结果：前端首页 `GET /` 返回 200，前端代理登录 `POST /api/user/login` 返回 `code=200`，gateway 票务列表返回 `code=200`，gateway 到 `grab-service` 的 `/api/grab/internal/users/1/requests` 返回 200，客服 AI SSE 返回 200 且包含流式增量数据。
- 运行边界：不要在 `npm run start:dev` 的 Nest watch 进程运行时并行执行 `npm run build`，因为 `nest-cli.json` 配置了 `compilerOptions.deleteOutDir=true`，构建会临时删除 `dist` 并导致 watch 子进程短暂报 `Cannot find module 'dist\main'`；验收时应先 build，再启动 watch。

## 2026-09-01 上传图片恢复与前端公共渲染修复

- 历史文件恢复：已将旧 worktree 的 `runtime/uploads` 合并回 `D:\Project\omni\runtime\uploads`，来源包括 `.worktrees\team-grab`、`.worktrees\waitlist-queue`、`.claude\worktrees\grab-low-risk-sentinel`；只复制缺失文件，不删除来源文件。
- 稳定目录口径：`start-project.ps1` 本地 Java 启动参数已经注入 `--omni.upload.root=D:\Project\omni\runtime\uploads`，用户头像和票务素材统一落在项目根的 `runtime\uploads`，不再依赖旧 worktree 目录。
- 前端修复：新增 `frontend/src/lib/image-url.ts` 与 `frontend/src/components/SafeImage.tsx`，统一处理 `/uploads/...`、站内图片路径、完整 `http/https` URL、空值/非法 scheme fallback，以及浏览器加载 404 后切换 fallback。
- 页面替换：上传预览、活动卡片、首页/搜索映射、活动详情、巡演详情、订单、电子票、订阅、C 端头像、B 端头像和艺人列表已改用共享图片逻辑；静态登录背景和 logo 保持原状。
- 数据清理结论：`ticket_asset` 共 9 条素材，本地文件全部存在；`artist.avatar` 已引用 1 条，`tour.poster` 已引用 3 条，当前 `activity.poster` 无 `/uploads/%` 引用，只有 2 条 smoke 测试活动 poster 为空。
- 回填偏离说明：`ticket_asset` 没有 `biz_id` 或其他可证明的活动关联字段，历史 `activity-poster` 素材无法可靠匹配具体 `activity`；本次不自动回填 `activity.poster`，避免错配活动海报。已引用的 `tour.poster` 和 `artist.avatar` 保持不变。
- 验证结果：`node --test src\lib\image-url.test.ts`、`node --test src\lib\image-rendering-production-entry.test.ts`、`pnpm typecheck` 通过；gateway 与前端代理访问上传头像/海报 URL 均返回 200。
- 联调补充：前端 dev 服务运行在 `http://localhost:3000`；`grab-service` 已用项目默认 JWT_SECRET 运行在 `http://127.0.0.1:3001`，登录测试用户后 `/api/waitlist/my` 返回 200，直连 internal grab/waitlist 接口返回 200。

## 2026-09-01 前端容器化启动

- 运行方式调整：停止本机 `pnpm dev` 前端进程，改用 `docker compose up -d frontend` 启动 `omni-frontend` 容器，占用 `localhost:3000`。
- Compose 修正：`docker-compose.yml` 的 `frontend` 命令改为 `pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com`，避免容器启动时漂移 lockfile，并优先使用镜像源安装前端依赖。
- 容器配置：前端容器使用 `node:24-alpine`，`API_PROXY_TARGET=http://host.docker.internal:8088`，通过宿主机 gateway 访问 Java 后端。
- 验证结果：`docker ps --filter name=omni-frontend` 显示 `omni-frontend` 正在运行；`GET /`、`GET /api/ticket/activities`、上传头像 URL、登录后 `GET /api/waitlist/my` 均返回 200。
- 运行边界：当前本次只按用户要求将前端放入 Docker；Java 服务仍沿用宿主机端口 `8081/8082/8083/8084/8085/8088`，`grab-service` 仍以本机 Node 进程供 gateway 调用。

## 2026-09-01 个人中心与账号设置合并

- 页面合并：`frontend/src/app/profile/page.tsx` 已整合原「个人中心」概览和「账号设置」表单，保留 Header/Footer、快捷操作胶囊、用户横幅、三列信息卡、个人资料表单、修改密码表单和账户提示。
- 接口复用：合并页继续使用 `getUserInfo`、`updateProfile`、`uploadUserAvatar`、`changePassword`、`sendSmsCode`，头像上传继续走 `LocalFileUpload` 与 `SafeImage`，不引入 mock/offline 降级。
- 入口收敛：`frontend/src/components/Header.tsx` 的登录用户下拉菜单由「个人信息」+「账号设置」合并为单一「个人中心」入口；后台个人中心快捷入口也改为 `/profile`。
- 兼容旧路径：`frontend/src/app/profile/account/page.tsx` 改为客户端重定向，登录用户跳 `/profile`，未登录用户跳 `/login?ru=/profile`。
- 验证结果：宿主机与 `omni-frontend` 容器内均通过 `node --test src/lib/profile-merged-page-production-entry.test.ts`、`node --test src/lib/header-user-menu-production-entry.test.ts src/lib/sms-production-copy.test.ts` 和 `pnpm typecheck`；`GET /profile` 与 `GET /profile/account` 均返回 200。

## 2026-09-01 个人中心安全与认证弹窗重构

- 右侧卡片调整：`frontend/src/app/profile/page.tsx` 将原内联「修改密码」表单替换为「安全与认证」中心，展示「登录密码」和「安全手机」两个浅灰操作项，并保留安全防护等级与最近安全操作说明。
- 修改密码弹窗：新增两步流程「身份验证 → 设置新密码」，第 1 步调用后端 `verifyPasswordIdentity` 校验旧密码和短信验证码，第 2 步调用 `changePassword` 完成修改；关闭弹窗会清空表单并重置倒计时。
- 更换手机号弹窗：新增两步流程「验证原手机 → 绑定新手机」，第 1 步调用后端 `verifyCurrentPhone`，第 2 步校验 11 位手机号并调用 `changePhone`；成功后同步更新页面手机号展示和本地登录态 `omni_user`。
- 后端接口：`java-user` 新增 `POST /api/user/password/verify`、`POST /api/user/phone/verify-current`、`PUT /api/user/phone`，并新增 `ChangePhoneRequest`、`VerifyCurrentPhoneRequest` DTO；验证码校验走后端服务，当前本地短信仍沿用项目既有 `mockSmsEnabled` / `MOCK_SMS_CODE` 口径。
- 验证记录：宿主机通过 `node --test src\lib\profile-security-step-modal-production-entry.test.ts src\lib\profile-merged-page-production-entry.test.ts src\lib\header-user-menu-production-entry.test.ts src\lib\sms-production-copy.test.ts`、`pnpm typecheck`、`mvn -pl java-user -Dtest=UserServiceTest test`；`omni-frontend` 容器内通过同一组前端测试与 `pnpm typecheck`，`GET /profile` 返回 200。

## 2026-09-01 个人中心 Docker 缓存与认证态修复

- 运行态根因：`docker-compose.yml` 曾把 `frontend-next-cache` 挂载到 `/app/.next`，Next dev 复用旧编译缓存，导致容器源码已是新版但应用面板仍渲染旧版「账号设置」页面。
- 容器修复：前端服务移除持久化 `.next` volume，改为 `tmpfs: /app/.next`；已 `docker compose up -d --force-recreate frontend` 重建 `omni-frontend`，当前容器不再挂载 `frontend-next-cache`。
- 认证态修复：`removeToken()` 现在会派发 `AUTH_UPDATED_EVENT`，`/profile` 在 `getUserInfo()` 返回「未认证 / 登录状态失效」时清理本地登录态并跳转 `/login?ru=/profile`，避免 Header 显示已登录但页面显示未认证。
- 验证记录：新增 `frontend-docker-cache-production-entry.test.ts`，宿主机前端 9 项入口测试通过；容器内前端入口测试 8 通过、1 项因根 compose 未挂载显式跳过；宿主机与容器 `pnpm typecheck` 均通过；Playwright 使用本机 Chrome 登录后访问 `/profile`，确认「安全与认证」「个人资料」可见、旧文案计数 0、「未认证」计数 0、`/api/user/info` 返回 200。

## 2026-09-02 活动详情页交互与内容重构

- 页面重构：`frontend/src/app/activity/[id]/page.tsx` 已按玫红品牌色统一活动详情页主卡片、顶部操作按钮、座位区、详情 Tab 和观众热评模块，整体背景改为 `#F8F9FA`，核心卡片使用 16px 圆角与轻投影。
- 顶部操作：`想看`、`关注艺人` 继续走真实订阅接口并增加防重复点击锁，成功/取消/失败反馈改为居中轻量 Toast；`加入日历` 不再调用 `/api/ticket/subscriptions/calendar`，不生成或下载 `.ics`，仅按登录用户写入本地日程提醒状态。
- 座位展示：选座项目继续复用 `SeatCraftSelector`；不可选座或座位图未公布项目在票档下方显示紧凑提示 `座位暂不公布，座位将在下单后由系统自动分配。`，避免旧的大块空状态。
- Tab 详情：`项目详情 / 购票须知 / 观演须知` 改为分段式胶囊控制器；项目详情使用 2 列信息网格和白底正文，购票须知使用 4 个规则胶囊与分割线清单，观演须知使用入场时间轴和禁带/文明观演提示卡。
- 评论模块：原 `评价与问答` 更名为 `观众热评`，移除活动详情页内 `写评价/去订单页评价` 入口和 `createActivityReview` 调用；评价入口保持由已完成订单业务路径触发。问答区继续调用真实 `createActivityQuestion` 接口。
- 运行偏离：本次容器验证前发现 8088 网关未监听，已先启动 Docker Seata，再通过 `start-project.ps1 -SkipFrontend -SkipInstall -UseDockerInfra` 只拉起 Java 后端，前端继续由 Docker 容器 `omni-frontend` 提供。
- 验证记录：宿主机通过 `node --test src\lib\activity-detail-production-entry.test.ts` 与 `pnpm typecheck`；容器内通过同一入口测试与 `pnpm typecheck`；浏览器自动化登录测试用户后访问 `/activity/900120`，确认核心文案、Tab 切换、日历 Toast、无 `.ics` 下载链接且无旧评价入口。
