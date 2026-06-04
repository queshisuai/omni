import { C, bg, footer, title, card, serviceBox, arrow } from "./theme.mjs";

export async function slide08(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  title(slide, ctx, "GROUP 1", "第 1 组讲清楚“用户怎么进系统，权限怎么传递”", "这一组承担答辩开场：先让系统跑起来，再解释登录、JWT、角色和网关路由。");
  card(slide, ctx, 70, 178, 340, 96, "负责模块", "java-user、java-gateway、前端登录/注册/个人中心/Console 权限入口", C.blue);
  card(slide, ctx, 70, 298, 340, 96, "核心接口", "POST /api/user/login\nGET /api/user/info\nGET /api/user/internal/{id}", C.blue);
  card(slide, ctx, 70, 418, 340, 96, "关键证明点", "JWT 包含 userId、phone、role；internal API 使用 X-Internal-Token 防止外部调用。", C.blue);
  serviceBox(slide, ctx, 520, 196, 180, 86, "Frontend", "login/register\nlocalStorage auth", C.violet);
  serviceBox(slide, ctx, 770, 196, 180, 86, "Gateway", ":8088\n路由 /api/**", C.ink);
  serviceBox(slide, ctx, 1020, 196, 180, 86, "User", ":8081\n账号/角色/JWT", C.blue);
  arrow(slide, ctx, 700, 239, 770, 239, C.violet);
  arrow(slide, ctx, 950, 239, 1020, 239, C.blue);
  ctx.addShape(slide, { x: 548, y: 365, w: 620, h: 128, fill: "#eff6ff", line: { style: "solid", fill: "#bfdbfe", width: 1 } });
  ctx.addText(slide, { x: 580, y: 386, w: 560, h: 28, text: "答辩讲法", fontSize: 22, bold: true, color: C.ink });
  ctx.addText(slide, { x: 580, y: 430, w: 560, h: 42, text: "先现场登录普通用户，再打开 token/user 信息说明前端认证状态如何驱动后续购票流程。", fontSize: 17, color: C.text });
  footer(slide, ctx, 8);
  return slide;
}
