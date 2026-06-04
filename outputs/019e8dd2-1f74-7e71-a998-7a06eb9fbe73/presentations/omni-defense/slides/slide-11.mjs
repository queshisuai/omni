import { C, bg, footer, title, card } from "./theme.mjs";

export async function slide11(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  title(slide, ctx, "VERIFICATION", "验收命令和演示路径让答辩从“能讲”变成“能证明”", "把边界检查、前端类型检查和 prod-split runtime verifier 作为答辩支撑材料。");
  card(slide, ctx, 76, 184, 520, 82, "边界验收", "powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1", C.brand);
  card(slide, ctx, 684, 184, 520, 82, "前端检查", "cd frontend\npnpm typecheck", C.blue);
  card(slide, ctx, 76, 306, 520, 110, "运行库检查", "$env:PGPASSWORD='123456'\npsql -h localhost -p 5432 -U postgres -d postgres -t -A -c \"SELECT datname, application_name, state FROM pg_stat_activity WHERE datname LIKE 'omni%' ...\"", C.green);
  card(slide, ctx, 684, 306, 520, 110, "Runtime verifier", "scripts/verify-production-split-runtime.ps1\n-TargetDatabaseByService 'ticket=omni_ticket_split'", C.amber);
  ctx.addShape(slide, { x: 180, y: 504, w: 920, h: 78, fill: "#111827" });
  ctx.addText(slide, { x: 220, y: 520, w: 840, h: 24, text: "现场演示路径", fontSize: 20, bold: true, color: "#ffffff", align: "center" });
  ctx.addText(slide, { x: 220, y: 550, w: 840, h: 22, text: "登录 -> 浏览活动 -> 活动详情 -> 选择场次/票档/座位 -> 创建订单 -> 支付同步 -> 查看订单", fontSize: 16, color: "#e5e7eb", align: "center" });
  footer(slide, ctx, 11);
  return slide;
}
