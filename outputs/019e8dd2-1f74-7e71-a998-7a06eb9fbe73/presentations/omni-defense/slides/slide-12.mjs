import { C, bg, footer, serviceBox, arrow } from "./theme.mjs";

export async function slide12(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx, C.ink);
  ctx.addText(slide, { x: 80, y: 78, w: 760, h: 58, text: "三组协作，串起一条完整票务平台链路", fontSize: 44, bold: true, color: "#ffffff" });
  ctx.addText(slide, { x: 84, y: 152, w: 650, h: 48, text: "用户入口负责身份，票务核心负责供给，交易闭环负责结果。每组都有明确边界，也能在演示中前后衔接。", fontSize: 20, color: "#d0d5dd" });
  serviceBox(slide, ctx, 116, 296, 210, 90, "第 1 组", "用户与入口层\n登录 / JWT / Gateway", C.blue);
  serviceBox(slide, ctx, 536, 296, 210, 90, "第 2 组", "票务核心\n活动 / 票档 / 座位", C.brand);
  serviceBox(slide, ctx, 956, 296, 210, 90, "第 3 组", "交易闭环\n订单 / 支付 / 通知", C.green);
  arrow(slide, ctx, 326, 340, 536, 340, C.cyan);
  arrow(slide, ctx, 746, 340, 956, 340, C.cyan);
  ctx.addShape(slide, { x: 212, y: 500, w: 856, h: 72, fill: "#172033", line: { style: "solid", fill: "#344054", width: 1 } });
  ctx.addText(slide, { x: 252, y: 518, w: 776, h: 30, text: "答辩收束句", fontSize: 22, bold: true, color: C.cyan, align: "center" });
  ctx.addText(slide, { x: 252, y: 550, w: 776, h: 22, text: "这个项目的价值不在于服务数量，而在于服务边界清晰、业务链路完整、能够本机联调验证。", fontSize: 16, color: "#ffffff", align: "center" });
  footer(slide, ctx, 12, true);
  return slide;
}
