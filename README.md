# Zeus Icons

60,331 SVG icons for React, Flutter and the web, part of [MyZeus UI](https://myzeusui.com).

[Browse icons](https://myzeusui.com/icons/) · [Downloads](https://github.com/notpritam/zeus-icons/releases/latest)

## React

Install the versioned GitHub release package:

```sh
npm install https://github.com/notpritam/zeus-icons/releases/download/v0.1.0/zeus-icons-0.1.0.tgz
```

```tsx
import { Home01SolidRoundedIcon } from 'zeus-icons/solid-rounded/Home01SolidRoundedIcon';

<Home01SolidRoundedIcon size={24} color="currentColor" title="Home" />
```

Named components, TypeScript, SVG props, refs, accessibility labels and per-icon imports are included. Next.js client boundaries are declared in the package. Only the icons you import are bundled. `strokeWidth` changes original stroke artwork; generated filled contours retain their shape. Download a customized standalone component from the browser when changing contour weight.

The package is distributed through GitHub Releases. It is not yet published to the npm registry.

## Flutter

Download and extract `zeus-icons-flutter-0.1.0.tar.gz` from the release, then add:

```yaml
dependencies:
  zeus_icons:
    path: ./zeus_icons
```

```dart
import 'package:zeus_icons/solid_rounded/Home01SolidRoundedIcon.dart';

const Home01SolidRoundedIcon(size: 24, color: Color(0xFF246348));
```

Widgets support size, color, opacity and semantic labels using `flutter_svg`.

## SVGs and styles

The source SVGs are in `public/icons/` (Stroke Rounded) and `public/traced/svg/` (generated styles). The release also includes one SVG archive. Browse Rounded (Stroke, Solid, Bulk, Duotone, Twotone), Standard (Stroke, Solid, Duotone) and Sharp (Stroke, Solid). Source names and style identities are preserved.

The website offers a large automatically fitted preview, color/stroke controls, copy/download and complete component source for React, React Native, Vue, Svelte, Angular, Flutter and plain SVG.

## Source and attribution

- 6,025 original Stroke Rounded icons come from the MIT-licensed Hugeicons free package. Their attribution remains with the files and downloads.
- 54,306 variants are inferred from public Hugeicons preview images. They are not original Hugeicons Pro SVG source and are **not covered by the application's MIT license**. Each retains source notices. Nine unavailable source previews are omitted.
- 100 geometric models and 9,472 reference-verified component models are present; 44,734 fitted contours remain marked for geometric review. Image overlap does not establish exact intended geometry.

Application code is [MIT](LICENSE). Packages contain `SOURCES.json` with per-icon provenance, hashes and review status. Renaming or distributing a package does not change artwork rights.

## Development

```sh
npm ci
npm run build
npm run preview -- --port 8937
npm test
npm run test:e2e -- --workers=1
npm run build:packages
npm run build:site
```

`npm ci` restores the compressed generated metadata. The repository includes the SVGs; original reference rasters used by geometry audits are not redistributed in the source tree. Fetch the public references with the generation tools before running image-comparison audits.

`build:site` produces a small static export mounted at `/icons/`; versioned SVGs and packages are served from this repository and its GitHub releases. The application keeps old hashed build modules for already-open tabs, and missing icon URLs stay 404.

See [generation tools](scripts/README.md) and [release instructions](RELEASING.md).
