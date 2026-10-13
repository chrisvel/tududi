# Life-to-Day brand — Path to Today

Approved by the owner on 2026-10-13. The blue sculptural path connects life's
long-term direction to the amber point representing today. Production assets
use the approved artwork rather than the concept presentation board.

## Source and exports

The untouched generated source is
`proposals/path-to-today-v1/master.png` (1254 × 1254, transparent PNG).
Research and the exact image generation prompts are stored beside it.

The source's visible mark occupies the crop `x=207, y=196, w=901, h=903`.
Exports preserve its silhouette, fold, blue material and amber sphere. They
are resized, packaged and PNG-optimized for each application; the source is
never overwritten. Wordmarks use the bundled Manrope Latin font.

| Asset | Purpose |
| --- | --- |
| `public/brand-mark.png` | Transparent compact logo used by the shared BrandMark component |
| `public/life-wordmark-{dark,light}.png` | Transparent mark and wordmark with dark/light lettering |
| `public/wide-logo-{dark,light}.png` | Compatibility copies of the matching wordmark exports |
| `public/icon-logo.png` | 1024 × 1024 PWA icon, opaque ivory background |
| `public/apple-touch-icon.png` | 180 × 180 Apple home-screen icon |
| `public/favicon-{16,32,48}.png`, `public/favicon.png` | Transparent PNG favicon exports |
| `public/favicon{,-dark,-light}.ico` | Replacement ICO files containing PNG frames at 16, 32, 48, 64, 128 and 256 pixels |
| `public/brand-badge.png` | 48 × 48 monochrome notification badge with transparent background |
| `monochrome-{dark,light}.png` | Single-color exports preserving the approved silhouette |
| `icon-{dark,light}.png`, `preview-*.png` | Reference appearances for dark and light backgrounds |
| `mark.svg` | Portable raster-backed SVG wrapper of the approved mark, not a vector tracing |
| `backend/modules/landing/public/og-path-to-today.png` | 1200 × 630 shared-link preview |

The maskable icon uses a mark width of 58% of the square. Its furthest visible
pixel is 396 pixels from the center, within the required 409.6-pixel safe
circle on the 1024-pixel canvas. The Apple icon uses the same composition.

## Cache refresh

Brand assets and updated marketing media use `v=path-to-today-1` URLs.
`getAssetPath` preserves the deployment base path and versions only brand
filenames. The PWA cache is `life-to-day-v2`, with the normal build identifier
appended by Webpack. The existing API cache and mutation queue retain their
identifiers. Shared-link previews use a new filename for crawler caches.

## Marketing media

The four screenshots, the mobile PWA feature preview and the eight-second
hero loop were recaptured from the current app using an isolated temporary
database with synthetic tasks. They contain no real user data. The loop
alternates the actual planner and Today views. Feature crops with no previous
brand mark remain unchanged. `og-1.png` is updated as a compatibility copy.

## Verification

- Production build and TypeScript check pass. Webpack reports existing bundle
  and unrelated asset size warnings; the optimized PWA icon is approximately
  110–130 KB.
- ESLint passes for the changed frontend files; JavaScript syntax checks pass
  for the worker and Webpack configuration.
- All 58 existing landing integration tests pass, including changed preview
  URLs, static assets and hero video.
- Browser verification covers login and submission, expanded/compact sidebar,
  Today, Plan, Inbox, light/dark appearances and the 390-pixel mobile header.
  Brand images load successfully with versioned URLs.
- Public navigation/footer logos, favicon, social metadata and video playback
  were verified on the running backend. The public page has no console errors.
- The self-hosted app makes an existing `/api/billing` request that returns
  404; it is unrelated to the brand assets. The initial signed-out profile
  request returns the expected 401. Development socket errors were resolved
  by allowing the two local review hostnames without changing the project.
- The project knowledge graph was updated. Nothing was committed or deployed.
