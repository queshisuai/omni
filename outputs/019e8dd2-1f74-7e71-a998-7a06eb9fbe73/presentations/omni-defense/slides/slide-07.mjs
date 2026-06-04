import { C, bg, footer, title, step, arrow, card } from "./theme.mjs";

export async function slide07(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  title(slide, ctx, "B-END FLOW", "B 端围绕“活动供给”组织后台工作流", "主办方创建活动，管理员处理场馆、艺人、风险和审批，最终形成 C 端可售票务。");
  const y = 208;
  step(slide, ctx, 80, y, 168, 96, "1", "主办方申请", "user 服务\n角色与申请审核", C.blue);
  step(slide, ctx, 296, y, 168, 96, "2", "创建活动", "ticket/admin\n活动基础信息", C.brand);
  step(slide, ctx, 512, y, 168, 96, "3", "配置场次", "时间、场馆\n活动排期", C.brand);
  step(slide, ctx, 728, y, 168, 96, "4", "配置票档", "价格、库存\n区域绑定", C.brand);
  step(slide, ctx, 944, y, 168, 96, "5", "座位图发布", "SeatCraft\n模板/版本/回滚", C.brand);
  [248, 464, 680, 896].forEach((x) => arrow(slide, ctx, x, y + 42, x + 48, y + 42, C.ink));
  card(slide, ctx, 106, 360, 310, 116, "后台 Console", "页面集中在 frontend/src/app/console，包括 activities、sessions、venue、risk、refunds、reconciliation 等管理入口。", C.violet);
  card(slide, ctx, 486, 360, 310, 116, "票务服务核心", "AdminController 聚合活动、场次、票档、场馆、SeatCraft、艺人、风险处理等 B 端能力。", C.brand);
  card(slide, ctx, 866, 360, 310, 116, "输出给 C 端", "活动列表、活动详情、场次票档、座位可售状态，支撑用户下单。", C.blue);
  ctx.addShape(slide, { x: 180, y: 548, w: 920, h: 46, fill: C.ink });
  ctx.addText(slide, { x: 210, y: 560, w: 860, h: 22, text: "答辩现场建议：用一个活动从后台创建到 C 端展示，证明 B/C 端不是割裂页面。", fontSize: 17, bold: true, color: "#ffffff", align: "center" });
  footer(slide, ctx, 7);
  return slide;
}
