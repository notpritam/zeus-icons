# Package launch

React is the primary npm package. Every icon has a named, typed component and a
per-icon import. Flutter is also available as a local path package; other
frameworks currently use the complete components downloaded from the site.

## Build and validate

1. Finish the desired catalogue snapshot and run `npm run build:packages`.
2. Install the generated React tarball into the isolated consumer described in
   scripts/README.md, then run `npm run audit:packages` and
   `npm run test:components`. Run the Flutter fixture when Flutter output changes.
3. Run `npm test`, `npm run build` and the active browser suite.
4. Run `npm run release:prepare -- @your-account/free-icons-react` with a scope
   owned by the intended publisher. Omitting the argument retains the current
   development name, `zeus-icons`; ownership of that scope is not established.

The prepare command checks the source archive checksum, extracts a fresh release
directory, enables public package metadata in that copy only, produces a tarball,
and runs `npm publish --dry-run`. It never publishes. The reviewed tarball path,
SHA-256, identity and result are recorded in `.local/releases/latest.json`.
The downloaded development package and live site are not altered.

## Launch

The registry login is not configured on omni as of 2026-10-10 (`ENEEDAUTH`). Use
`npm login --registry https://registry.npmjs.org/`, then confirm the account or
organization owns the chosen scope. Preparing a name is not a claim that it is
available or that the user owns it.

Install and smoke-test the **prepared tarball**, then publish that exact artifact
with `npm publish /absolute/path/to/reviewed.tgz --access public`. A successful
dry-run is not a registry release. Verify a clean registry install, then switch
the site's installation instructions to `npm install <published-name>` and update
the import snippets. Keep the tarball path instructions until publication succeeds.

The Flutter development package uses `publish_to: none`. A pub.dev release needs
an owned/available package name, publisher login, package validation and a clean
consumer install before switching the site to a hosted dependency.

## Included artwork

The current artifacts contain 60,331 actual icons: 6,025 original free icons and
54,306 image-derived variants. Nine references were unavailable; review metadata
for fitted geometry remains in `SOURCES.json`. Keep source notices, hashes, free
MIT attribution and generated artwork provenance in every release. Do not label
the generated collection as original Hugeicons Pro SVGs or relicense it by
changing the package metadata. Package preparation does not change repository
visibility or publish any source repository.
