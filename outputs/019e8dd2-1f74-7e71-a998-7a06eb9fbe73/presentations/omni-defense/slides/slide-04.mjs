import { C, bg, footer, title, serviceBox, dbBox, arrow } from "./theme.mjs";

export async function slide04(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  title(slide, ctx, "ARCHITECTURE", "前端经网关进入五个业务服务，服务边界靠 internal API 串联", "本机推荐 prod-split：五个业务服务分别连接五个 PostgreSQL database。");
  serviceBox(slide, ctx, 68, 218, 170, 86, "Next.js 前端", ":3000\nC 端 + B 端 console", C.violet);
  serviceBox(slide, ctx, 296, 218, 170, 86, "java-gateway", ":8088\n统一 API 入口", C.ink);
  arrow(slide, ctx, 238, 262, 296, 262, C.violet);
  const svc = [
    ["java-user", ":8081\n用户/角色/JWT", 560, 168, C.blue],
    ["java-ticket", ":8082\n活动/票档/座位", 780, 168, C.brand],
    ["java-order", ":8083\n订单/快照", 560, 318, C.amber],
    ["java-payment", ":8084\n支付/退款", 780, 318, C.green],
    ["java-notification", ":8085\n站内/短信/邮件", 1000, 318, C.cyan],
  ];
  svc.forEach(([name, meta, x, y, color]) => serviceBox(slide, ctx, x, y, 172, 86, name, meta, color));
  arrow(slide, ctx, 466, 244, 560, 212, C.ink);
  arrow(slide, ctx, 466, 258, 780, 212, C.ink);
  arrow(slide, ctx, 466, 276, 560, 362, C.ink);
  arrow(slide, ctx, 466, 290, 780, 362, C.ink);
  arrow(slide, ctx, 466, 304, 1000, 362, C.ink);
  arrow(slide, ctx, 646, 318, 646, 254, C.brand);
  arrow(slide, ctx, 732, 362, 780, 362, C.green);
  arrow(slide, ctx, 952, 362, 1000, 362, C.cyan);
  dbBox(slide, ctx, 78, 528, 188, "omni_user", "java-user", C.blue);
  dbBox(slide, ctx, 298, 528, 188, "omni_ticket_split", "java-ticket", C.brand);
  dbBox(slide, ctx, 518, 528, 188, "omni_order", "java-order", C.amber);
  dbBox(slide, ctx, 738, 528, 188, "omni_payment", "java-payment", C.green);
  dbBox(slide, ctx, 958, 528, 188, "omni_notification", "java-notification", C.cyan);
  ctx.addText(slide, { x: 68, y: 622, w: 1080, h: 26, text: "硬边界：订单服务不跨查 user/ticket 表；支付服务不跨查 order/user/ticket 表；internal API 必须校验 X-Internal-Token。", fontSize: 15, bold: true, color: C.ink, align: "center" });
  footer(slide, ctx, 4);
  return slide;
}
