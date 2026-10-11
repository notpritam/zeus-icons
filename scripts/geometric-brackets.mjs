// Shape construction for the bracket family. The reference decides the style;
// circles, mirror symmetry and shared radii decide the geometry. These are
// inferred models, not recovered original authoring paths.
const roundedSquare =
  "M2.5 12 C2.5 7.5217 2.5 5.2825 3.89125 3.89125 C5.2825 2.5 7.5217 2.5 12 2.5 C16.4783 2.5 18.7175 2.5 20.10875 3.89125 C21.5 5.2825 21.5 7.5217 21.5 12 C21.5 16.4783 21.5 18.7175 20.10875 20.10875 C18.7175 21.5 16.4783 21.5 12 21.5 C7.5217 21.5 5.2825 21.5 3.89125 20.10875 C2.5 18.7175 2.5 16.4783 2.5 12 Z";
const n = (value) => Number(value.toFixed(5));
function serialize(path) {
  const d = path
    .toSVGString()
    .replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (v) => String(n(Number(v))));
  path.delete();
  return d;
}
function circle(r) {
  return `M${12 + r} 12 A${r} ${r} 0 1 1 ${12 - r} 12 A${r} ${r} 0 1 1 ${12 + r} 12Z`;
}
function rect(lo, hi, r) {
  return `M${lo + r} ${lo}H${hi - r}Q${hi} ${lo} ${hi} ${lo + r}V${hi - r}Q${hi} ${hi} ${hi - r} ${hi}H${lo + r}Q${lo} ${hi} ${lo} ${hi - r}V${lo + r}Q${lo} ${lo} ${lo + r} ${lo}Z`;
}
export function constructBrackets(entry, kit) {
  if (!/^(1st|2nd)-bracket(?:-circle|-square)?$/.test(entry.name))
    return undefined;
  const [weight, family] = entry.style.split("-");
  const enclosed = /-(circle|square)$/.test(entry.name),
    first = entry.name.startsWith("1st");
  const solid = weight === "solid",
    bulk = weight === "bulk",
    duotone = weight === "duotone",
    twotone = weight === "twotone";
  const sharp = family === "sharp",
    rounded = family === "rounded";
  const outline = (
    d,
    width,
    cap = sharp ? "Butt" : "Round",
    join = sharp ? "Miter" : "Round",
  ) => {
    const p = kit.Path.MakeFromSVGString(d);
    if (!p) throw new Error("Invalid bracket model");
    const result = p.makeStroked({
      width,
      cap: kit.StrokeCap[cap],
      join: kit.StrokeJoin[join],
      precision: 4,
    });
    p.delete();
    if (!result) throw new Error("Could not outline bracket model");
    return result;
  };
  const mirror = (d) => {
    const p = kit.Path.MakeFromSVGString(d);
    const b = new kit.PathBuilder(p);
    b.transform(-1, 0, 24, 0, 1, 0, 0, 0, 1);
    p.delete();
    return serialize(b.detachAndDelete());
  };
  let left;
  if (first)
    left = enclosed
      ? "M9 8 C7.7945 8.85994 7 10.3304 7 12 C7 13.6696 7.7945 15.14006 9 16"
      : "M6 3 C3.58901 4.93486 2 8.24345 2 12 C2 15.75655 3.58901 19.06514 6 21";
  else if (enclosed)
    left = sharp
      ? solid
        ? "M10 8H7.5V16H10"
        : "M9 8H7V16H9"
      : rounded
        ? "M9 8 C8.34994 8.06476 7.91238 8.21113 7.58579 8.54192 C7 9.13523 7 10.0902 7 12 C7 13.9098 7 14.86477 7.58579 15.45808 C7.91238 15.78887 8.34994 15.93524 9 16"
        : "M9 8H8 A1 1 0 0 0 7 9 V15 A1 1 0 0 0 8 16H9";
  else
    left = sharp
      ? "M7 3H3V21H7"
      : rounded
        ? `M6.775 3 C5.3855 3.15381 4.45021 3.50143 3.75212 4.28705 C2.5 5.69617 2.5 7.96411 2.5 12.5 C2.5 17.03589 2.5 19.30383 3.75212 20.71295 C4.45021 21.49857 5.3855 21.84619 6.775 22`
        : "M6.5 3H5 A2 2 0 0 0 3 5 V19 A2 2 0 0 0 5 21H6.5";
  // Bulk standalone has a vertically centred pair in the reference.
  if (!first && !enclosed && bulk) {
    const p = kit.Path.MakeFromSVGString(left);
    const b = new kit.PathBuilder(p);
    b.offset(0, -0.5);
    p.delete();
    left = serialize(b.detachAndDelete());
  }
  if (first && solid && sharp) {
    const p = kit.Path.MakeFromSVGString(left);
    const b = new kit.PathBuilder(p);
    b.offset(0.5, 0);
    p.delete();
    left = serialize(b.detachAndDelete());
  }
  const width = enclosed
    ? solid || bulk
      ? 2
      : 1.5
    : solid || bulk
      ? rounded || sharp
        ? 2.5
        : 2
      : 1.5;
  const join =
    sharp && enclosed && solid && !first ? "Round" : sharp ? "Miter" : "Round";
  const l = outline(left, width, undefined, join),
    r = outline(mirror(left), width, undefined, join);
  const pair = kit.Path.MakeFromOp(l, r, kit.PathOp.Union);
  l.delete();
  r.delete();
  if (!pair) throw new Error("Could not combine bracket pair");
  const groups = [];
  const append = (p, opacity = 1) =>
    groups.push(
      `<g fill="currentColor" opacity="${opacity}"><path fill-rule="${p.getFillType() === kit.FillType.EvenOdd ? "evenodd" : "nonzero"}" d="${serialize(p)}"/></g>`,
    );
  if (enclosed && entry.name.endsWith("circle")) {
    // Keep the circle as exact SVG arcs, including in the exported code.
    // Skia's SVG serializer otherwise expands conics into many quadratics.
    const disk = (d, opacity = 1) =>
      groups.push(
        `<g fill="currentColor" opacity="${opacity}"><path fill-rule="evenodd" d="${d}"/></g>`,
      );
    if (solid) disk(circle(10.75) + serialize(pair));
    else {
      if (bulk || duotone) disk(circle(10.75), 0.4);
      if (!bulk) disk(circle(10.75) + circle(9.25));
      append(pair, twotone ? 0.4 : 1);
    }
  } else if (enclosed) {
    let outer;
    if (rounded) {
      const p = kit.Path.MakeFromSVGString(roundedSquare),
        edge = outline(roundedSquare, 1.5);
      outer = kit.Path.MakeFromOp(p, edge, kit.PathOp.Union);
      p.delete();
      edge.delete();
    } else
      outer = kit.Path.MakeFromSVGString(
        sharp ? rect(2.25, 21.75, 0.3) : rect(1.75, 22.25, 2.75),
      );
    if (solid) {
      const cutout = kit.Path.MakeFromOp(outer, pair, kit.PathOp.Difference);
      outer.delete();
      pair.delete();
      append(cutout);
    } else {
      if (bulk || duotone) append(outer.copy(), 0.4);
      if (!bulk) {
        let ring;
        if (rounded) ring = outline(roundedSquare, 1.5);
        else ring = outline(sharp ? rect(3, 21, 0) : rect(2.5, 21.5, 2), 1.5);
        append(ring);
      }
      outer.delete();
      append(pair, twotone ? 0.4 : 1);
    }
  } else if (bulk) {
    pair.delete();
    append(outline(left, width));
    append(outline(mirror(left), width), 0.4);
  } else if (duotone && rounded) append(pair, 0.4);
  else if (twotone) {
    // The original's opaque upper halves end in round caps on a shared
    // 40% base; clipping a full contour would leave an incorrect flat join.
    append(pair, 0.4);
    const half = left.slice(
      0,
      first
        ? left.indexOf(" C2 ", left.indexOf("C") + 1)
        : left.indexOf(" C2.5 17"),
    );
    const topLeft = outline(half, width),
      topRight = outline(mirror(half), width);
    const top = kit.Path.MakeFromOp(topLeft, topRight, kit.PathOp.Union);
    topLeft.delete();
    topRight.delete();
    append(top);
  } else append(pair);
  return {
    groups,
    geometry: {
      method: "shape-model",
      model: entry.name,
      constraints: [
        "shared-centreline",
        "mirror-symmetry",
        ...(entry.name.endsWith("circle")
          ? ["concentric-circles"]
          : entry.name.endsWith("square")
            ? ["shared-corners"]
            : []),
      ],
    },
  };
}
