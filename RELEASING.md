# Releasing Zeus Icons

The browser is hosted at https://myzeusui.com/icons/. Source vectors are pinned to
`notpritam/zeus-icons` tags; installable packages and the small browser export are
published as GitHub Release assets. React uses `zeus-icons`, Flutter `zeus_icons`.

## Build and validate

1. Run `npm run build:packages`, `npm test` and `npm run build`.
2. Install the React tarball into the isolated consumer described in
   `scripts/README.md`. Run `npm run audit:packages` and `npm run test:components`.
   Validate the Flutter fixture with a Flutter SDK when widget output changes.
3. Run the browser suite with one worker and `npm run build:site`.
4. Make SVG and browser archives, plus SHA256SUMS. Exclude scratch files and
   reference rasters. Preserve source attribution and per-icon provenance.
5. Tag the verified public source, create the matching GitHub Release and upload
   the exact checked archives. Confirm public downloads match their checksums.
6. Install the public React release URL in a clean consumer and validate the
   per-icon import, TypeScript and rendering before announcing it ready.

MyZeus UI pins the browser release URL and checksum in
`tools/zeus-icons-release.json`. Update that pin, build the static site and check
its export before deploying. Navigation into `/icons/` uses ordinary anchors.
Source SVG URLs use the immutable release tag, not the changing main branch.

## Registry publication is separate

The current package is installed from GitHub Releases. It is not published to
npm or pub.dev. `npm run release:prepare -- zeus-icons` prepares a separate npm
candidate and runs `npm publish --dry-run`; it never publishes. Registry launch
requires publisher authentication, name ownership and a clean registry install.
Never switch the site's command to `npm install zeus-icons` before that succeeds.
Flutter's archive uses `publish_to: none` and is installed as a local dependency.

## Artwork

The release contains 60,331 actual icons: 6,025 original MIT free icons and 54,306
image-derived variants. Nine references were unavailable. Generated artwork is
not original Hugeicons Pro SVG source and is not covered by the application's
MIT license. Keep source notices and review metadata in every distribution.
