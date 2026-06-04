import { C, bg, footer, title, card, serviceBox, arrow } from "./theme.mjs";

export async function slide09(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  title(slide, ctx, "GROUP 2", "第 2 组负责票务供给和库存/座位这一核心复杂度", "票务服务是活动、场次、票档、座位图和锁库存能力的集中体现。");
  serviceBox(slide, ctx, 90, 210, 170, 82, "Activity", "活动\ncategory/artist/venue", C.brand);
  serviceBox(slide, ctx, 330, 210, 170, 82, "Session", "场次\n时间/场馆", C.brand);
  serviceBox(slide, ctx, 570, 210, 170, 82, "TicketType", "票档\n价格/库存", C.brand);
  serviceBox(slide, ctx, 810, 210, 170, 82, "SeatCraft", "座位图\n模板/分区/版本", C.brand);
  serviceBox(slide, ctx, 1050, 210, 140, 82, "Internal", "quote/lock\nconfirm/release", C.ink);
  [260, 500, 740, 980].forEach((x) => arrow(slide, ctx, x, 251, x + 70, 251, C.ink));
  card(slide, ctx, 100, 380, 300, 118, "给 B 端讲", "活动创建、场次配置、票档绑定、SeatCraft 座位图从模板到发布。", C.brand);
  card(slide, ctx, 490, 380, 300, 118, "给 C 端讲", "活动列表和详情展示，选择场次、票档和座位后进入下单。", C.blue);
  card(slide, ctx, 880, 380, 300, 118, "给订单讲", "通过 internal API 报价、锁库存/锁座、确认售出、释放库存。", C.green);
  ctx.addText(slide, { x: 166, y: 565, w: 950, h: 24, text: "关键边界：java-ticket 不直接写订单，只提供票务事实和库存动作给 java-order 调用。", fontSize: 17, bold: true, color: C.ink, align: "center" });
  footer(slide, ctx, 9);
  return slide;
}
