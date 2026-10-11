import sharp from "sharp";
import { regularizePath } from "./primitive-fit.mjs";
const svg = (groups) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${groups.join("")}</svg>`;
export function overlap(a, b) {
  let u = 0,
    n = 0;
  for (let i = 3; i < a.length; i += 4) {
    u += Math.max(a[i], b[i]);
    n += Math.min(a[i], b[i]);
  }
  return u ? (100 * n) / u : 0;
}
function pathData(tag, a) {
  if (tag === "path") return a.d;
  if (tag === "circle" || tag === "ellipse") {
    const x = +a.cx,
      y = +a.cy,
      rx = +(a.r ?? a.rx),
      ry = +(a.r ?? a.ry);
    return `M${x + rx} ${y}A${rx} ${ry} 0 1 1 ${x - rx} ${y}A${rx} ${ry} 0 1 1 ${x + rx} ${y}Z`;
  }
  if (tag === "line") return `M${a.x1} ${a.y1}L${a.x2} ${a.y2}`;
  if (tag === "rect" && !a.rx && !a.ry)
    return `M${a.x} ${a.y}h${a.width}v${a.height}h${-Number(a.width)}Z`;
  if (tag === "polygon" || tag === "polyline")
    return `M${a.points.replace(/\s+/g, "L")}${tag === "polygon" ? "Z" : ""}`;
}
export async function matchedCentrelines(entry, kit, nodes, original, width) {
  if (!nodes?.length || nodes.length > 30) return;
  const sharpStyle = entry.style.endsWith("sharp"),
    tone = /bulk|twotone|duotone/.test(entry.style),
    solid = entry.style.startsWith("solid");
  const components = [];
  const combine = (a, b, operation) => {
    const p = kit.Path.MakeFromOp(a, b, kit.PathOp[operation]);
    a.delete();
    b.delete();
    if (!p) throw new Error("Candidate path operation failed");
    return p;
  };
  const asXml = (p, opacity = 1) => {
    const rule =
      p.getFillType() === kit.FillType.EvenOdd ? "evenodd" : "nonzero";
    const d = regularizePath(p.toSVGString(), kit).d;
    p.delete();
    return `<g fill="currentColor" opacity="${opacity}"><path fill-rule="${rule}" d="${d}"/></g>`;
  };
  for (const [tag, a] of nodes) {
    if (a.transform) return;
    const d = pathData(tag, a);
    if (!d) return;
    const p = kit.Path.MakeFromSVGString(d);
    if (!p) return;
    const filled = a.fill && a.fill !== "none",
      closed = /[zZ]\s*$/.test(d);
    const border = a.stroke
      ? p.makeStroked({
          width: Number(a.strokeWidth ?? 1.5),
          cap: sharpStyle ? kit.StrokeCap.Butt : kit.StrokeCap.Round,
          join: sharpStyle ? kit.StrokeJoin.Miter : kit.StrokeJoin.Round,
          precision: 4,
        })
      : undefined;
    const outline = filled
      ? border
        ? combine(p.copy(), border, "Union")
        : p.copy()
      : border;
    if (!outline) {
      p.delete();
      continue;
    }
    components.push({
      xml: asXml(outline),
      closed,
      body: closed
        ? asXml(
            a.stroke
              ? combine(
                  p.copy(),
                  p.makeStroked({
                    width: Number(a.strokeWidth ?? 1.5),
                    join: sharpStyle
                      ? kit.StrokeJoin.Miter
                      : kit.StrokeJoin.Round,
                    cap: kit.StrokeCap.Round,
                    precision: 4,
                  }),
                  "Union",
                )
              : p.copy(),
          )
        : undefined,
      d,
    });
    p.delete();
  }
  if (!components.length) return;
  const groups = components.map((c) => c.xml),
    candidates = [groups];
  if (tone) {
    const toned = [];
    for (const c of components) {
      const data = await sharp(Buffer.from(svg([c.xml])))
        .resize(width, width)
        .ensureAlpha()
        .raw()
        .toBuffer();
      let source = 0,
        total = 0;
      for (let i = 3; i < data.length; i += 4)
        if (data[i] > 240) {
          source += original[i];
          total += 255;
        }
      const alpha = total && source / total < 0.7 ? 0.4 : 1;
      toned.push(c.xml.replace('opacity="1"', `opacity="${alpha}"`));
    }
    candidates.push(toned);
  }
  const body = components.find((c) => c.closed)?.body;
  if (body && (solid || tone)) {
    const outside = components.filter((c) => !c.closed).map((c) => c.xml);
    if (solid) {
      const $d = /d="([^"]+)"/.exec(body)?.[1];
      let p = kit.Path.MakeFromSVGString($d);
      for (const c of outside) {
        const d = /d="([^"]+)"/.exec(c)?.[1];
        p = combine(p, kit.Path.MakeFromSVGString(d), "Difference");
      }
      candidates.push([asXml(p)]);
    } else {
      const shade = body.replace('opacity="1"', 'opacity="0.4"');
      candidates.push([
        shade,
        ...(entry.style.startsWith("bulk") ? outside : groups),
      ]);
    }
  }
  let best;
  for (const groups of candidates) {
    const b = await sharp(Buffer.from(svg(groups)))
      .resize(width, width)
      .ensureAlpha()
      .raw()
      .toBuffer();
    const score = overlap(original, b);
    if (score >= 98.5 && (!best || score > best.score))
      best = {
        groups,
        score,
        geometry: {
          method: "matched-centrelines",
          model: "reference-verified-components",
          constraints: [
            "source-centrelines",
            "style-specific-caps",
            "reference-overlap-at-least-98.5",
          ],
        },
      };
  }
  return best;
}
