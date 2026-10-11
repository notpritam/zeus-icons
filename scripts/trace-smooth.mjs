import { spawn } from "node:child_process";
import { load } from "cheerio";
import { regularizePath } from "./primitive-fit.mjs";
const executable =
  process.env.POTRACE_PATH ?? ".local/tools/potrace-1.16/src/potrace";
export async function traceSmooth(raw, dimension, cutoff, kit, style) {
  const mask = Buffer.alloc(dimension * dimension);
  for (let i = 0; i < mask.length; i++)
    mask[i] = raw[i * 4 + 3] >= cutoff ? 0 : 255;
  const input = Buffer.concat([
    Buffer.from(`P5\n${dimension} ${dimension}\n255\n`),
    mask,
  ]);
  const xml = await new Promise((resolve, reject) => {
    const p = spawn(
      executable,
      [
        "-s",
        "-u",
        "100",
        "-a",
        style.endsWith("rounded") ? "1" : "0.55",
        "-O",
        "1.5",
        "-t",
        "0",
        "-o",
        "-",
        "-",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const out = [],
      errors = [];
    p.stdout.on("data", (b) => out.push(b));
    p.stderr.on("data", (b) => errors.push(b));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(out).toString())
        : reject(new Error(`Potrace ${code}: ${Buffer.concat(errors)}`)),
    );
    p.stdin.on("error", reject);
    p.stdin.end(input);
  });
  const $ = load(xml, { xmlMode: true }),
    parts = [],
    primitives = [];
  let unmodelled = 0;
  for (const el of $("path").toArray()) {
    const p = kit.Path.MakeFromSVGString($(el).attr("d"));
    if (!p) throw new Error("Invalid traced path");
    const scale = 24 / (dimension * 100),
      builder = new kit.PathBuilder(p);
    builder.transform(scale, 0, 0, 0, -scale, 24, 0, 0, 1);
    const normalized = builder.detachAndDelete();
    p.delete();
    const fitted = regularizePath(normalized.toSVGString(), kit, {
      arcs: true,
    });
    normalized.delete();
    primitives.push(...fitted.primitives);
    unmodelled += fitted.unmodelled;
    parts.push(
      `<path d="${fitted.d.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (v) => String(Number(Number(v).toFixed(5))))}"/>`,
    );
  }
  if (!parts.length) throw new Error("Empty traced layer");
  return { paths: parts.join(""), primitives, unmodelled };
}
