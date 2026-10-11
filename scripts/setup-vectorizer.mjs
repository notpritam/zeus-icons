// Reproducible build-only CLI. Potrace is GPL-2.0, authored by Peter Selinger;
// its executable/source are not bundled in the MIT browser or icon archive.
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const root = ".local/tools",
  target = `${root}/potrace-1.16/src/potrace`;
try {
  await access(target);
  console.log(target);
  process.exit(0);
} catch {}
await mkdir(root, { recursive: true });
const response = await fetch(
  "https://potrace.sourceforge.net/download/1.16/potrace-1.16.tar.gz",
);
if (!response.ok) throw new Error(`Potrace download ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (
  createHash("sha256").update(bytes).digest("hex") !==
  "be8248a17dedd6ccbaab2fcc45835bb0502d062e40fbded3bc56028ce5eb7acc"
)
  throw new Error("Potrace checksum mismatch");
await writeFile(`${root}/potrace-1.16.tar.gz`, bytes);
execFileSync("tar", ["-xzf", `${root}/potrace-1.16.tar.gz`, "-C", root]);
execFileSync("./configure", ["--disable-zlib"], {
  cwd: `${root}/potrace-1.16`,
  stdio: "inherit",
});
execFileSync("make", ["-j4"], {
  cwd: `${root}/potrace-1.16`,
  stdio: "inherit",
});
console.log(target);
