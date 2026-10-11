# Free catalogue generation and verification

## Geometric SVG generation (R-18, 2026-10-10)

`npm run trace:pro` builds the first 100 reference variants with explicit geometric models: circles/arcs, shared centreline curves, mirrored brackets, polygons, straight bodies, boolean cutouts and style-specific caps/opacity. The models in `geometric-brackets.mjs` and `geometric-symbols.mjs` cover all 12 names in the current batch. `geometric-profiles.json` holds constrained shape parameters for the Standard/Sharp move triangles and globe cutouts. Triangle parameters are top apex Y, base Y, half-width, then the three left-triangle vertices; the right triangle mirrors them. Globe parameters are the horizontal cubic's start Y, two XY controls, end Y; vertical cubic start X, two XY controls, end X; and cutout width.

An optional metadata file (`node scripts/trace-pro-batch.mjs path/to/batch.json`) merges later batches. References are cached under `public/traced/images/`; generated SVGs and the manifest remain outside Git and the MIT free ZIP. Model outputs are checked against the actual reference before writing. Unmodelled entries use the original alpha-layer VTracer fallback, but are always flagged for geometric refinement: high image overlap cannot prove a smooth, correct shape. Add a model after inspecting its source. Never treat the first-batch model coverage as an automatic solution for all remaining icons.

Some matching centreline components come from the installed MIT free package; style-specific proportions/fills/cutouts are explicitly reconstructed and checked against each Pro-style image. Preserve original names and provenance. SVG boolean output must retain its fill rule. Preserve exact SVG arcs for complete circular bracket frames rather than serializing approximate conics.

`npm run test:geometry` requires a generated first batch and verifies radii, bracket symmetry, straight edges, holes, square corners and raster alignment. `npm run audit:traces` independently checks every hash, SVG/MIME/image and overlap in Chromium. `audit:served` checks all 12,255 currently served assets. Rebuild/restart after generating. Run browser tests separately from the 7,173-case free export audit: two Chromium pages crashed during a concurrent run on 2026-10-10.

The former 32 low-overlap first-batch traces have been reconstructed; the full catalogue remains pending. Outputs remain image-guided approximations, not original paid source SVGs.

## Original styles and exports (2026-10-10)

Build serves the installed free catalogue unchanged. Original style definitions live in `src/lib/icon-styles.ts`; other styles use generated image traces where available and public raster references otherwise. Custom treatment generation and archives were removed at the user's request. Retired paths are checked for 404 in `audit:served`.

`audit:served` verifies all 12,053 original catalogue/download assets plus the CanvasKit licence over HTTP against disk. The browser dynamically loads CanvasKit only for outlined SVG export. Outlining expands source paths and primitive shapes into filled vector geometry; it does not trace reference images.

## Official free package

Artwork is sourced exclusively from **@hugeicons/core-free-icons 4.3.5**, the upstream MIT-licensed Stroke Rounded package. The sync reads public free-style catalogue metadata. Alias review inspects only the 20 free Stroke Rounded preview rasters for ambiguous name pairs; none of those rasters become exported SVG artwork. It never traces screenshots or requests Pro artwork.

Separate review utility: `npm run review:pro:snapshot` records the first 100 paid variants from the public **all-style** listing in `src/data/pro-review.json`. It checks pagination, card/metadata order, PRO badges, preview URL host/path, unique IDs and known styles, and excludes Stroke Rounded. It records public preview URLs for browser display without downloading artwork. These entries never enter the free catalogue, reference renderer or ZIP. The current snapshot spans 12 names across pages 1–2; it starts at `1st-bracket-solid-sharp` and ends at `3-d-view-solid-sharp`.

```sh
npm run sync                       # cached public metadata; preserves generated files on mapping failure
npm run sync -- --refresh          # refetch all 61 free catalogue pages
npm run audit                      # full offline audit against the installed official React renderer
npm run audit -- --write-report    # also persist verification evidence in public/audit.json
npm run audit -- --live            # refresh metadata and compare to the generated catalogue
npm run audit:exports              # built vector converter, all icons plus primitive/transform stroke presets
npm run audit:served               # HTTP status, MIME and exact bytes for every served icon/reference
node scripts/test-catalog-audit.mjs # ensure audit rejects geometry, category, and archive corruption
```

The cache lives in `.cache/hugeicons/`. Fetching uses three workers, 30-second timeouts, and at most three attempts with backoff per page. Hydration strings are parsed as JSON, never executed. Every page is checked for correct pagination, style, count, and unchanged sidebar categories. Only `stroke-rounded` listing URLs are fetched.

After a sync on omni, restart `free-icons-dev.service` to rebuild and publish the complete catalogue. It serves a built snapshot and runs `audit:served` after starting. Do not rely on a long-running Vite dev process seeing directory replacements: this produced a partial public-file index and HTML responses for existing SVGs on October 9. The served audit checks all 12,054 assets (6,025 SVGs, 6,025 references, catalogue, two licences and ZIP) and fails on HTTP/MIME/byte mismatches. It accepts an optional base URL: `npm run audit:served -- http://127.0.0.1:8938`.

## Outputs

- `public/catalog.json` conforms to `src/types.ts`: 6,025 canonical icons, all 59 website categories in their original order, exact source membership, and coverage counts.
- `public/reference/<id>.json` is the untouched official `IconNode[]` for the independent reference renderer.
- `public/icons/<id>.svg` is the faithful SVG export. It keeps the 24×24 viewBox and every official path attribute, including per-node stroke width, cap, join, fill, opacity, and transform. React-only keys are omitted; secondary paths use the same paint order as the official React component.
- `public/manifest.json` records all canonical modules, package export aliases, exact upstream spellings, and source URLs.
- `public/upstream-metadata.json` records the complete public free-style membership snapshot without artwork.
- `public/audit.json` describes all aliases and explained category count differences. `--write-report` adds exhaustive verification counts and ZIP SHA-256.
- `public/free-icons.zip` contains all 6,025 SVG files, the full upstream MIT license, category metadata, and mapping manifest.
- `public/LICENSE-hugeicons.txt` retains the complete upstream license, including copyright notice.

## Why the website count is 6,035

Ten website entries resolve by name to a canonical package module already used by another entry: C++/Cpp, three comment names with spaces, fingerprint scan, fullscreen, Re, Rubik's cube, Four Square/Foursquare, and Trade Mark/Trademark. The latter two span categories; both memberships remain. These mappings come from explicit package aliases or normalized canonical names. **They do not establish website artwork equivalence.** Free-preview inspection identified four confirmed design conflicts (Foursquare, Trademark, Fingerprint Scan, Fullscreen), five pairs with different raster images and unverified artwork equivalence (three comment names, C++/Cpp, Re/Re:), and one byte-identical pair (Rubik's cube). Every unresolved case is exposed in `coverage.missingFromPackage`, `audit.json`, and the per-icon mapping manifest, with exact source URLs, preview URLs, and SHA-256 hashes. The SVGs are complete and exact for the installed free package; the website artwork differences remain unresolved.

Five website category counts include duplicate names within that category:

| Category | Website entries | Canonical icons |
| --- | ---: | ---: |
| Communications | 286 | 283 |
| Editing | 601 | 600 |
| Games | 172 | 171 |
| Programming | 87 | 85 |
| Security | 113 | 112 |

`expectedCount` retains the website count; `actualCount` counts unique exported icons. `categoryMismatches` explains these differences. No package exports or website metadata entries are omitted. Four website designs conflict with their package alias, and five other preview pairs remain unverified; those are reported separately from category counts.

`scripts/upstream-alias-review.json` records the reviewed evidence. New alias groups or package versions fail closed until their review is updated. `--refresh` and `--live` also refetch the reviewed free preview URLs and fail if their hashes have changed.

Numeric names need explicit translation. For example, `arrow-down-0-1` maps to `ArrowDownZeroOneIcon`, while `arrow-down-01` maps to `ArrowDown01Icon`. Blind punctuation stripping selects the wrong design. Reviewed translations live in `SLUG_EXPORT_OVERRIDES`, and the auditor checks the most collision-prone names explicitly.

Website names with unsafe filename characters retain their exact spelling in source URLs and the manifest, while local files use the canonical export's safe slug. This affects three source entries: `image-flip -horizontal` and the trailing spaces in `package-add-01 ` and `package-remove-01 `.

The audit validates all 20,354 SVG nodes independently by rendering `@hugeicons/react`, then comparing parsed XML element names, attributes, and paint order. It also checks every reference JSON, exact category membership, all source/package aliases, every ZIP entry, license bytes, and unexpected extra files. Any missing package icon, unknown category, hidden website artwork difference, geometry alteration, or incomplete archive fails with a nonzero exit code. The four already reported upstream design conflicts and five unverified raster pairs remain visible while package verification passes.

## Full Pro inventory and reconstruction (R-20, 2026-10-10)

`npm run snapshot:pro:all` verifies all 604 public listing pages, PRO labels,
original style IDs, category metadata and preview URLs. It resumes from
`.cache/pro-catalog/page-*.json` and writes `.cache/pro-catalog/catalog.json`.
Pass --refresh to fetch fresh pages instead of resuming cached pages.
The captured inventory has 54,315 paid variants (6,035 names × nine styles).
Spaces and punctuation in source names are preserved; safe hashed filenames
prevent them becoming filesystem paths. `src/data/pro-catalog-summary.json`
records the counts without bundling the whole upstream page snapshot.

Run `npm run setup:vectorizer` once (C compiler/make required), then
`npm run trace:all`. Potrace 1.16 is a separate GPL-2.0 build-time CLI; its
pinned source archive is checksum-verified. Neither it nor its source is
bundled in the browser or the MIT free icon ZIP. The runtime dependencies remain
unchanged. `POTRACE_PATH` can point at an already-installed executable.

The `geometry-first-v4` pipeline:

1. Keeps the 100 approved explicit geometric models unchanged.
2. Downloads the same variant's public `-512.webp` reference from the source
   detail page's preview convention, falling back to @3x only if unavailable.
3. Reuses clean centreline/shape components only when their rendered target
   style matches the actual reference at ≥98.5% alpha overlap.
4. Fits other contours with corner-aware curves and recognises whole circles,
   straight rectangles, and contours formed from circular arcs and lines.
   Axis-aligned lines are regularised; joins use actual shape intersections.
   Winding, holes, and real opacity plateaus (including 30%, 40%, 50%) survive.
5. Keeps unrecognised curves marked `needs-review`, even with a high overlap.
   This is an automatic reconstruction pass, not a claim that every contour has
   a hand-reviewed semantic model. Pixel scores cannot prove intended geometry.

`TRACE_WORKERS` controls bounded concurrency (default eight). The installed
`free-icons-generate.service` uses 32 workers and a 12-slot native thread pool with a maximum of three retries
per day. Individual outputs have durable JSON checkpoints under
`.cache/generated`; references and SVGs live under `public/traced`. Restarting
resumes matching algorithm outputs and repairs missing files. Each 250 results,
a manifest is atomically published after its assets. The browser receives a
compact gzip catalogue, checks a tiny progress record every 30 seconds, and
uses SVG hashes to refresh changed artwork. Full provenance/hashes remain in
`manifest.json`. `--force` regenerates the requested batch; `--publish` updates
the running preview without rebuilding JS. Do not run two publishers together.

`test:geometry` checks the original approved batch. `test:reconstruction` checks
primitive fitting, sharp corners, holes, opacity and rejection of unrelated
centreline candidates. `audit:traces` compares rendered vectors and references
at their actual source resolution. Run full audits after generation settles,
otherwise a checkpoint can change during the audit.

The browser includes all distinct source names in Pro/built views, including
the ten names collapsed by the official free package. Such a name's Free tab
shows its actual public reference and disables the unavailable free SVG export;
it never substitutes a different alias's artwork.

## Deployment continuity (R-19)

Vite builds retain immutable hashed assets (`emptyOutDir: false`), so an old
open tab can finish loading its modules. The already-deleted
`outline-svg-BuQc-UMe.js` URL has a compatibility export bridge. A bounded Vite
preload-error handler reloads at most once per minute for pre-retention clients.
`tests/deployment.spec.ts` covers that URL, URL-preserving recovery and loop
prevention. An additional browser check kept a tab open through a real build
and successfully adjusted its stroke afterward. Keep missing SVGs returning
404 (`appType: mpa`); never use an HTML fallback for an asset URL. Retaining
assets also means retired public files must be explicitly removed when retiring
features; the served audit checks the previously retired paths.

Opacity validation uses actual interior plateaus, not just frequent edge values.
This avoids treating antialiasing bands as extra shaded shapes and preserves
small 64% overlap regions. `node scripts/audit-alpha-levels.mjs` checks all cached
references and writes a targeted `.local/tracing/alpha-repairs.json` batch.
Run that with `trace-pro-batch.mjs ... --force --publish` after stopping the main
publisher. Partial repair batches keep the full catalogue target and unrelated
source failures in the manifest. Browser audit results are reused only when
both image and SVG hashes are unchanged; high-resolution audit pages are kept
small and canvas/image resources are released to avoid Chromium decode limits.

## Modal and framework packages (R-21/R-22)

The collection/modal is the only active route. `Root.tsx` translates saved
workbench icon URLs; `legacy-tests/workbench.spec.ts` preserves the retired
workbench browser checks, while active tests cover modal migration and zoom.
IndexedDB is not deleted. Zoom changes preview CSS dimensions only; exports use
the Size preset. Category selection is a top control; comparison modes are removed.

`npm run build:packages` converts every actual free/generated SVG into a named
React component and Flutter widget, checks unique identifiers and source hashes,
and creates `public/packages/manifest.json` plus two archives. It does not
regenerate artwork. Component source conversion is shared with the site's
framework tabs through `src/lib/component-source.ts`. Original style labels and
source IDs remain unchanged; canonical free export names become the component
base names, with the original style suffix. Punctuation-only aliases get valid,
distinct identifiers. Both packages retain per-icon provenance and review status.

React is compiled ESM using a small native-element renderer, not innerHTML or
remote SVG URLs. Per-icon imports avoid a whole-catalogue bundle; declarations
include SVG props, size, title and refs. Flutter widgets use flutter_svg and
support size, color, opacity and semantics. Registry publishing is disabled in
both generated manifests. React/Flutter source copies are in `.local/packages`.
Other framework tabs download complete local components (Vue SFC, Svelte 5,
standalone Angular, React Native with react-native-svg); they are not registry
packages. For a custom contour weight the usage example points at the downloaded
component, not the package's default geometry.

Package verification installs the actual React tarball into
`.local/package-consumer` with React, React DOM and their types. Run
`npm run audit:packages` to render all components, compare every vector element,
verify Flutter embedded geometry and provenance hashes, verify archive checksums,
and check a single-icon consumer bundle. `node scripts/test-components.mjs`
also uses Vue/compiler-sfc/server-renderer, Svelte, Angular/core/compiler/compiler-cli,
React Native/react-native-svg and TypeScript installed in that consumer folder.
It renders React/Vue/Svelte examples, typechecks React/React Native/actual package
imports and compiles an Angular consumer template with ngc. These validation
dependencies are isolated from the app.

Flutter verification uses a separate consumer with a path dependency on the
extracted package, plus flutter_test. Copy `scripts/fixtures/flutter/icons_test.dart`
to its test directory and run `flutter test`; all ten styles are rendered with
size, tint, opacity and semantic-label checks. The Flutter SDK is only a local
validation tool, not an app dependency.

Packed catalogue v2 shortens repeated reference URLs and hashes (1.1 MB gzip),
while v1 remains served for open tabs. Publish temporary files outside `public`
to prevent Vite directory-copy races. The served audit also verifies package
archive bytes and MIME types. Package downloads use application/gzip.
