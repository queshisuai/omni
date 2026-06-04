import { C, bg, footer, metric, pill } from "./theme.mjs";

export async function slide01(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx, C.ink);
  ctx.addShape(slide, { x: 0, y: 0, w: 1280, h: 720, fill: "#101828" });
  ctx.addShape(slide, { x: 760, y: 70, w: 420, h: 560, fill: "#172033", line: { style: "solid", fill: "#2b3448", width: 1 } });
  ctx.addShape(slide, { x: 810, y: 122, w: 320, h: 150, fill: "#ffffff", line: { style: "solid", fill: C.brand, width: 3 } });
  ctx.addShape(slide, { x: 838, y: 154, w: 72, h: 72, fill: C.brand });
  ctx.addShape(slide, { x: 938, y: 155, w: 150, h: 14, fill: "#d0d5dd" });
  ctx.addShape(slide, { x: 938, y: 184, w: 112, h: 14, fill: "#98a2b3" });
  ctx.addShape(slide, { x: 938, y: 214, w: 168, h: 14, fill: C.cyan });
  const y = 334;
  ["java-user", "java-ticket", "java-order", "java-payment", "java-notification"].forEach((s, i) => {
    ctx.addShape(slide, { x: 785 + i * 78, y: y + (i % 2) * 38, w: 62, h: 54, fill: i === 1 ? C.brand : "#344054", line: { style: "solid", fill: "#667085", width: 1 } });
    ctx.addText(slide, { x: 790 + i * 78, y: y + 12 + (i % 2) * 38, w: 52, h: 28, text: s.replace("java-", ""), fontSize: 10, bold: true, color: "#ffffff", align: "center" });
  });
  ctx.addShape(slide, { x: 818, y: 500, w: 280, h: 74, fill: "#0f766e", line: { style: "solid", fill: C.cyan, width: 2 } });
  ctx.addText(slide, { x: 846, y: 516, w: 224, h: 40, text: "prod-split 五库联调", fontSize: 20, bold: true, color: "#ffffff", align: "center" });

  pill(slide, ctx, 68, 84, 160, "项目答辩 PPT", C.cyan, "#123b44");
  ctx.addText(slide, { x: 66, y: 156, w: 620, h: 70, text: "万象抢票平台", fontSize: 60, bold: true, color: "#ffffff" });
  ctx.addText(slide, { x: 70, y: 238, w: 650, h: 62, text: "按业务链路拆分的微服务答辩方案", fontSize: 34, bold: true, color: "#f2f4f7" });
  ctx.addText(slide, { x: 72, y: 320, w: 600, h: 60, text: "六人三组协作：用户入口、票务核心、交易闭环，共同串起一条完整购票流程。", fontSize: 20, color: "#d0d5dd" });
  metric(slide, ctx, 76, 458, "5", "业务微服务", "用户、票务、订单、支付、通知", C.brand);
  metric(slide, ctx, 256, 458, "8", "中间件/基础设施", "数据、注册、事务、消息与运行支撑", C.cyan);
  metric(slide, ctx, 486, 458, "3", "两人小组", "每组负责可独立讲述的业务段", "#a78bfa");
  footer(slide, ctx, 1, true);
  return slide;
}
