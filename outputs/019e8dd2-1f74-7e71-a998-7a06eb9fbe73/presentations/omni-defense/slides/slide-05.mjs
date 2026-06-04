import { C, bg, footer, title, card } from "./theme.mjs";

export async function slide05(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  title(slide, ctx, "INFRASTRUCTURE", "八个中间件/基础设施组件支撑服务发现、数据、事务、消息和运行", "答辩时按“它解决什么问题”讲，比逐个背配置更清楚。");
  const items = [
    ["PostgreSQL", "五库 prod-split 数据持久化", C.blue],
    ["Redis", "抢票/缓存/高并发预留", C.red],
    ["Nacos", "注册中心与配置中心", C.green],
    ["Seata Config Init", "初始化分布式事务配置", C.amber],
    ["Seata Server", "跨服务事务协调预留", C.violet],
    ["RabbitMQ", "异步消息与通知链路", C.cyan],
    ["Docker Compose", "本地基础设施一键编排", C.ink],
    ["Node Runtime", "frontend 与 grab-service 运行支撑", C.brand],
  ];
  items.forEach(([name, desc, color], i) => {
    const x = 70 + (i % 4) * 290;
    const y = 182 + Math.floor(i / 4) * 178;
    ctx.addShape(slide, { x, y, w: 240, h: 132, fill: "#ffffff", line: { style: "solid", fill: "#e4e7ec", width: 1 } });
    ctx.addShape(slide, { x, y, w: 240, h: 10, fill: color });
    ctx.addShape(slide, { x: x + 18, y: y + 30, w: 46, h: 46, fill: color });
    ctx.addText(slide, { x: x + 78, y: y + 28, w: 138, h: 26, text: name, fontSize: 19, bold: true, color: C.ink });
    ctx.addText(slide, { x: x + 78, y: y + 62, w: 138, h: 42, text: desc, fontSize: 13, color: C.muted });
  });
  card(slide, ctx, 104, 550, 1050, 58, "讲法建议", "先讲 PostgreSQL / Nacos 这些直接承载业务运行的组件，再讲 Seata / RabbitMQ / Redis / Docker / Node 如何支撑事务、异步、高并发和本地联调。", C.brand);
  footer(slide, ctx, 5);
  return slide;
}
