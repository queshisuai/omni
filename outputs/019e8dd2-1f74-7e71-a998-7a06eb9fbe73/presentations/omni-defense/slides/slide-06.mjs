import { C, bg, footer, title, card, arrow } from "./theme.mjs";

export async function slide06(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  title(slide, ctx, "C-END FLOW", "C 端购票从登录到支付结果是一条可现场演示的主链路", "登录请求使用 account 字段；订单状态以前端/后端统一的 1-4 编码展示。");
  const steps = [
    ["1", "登录", "account + password", C.blue],
    ["2", "浏览活动", "列表 / 搜索 / 详情", C.brand],
    ["3", "选择票档", "场次 / 票档 / 座位", C.brand],
    ["4", "创建订单", "锁库存 + 写快照", C.amber],
    ["5", "支付同步", "QR pay / callback", C.green],
    ["6", "查看结果", "订单状态 / 通知", C.cyan],
  ];
  steps.forEach(([no, label, note, color], i) => {
    const x = 70 + i * 198;
    ctx.addShape(slide, { x, y: 206, w: 150, h: 110, fill: "#ffffff", line: { style: "solid", fill: color, width: 2 } });
    ctx.addShape(slide, { x: x + 16, y: 224, w: 34, h: 34, fill: color });
    ctx.addText(slide, { x: x + 16, y: 230, w: 34, h: 20, text: no, fontSize: 15, bold: true, color: "#ffffff", align: "center" });
    ctx.addText(slide, { x: x + 62, y: 222, w: 78, h: 26, text: label, fontSize: 18, bold: true, color: C.ink });
    ctx.addText(slide, { x: x + 18, y: 272, w: 114, h: 30, text: note, fontSize: 12, color: C.muted, align: "center" });
    if (i < steps.length - 1) arrow(slide, ctx, x + 150, 260, x + 198, 260, C.ink);
  });
  card(slide, ctx, 78, 390, 260, 86, "用户服务", "POST /api/user/login\nJWT 写入 localStorage", C.blue);
  card(slide, ctx, 370, 390, 260, 86, "票务服务", "GET /api/ticket/activities\n活动详情、场次、票档、座位", C.brand);
  card(slide, ctx, 662, 390, 260, 86, "订单服务", "POST /api/order/create\n校验用户、锁库存、写快照", C.amber);
  card(slide, ctx, 954, 390, 260, 86, "支付服务", "POST /api/payment/alipay/qr-pay\nsync / notify 回写订单", C.green);
  ctx.addShape(slide, { x: 120, y: 538, w: 1040, h: 52, fill: C.ink });
  ctx.addText(slide, { x: 152, y: 552, w: 976, h: 22, text: "订单状态：1 待支付 / 2 已支付 / 3 已取消 / 4 已退款", fontSize: 18, bold: true, color: "#ffffff", align: "center" });
  footer(slide, ctx, 6);
  return slide;
}
