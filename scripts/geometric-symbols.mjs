import profiles from "./geometric-profiles.json" with { type: "json" };
// Geometric reconstructions for the other families in the reviewed batch.
// Public free centreline curves are useful grid references where the raster
// confirms the same component; style-specific fills, cutouts and proportions
// are modelled explicitly and validated against that style's own image.
export function constructSymbol(entry, kit, nodes, parameters) {
  if (
    ![
      "24-hours-clock",
      "3d-move",
      "3d-scale",
      "3d-printer",
      "3d-rotate",
      "3-d-view",
    ].includes(entry.name)
  )
    return undefined;
  if (entry.name === "3-d-view" && entry.style !== "solid-sharp")
    return undefined;
  parameters ??= profiles[entry.id]?.parameters;
  const [weight, family] = entry.style.split("-"),
    solid = weight === "solid",
    bulk = weight === "bulk",
    duotone = weight === "duotone",
    twotone = weight === "twotone",
    sharp = family === "sharp",
    rounded = family === "rounded";
  const paths = nodes?.filter((n) => n[0] === "path").map((n) => n[1].d) ?? [],
    groups = [];
  const make = (d) => {
    const p = kit.Path.MakeFromSVGString(d);
    if (!p) throw new Error("Invalid geometric symbol");
    return p;
  };
  const op = (a, b, operation) => {
    const p = kit.Path.MakeFromOp(a, b, kit.PathOp[operation]);
    a.delete();
    b.delete();
    if (!p) throw new Error("Invalid geometric operation");
    return p;
  };
  const union = (...ps) => ps.reduce((a, b) => op(a, b, "Union"));
  const stroke = (
    d,
    w = 1.5,
    cap = sharp
      ? entry.name === "24-hours-clock" || entry.name === "3d-printer"
        ? "Square"
        : "Butt"
      : "Round",
    join = sharp ? "Miter" : "Round",
  ) => {
    const p = make(d),
      result = p.makeStroked({
        width: w,
        cap: kit.StrokeCap[cap],
        join: kit.StrokeJoin[join],
        precision: 4,
      });
    p.delete();
    if (!result) throw new Error("Cannot outline geometric symbol");
    return result;
  };
  const body = (d, w = 1.5) => union(make(d), stroke(d, w));
  const circle = (x, y, r) =>
    make(
      `M${x + r} ${y}A${r} ${r} 0 1 1 ${x - r} ${y}A${r} ${r} 0 1 1 ${x + r} ${y}Z`,
    );
  const box = (x, y, w, h) => make(`M${x} ${y}H${x + w}V${y + h}H${x}Z`);
  const append = (p, opacity = 1) => {
    const rule =
      p.getFillType() === kit.FillType.EvenOdd ? "evenodd" : "nonzero";
    const d = p
      .toSVGString()
      .replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (n) =>
        String(Number(Number(n).toFixed(5))),
      );
    p.delete();
    groups.push(
      `<g fill="currentColor" opacity="${opacity}"><path fill-rule="${rule}" d="${d}"/></g>`,
    );
  };
  if (entry.name === "3d-rotate") {
    const v = parameters ?? [
      12,
      7.18491,
      16.8269,
      16.4642,
      16.3877,
      12.3556,
      11.5368,
      6.98939,
      6.5,
      6.48408,
      17,
      11.9941,
      rounded ? 2 : 1.5,
    ];
    const horizontal =
        solid || bulk
          ? `M2 ${v[0]}C${v[1]} ${v[2]} ${v[3]} ${v[4]} 22 ${v[5]}`
          : paths[0],
      vertical =
        solid || bulk
          ? `M${v[6]} 2C${v[7]} ${v[8]} ${v[9]} ${v[10]} ${v[11]} 22`
          : paths[1];
    const extend = (d) => {
      const p = make(d),
        it = new kit.ContourMeasureIter(p, false, 4),
        c = it.next();
      const a = c.getPosTan(0),
        b = c.getPosTan(c.length());
      c.delete();
      it.delete();
      p.delete();
      return (
        d.replace(
          /^M[-\d.]+[ ,]+[-\d.]+/,
          `M${a[0] - 2 * a[2]} ${a[1] - 2 * a[3]}L${a[0]} ${a[1]}`,
        ) + `L${b[0] + 2 * b[2]} ${b[1] + 2 * b[3]}`
      );
    };
    const patches = () =>
      op(
        circle(12, 12, 10.75),
        union(
          stroke(extend(horizontal), v[12]),
          stroke(extend(vertical), v[12]),
        ),
        "Difference",
      );
    const shaded = (opposite) => {
      const p = patches(),
        d = p.toSVGString();
      p.delete();
      for (const part of d.split(/(?=M)/).filter(Boolean)) {
        const q = make(part),
          b = q.getBounds(),
          left = (b[0] + b[2]) / 2 < 11,
          top = (b[1] + b[3]) / 2 < 12;
        const dark = left === top;
        if (opposite) {
          if (!dark) append(q, 0.4);
          else q.delete();
        } else append(q, dark ? 1 : 0.4);
      }
    };
    if (solid || bulk) {
      if (bulk) shaded(false);
      else append(patches());
    } else {
      if (duotone) {
        if (rounded) shaded(true);
        else append(circle(12, 12, 10), 0.4);
      }
      const rim = op(circle(12, 12, 10.75), circle(12, 12, 9.25), "Difference");
      append(
        op(stroke(horizontal), circle(12, 12, 10.75), "Intersect"),
        twotone ? 0.4 : 1,
      );
      append(
        op(stroke(vertical), circle(12, 12, 10.75), "Intersect"),
        twotone ? 0.4 : 1,
      );
      append(rim);
    }
  } else if (entry.name === "24-hours-clock") {
    const rim = paths[0].split("M9")[0],
      hand = "M9 14L12 12V6.66702";
    const digits = sharp
      ? ["M13 16H16V19H13V22H16", "M19 16V19H22M22 16V22"]
      : paths.slice(1);
    const numeral = () => union(...digits.map((d) => stroke(d)));
    if (solid || bulk) {
      const clearance = sharp
        ? box(11.25, 14.5, 14, 10)
        : union(...digits.map((d) => stroke(d, 4.5)));
      let face = op(circle(12, 12, 10.75), clearance, "Difference");
      if (solid) face = op(face, stroke(hand), "Difference");
      append(face, bulk ? 0.4 : 1);
      if (bulk) append(stroke(hand));
      append(numeral());
    } else {
      if (duotone) append(circle(12, 12, 10), 0.4);
      append(union(stroke(rim), stroke(hand)));
      append(numeral(), twotone ? 0.4 : 1);
    }
  } else if (entry.name === "3d-move" || entry.name === "3d-scale") {
    const move = entry.name === "3d-move";
    let shapes = paths.slice(1),
      connector = paths[0];
    if (!rounded) {
      if (move) {
        const v = parameters ?? [
          sharp ? 3 : 2,
          sharp ? 8 : 7,
          3,
          5,
          16.5,
          2,
          21.5,
          8,
          21.5,
        ];
        shapes = [
          `M12 ${v[0]}L${12 - v[2]} ${v[1]}H${12 + v[2]}Z`,
          `M${v[3]} ${v[4]}L${v[5]} ${v[6]}L${v[7]} ${v[8]}Z`,
          `M${24 - v[3]} ${v[4]}L${24 - v[5]} ${v[6]}L${24 - v[7]} ${v[8]}Z`,
        ];
      } else
        shapes = [
          [12, 5],
          [19.5, 19],
          [4.5, 19],
        ].map(
          ([x, y]) =>
            `M${x} ${y - 3}L${x + 2.5} ${y - 1.5}V${y + 1.5}L${x} ${y + 3}L${x - 2.5} ${y + 1.5}V${y - 1.5}Z`,
        );
    }
    const symbolStroke = (d, w = 1.5) => stroke(d, w, "Round", "Round");
    const symbolBody = (d) => union(make(d), symbolStroke(d));
    if (solid) append(union(stroke(connector, 2), ...shapes.map(symbolBody)));
    else {
      if (bulk) {
        const faces = union(...shapes.map(symbolBody));
        append(op(stroke(connector, 2), faces, "Difference"));
        for (const d of shapes) append(symbolBody(d), 0.4);
      } else {
        if (duotone)
          for (const d of rounded
            ? move
              ? shapes.slice(1)
              : shapes.slice(0, 2)
            : shapes)
            append(make(d), 0.4);
        const edges = union(...shapes.map((d) => symbolStroke(d))),
          stem = op(
            stroke(connector),
            union(...shapes.map(make)),
            "Difference",
          );
        if (twotone) {
          append(stem, 0.4);
          append(edges);
        } else append(union(stem, edges));
      }
    }
  } else if (entry.name === "3d-printer") {
    const bars = sharp
      ? ["M2 2H8V4.5H2Z", "M16 2H22V4.5H16Z"]
      : paths.slice(0, 2);
    const dots = () =>
      union(
        ...[5, 7.5].map((y) =>
          sharp ? box(13.25, y - 0.75, 1.5, 1.5) : circle(14, y + 0.005, 0.75),
        ),
      );
    const filament = sharp ? "M2 22H10Q12 22 12 20" : paths[5];
    if (solid || bulk) {
      const left = op(body(bars[0]), box(0, 0, 6, 24), "Intersect"),
        right = op(body(bars[1]), box(18, 0, 6, 24), "Intersect");
      append(union(left, right));
      let head = box(7.25, 1.25, 9.5, 8.75);
      if (solid) head = op(head, dots(), "Difference");
      append(head, bulk ? 0.4 : 1);
      if (bulk) append(dots());
      const nozzle = sharp
        ? "M8.25 11.5H15.75L14.25 13.5V16L12 18L9.75 16V13.5Z"
        : "M8.25 11.5H15.75L14.25 13.5V14.75C14.25 16.45 13.55 17.5 12 18.25C10.45 17.5 9.75 16.45 9.75 14.75V13.5Z";
      append(make(nozzle));
      append(stroke(filament), bulk ? 0.4 : 1);
    } else {
      if (duotone) {
        if (rounded) append(union(...bars.map(make), make(paths[3])), 0.4);
        else append(make(paths[2]), 0.4);
      }
      const nozzle = sharp ? "M10.5 13V16L12 17.5L13.5 16V13" : paths[4];
      append(union(...bars.map((d) => stroke(d))), twotone ? 0.4 : 1);
      append(stroke(paths[2]));
      append(
        sharp
          ? op(stroke(paths[3]), box(7.25, 0, 9.5, 24), "Intersect")
          : stroke(paths[3]),
      );
      append(stroke(nozzle), twotone ? 0.4 : 1);
      append(stroke(filament));
      append(dots());
    }
  } else {
    // Cube viewed in perspective inside four square corner brackets.
    append(
      union(
        ...[
          "M2.5 9V2.5H9",
          "M15 2.5H21.5V9",
          "M21.5 15V21.5H15",
          "M9 21.5H2.5V15",
        ].map((d) => stroke(d, 2)),
      ),
    );
    append(
      make(
        "M7.25 8.125L12 5.75L16.75 8.125L12 10.5Z M6.25 9.75L11.25 12.25V18L6.25 15.5Z M17.75 9.75L12.75 12.25V18L17.75 15.5Z",
      ),
    );
  }
  return {
    groups,
    geometry: {
      method: "shape-model",
      model: entry.name,
      constraints: [
        "shared-grid",
        "geometric-components",
        "smooth-centrelines",
      ],
    },
  };
}
