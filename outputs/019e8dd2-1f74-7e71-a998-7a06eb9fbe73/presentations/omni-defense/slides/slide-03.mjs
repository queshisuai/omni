import { C, bg, footer, title, card } from "./theme.mjs";

export async function slide03(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  title(slide, ctx, "TEAM SPLIT", "三组按业务链路负责，答辩时能自然串成完整流程", "每两人负责一个可独立讲清楚、又能前后衔接的业务段。");
  const xs = [66, 455, 844];
  const headers = [
    ["第 1 组", "用户与入口层", C.blue],
    ["第 2 组", "票务核心", C.brand],
    ["第 3 组", "交易闭环", C.green],
  ];
  headers.forEach(([g, name, color], i) => {
    ctx.addShape(slide, { x: xs[i], y: 178, w: 330, h: 74, fill: color });
    ctx.addText(slide, { x: xs[i] + 20, y: 194, w: 120, h: 24, text: g, fontSize: 18, bold: true, color: "#ffffff" });
    ctx.addText(slide, { x: xs[i] + 20, y: 222, w: 220, h: 28, text: name, fontSize: 24, bold: true, color: "#ffffff" });
  });
  card(slide, ctx, xs[0], 276, 330, 94, "负责范围", "java-user + java-gateway + 前端登录/权限", C.blue);
  card(slide, ctx, xs[1], 276, 330, 94, "负责范围", "java-ticket + C/B 端活动、票档、座位相关页面", C.brand);
  card(slide, ctx, xs[2], 276, 330, 94, "负责范围", "java-order + java-payment + java-notification + 订单/支付前端", C.green);
  card(slide, ctx, xs[0], 394, 330, 118, "答辩重点", "JWT、角色权限、网关路由、统一入口、internal token 的安全边界", C.blue);
  card(slide, ctx, xs[1], 394, 330, 118, "答辩重点", "活动供给、场次票档、SeatCraft 座位图、库存锁定接口", C.brand);
  card(slide, ctx, xs[2], 394, 330, 118, "答辩重点", "订单快照、库存确认、支付宝沙盒、支付同步、通知和退款", C.green);
  ctx.addShape(slide, { x: 130, y: 570, w: 1020, h: 44, fill: C.ink });
  ctx.addText(slide, { x: 160, y: 582, w: 960, h: 22, text: "推荐串讲顺序：登录拿 token -> 浏览活动和选座 -> 创建订单、支付、查看订单", fontSize: 18, bold: true, color: "#ffffff", align: "center" });
  footer(slide, ctx, 3);
  return slide;
}
