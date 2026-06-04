export const C = {
  ink: "#101828",
  ink2: "#172033",
  paper: "#fbfcfe",
  panel: "#ffffff",
  soft: "#f2f4f7",
  line: "#d0d5dd",
  text: "#1f2937",
  muted: "#667085",
  brand: "#ff1268",
  cyan: "#2dd4bf",
  blue: "#2563eb",
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#ef4444",
  violet: "#7c3aed",
};

export function bg(slide, ctx, color = C.paper) {
  ctx.addShape(slide, { x: 0, y: 0, w: ctx.W, h: ctx.H, fill: color });
}

export function footer(slide, ctx, page, dark = false) {
  const color = dark ? "#d0d5dd" : C.muted;
  ctx.addText(slide, {
    x: 48,
    y: 678,
    w: 420,
    h: 22,
    text: "Omni 万象抢票平台 | 答辩演示",
    fontSize: 12,
    color,
  });
  ctx.addText(slide, {
    x: 1190,
    y: 676,
    w: 40,
    h: 22,
    text: String(page).padStart(2, "0"),
    fontSize: 13,
    color,
    align: "right",
  });
}

export function title(slide, ctx, kicker, claim, sub = "") {
  ctx.addShape(slide, { x: 52, y: 42, w: 32, h: 4, fill: C.brand });
  ctx.addText(slide, {
    x: 92,
    y: 30,
    w: 420,
    h: 24,
    text: kicker,
    fontSize: 13,
    bold: true,
    color: C.brand,
  });
  ctx.addText(slide, {
    x: 52,
    y: 64,
    w: 1050,
    h: 56,
    text: claim,
    fontSize: 34,
    bold: true,
    color: C.ink,
  });
  if (sub) {
    ctx.addText(slide, {
      x: 54,
      y: 132,
      w: 980,
      h: 28,
      text: sub,
      fontSize: 17,
      color: C.muted,
    });
  }
}

export function pill(slide, ctx, x, y, w, text, color = C.brand, fill = "#fff1f6") {
  ctx.addShape(slide, {
    x,
    y,
    w,
    h: 32,
    fill,
    line: { style: "solid", fill: color, width: 1 },
  });
  ctx.addText(slide, {
    x: x + 12,
    y: y + 6,
    w: w - 24,
    h: 20,
    text,
    fontSize: 13,
    bold: true,
    color,
    align: "center",
  });
}

export function card(slide, ctx, x, y, w, h, label, body, accent = C.brand) {
  ctx.addShape(slide, {
    x,
    y,
    w,
    h,
    fill: C.panel,
    line: { style: "solid", fill: "#e4e7ec", width: 1 },
  });
  ctx.addShape(slide, { x, y, w: 6, h, fill: accent });
  ctx.addText(slide, {
    x: x + 20,
    y: y + 16,
    w: w - 34,
    h: 24,
    text: label,
    fontSize: 18,
    bold: true,
    color: C.ink,
  });
  ctx.addText(slide, {
    x: x + 20,
    y: y + 48,
    w: w - 34,
    h: h - 58,
    text: body,
    fontSize: 14,
    color: C.muted,
  });
}

export function serviceBox(slide, ctx, x, y, w, h, name, meta, color = C.blue) {
  ctx.addShape(slide, {
    x,
    y,
    w,
    h,
    fill: "#ffffff",
    line: { style: "solid", fill: color, width: 2 },
  });
  ctx.addShape(slide, { x, y, w, h: 8, fill: color });
  ctx.addText(slide, {
    x: x + 12,
    y: y + 18,
    w: w - 24,
    h: 24,
    text: name,
    fontSize: 17,
    bold: true,
    color: C.ink,
    align: "center",
  });
  ctx.addText(slide, {
    x: x + 12,
    y: y + 48,
    w: w - 24,
    h: h - 54,
    text: meta,
    fontSize: 12,
    color: C.muted,
    align: "center",
  });
}

export function dbBox(slide, ctx, x, y, w, name, owner, color = C.cyan) {
  ctx.addShape(slide, {
    x,
    y,
    w,
    h: 62,
    fill: "#ecfeff",
    line: { style: "solid", fill: color, width: 1.5 },
  });
  ctx.addShape(slide, { x: x + 12, y: y + 12, w: 16, h: 38, fill: color });
  ctx.addText(slide, {
    x: x + 38,
    y: y + 10,
    w: w - 48,
    h: 22,
    text: name,
    fontSize: 15,
    bold: true,
    color: C.ink,
  });
  ctx.addText(slide, {
    x: x + 38,
    y: y + 34,
    w: w - 48,
    h: 18,
    text: owner,
    fontSize: 11,
    color: C.muted,
  });
}

export function arrow(slide, ctx, x1, y1, x2, y2, color = C.blue) {
  const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  if (horizontal) {
    const left = Math.min(x1, x2);
    const width = Math.max(8, Math.abs(x2 - x1) - 10);
    ctx.addShape(slide, { x: left, y: y1 - 2, w: width, h: 4, fill: color });
    const tipX = x2 >= x1 ? x2 - 10 : x2;
    ctx.addShape(slide, { x: tipX, y: y1 - 7, w: 10, h: 14, fill: color });
  } else {
    const top = Math.min(y1, y2);
    const height = Math.max(8, Math.abs(y2 - y1) - 10);
    ctx.addShape(slide, { x: x1 - 2, y: top, w: 4, h: height, fill: color });
    const tipY = y2 >= y1 ? y2 - 10 : y2;
    ctx.addShape(slide, { x: x1 - 7, y: tipY, w: 14, h: 10, fill: color });
  }
}

export function swimlane(slide, ctx, x, y, w, h, label, color) {
  ctx.addShape(slide, { x, y, w, h, fill: "#ffffff", line: { style: "solid", fill: "#e4e7ec", width: 1 } });
  ctx.addShape(slide, { x, y, w: 78, h, fill: color });
  ctx.addText(slide, {
    x: x + 8,
    y: y + 18,
    w: 62,
    h: h - 36,
    text: label,
    fontSize: 16,
    bold: true,
    color: "#ffffff",
    align: "center",
    valign: "middle",
  });
}

export function step(slide, ctx, x, y, w, h, no, label, note, color = C.blue) {
  ctx.addShape(slide, { x, y, w, h, fill: "#ffffff", line: { style: "solid", fill: color, width: 1.5 } });
  ctx.addShape(slide, { x: x + 12, y: y + 12, w: 30, h: 30, fill: color });
  ctx.addText(slide, { x: x + 12, y: y + 16, w: 30, h: 18, text: no, fontSize: 14, bold: true, color: "#ffffff", align: "center" });
  ctx.addText(slide, { x: x + 54, y: y + 10, w: w - 66, h: 24, text: label, fontSize: 17, bold: true, color: C.ink });
  ctx.addText(slide, { x: x + 54, y: y + 38, w: w - 66, h: h - 58, text: note, fontSize: 11, color: C.muted });
}

export function metric(slide, ctx, x, y, value, label, note, color = C.brand) {
  ctx.addText(slide, { x, y, w: 110, h: 44, text: value, fontSize: 32, bold: true, color });
  ctx.addText(slide, { x, y: y + 44, w: 150, h: 22, text: label, fontSize: 15, bold: true, color: C.ink });
  ctx.addText(slide, { x, y: y + 68, w: 170, h: 32, text: note, fontSize: 11, color: C.muted });
}
