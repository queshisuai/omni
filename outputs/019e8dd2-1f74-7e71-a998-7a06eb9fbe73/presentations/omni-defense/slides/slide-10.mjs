import { C, bg, footer, title, step, arrow, card } from "./theme.mjs";

export async function slide10(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  title(slide, ctx, "GROUP 3", "第 3 组讲交易闭环：订单、支付和通知共同收口", "订单服务保存快照，支付服务负责沙盒支付与同步，通知服务承接消息结果。");
  step(slide, ctx, 88, 212, 190, 92, "1", "待支付", "STATUS_PENDING = 1\n创建订单并锁库存", C.amber);
  step(slide, ctx, 350, 212, 190, 92, "2", "支付中", "支付宝 QR / page pay\n等待同步或回调", C.green);
  step(slide, ctx, 612, 212, 190, 92, "3", "已支付", "Payment -> Order\n标记 paid", C.green);
  step(slide, ctx, 874, 212, 190, 92, "4", "通知/查看", "站内消息\n订单列表展示", C.cyan);
  arrow(slide, ctx, 278, 250, 350, 250, C.ink);
  arrow(slide, ctx, 540, 250, 612, 250, C.ink);
  arrow(slide, ctx, 802, 250, 874, 250, C.ink);
  card(slide, ctx, 100, 372, 300, 120, "java-order", "创建订单、写 order_snapshot、订单状态流转、取消/退款入口、内部 paid/refunded 接口。", C.amber);
  card(slide, ctx, 490, 372, 300, 120, "java-payment", "支付宝沙盒 QR/page pay、notify、sync、退款审核与订单回写。", C.green);
  card(slide, ctx, 880, 372, 300, 120, "java-notification", "通知消息是 copied id，不跨查 user/order 表，只保存通知归属与内容。", C.cyan);
  ctx.addShape(slide, { x: 174, y: 560, w: 934, h: 44, fill: C.ink });
  ctx.addText(slide, { x: 204, y: 572, w: 874, h: 22, text: "演示重点：创建订单 -> 获取支付二维码 -> 支付同步 -> 订单状态从 1 变为 2。", fontSize: 17, bold: true, color: "#ffffff", align: "center" });
  footer(slide, ctx, 10);
  return slide;
}
