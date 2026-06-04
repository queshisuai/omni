import { C, bg, footer, title, card, serviceBox, dbBox, arrow, metric, pill, step } from "../../omni-defense/slides/theme.mjs";

const today = "2026/06/04";

export const slides = [
  {
    type: "cover",
    kicker: "MICROSERVICE PRACTICE",
    title: "Omni 万象抢票平台",
    subtitle: "微服务架构实践与答辩优化版",
    bullets: ["五个业务微服务", "八个中间件/基础设施", "六人三组协作", "prod-split 五库联调"],
  },
  {
    type: "contents",
    title: "目录",
    items: ["01 项目概述", "02 需求与业务设计", "03 系统架构与技术实现", "04 前端展示与系统演示", "05 测试总结与展望"],
  },
  { type: "section", section: "01", title: "项目概述", subtitle: "先说明项目做什么、为什么做、团队如何协作。" },
  {
    type: "overview",
    kicker: "PROJECT OVERVIEW",
    title: "项目定位从“抢票平台”落到一条完整交易闭环",
    subtitle: "Omni 面向演出、赛事等票务场景，采用 B 端主导、C 端参与模式。",
    leftTitle: "业务目标",
    left: ["C 端完成登录、浏览、选座、下单、支付、查看订单", "B 端完成活动、场次、票档、座位图与审核管理", "订单、支付、通知形成交易结果闭环"],
    rightTitle: "技术目标",
    right: ["Spring Cloud Alibaba 微服务", "Next.js 16 + React 19 前端", "PostgreSQL prod-split 五库联调", "internal API 约束服务边界"],
  },
  {
    type: "pain",
    kicker: "BACKGROUND",
    title: "票务系统的难点集中在高峰流量、库存一致性和多角色协作",
    cards: [
      ["流量高峰", "热门活动开售时请求集中爆发，需要入口层、缓存和后端服务共同承压。"],
      ["库存一致", "票档库存和座位售卖必须避免超卖，订单创建需要先锁定再确认。"],
      ["链路较长", "登录、活动、选座、订单、支付、通知跨多个服务协作。"],
      ["角色复杂", "普通用户、主办方、管理员对应不同权限和后台工作流。"],
    ],
  },
  {
    type: "split",
    kicker: "TEAM SPLIT",
    title: "六人三组按业务链路分工，答辩能自然串成完整流程",
    groups: [
      ["第 1 组", "用户与入口层", "java-user + java-gateway + 登录/权限前端", "讲登录、JWT、角色、网关路由和 internal token。", C.blue],
      ["第 2 组", "票务核心", "java-ticket + 活动/票档/座位前端", "讲活动供给、SeatCraft、票档库存和锁库存接口。", C.brand],
      ["第 3 组", "交易闭环", "java-order + java-payment + java-notification", "讲订单快照、支付同步、退款通知和状态流转。", C.green],
    ],
  },
  { type: "section", section: "02", title: "需求与业务设计", subtitle: "用角色、流程和数据所有权说明系统为什么这样拆。" },
  {
    type: "matrix",
    kicker: "ROLE MATRIX",
    title: "三类角色覆盖平台从供给到消费的主要需求",
    columns: [
      ["普通用户", ["注册登录", "浏览/搜索活动", "选择票档/座位", "下单支付", "订单查看/退款"]],
      ["主办方", ["活动发布", "场次配置", "票档定价", "座位图维护", "销售数据查看"]],
      ["平台管理员", ["用户治理", "主办方审批", "场馆/艺人审核", "风险处理", "运营数据管理"]],
    ],
  },
  {
    type: "flow",
    kicker: "PURCHASE FLOW",
    title: "C 端购票主流程是后续架构验证的核心基准",
    steps: ["登录", "浏览活动", "活动详情", "选择票档/座位", "创建订单", "支付同步", "查看订单"],
    note: "这条链路会贯穿 user、ticket、order、payment、notification 五个服务。",
  },
  { type: "section", section: "03", title: "系统架构与技术实现", subtitle: "重点讲五个微服务、八个支撑组件和服务边界。" },
  {
    type: "architecture",
    kicker: "ARCHITECTURE",
    title: "前端经 Gateway 进入五个业务服务，服务间靠 internal API 协作",
  },
  {
    type: "services",
    kicker: "SERVICE SCOPE",
    title: "五个微服务分别拥有清晰的业务边界和数据库所有权",
    services: [
      ["java-user", ":8081", "用户、角色、JWT、主办方申请", "omni_user", C.blue],
      ["java-ticket", ":8082", "活动、场次、票档、座位图、库存", "omni_ticket_split", C.brand],
      ["java-order", ":8083", "订单、订单快照、座位锁定结果", "omni_order", C.amber],
      ["java-payment", ":8084", "支付宝沙盒、支付同步、退款", "omni_payment", C.green],
      ["java-notification", ":8085", "站内信、短信、邮件通知", "omni_notification", C.cyan],
    ],
  },
  {
    type: "middleware",
    kicker: "INFRASTRUCTURE",
    title: "八个中间件/基础设施组件支撑本地联调和扩展能力",
    items: ["PostgreSQL", "Redis", "Nacos", "Seata Config Init", "Seata Server", "RabbitMQ", "Docker Compose", "Node Runtime"],
  },
  {
    type: "governance",
    kicker: "GOVERNANCE",
    title: "服务治理靠注册发现、网关路由和 internal API 安全约束落地",
    points: [
      ["Nacos 注册发现", "服务启动后注册到 Nacos，Gateway 可按服务名路由到下游。"],
      ["Gateway 统一入口", "外部请求统一走 :8088，前端不直接访问业务服务。"],
      ["OpenFeign / internal API", "order/payment 通过内部接口获取用户、票务、订单信息。"],
      ["X-Internal-Token", "新增 internal API 必须校验 token，防止外部绕过网关调用。"],
    ],
  },
  {
    type: "consistency",
    kicker: "CONSISTENCY",
    title: "下单链路先校验和锁定，再写订单快照，避免跨服务直接查表",
    steps: ["校验用户", "报价", "锁库存/锁座", "创建订单快照", "支付同步", "确认售出/释放"],
  },
  {
    type: "database",
    kicker: "DATA OWNERSHIP",
    title: "prod-split 五库拆分让服务自治边界更清楚",
  },
  {
    type: "boundary",
    kicker: "BOUNDARY RULES",
    title: "服务边界是本项目答辩最应该强调的工程纪律",
    rules: [
      "禁止新增跨服务 Mapper、Entity、XML mapper 或 SQL join。",
      "java-order 不直接访问 user/ticket 表，必须调用 user/ticket internal API。",
      "java-payment 不直接访问 order/user/ticket 表，通过 order/user/ticket internal API 协作。",
      "java-notification 只保存 copied id，不拥有 user/order 主数据。",
    ],
  },
  {
    type: "search",
    kicker: "CACHE & SEARCH",
    title: "缓存和搜索能力以项目实际状态表述，避免把预留能力讲成已落地",
    points: [
      ["Redis", "用于抢票核心预留、缓存和高并发扩展支撑，当前由 Docker infra 提供。"],
      ["Elasticsearch", "源 PPT 曾写 ES 搜索增强；当前项目运行手册未将 ES 列为默认联调组件，答辩中建议作为后续优化方向。"],
      ["PostgreSQL", "当前核心检索和业务数据以五个 PostgreSQL database 为主。"],
    ],
  },
  { type: "section", section: "04", title: "前端展示与系统演示", subtitle: "把页面讲成业务路径，而不是只展示截图。" },
  {
    type: "frontend",
    kicker: "FRONTEND",
    title: "Next.js 前端分为 C 端购票体验和 B 端 Console 管理台",
    columns: [
      ["C 端页面", ["/", "/login", "/activity/[id]", "/orders", "/payment/result"]],
      ["B 端 Console", ["/console", "/console/activities", "/console/sessions", "/console/venue", "/console/refunds"]],
      ["公共技术层", ["src/lib/api.ts request<T>()", "src/lib/auth.ts", "localStorage token/user", "800ms API timeout"]],
    ],
  },
  {
    type: "demoC",
    kicker: "C-END DEMO",
    title: "C 端演示按真实购票链路推进",
    steps: ["登录测试账号", "浏览活动列表", "进入活动详情", "选择场次和票档/座位", "创建订单", "发起支付", "查看订单状态"],
  },
  {
    type: "demoB",
    kicker: "B-END DEMO",
    title: "B 端演示说明票务供给如何进入 C 端可售状态",
    cards: [
      ["主办方", "活动发布、场次配置、票档定价、座位图维护。"],
      ["管理员", "主办方审批、场馆申请审核、风险处理、数据治理。"],
      ["Console 布局", "统一侧边栏与表格/表单布局，支撑重复运营操作。"],
    ],
  },
  {
    type: "demoPath",
    kicker: "DEMO PLAN",
    title: "答辩演示用一条主线和两条补充线控制节奏",
    lines: [
      ["主线", "普通用户登录 -> 浏览活动 -> 下单 -> 支付同步 -> 订单状态变化"],
      ["补充线 A", "主办方/管理员进入 Console，展示活动、场次、票档和座位图管理"],
      ["补充线 B", "展示边界验收命令和 prod-split 数据库连接检查结果"],
    ],
  },
  { type: "section", section: "05", title: "测试总结与展望", subtitle: "用验收命令、风险反思和未来方向收束。" },
  {
    type: "tests",
    kicker: "QUALITY GATE",
    title: "验收不是泛泛测试，而是围绕微服务边界和运行拓扑",
    checks: [
      ["边界验收", "scripts/verify-microservice-boundaries.ps1"],
      ["前端检查", "cd frontend && pnpm typecheck"],
      ["Runtime verifier", "verify-production-split-runtime.ps1 -TargetDatabaseByService 'ticket=omni_ticket_split'"],
      ["数据库连接", "pg_stat_activity 不应出现业务 JDBC 连到 omni_ticket"],
    ],
  },
  {
    type: "highlights",
    kicker: "VALUE",
    title: "项目亮点从“技术很多”调整为“边界清楚、链路完整、可验证”",
    cards: [
      ["架构亮点", "五个业务服务 + 五库拆分，服务拥有独立数据边界。"],
      ["业务亮点", "B 端供给和 C 端购买能串成完整票务闭环。"],
      ["工程亮点", "启动脚本、边界检查、runtime verifier 支撑本机联调。"],
      ["协作亮点", "三组按业务链路分工，答辩叙事自然衔接。"],
    ],
  },
  {
    type: "future",
    kicker: "NEXT STEPS",
    title: "未来优化方向应围绕高并发、可观测性和支付可靠性继续深化",
    cards: [
      ["抢票核心增强", "完善 Redis 队列、限流、令牌和库存预热策略。"],
      ["可观测性建设", "补充日志聚合、链路追踪、指标监控和告警。"],
      ["支付补偿机制", "强化回调幂等、异常补偿和对账流程。"],
      ["搜索体验升级", "将 ES 搜索作为明确后续能力，而不是当前默认运行依赖。"],
    ],
  },
  {
    type: "thanks",
    title: "感谢观看",
    subtitle: "Omni 万象抢票平台：微服务架构实践",
  },
];

function drawHeader(slide, ctx, s, page) {
  title(slide, ctx, s.kicker || "OMNI", s.title, s.subtitle || "");
  footer(slide, ctx, page);
}

function drawSection(slide, ctx, s, page) {
  bg(slide, ctx, C.ink);
  ctx.addText(slide, { x: 84, y: 96, w: 220, h: 52, text: `SECTION ${s.section}`, fontSize: 22, bold: true, color: C.cyan });
  ctx.addShape(slide, { x: 86, y: 170, w: 62, h: 6, fill: C.brand });
  ctx.addText(slide, { x: 84, y: 220, w: 760, h: 72, text: s.title, fontSize: 56, bold: true, color: "#ffffff" });
  ctx.addText(slide, { x: 88, y: 318, w: 720, h: 40, text: s.subtitle, fontSize: 22, color: "#d0d5dd" });
  ctx.addShape(slide, { x: 870, y: 138, w: 250, h: 250, fill: "#172033", line: { style: "solid", fill: "#344054", width: 1 } });
  ctx.addText(slide, { x: 916, y: 210, w: 158, h: 90, text: s.section, fontSize: 76, bold: true, color: C.brand, align: "center" });
  footer(slide, ctx, page, true);
}

function drawCover(slide, ctx, s) {
  bg(slide, ctx, C.ink);
  pill(slide, ctx, 72, 74, 210, s.kicker, C.cyan, "#123b44");
  ctx.addText(slide, { x: 72, y: 156, w: 720, h: 74, text: s.title, fontSize: 58, bold: true, color: "#ffffff" });
  ctx.addText(slide, { x: 76, y: 246, w: 650, h: 46, text: s.subtitle, fontSize: 32, bold: true, color: "#f2f4f7" });
  ctx.addText(slide, { x: 78, y: 330, w: 520, h: 30, text: `时间：${today}`, fontSize: 18, color: "#d0d5dd" });
  s.bullets.forEach((b, i) => metric(slide, ctx, 80 + i * 180, 448, String(i === 0 ? 5 : i === 1 ? 8 : i === 2 ? 3 : "五库"), b, i === 3 ? "prod-split" : "答辩主线", [C.brand, C.cyan, "#a78bfa", C.green][i]));
  ctx.addShape(slide, { x: 812, y: 92, w: 340, h: 460, fill: "#172033", line: { style: "solid", fill: "#344054", width: 1 } });
  ["user", "ticket", "order", "payment", "notice"].forEach((n, i) => {
    ctx.addShape(slide, { x: 860 + (i % 2) * 130, y: 150 + i * 58, w: 94, h: 42, fill: i === 1 ? C.brand : "#344054" });
    ctx.addText(slide, { x: 866 + (i % 2) * 130, y: 164 + i * 58, w: 82, h: 14, text: n, fontSize: 12, bold: true, color: "#ffffff", align: "center" });
  });
  ctx.addShape(slide, { x: 854, y: 458, w: 250, h: 58, fill: "#0f766e", line: { style: "solid", fill: C.cyan, width: 2 } });
  ctx.addText(slide, { x: 884, y: 474, w: 190, h: 24, text: "可联调 · 可验证 · 可答辩", fontSize: 18, bold: true, color: "#ffffff", align: "center" });
  footer(slide, ctx, 1, true);
}

function drawContents(slide, ctx, s) {
  bg(slide, ctx);
  ctx.addText(slide, { x: 68, y: 58, w: 420, h: 58, text: s.title, fontSize: 48, bold: true, color: C.ink });
  s.items.forEach((item, i) => {
    const y = 160 + i * 86;
    ctx.addShape(slide, { x: 86, y, w: 70, h: 54, fill: i % 2 ? C.ink : C.brand });
    ctx.addText(slide, { x: 86, y: y + 14, w: 70, h: 22, text: item.slice(0, 2), fontSize: 20, bold: true, color: "#ffffff", align: "center" });
    ctx.addText(slide, { x: 186, y: y + 9, w: 760, h: 30, text: item.slice(3), fontSize: 28, bold: true, color: C.ink });
    ctx.addShape(slide, { x: 960, y: y + 25, w: 170, h: 3, fill: "#e4e7ec" });
  });
  footer(slide, ctx, 2);
}

function drawOverview(slide, ctx, s, page) {
  bg(slide, ctx);
  drawHeader(slide, ctx, s, page);
  card(slide, ctx, 82, 210, 460, 270, s.leftTitle, s.left.map((x) => `• ${x}`).join("\n"), C.brand);
  card(slide, ctx, 738, 210, 460, 270, s.rightTitle, s.right.map((x) => `• ${x}`).join("\n"), C.blue);
  ctx.addShape(slide, { x: 575, y: 280, w: 130, h: 130, fill: C.ink });
  ctx.addText(slide, { x: 590, y: 318, w: 100, h: 36, text: "Omni", fontSize: 28, bold: true, color: "#ffffff", align: "center" });
  ctx.addText(slide, { x: 590, y: 360, w: 100, h: 22, text: "票务平台", fontSize: 16, color: "#d0d5dd", align: "center" });
  arrow(slide, ctx, 542, 344, 575, 344, C.brand);
  arrow(slide, ctx, 705, 344, 738, 344, C.blue);
}

function drawCards(slide, ctx, s, page) {
  bg(slide, ctx);
  drawHeader(slide, ctx, s, page);
  const data = s.cards || s.points || (s.rules || []).map((r, i) => [`规则 ${i + 1}`, r]);
  data.forEach(([h, b, color], i) => {
    const x = 76 + (i % 2) * 570;
    const y = 184 + Math.floor(i / 2) * 154;
    card(slide, ctx, x, y, 500, 112, h, b, color || [C.brand, C.blue, C.green, C.amber][i % 4]);
  });
}

function drawSplit(slide, ctx, s, page) {
  bg(slide, ctx);
  drawHeader(slide, ctx, s, page);
  s.groups.forEach(([g, name, scope, point, color], i) => {
    const x = 76 + i * 390;
    ctx.addShape(slide, { x, y: 190, w: 330, h: 76, fill: color });
    ctx.addText(slide, { x: x + 20, y: 204, w: 100, h: 20, text: g, fontSize: 16, bold: true, color: "#ffffff" });
    ctx.addText(slide, { x: x + 20, y: 228, w: 220, h: 28, text: name, fontSize: 24, bold: true, color: "#ffffff" });
    card(slide, ctx, x, 294, 330, 98, "负责范围", scope, color);
    card(slide, ctx, x, 422, 330, 126, "答辩重点", point, color);
  });
  ctx.addShape(slide, { x: 162, y: 592, w: 956, h: 42, fill: C.ink });
  ctx.addText(slide, { x: 188, y: 604, w: 904, h: 18, text: "推荐串讲：登录拿 token -> 浏览活动和选座 -> 创建订单、支付、查看订单", fontSize: 16, bold: true, color: "#ffffff", align: "center" });
}

function drawMatrix(slide, ctx, s, page) {
  bg(slide, ctx);
  drawHeader(slide, ctx, s, page);
  s.columns.forEach(([h, arr], i) => {
    const x = 84 + i * 390;
    ctx.addShape(slide, { x, y: 190, w: 310, h: 360, fill: "#ffffff", line: { style: "solid", fill: "#e4e7ec", width: 1 } });
    ctx.addShape(slide, { x, y: 190, w: 310, h: 58, fill: [C.blue, C.brand, C.green][i] });
    ctx.addText(slide, { x: x + 22, y: 206, w: 260, h: 24, text: h, fontSize: 23, bold: true, color: "#ffffff" });
    arr.forEach((it, j) => {
      ctx.addShape(slide, { x: x + 24, y: 278 + j * 48, w: 12, h: 12, fill: [C.blue, C.brand, C.green][i] });
      ctx.addText(slide, { x: x + 50, y: 270 + j * 48, w: 230, h: 24, text: it, fontSize: 17, color: C.text });
    });
  });
}

function drawFlow(slide, ctx, s, page) {
  bg(slide, ctx);
  drawHeader(slide, ctx, s, page);
  s.steps.forEach((label, i) => {
    const x = 70 + i * 164;
    ctx.addShape(slide, { x, y: 250, w: 128, h: 96, fill: "#ffffff", line: { style: "solid", fill: [C.blue, C.brand, C.amber, C.green][i % 4], width: 2 } });
    ctx.addText(slide, { x: x + 18, y: 270, w: 92, h: 28, text: label, fontSize: 18, bold: true, color: C.ink, align: "center" });
    ctx.addText(slide, { x: x + 40, y: 308, w: 48, h: 22, text: String(i + 1), fontSize: 20, bold: true, color: [C.blue, C.brand, C.amber, C.green][i % 4], align: "center" });
    if (i < s.steps.length - 1) arrow(slide, ctx, x + 128, 298, x + 164, 298, C.ink);
  });
  if (s.note) {
    ctx.addShape(slide, { x: 170, y: 470, w: 940, h: 58, fill: C.ink });
    ctx.addText(slide, { x: 204, y: 488, w: 872, h: 22, text: s.note, fontSize: 17, bold: true, color: "#ffffff", align: "center" });
  }
}

function drawArchitecture(slide, ctx, s, page) {
  bg(slide, ctx);
  drawHeader(slide, ctx, s, page);
  serviceBox(slide, ctx, 70, 244, 170, 86, "Next.js 前端", ":3000\nC 端 + B 端", C.violet);
  serviceBox(slide, ctx, 304, 244, 170, 86, "java-gateway", ":8088\n统一 API 入口", C.ink);
  arrow(slide, ctx, 240, 286, 304, 286, C.violet);
  [["java-user", 570, 192, C.blue], ["java-ticket", 792, 192, C.brand], ["java-order", 570, 354, C.amber], ["java-payment", 792, 354, C.green], ["java-notification", 1014, 354, C.cyan]].forEach(([n, x, y, color]) => serviceBox(slide, ctx, x, y, 170, 84, n, "业务服务", color));
  [570, 792, 570, 792, 1014].forEach((x, i) => arrow(slide, ctx, 474, 286, x, i < 2 ? 234 : 396, C.ink));
  dbBox(slide, ctx, 82, 552, 190, "omni_user", "user", C.blue);
  dbBox(slide, ctx, 302, 552, 190, "omni_ticket_split", "ticket", C.brand);
  dbBox(slide, ctx, 522, 552, 190, "omni_order", "order", C.amber);
  dbBox(slide, ctx, 742, 552, 190, "omni_payment", "payment", C.green);
  dbBox(slide, ctx, 962, 552, 190, "omni_notification", "notification", C.cyan);
}

function drawServices(slide, ctx, s, page) {
  bg(slide, ctx);
  drawHeader(slide, ctx, s, page);
  s.services.forEach(([name, port, scope, db, color], i) => {
    const x = 78 + (i % 3) * 384;
    const y = 190 + Math.floor(i / 3) * 180;
    serviceBox(slide, ctx, x, y, 300, 96, name, `${port}\n${scope}`, color);
    dbBox(slide, ctx, x, y + 116, 300, db, name, color);
  });
}

function drawMiddleware(slide, ctx, s, page) {
  bg(slide, ctx);
  drawHeader(slide, ctx, s, page);
  s.items.forEach((it, i) => {
    const x = 76 + (i % 4) * 286;
    const y = 194 + Math.floor(i / 4) * 160;
    ctx.addShape(slide, { x, y, w: 230, h: 118, fill: "#ffffff", line: { style: "solid", fill: "#e4e7ec", width: 1 } });
    ctx.addShape(slide, { x, y, w: 230, h: 9, fill: [C.blue, C.red, C.green, C.amber, C.violet, C.cyan, C.ink, C.brand][i] });
    ctx.addText(slide, { x: x + 20, y: y + 36, w: 190, h: 26, text: it, fontSize: 19, bold: true, color: C.ink, align: "center" });
  });
  card(slide, ctx, 150, 524, 980, 88, "讲法建议", "按职责讲：数据持久化、缓存与并发、服务发现、事务协调、异步消息、容器编排和前端/抢票服务运行支撑。", C.brand);
}

function drawDatabase(slide, ctx, s, page) {
  bg(slide, ctx);
  drawHeader(slide, ctx, s, page);
  const dbs = [["omni_user", "java-user", C.blue], ["omni_ticket_split", "java-ticket", C.brand], ["omni_order", "java-order", C.amber], ["omni_payment", "java-payment", C.green], ["omni_notification", "java-notification", C.cyan]];
  dbs.forEach(([db, owner, color], i) => dbBox(slide, ctx, 92 + i * 220, 260, 184, db, owner, color));
  ctx.addShape(slide, { x: 130, y: 430, w: 1020, h: 72, fill: "#111827" });
  ctx.addText(slide, { x: 172, y: 452, w: 936, h: 26, text: "omni_ticket 仅作为历史共享库/迁移源，不再作为当前业务运行库", fontSize: 20, bold: true, color: "#ffffff", align: "center" });
}

function drawFrontend(slide, ctx, s, page) {
  bg(slide, ctx);
  drawHeader(slide, ctx, s, page);
  s.columns.forEach(([h, arr], i) => {
    card(slide, ctx, 78 + i * 386, 210, 320, 280, h, arr.map((x) => `• ${x}`).join("\n"), [C.blue, C.brand, C.green][i]);
  });
}

function drawDemoPath(slide, ctx, s, page) {
  bg(slide, ctx);
  drawHeader(slide, ctx, s, page);
  s.lines.forEach(([label, text], i) => {
    const y = 210 + i * 118;
    const color = [C.brand, C.blue, C.green][i];
    ctx.addShape(slide, { x: 92, y, w: 170, h: 72, fill: color });
    ctx.addText(slide, { x: 112, y: y + 22, w: 130, h: 24, text: label, fontSize: 22, bold: true, color: "#ffffff", align: "center" });
    ctx.addShape(slide, { x: 296, y, w: 850, h: 72, fill: "#ffffff", line: { style: "solid", fill: color, width: 1.5 } });
    ctx.addText(slide, { x: 326, y: y + 22, w: 790, h: 24, text, fontSize: 19, bold: i === 0, color: C.ink });
    arrow(slide, ctx, 262, y + 36, 296, y + 36, color);
  });
  ctx.addShape(slide, { x: 188, y: 580, w: 904, h: 44, fill: C.ink });
  ctx.addText(slide, { x: 218, y: 592, w: 844, h: 20, text: "节奏控制：先跑通主链路，再用后台和验收命令补强工程可信度。", fontSize: 16, bold: true, color: "#ffffff", align: "center" });
}

function drawTests(slide, ctx, s, page) {
  bg(slide, ctx);
  drawHeader(slide, ctx, s, page);
  s.checks.forEach(([h, b], i) => card(slide, ctx, 84 + (i % 2) * 560, 200 + Math.floor(i / 2) * 150, 500, 94, h, b, [C.brand, C.blue, C.green, C.amber][i]));
  ctx.addShape(slide, { x: 166, y: 548, w: 948, h: 46, fill: C.ink });
  ctx.addText(slide, { x: 198, y: 560, w: 884, h: 22, text: "演示路径：登录 -> 浏览活动 -> 创建订单 -> 支付同步 -> 查看订单状态", fontSize: 17, bold: true, color: "#ffffff", align: "center" });
}

function drawThanks(slide, ctx, s, page) {
  bg(slide, ctx, C.ink);
  ctx.addText(slide, { x: 100, y: 190, w: 680, h: 72, text: s.title, fontSize: 64, bold: true, color: "#ffffff" });
  ctx.addText(slide, { x: 104, y: 292, w: 700, h: 38, text: s.subtitle, fontSize: 28, color: "#d0d5dd" });
  ctx.addShape(slide, { x: 860, y: 190, w: 250, h: 250, fill: "#172033", line: { style: "solid", fill: "#344054", width: 1 } });
  ctx.addText(slide, { x: 910, y: 282, w: 150, h: 42, text: "Q&A", fontSize: 42, bold: true, color: C.cyan, align: "center" });
  footer(slide, ctx, page, true);
}

export async function makeSlide(presentation, ctx, index) {
  const s = slides[index];
  const slide = presentation.slides.add();
  const page = index + 1;
  if (s.type === "cover") drawCover(slide, ctx, s);
  else if (s.type === "contents") drawContents(slide, ctx, s);
  else if (s.type === "section") drawSection(slide, ctx, s, page);
  else if (s.type === "overview") drawOverview(slide, ctx, s, page);
  else if (s.type === "split") drawSplit(slide, ctx, s, page);
  else if (s.type === "matrix") drawMatrix(slide, ctx, s, page);
  else if (s.type === "flow" || s.type === "consistency" || s.type === "demoC") drawFlow(slide, ctx, s, page);
  else if (s.type === "architecture") drawArchitecture(slide, ctx, s, page);
  else if (s.type === "services") drawServices(slide, ctx, s, page);
  else if (s.type === "middleware") drawMiddleware(slide, ctx, s, page);
  else if (s.type === "database") drawDatabase(slide, ctx, s, page);
  else if (s.type === "frontend") drawFrontend(slide, ctx, s, page);
  else if (s.type === "demoPath") drawDemoPath(slide, ctx, s, page);
  else if (s.type === "tests") drawTests(slide, ctx, s, page);
  else if (s.type === "thanks") drawThanks(slide, ctx, s, page);
  else drawCards(slide, ctx, s, page);
  return slide;
}
