// Fit complete primitive contours, preserving winding and holes. A fit must
// explain the entire contour; one curved corner must never turn a box round.
const n = (v) => String(Number(v.toFixed(5)));
const snap = (v) =>
  Math.abs(v * 4 - Math.round(v * 4)) < 0.08 ? Math.round(v * 4) / 4 : v;
function solve(a, b) {
  a = a.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) {
    let pivot = i;
    for (let j = i + 1; j < 3; j++)
      if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    if (Math.abs(a[i][i]) < 1e-9) return;
    const scale = a[i][i];
    for (let k = i; k < 4; k++) a[i][k] /= scale;
    for (let j = 0; j < 3; j++)
      if (j !== i) {
        const s = a[j][i];
        for (let k = i; k < 4; k++) a[j][k] -= s * a[i][k];
      }
  }
  return a.map((r) => r[3]);
}
export function fitCircle(points, complete = true) {
  const a = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
    b = [0, 0, 0];
  for (const [x, y] of points) {
    const v = [x, y, 1],
      z = -(x * x + y * y);
    for (let i = 0; i < 3; i++) {
      b[i] += v[i] * z;
      for (let j = 0; j < 3; j++) a[i][j] += v[i] * v[j];
    }
  }
  const s = solve(a, b);
  if (!s) return;
  const x = snap(-s[0] / 2),
    y = snap(-s[1] / 2),
    r = snap(Math.sqrt((s[0] * s[0]) / 4 + (s[1] * s[1]) / 4 - s[2]));
  if (!Number.isFinite(r) || r < 0.18 || r > (complete ? 16 : 100)) return;
  const errors = points
    .map((p) => Math.abs(Math.hypot(p[0] - x, p[1] - y) - r))
    .sort((a, b) => a - b);
  if (
    errors.at(-1) > 0.18 ||
    errors[Math.floor(errors.length * 0.9)] > 0.07 ||
    errors.reduce((s, e) => s + e, 0) / errors.length > 0.04
  )
    return;
  // Require coverage of every octant, not merely a small arc.
  const octants = new Set(
    points.map(
      (p) =>
        Math.floor(((Math.atan2(p[1] - y, p[0] - x) + Math.PI) * 4) / Math.PI) %
        8,
    ),
  );
  if (complete && octants.size !== 8) return;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    area += a[0] * b[1] - a[1] * b[0];
  }
  const sweep = area > 0 ? 1 : 0;
  return {
    d: `M${n(x + r)} ${n(y)}A${n(r)} ${n(r)} 0 1 ${sweep} ${n(x - r)} ${n(y)}A${n(r)} ${n(r)} 0 1 ${sweep} ${n(x + r)} ${n(y)}Z`,
    kind: "circle",
    x,
    y,
    r,
  };
}
function fitRect(points) {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const l = snap(Math.min(...xs)),
    r = snap(Math.max(...xs)),
    t = snap(Math.min(...ys)),
    b = snap(Math.max(...ys));
  if (r - l < 0.2 || b - t < 0.2) return;
  const errors = points.map(([x, y]) =>
    Math.min(
      Math.abs(x - l),
      Math.abs(x - r),
      Math.abs(y - t),
      Math.abs(y - b),
    ),
  );
  if (
    Math.max(...errors) > 0.065 ||
    errors.reduce((s, e) => s + e, 0) / errors.length > 0.025
  )
    return;
  for (const [x, y] of [
    [l, t],
    [r, t],
    [r, b],
    [l, b],
  ])
    if (Math.min(...points.map((p) => Math.hypot(p[0] - x, p[1] - y))) > 0.1)
      return;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    area += a[0] * b[1] - a[1] * b[0];
  }
  return {
    d:
      area > 0
        ? `M${n(l)} ${n(t)}H${n(r)}V${n(b)}H${n(l)}Z`
        : `M${n(l)} ${n(t)}V${n(b)}H${n(r)}V${n(t)}Z`,
    kind: "rectangle",
  };
}
function fitLine(points) {
  const x = points.reduce((s, p) => s + p[0], 0) / points.length,
    y = points.reduce((s, p) => s + p[1], 0) / points.length;
  let xx = 0,
    yy = 0,
    xy = 0;
  for (const p of points) {
    xx += (p[0] - x) ** 2;
    yy += (p[1] - y) ** 2;
    xy += (p[0] - x) * (p[1] - y);
  }
  const a = 0.5 * Math.atan2(2 * xy, xx - yy),
    dx = Math.cos(a),
    dy = Math.sin(a);
  const errors = points.map((p) => Math.abs((p[0] - x) * dy - (p[1] - y) * dx));
  if (
    Math.max(...errors) > 0.075 ||
    errors.reduce((s, e) => s + e, 0) / errors.length > 0.025
  )
    return;
  if (Math.abs(dx) < 0.02)
    return { kind: "line", x: snap(x), y, dx: 0, dy: Math.sign(dy) };
  if (Math.abs(dy) < 0.02)
    return { kind: "line", x, y: snap(y), dx: Math.sign(dx), dy: 0 };
  return { kind: "line", x, y, dx, dy };
}
function joint(a, b, p) {
  if (a.kind === "line" && b.kind === "line") {
    const det = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(det) < 1e-5) return;
    const t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / det;
    return [a.x + t * a.dx, a.y + t * a.dy];
  }
  if (a.kind === "circle" && b.kind === "line") return joint(b, a, p);
  let choices;
  if (a.kind === "line") {
    const dx = a.x - b.x,
      dy = a.y - b.y,
      t = -(dx * a.dx + dy * a.dy),
      d = b.r * b.r - (dx * dx + dy * dy - t * t);
    if (d < 0) return;
    choices = [t + Math.sqrt(d), t - Math.sqrt(d)].map((v) => [
      a.x + v * a.dx,
      a.y + v * a.dy,
    ]);
  } else {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      d = Math.hypot(dx, dy);
    if (d < 1e-5) return;
    const k = (a.r * a.r - b.r * b.r + d * d) / (2 * d),
      h2 = a.r * a.r - k * k;
    if (h2 < 0) return;
    const x = a.x + (k * dx) / d,
      y = a.y + (k * dy) / d,
      h = Math.sqrt(h2);
    choices = [
      [x - (h * dy) / d, y + (h * dx) / d],
      [x + (h * dy) / d, y - (h * dx) / d],
    ];
  }
  return choices.sort(
    (a, b) =>
      Math.hypot(a[0] - p[0], a[1] - p[1]) -
      Math.hypot(b[0] - p[0], b[1] - p[1]),
  )[0];
}
// Reconstruct contours made entirely of lines and circular arcs (e.g. signal
// bands, arrowheads, capsules). Shared intersections keep joins exact.
function fitArcPolygon(points) {
  const count = points.length;
  if (count < 20) return;
  const step = Math.hypot(
    points[1][0] - points[0][0],
    points[1][1] - points[0][1],
  );
  const window = Math.max(2, Math.round(0.35 / step)),
    separation = Math.max(3, Math.round(0.5 / step)),
    peaks = [];
  for (let i = 0; i < count; i++) {
    const a = points[(i - window + count) % count],
      b = points[i],
      c = points[(i + window) % count];
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      vx = c[0] - b[0],
      vy = c[1] - b[1];
    const cosine =
      (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
    if (cosine < 0.72) peaks.push({ i, score: 1 - cosine });
  }
  const selected = [];
  for (const p of peaks.sort((a, b) => b.score - a.score))
    if (
      !selected.some(
        (q) =>
          Math.min(Math.abs(q - p.i), count - Math.abs(q - p.i)) < separation,
      )
    )
      selected.push(p.i);
  if (selected.length < 3 || selected.length > 32) return;
  selected.sort((a, b) => a - b);
  const models = [];
  for (let i = 0; i < selected.length; i++) {
    const start = selected[i],
      end = selected[(i + 1) % selected.length],
      segment = [];
    for (let j = start; j !== (end + 1) % count; j = (j + 1) % count)
      segment.push(points[j]);
    if (segment.length < 4) return;
    let model = fitLine(segment);
    if (!model) {
      model = fitCircle(segment, false);
      if (!model) return;
      let angle = 0;
      for (let j = 1; j < segment.length; j++) {
        const a = [segment[j - 1][0] - model.x, segment[j - 1][1] - model.y],
          b = [segment[j][0] - model.x, segment[j][1] - model.y];
        angle += Math.atan2(
          a[0] * b[1] - a[1] * b[0],
          a[0] * b[0] + a[1] * b[1],
        );
      }
      if (Math.abs(angle) < 0.35 || Math.abs(angle) > Math.PI * 1.8) return;
      model.angle = angle;
    }
    models.push(model);
  }
  const joins = models.map((m, i) =>
    joint(
      models[(i + models.length - 1) % models.length],
      m,
      points[selected[i]],
    ),
  );
  if (
    joins.some(
      (p, i) =>
        !p ||
        Math.hypot(
          p[0] - points[selected[i]][0],
          p[1] - points[selected[i]][1],
        ) > 0.2,
    )
  )
    return;
  let d = `M${n(joins[0][0])} ${n(joins[0][1])}`;
  for (let i = 0; i < models.length; i++) {
    const m = models[i],
      p = joins[(i + 1) % joins.length];
    d +=
      m.kind === "line"
        ? `L${n(p[0])} ${n(p[1])}`
        : `A${n(m.r)} ${n(m.r)} 0 ${Math.abs(m.angle) > Math.PI ? 1 : 0} ${m.angle > 0 ? 1 : 0} ${n(p[0])} ${n(p[1])}`;
  }
  return {
    d: d + "Z",
    kind: "arc-polygon",
    lines: models.filter((m) => m.kind === "line").length,
    arcs: models.filter((m) => m.kind === "circle").length,
  };
}
export function regularizePath(d, kit, { arcs = false } = {}) {
  const parts = d.split(/(?=M)/).filter(Boolean),
    result = [],
    primitives = [];
  let unmodelled = 0;
  for (const part of parts) {
    const p = kit.Path.MakeFromSVGString(part);
    if (!p) throw new Error("Invalid contour");
    const iter = new kit.ContourMeasureIter(p, true, 4),
      contour = iter.next();
    if (!contour) {
      iter.delete();
      p.delete();
      continue;
    }
    const length = contour.length(),
      points = [];
    for (let s = 0; s < length; s += Math.max(0.05, length / 1500)) {
      const v = contour.getPosTan(s);
      points.push([v[0], v[1]]);
    }
    const fitted =
      points.length >= 8
        ? (fitCircle(points) ??
          fitRect(points) ??
          (arcs ? fitArcPolygon(points) : undefined))
        : undefined;
    result.push(fitted?.d ?? part);
    if (fitted) primitives.push(fitted);
    else unmodelled++;
    contour.delete();
    iter.delete();
    p.delete();
  }
  return { d: result.join(""), primitives, unmodelled };
}
