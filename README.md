# Spider Gem — WebSpatial Puzzle (MVP)

A lightweight match-3 on a radial “spider web”. Built with React + SVG.
Runs in any browser; via WebSpatial it enables panel depth/materials and haptics.

## Demo
- Web: `npm run dev` then open the printed URL.
- visionOS (simulator): keep Vite running, then install with WebSpatial builder (below).

## Scripts
```bash
npm i
npm run dev           # web
npm run dev:xr        # same as dev; keep running while using the builder
npm run build
npm run preview
````

## Run on visionOS via WebSpatial

1. Boot **visionOS 2.5** simulator.

```bash
open -a Simulator
xcrun simctl boot <YOUR-2.5-UDID>
xcrun simctl bootstatus <YOUR-2.5-UDID> -b
```

2. In **Terminal A**:

```bash
npm run dev:xr
# Note the URL, e.g. http://localhost:5175/
```

3. In **Terminal B**:

```bash
npx webspatial-builder run --base=http://localhost:5175/
# If you host under /webspatial/avp and it works in a browser, use that path instead.
```

## Files

* `src/SpiderGem.jsx` — single-file game component (React + SVG)
* `src/main.jsx` — mounts `SpiderGem`
* `index.html` — plain Vite HTML (no templating)

## Notes

* The app gracefully falls back if `window.WebSpatial` is absent.
* The UI uses utility classes; styling is minimal but functional.

## License

MIT

