import { C, bg, footer, title, card, arrow, pill } from "./theme.mjs";

export async function slide02(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  title(slide, ctx, "PROJECT POSITIONING", "平台定位是 B 端主导、C 端参与的票务闭环", "主办方负责票务供给，用户完成浏览、选座、下单、支付和订单查看。");
  ctx.addShape(slide, { x: 70, y: 178, w: 500, h: 404, fill: "#fff7fb", line: { style: "solid", fill: "#ffd1e2", width: 1 } });
  ctx.addShape(slide, { x: 710, y: 178, w: 500, h: 404, fill: "#f0f9ff", line: { style: "solid", fill: "#bae6fd", width: 1 } });
  ctx.addText(slide, { x: 102, y: 206, w: 280, h: 38, text: "B 端：平台管理员 / 主办方", fontSize: 26, bold: true, color: C.ink });
  ctx.addText(slide, { x: 742, y: 206, w: 280, h: 38, text: "C 端：普通用户", fontSize: 26, bold: true, color: C.ink });
  card(slide, ctx, 104, 276, 380, 72, "供给侧管理", "活动、场次、票档、场馆、座位图、艺人资料", C.brand);
  card(slide, ctx, 104, 370, 380, 72, "后台治理", "主办方申请、场馆审核、风险处理、数据概览", C.brand);
  card(slide, ctx, 104, 464, 380, 72, "核心目标", "保证票务信息准确，支撑可售库存与座位映射", C.brand);
  card(slide, ctx, 744, 276, 380, 72, "用户入口", "注册登录、浏览活动、搜索、查看详情", C.blue);
  card(slide, ctx, 744, 370, 380, 72, "购买体验", "选择场次、票档、座位，创建订单并支付", C.blue);
  card(slide, ctx, 744, 464, 380, 72, "结果闭环", "支付结果、订单列表、通知与后续退款处理", C.blue);
  ctx.addShape(slide, { x: 570, y: 302, w: 140, h: 154, fill: C.ink });
  ctx.addText(slide, { x: 592, y: 334, w: 96, h: 28, text: "Omni", fontSize: 26, bold: true, color: "#ffffff", align: "center" });
  ctx.addText(slide, { x: 590, y: 376, w: 100, h: 42, text: "统一票务平台", fontSize: 17, bold: true, color: "#d0d5dd", align: "center" });
  arrow(slide, ctx, 506, 374, 570, 374, C.brand);
  arrow(slide, ctx, 710, 374, 636, 374, C.blue);
  pill(slide, ctx, 508, 602, 264, "一条演示链路贯穿三组答辩", C.green, "#ecfdf3");
  footer(slide, ctx, 2);
  return slide;
}
