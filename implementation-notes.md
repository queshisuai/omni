# Implementation Notes

## 2026-09-05 活动发布管理页排版与类目联合过滤

- 页面排版：`/console/activities` 移除顶部两个说明型草稿卡片，右上角仅保留「巡演草稿箱」和「+ 新建演出活动」；搜索、类目、状态、查询和重置整合为紧凑筛选栏。
- 类目筛选：前端类目选择器直接透传 `categoryId` 给普通活动与巡演管理查询；后端后台活动列表按 `activity.category_id` 过滤，巡演列表按 `tour.category_id` 过滤，保证混合分页列表中两类主体使用同一类目口径。
- 批量操作：批量条从表格底部移到表头正上方，选中活动后展示浅蓝提示条；按钮文案按单选/多选自适应，提供「取消选择」清空选中项。
- 行与操作列：演出活动列补充海报、类目、实名制和可转赠标签；操作列常驻「继续配置」「座位票档」，删除、风险停售、营销配置等低频或高危动作收纳进更多菜单，并用红色警示高危项。
- 分页复原：表格底部仅保留 `GlobalPagination`，不再夹带批量操作块。
- 验证：`node --test src\lib\console-production-entry.test.ts` 通过 55/55；`pnpm typecheck` 通过；`pnpm build` 通过；`mvn -pl java-ticket "-Dtest=AdminControllerTest,TourStationServiceTest" test` 通过 177/177。

## 2026-09-04 项目架构上下文文档

- 文档生成：新增根目录 `精准地掌握整个项目架构.md`，用于后续 AI 助手快速理解 Omni 项目架构、前端/B 端路由、RBAC、公共组件、核心实体与主要 API 数据流。
- 范围口径：基于当前源码静态解析，覆盖 `frontend/`、`java/`、`nestjs/grab-service/`、`sql/production-split/` 和 Gateway 路由配置；未修改业务代码。
- 文件名偏离：用户给出的名称末尾含空格，Windows 文件名对尾随空格不可靠；实际创建为 `精准地掌握整个项目架构.md`。

## 2026-09-03 顶栏搜索输入联想与模糊搜索

- 根因：后端 ES 搜索已支持 `keyword=孙` 返回「孙燕姿」相关巡演，但顶栏搜索 Popover 只展示历史搜索和热门榜单，用户输入过程中没有把实时搜索结果展示出来。
- 修复：`Header` 在用户输入关键词时通过 260ms 防抖调用既有 `/api/ticket/activities` 搜索接口，展示「相关推荐」联想区，最多返回 6 条活动/巡演；点击联想项直接进入 `/activity/:id` 或 `/tour/:id`，点击「搜索 "关键词" 相关结果」进入搜索结果页。
- 保留：空输入状态仍展示历史搜索和动态热门榜单；placeholder 恢复为中立短文案「搜索演出、艺人、场馆...」，`Enter ↵` 继续使用 `shrink-0 whitespace-nowrap` 防遮挡。
- 视觉优化：移除右上角红色「模糊搜索」药丸和首行重粉色底；输入框与直达行统一使用 `Search` 单色线框图标，直达行和联想结果仅在 hover 时显示浅灰底，命中的用户输入词用品牌主色局部高亮。
- 验证：`keyword=孙` 通过 Gateway 返回「2026就在日落以后 / 孙燕姿」巡演；Docker 前端首页 HTTP 输出包含新 placeholder 与 `shrink-0 whitespace-nowrap`；`node --test src\lib\header-search-popover-production-entry.test.ts` 和 `pnpm typecheck` 均通过。

## 2026-09-03 搜索框提示词与 Enter 标识布局修复

- 根因：顶栏搜索框固定宽度为 `320px`，长 placeholder 与右侧 `Enter ↵` 快捷提示争用横向空间，快捷提示未设置 `shrink-0`，窄视口下容易出现视觉遮挡。
- 修复：将 placeholder 缩短为「搜索演出、艺人、场馆...」；搜索框在中等桌面宽度使用 `340px`、大屏使用 `380px`；输入框启用 `truncate`，`Enter ↵` 标识启用 `shrink-0 whitespace-nowrap`，避免互相覆盖。
- 验证：更新 `header-search-popover-production-entry.test.ts`，并执行前端类型检查与该入口测试。

## 2026-09-03 全局搜索热搜与详情返回优化

- 全局搜索：`Header` 搜索框升级为聚焦弹出的历史搜索 + 动态热门榜单 Popover；占位文案当前为「搜索演出、艺人、场馆...」，未登录历史使用 `search_history_records` localStorage，登录态调用 `/api/v1/search/history`。
- 动态热榜：新增 `/api/v1/search/trending`，后端优先从 `search_history` 聚合 Top 10，再通过 `ElasticsearchActivitySearchProvider` 按 `relevance` 解析活动/巡演目标；无历史数据时从 ES 推荐搜索生成榜单，不保留前端硬编码热榜词条。
- 搜索链路：新增 `SearchController`、`SearchHistoryService`、`SearchHistoryMapper` 和 `search_history` 表；Gateway 新增 `/api/v1/search/** -> java-ticket` 短读路由。搜索仍由 ES provider 执行，ES 不可用时返回搜索服务异常，不回退 DB 搜索。
- 详情返回：新增共享 `FloatingBackButton`，活动详情和巡演详情页均展示左侧悬浮「返回上一页」；优先恢复搜索页缓存 URL 与滚动位置，其次站内 `router.back()`，外链直达回退首页，并上报 `omni_activity_detail_back_clicked` / `omni_tour_detail_back_clicked`。
- 搜索页缓存：搜索结果卡片和右侧推荐点击前保存 `/search` 当前 URL 与滚动位置，返回时通过 `restoreSearchScrollIfPending()` 恢复，不强制重置第一页。
- 本地迁移：已对 `omni_ticket_split` 执行 `sql/production-split/ticket/20260609_search_history.sql`，创建 `search_history` 及用户历史、关键词热度索引。
- 本轮联调：前端已按用户口径运行在 `omni-frontend` Docker 容器；`java-ticket`、`java-gateway` 已重启加载新接口；`/api/v1/search/trending` 通过 Gateway、`java-ticket` 直连和前端代理均返回 `code=200`。
- 索引重建：通过后台管理员 token 执行 `scripts/rebuild-activity-search-index.ps1`，返回 `code=200`，新索引 `omni_activity_v1_20260903121556938_924ed371` 原子切换到 `omni_activity_current`，`_count=145`。
- 断开验证：短暂停止 `omni-elasticsearch` 后，搜索接口返回 `code=503` 与「搜索服务暂时不可用，请稍后重试」，未返回 DB 搜索结果；恢复 ES 后同一关键词搜索重新返回 `code=200`。
- 启动偏离：手动单独启动 `java-ticket` 时，`application-prod-split.yml` 要求显式 RabbitMQ 环境；本轮临时启动通过命令行传入 `spring.rabbitmq.*` 参数。推荐继续使用 `start-project.ps1`，脚本已内置本地 RabbitMQ 与强制 ES 默认值。
- 验证：前端目标 Node 测试 18/18 通过，`pnpm typecheck` 通过；Java 搜索/ES 配置/MQ/网关路由测试共 57 项通过；`check-production-runtime-defaults.ps1`、production-split SQL 安全检查与 cross-owner FK 检查通过。

## 2026-09-03 活动推荐海报回传修复

- 根因：活动详情页主图来自详情接口，可以正常显示；底部推荐活动来自 Elasticsearch 搜索结果，但 `ActivitySearchDocument`、mapping、文档构建和搜索结果转换均未携带 `poster`，前端因此按 `SafeImage` 规则回退到 `/background.png`。
- 修复：为 `ActivitySearchDocument` 增加 `poster` 字段；`ActivitySearchDocumentBuilder` 写入活动海报；`ElasticsearchActivitySearchProvider` 回传 `ActivityVO.poster`；索引 mapping 增加不可搜索的 `poster` 字段。
- 回填：重启 `java-ticket` 后执行 `scripts/rebuild-activity-search-index.ps1`，成功回填 145 条，通过新版本索引原子切换 `omni_activity_current` alias；活动 `27` 文档已包含 `/seed-posters/activity-27.jpg`。
- 验证：`ActivitySearchDocumentBuilderTest` 与 `ElasticsearchActivitySearchProviderTest` 共 10 项通过；直连 `java-ticket`、Gateway、前端代理的 `/api/ticket/activities?page=1&size=20` 均返回 200，20/20 条记录带 `poster`；浏览器刷新 `/activity/27` 后主图和推荐区 3 张海报均加载成功，图片有效尺寸，浏览器错误日志为 0。

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
- 启动脚本修复：`start-project.ps1` 为本地 `prod-split` 注入 RabbitMQ、Grab、Seata、本地 Alipay 占位、AI context-window 和前端 `API_PROXY_TARGET` 默认值；搜索默认已在 2026-09-02 调整为强制 Elasticsearch，见下方记录。
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

## 2026-09-02 个人设置中心三合一重构

- 页面重构：`frontend/src/app/profile/page.tsx` 将顶部概览、基础资料和安全认证合并为单个「个人设置中心」主卡片，保留页面 Header 快捷入口与底部账户提示横幅。
- 头像管理：移除下方重复头像上传区，改为主卡片顶部 80x80 圆角头像就地管理；「更换头像」触发隐藏文件选择并继续调用 `uploadUserAvatar`，仅允许 JPG、PNG、WebP；「清除」先更新表单，保存资料时统一提交。
- 信息去重：移除三列概览中的独立「角色身份」小卡片，只在用户条右侧保留唯一粉色权限徽章；注册时间和当前账号/手机号收敛为头像右侧单行元信息。
- 安全逻辑：保留 `verifyPasswordIdentity`、`verifyCurrentPhone`、`changePassword`、`changePhone`、`sendSmsCode` 两步弹窗流程，页面安全列表文案更新为「用于验证码校验」。
- 测试记录：新增页面源码结构断言，覆盖「个人设置中心」、就地头像操作、移除 `LocalFileUpload` / `CardHeader` / `InfoItem` / `profile-avatar-upload` / `scrollToAvatarUpload` 和重复角色文案。
- 头像排版微调：头像下方「更换头像 / 清除」操作容器增加 `whitespace-nowrap`，避免窄容器下文字纵向折行。

## 2026-09-02 活动详情页巡演/单场分流重构

- 巡演兼容：`frontend/src/app/activity/[id]/page.tsx` 通过 `isTour`、`eventType`、`tour` 和 `stationDetails` 识别巡演项目；单场活动继续走原 `detail.sessions` 购买链路。
- 站点联动：新增 `selectedStationId`、`selectedStationDetail`、`stationPurchaseState`、`activePurchaseSessions`，城市切换会清空旧座位、票档、实名观演人选择和抢票幂等键。
- 巡演 UI：顶部主卡片展示「巡演项目」标签、当前选站与分类角标；巡演模式下新增横向 `Tour Stations Selector`，支持售票中、预约中、待公布、缺货登记与「+ 求加场」。
- 待公布分支：`PENDING` 站点隐藏场次、票档、数量和座位提示，改为居中空态卡片，提供「开启开售提醒」和「登记想看意向」并复用真实订阅接口。
- 交互文案：`加入日历` 只更新前端日程提醒状态，Toast 改为「已加入日程提醒」；开售提醒空态成功文案为「已成功订阅，开票前将短信提醒！」。
- 验证偏离：相邻推荐测试在 Node ESM 下暴露 `activity-recommendations.ts` 对 `image-url` 的扩展名解析问题，已改为显式 `.ts` 导入以兼容现有测试运行方式。
- 验证偏离：`subscription.test.ts` 的目标时间未带时区，宿主机与 Docker UTC 环境结果不一致；已给测试输入补 `+08:00`，不改倒计时业务函数。

## 2026-09-02 活动搜索 Elasticsearch 强制切换

- 切换原因：活动搜索必须使用 Elasticsearch 全文检索、filter、分页与排序；PostgreSQL 继续作为活动详情、订单、库存、座位等业务数据真实源，不再承担搜索接口或内存过滤 fallback。
- 搜索 Provider：`ActivitySearchProperties` 默认 `provider=elasticsearch`、`requireElasticsearch=true`；`ActivityService.searchActivities()` 只调用注入的 `ActivitySearchProvider`，未注入时返回 503「搜索服务暂时不可用，请稍后重试」，不再实例化 `DbActivitySearchProvider`。
- 启动配置：`java-ticket` base 与 `prod-split` profile 固定 `omni.search.provider=elasticsearch`、`omni.search.require-elasticsearch=true`；`start-project.ps1` 注入 `ELASTICSEARCH_URIS` / `SPRING_ELASTICSEARCH_URIS`，并在 Java 启动前等待 ES yellow/green。
- Docker 基础设施：`docker-compose.yml` 和 `docker-compose.production.example.yml` 均声明 `omni-elasticsearch`、健康检查和持久化卷；`scripts/start-infra.ps1` 会同时确保 RabbitMQ 与 ES 就绪；生产示例要求 `ELASTICSEARCH_IMAGE_TAG`、`ELASTICSEARCH_SECURITY_ENABLED`、`ELASTICSEARCH_PASSWORD`、`ELASTICSEARCH_JAVA_OPTS` 显式注入。
- 索引结构：沿用 `ActivitySearchDocument` 与 `search/omni_activity_v1_mapping.json`，字段覆盖活动名称、艺人名称、分类、场馆、城市、演出时间、价格区间、售卖状态、实名要求和选座可见性；查询使用 `omni_activity_current` alias，不依赖固定版本索引。
- 索引字段补齐：`ActivityVO`、全量列表装配、单条 upsert 装配和 ES provider 返回映射均补齐 `categoryId`、`organizerId`、`venueName`、`maxPrice`，避免全量回填与实时同步字段不一致。
- 历史回填：继续使用 `scripts/rebuild-activity-search-index.ps1` 调用 `POST /api/ticket/admin/search-index/rebuild`；重建服务从 PostgreSQL 业务数据分页读取，写入新索引 `omni_activity_v1_<timestamp>_<suffix>` 后原子切换 alias，失败不会切走当前查询索引。
- 实时同步：活动新增/修改、发布/下架/删除、场次增删改、票档增删改、艺人阵容变更和场馆名称/城市变更都会发布活动搜索索引事件；艺人基础资料更新会批量刷新直接关联与阵容关联活动。
- MQ 处理：搜索索引事件继续走 RabbitMQ `omni.search-index`，消费者幂等执行 ES upsert/delete；处理失败进入 retry queue，超过 3 次转入 `search.activity.changed.dlq`；Rabbit JSON converter 已注册 `JavaTimeModule`，确保 `ActivitySearchIndexMessage.occurredAt` 可序列化；发布端不再吞掉 RabbitMQ 发送异常。
- 本机回填验证：`POST /api/ticket/admin/search-index/rebuild` 成功回填 145 条，alias 切换到 `omni_activity_v1_20260902200446642_9024a7ec`；ES 样本文档确认活动名称、艺人、分类 ID/名称、主办方、场馆、城市、票价区间、售卖状态、实名要求和座位图状态均可读取。
- 本机联调验证：临时活动 `ES-sync-smoke-20260902202953` 通过后台 API 新增、加场次、加票档、改名、改票价、下架、删除；ES 文档新增、字段更新、下架删除、删除后无遗留均通过，临时活动已逻辑删除且 ES 无 `ES*` 临时文档。
- 失败场景验证：停止 `omni-elasticsearch` 后搜索接口返回 503「搜索服务暂时不可用，请稍后重试」，未返回 PostgreSQL 搜索结果；恢复 ES 后网关和前端容器代理搜索恢复 200。
- 收尾命令验证：2026-09-02 20:35 重新执行搜索相关 Java 测试、RabbitMQ 消息测试、前端 `pnpm typecheck`、容器内前端 `pnpm typecheck`、`docker compose config --quiet`、`scripts/check-production-runtime-defaults.ps1` 和 `scripts/verify-microservice-boundaries.ps1`，均通过。
- 收尾运行态验证：`omni_activity_current` alias 指向 `omni_activity_v1_20260902200446642_9024a7ec`，当前 ES 文档数 145；前端容器代理搜索返回 200，短暂停止 ES 时搜索接口返回业务 `code=503`，恢复 ES 后搜索重新返回 200。

## 2026-09-02 巡演求加场联调闭环

- 前端状态：`frontend/src/app/tour/[id]/page.tsx` 已完成巡演城市栏细节修复，横向容器使用 `overflow-y-visible` 与 `py-2`，角标定位为卡片内右上角，卡片使用 `pt-5` 避免「待公布 / 售票中」文字被裁切。
- 城市弹窗：`+ 求加场` 已唤起「我想看的城市」弹窗，复用项目城市数据 `HOT_CITIES`、`OTHER_CITIES`、`filterCityOptions` 和 `CITY_KEY`，包含当前定位城市、热门城市、搜索、按字母分组和右侧字母导航。
- 提交流程：点击城市会通过前端代理调用 `POST /api/ticket/subscriptions`，提交 `targetType=TOUR_CITY_REMINDER`、`targetId=tourId`、`targetValue/city=城市名`，成功后关闭弹窗并显示居中 Toast「已提交【城市】加场心愿，主办方会收到您的期待！」。
- 后端补齐：新增 `NotificationInternalClient`，`PerformanceSubscriptionService` 在创建 `TOUR_CITY_REMINDER` 后直接调用 `java-notification` 的 `/api/notification/internal/events`，同时保留 RabbitMQ 通知事件；`NotificationService` 依据 `aggregateKey` 去重，避免 direct + MQ 重复消息。
- 启动修复：`start-project.ps1` 将 `TEMP/TMP` 固定到项目 `runtime/tmp`，规避本机 Windows Java `Selector.open()` 在 `ADMINI~1` 临时目录下报 `Unable to establish loopback connection` 导致 `java-ticket` 无法重启的问题。
- 联调验证：登录测试用户 `13900000001` 后经前端容器代理提交巡演 `5` 的「厦门」加场心愿，接口返回 200，`performance_subscription` 写入 `id=29`，`notification_delivery` 写入 `tour-city-wish:5:厦门:29` 且状态 `SENT`，主办方 `user_id=2002` 的 `notification` 写入 `TOUR_CITY_WISH`，入口 `/console/tours/5`。随后将 `java-ticket` 恢复为 `--seata.enabled=true` 正常口径，再提交「宁波」加场心愿，`performance_subscription` 写入 `id=30`，主办方通知写入 `notification.id=988011`，`notification_delivery.id=4` 状态 `SENT`。
- 测试记录：`mvn -pl java-ticket "-Dtest=ElasticsearchClientConfigTest,PerformanceSubscriptionServiceTest" test` 通过 5 项；`node --test src\lib\tour-detail-production-entry.test.ts src\lib\subscription.test.ts` 通过 3 项；`pnpm typecheck` 通过。

## 2026-09-03 分类页搜索体验与分页修复

- 分类页历史条：`frontend/src/app/search/page.tsx` 仍作为分类页入口 `/search?category=...` 使用，但搜索联想/历史标签条改为仅在 `/search` 且存在 `keyword` 时显示；分类浏览不再展示「搜索历史」横条。
- 可选座筛选：前端 `listActivities()` 增加公开查询参数 `isSupportSeat=true`，并保留旧入参 `seatMapOnly` 的调用兼容；后端 `/api/ticket/activities` 同时接收 `seatMapOnly` 与 `isSupportSeat`，统一归一后传入 ES provider 的 `seatMapVisibility=published` filter。
- 分页交互：`frontend/src/lib/pagination.ts` 新增 `buildPaginationItems()`，搜索页分页与通用 `Pagination` 组件都接入可点击省略号；点击 `...` 后原地输入页码，非法/越界页码按 `normalizePageRequest()` 归一，当前页高亮改为 `#ff2d55`。
- 运行偏离：手动重启 `java-ticket` 时首次漏传 `RABBITMQ_PORT` 等 prod-split 环境变量导致启动失败；补齐 RabbitMQ、ES、Nacos、Seata 和数据库环境变量后服务恢复并重新注册到 Nacos。
- 验证记录：新增/更新前端 `search-experience.test.ts`、`pagination.test.ts`、`api.test.ts` 和后端 `ActivityControllerCEndTest` 覆盖上述行为；宿主机与 `omni-frontend` 容器内前端目标 Node 测试均 51/51 通过，宿主机与容器 `pnpm typecheck` 通过，Java 搜索/控制器目标测试 39/39 通过；前端代理与网关直连 `isSupportSeat=true` 均返回 20 条样本且 `badSeatMapVisibility=0`。

## 2026-09-03 后台全局分页组件统一

- 公共组件：`frontend/src/components/Pagination.tsx` 正式导出 `GlobalPagination`，保留 `Pagination` 兼容别名；统一页码和省略号原地输入跳转的品牌玫红样式，并按最新 UI 要求移除尾部 `跳至 [X] 页 跳转` Quick Jumper 模块，分页器最右侧停在「下一页」。
- 活动/场次/艺人管理：`frontend/src/app/console/activities/page.tsx`、`frontend/src/app/console/sessions/page.tsx`、`frontend/src/app/console/artists/page.tsx` 移除本地「上一页 / 下一页」分页块，改用 `GlobalPagination`，原服务端/本地切片数据逻辑保持不变。
- 草稿箱：`frontend/src/app/console/tours/page.tsx` 新增 `DEFAULT_PAGE_SIZE` 本地分页切片与分页容器，避免草稿列表无分页导致页面过长。
- 已有后台分页入口：订单、退款、风险事件、风险工单、风险恢复申请、场馆记录、场馆资料审核统一改为 `<GlobalPagination />` 调用，保持各自原有数据筛选和分页切片。
- 其他后台表格页：操作审计、异常任务、入场核验、日结对账、站点变更审核、平台主办方运营工作台补齐本地分页切片和 `GlobalPagination` 容器；导出、详情、跟进等原业务动作保持原完整数据或当前业务状态。
- 验证记录：新增 `frontend/src/lib/console-pagination-production-entry.test.ts` 覆盖标准组件导出、Quick Jumper 移除、后台页面统一入口、活动/场次/艺人本地分页块移除、草稿箱分页补齐和主要后台表格页统一入口。

## 2026-09-03 想看与提醒通知收拢

- 页面精简：`frontend/src/app/subscriptions/page.tsx` 右上角移除「导出日历」按钮，仅保留「刷新」；同时删除前端 `Blob` / `URL.createObjectURL` / `.ics` 下载逻辑，避免用户误以为需要同步第三方日历。
- API 收口：前端 `createSubscriptionCalendar()` 与 `SubscriptionCalendarVO` 已移除；后端 `GET /api/ticket/subscriptions/calendar`、`PerformanceSubscriptionService.createCalendar()` 和 `SubscriptionCalendarResponse` 已移除，生产链路不再生成本地日历文件。
- 通知口径：开售提醒、想看状态、候补释放、支付提醒、艺人/城市上新与巡演加场心愿统一进入站内消息中心/顶部通知图标；后续短信、App Push 或浏览器 Push 也应通过消息服务下发，不恢复本地日历方案。
- 后端机制：订阅仍写入 `performance_subscription`；需要触达用户或主办方的场景继续通过 MQ/延迟任务投递通知事件，由通知服务写入站内信通知列表。

## 2026-09-04 IDEA 与 Docker 本地启动修复

- Docker 根因：Docker Desktop 直接启动 `seata-server` 会先触发一次性容器 `seata-config-init`，但不会注入 `SEATA_ADVERTISE_HOST`，导致报错「必须是宿主机可达的非回环 IPv4」。本机应使用 `powershell -ExecutionPolicy Bypass -File scripts\start-seata-docker.ps1`，脚本会自动探测宿主机 IP、发布 Nacos 配置并启动 `omni-seata`。
- 中间件状态：已恢复并验证 `omni-redis`、`omni-nacos`、`omni-rabbitmq`、`omni-elasticsearch`、`omni-seata` 健康运行；前端 Docker 容器 `omni-frontend` 继续监听 `localhost:3000`。
- IDEA 根因：Windows 本机 `TEMP/TMP` 指向短路径 `C:\Users\ADMINI~1\AppData\Local\Temp` 时，JDK 17/Netty 在 `Selector.open()` 触发 `Unable to establish loopback connection` / `Invalid argument: connect`，导致 Java 微服务启动失败。
- 本地配置修复：已在忽略文件 `.idea/workspace.xml` 的六个 Spring Boot Run Config 中写入 `TEMP=D:\Project\omni\runtime\java-tmp`、`TMP=D:\Project\omni\runtime\java-tmp` 和 `-Djava.io.tmpdir=D:\Project\omni\runtime\java-tmp`；`TicketApplication` 同时保持 ES 强制搜索配置，避免回退 DB 搜索。
- IDEA 状态修复：`.idea/workspace.xml` 的 `RunDashboard` 残留了六个 Spring Boot 配置的 `FAILED` 历史状态，导致服务面板继续显示红色感叹号；已清理该本地失败缓存，重启或刷新 IDEA 后应恢复为可启动状态。
- 启动验证：命令行按 IDEA 同等参数已验证 `GatewayApplication`、`PaymentApplication`、`TicketApplication`、`UserApplication`、`OrderApplication`、`NotificationApplication` 均可启动并注册 Nacos；其中 ticket/order/payment 的 Seata 连接正常，notification 的 RabbitMQ 连接正常。临时启动进程已全部停止，8081/8082/8083/8084/8085/8088 已释放给 IDEA 使用。
- 二次修复：IDEA 实际启动时仍未向非网关服务传入部分环境变量，`application-prod-split.yml` 中的 `${RABBITMQ_PORT}`、`${SEATA_ENABLED}`、`${GRAB_SERVICE_URL}` 等裸占位符被原样绑定并启动失败。已为 `java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification` 的 `prod-split` 配置补齐本地默认值，环境变量仍可覆盖；同时补齐 `java-user` 的 `omni.privacy.id-no-key` 本地默认，避免实名观演人加密服务因本地密钥缺失启动失败。
- 二次验证：在显式移除 `RABBITMQ_PORT`、`SEATA_ENABLED`、`GRAB_SERVICE_URL`、`OMNI_ID_NO_KEY`、`ELASTICSEARCH_URIS`、`ALIPAY_*` 等环境变量后，分别启动 `java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification`，均可使用 `prod-split` 成功启动并注册 Nacos；临时验证进程已停止，除 IDEA 当前运行的 `GatewayApplication` 占用 8088 外，其余 Java 端口均已释放。

## 2026-09-04 客户端断连异常降噪

- 根因：`java-ticket` 请求处理完成写响应时，浏览器或前端代理主动关闭连接，Tomcat 抛出 `ClientAbortException: 你的主机中的软件中止了一个已建立的连接`。这类异常表示客户端已取消接收响应，不是业务处理失败，也不是服务启动失败。
- 修复：`java-common` 的 `GlobalExceptionHandler` 新增 `ClientAbortException` 专用处理器，返回 `204 NO_CONTENT` 且仅打 debug 日志，避免进入通用 `handleException(Exception)` 后被误报为「系统异常」并再次尝试写 500 JSON 响应。
- 验证：新增 `GlobalExceptionHandlerTest.clientAbortUsesDedicatedNoContentHandlerInsteadOfInternalError` 回归测试；`mvn -pl java-common -Dtest=GlobalExceptionHandlerTest test` 通过 3/3；`mvn -pl java-ticket -am -DskipTests compile` 通过。

## 2026-09-04 后台侧边栏分组导航重构

- 范围：按需求重构 `frontend/src/app/console/layout.tsx` 后台侧边栏，将平铺菜单改为「概览与看板、演出与票务管理、订单与履约中心、运营、客服与审核、系统、安全与财务」五个折叠分组，并把 `/console/profile` 固定保留在底部个人区。
- 权限：分组渲染先按 `role` 过滤，再按子项 `roles`、`canAccessConsolePath(child.href, permissionCodes)` 过滤；`organizer` 角色继续使用 `isConsolePathAllowedForRole(role, child.href)` 白名单，并对活动、巡演、场次、场馆、艺人、订单、退款文案做主办方视角调整。
- 入口对齐：`console-auth.ts` 将 `organizer_admin`、`support` 的默认后台入口限制在新分组实际可见的订单、履约、运营和客服路径；`console-paths.ts` 同步收紧两类角色的快捷操作，隐藏客服账号、审计等不应暴露的系统入口。
- 交互：新增 `openGroups: string[]` 状态、当前路径命中分组自动展开、分组按钮手动展开/收起；子菜单选中态统一使用 `bg-[var(--omni-brand)]/10` 和 `text-[var(--omni-brand)]`。
- 验证：新增 `frontend/src/lib/console-layout-menu.test.ts` 并更新 `console-production-entry.test.ts` 覆盖分组结构、主办方白名单、空分组隐藏和自动展开；`node --test` 目标测试 92/92 通过，`pnpm typecheck` 通过，`pnpm build` 通过。`pnpm lint` 仍被既有全仓 React Compiler/unused-vars 问题拦截，本次改动文件仅剩原布局已有的 `setRedirecting(false)` effect 警告。
