import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Spider Gem — WebSpatial Puzzle (Prototype)
 * ------------------------------------------
 * A lightweight match-3 style puzzle on a radial "web" grid.
 * Works in any browser. If WebSpatial SDK is present, it will
 * politely enable panel title + haptics (no hard dependency).
 */

const RINGS = 4;             // number of concentric circles (excluding center)
const SPOKES = 8;            // number of radial lines
const WEB_RADIUS = 280;      // px (SVG logical units)
const CENTER = { x: 320, y: 320 }; // SVG viewBox center (640x640)

const GEM_TYPES = [
  { id: "ruby",     label: "Ruby",     stops: ["#ff6b6b", "#b8133f"], sparkle: "#ffd6e0" },
  { id: "emerald",  label: "Emerald",  stops: ["#7bed9f", "#11998e"], sparkle: "#e0ffef" },
  { id: "sapphire", label: "Sapphire", stops: ["#70a1ff", "#1e3a8a"], sparkle: "#e0ecff" },
  { id: "amethyst", label: "Amethyst", stops: ["#b794f4", "#6d28d9"], sparkle: "#efe0ff" },
  { id: "topaz",    label: "Topaz",    stops: ["#fbd38d", "#dd6b20"], sparkle: "#fff2da" },
];

const randGem = () => GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)].id;

// Polar → Cartesian position for a grid node
function nodePos(rIdx, sIdx) {
  const ringStep = WEB_RADIUS / (RINGS + 1);
  const radius = ringStep * (rIdx + 1);
  const angle = (2 * Math.PI * sIdx) / SPOKES - Math.PI / 2; // start at top
  const x = CENTER.x + Math.cos(angle) * radius;
  const y = CENTER.y + Math.sin(angle) * radius;
  return { x, y };
}

// Build a grid of cells [{r,s,type}]
function makeGrid(fillRandom = true) {
  const grid = [];
  for (let r = 0; r < RINGS; r++) {
    const row = [];
    for (let s = 0; s < SPOKES; s++) {
      row.push({ r, s, type: fillRandom ? randGem() : null });
    }
    grid.push(row);
  }
  return grid;
}

const cloneGrid = (g) => g.map(row => row.map(cell => ({ ...cell })));

function neighbors(r, s) {
  // Adjacent nodes (same ring across spokes; same spoke across rings)
  const list = [];
  list.push({ r, s: (s - 1 + SPOKES) % SPOKES }); // prev spoke (wrap)
  list.push({ r, s: (s + 1) % SPOKES });          // next spoke (wrap)
  if (r - 1 >= 0) list.push({ r: r - 1, s });     // inner ring
  if (r + 1 < RINGS) list.push({ r: r + 1, s });  // outer ring
  return list;
}

// Find matches of len >= 3 along rings (wrap) and spokes (no wrap)
function findMatches(grid) {
  const toClear = new Set();

  // Rings (wrap)
  for (let r = 0; r < RINGS; r++) {
    let count = 1;
    for (let s = 1; s <= SPOKES; s++) {
      const curr = grid[r][s % SPOKES].type;
      const prev = grid[r][(s - 1) % SPOKES].type;
      if (curr && prev && curr === prev) {
        count++;
      } else {
        if (count >= 3) {
          for (let k = 0; k < count; k++) {
            const idx = (s - 1 - k + SPOKES) % SPOKES;
            toClear.add(`${r},${idx}`);
          }
        }
        count = 1;
      }
    }
  }

  // Spokes (no wrap)
  for (let s = 0; s < SPOKES; s++) {
    let count = 1;
    for (let r = 1; r <= RINGS; r++) {
      const curr = r < RINGS ? grid[r][s].type : null;
      const prev = grid[r - 1][s].type;
      if (curr && prev && curr === prev) {
        count++;
      } else {
        if (count >= 3) {
          for (let k = 0; k < count; k++) {
            const idx = r - 1 - k;
            toClear.add(`${idx},${s}`);
          }
        }
        count = 1;
      }
    }
  }

  return toClear;
}

function swapCells(grid, a, b) {
  const n = cloneGrid(grid);
  const t = n[a.r][a.s].type;
  n[a.r][a.s].type = n[b.r][b.s].type;
  n[b.r][b.s].type = t;
  return n;
}

function useRaf(onFrame, running = true) {
  const ref = useRef();
  useEffect(() => {
    let id;
    const loop = (t) => {
      onFrame?.(t);
      if (running) id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [onFrame, running]);
  return ref;
}

function initWebSpatialIfAvailable() {
  try {
    const ws = window?.WebSpatial;
    if (!ws) return;
    ws.ui?.setPanelTitle?.("🕷️ Spider Gem");
    ws.haptics?.enable?.(true);
  } catch {}
}

function Gem({ x, y, size = 38, type, isSelected, onPointerDown }) {
  const gem = GEM_TYPES.find((g) => g.id === type) || GEM_TYPES[0];
  const gradId = `${type}-grad`;
  const shineId = `${type}-shine`;
  return (
    <g transform={`translate(${x},${y})`} onPointerDown={onPointerDown} style={{ cursor: "pointer" }}>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor={gem.stops[0]} />
          <stop offset="100%" stopColor={gem.stops[1]} />
        </radialGradient>
        <radialGradient id={shineId} cx="30%" cy="20%" r="30%">
          <stop offset="0%" stopColor={gem.sparkle} stopOpacity="0.9" />
          <stop offset="100%" stopColor={gem.sparkle} stopOpacity="0" />
        </radialGradient>
      </defs>
      <polygon
        points={polygonPoints(8, size)}
        fill={`url(#${gradId})`}
        stroke={isSelected ? "#fff" : "#ffffff88"}
        strokeWidth={isSelected ? 3 : 2}
        filter="drop-shadow(0 2px 6px rgba(0,0,0,0.45))"
      />
      <circle cx="-6" cy="-6" r={size * 0.25} fill={`url(#${shineId})`} />
    </g>
  );
}

function polygonPoints(sides, radius) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = (2 * Math.PI * i) / sides - Math.PI / 2;
    pts.push(`${Math.cos(a) * radius},${Math.sin(a) * radius}`);
  }
  return pts.join(" ");
}

export default function SpiderGem() {
  const [grid, setGrid] = useState(() => makeGrid(true));
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null); // {r,s}
  const [clearing, setClearing] = useState(false);
  const [combo, setCombo] = useState(0);
  const [sparkles, setSparkles] = useState([]);
  const lastTimeRef = useRef(0);
  const [targetScore] = useState(800);
  const [won, setWon] = useState(false);
  const [comboFlash, setComboFlash] = useState(0);

  useEffect(() => { initWebSpatialIfAvailable(); }, []);

  useRaf((t) => {
    const prev = lastTimeRef.current || t;
    const dt = Math.min(32, t - prev) / 1000;
    lastTimeRef.current = t;
    if (!dt) return;

    setSparkles((arr) => {
      if (arr.length === 0) return arr;
      const next = arr
        .map((p) => {
          const nx = p.x + p.vx * dt;
          const ny = p.y + p.vy * dt;
          const nlife = p.life - dt;
          const nvy = (p.vy ?? 0) + (p.gravity ?? 0) * dt;
          return { ...p, x: nx, y: ny, life: nlife, vy: nvy };
        })
        .filter((p) => p.life > 0);
      return next;
    });
    setComboFlash((v) => Math.max(0, v - dt * 1.5));
  }, true);

  // Avoid starting with matches (optional)
  useEffect(() => {
    let safety = 0;
    while (true) {
      const m = findMatches(grid);
      if (m.size === 0 || safety++ > 20) break;
      const n = cloneGrid(grid);
      m.forEach((key) => {
        const [r, s] = key.split(",").map(Number);
        n[r][s].type = randGem();
      });
      setGrid(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (r, s) => {
    if (clearing) return;
    if (!selected) {
      setSelected({ r, s });
      return;
    }
    const isNeighbor = neighbors(selected.r, selected.s).some((n) => n.r === r && n.s === s);
    if (!isNeighbor) {
      setSelected({ r, s }); // switch selection
      return;
    }

    const swapped = swapCells(grid, selected, { r, s });
    const matchesAfter = findMatches(swapped);
    if (matchesAfter.size > 0) {
      setGrid(swapped);
      setSelected(null);
      resolveMatches(swapped);
    } else {
      // no-match feedback: brief swap + revert
      setGrid(swapped);
      setTimeout(() => setGrid((g) => swapCells(g, selected, { r, s })), 120);
      setSelected(null);
    }
  };

  function spawnSparklesAt(r, s, type) {
    const { x, y } = nodePos(r, s);
    const gem = GEM_TYPES.find((g) => g.id === type) || GEM_TYPES[0];
    const base = gem.stops[0];
    const count = 10 + Math.floor(Math.random() * 8);
    const parts = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      parts.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 80,
        life: 0.9 + Math.random() * 0.6,
        maxLife: 1.2,
        r: 1.5 + Math.random() * 2.2,
        color: base,
      });
    }
    setSparkles((arr) => {
      const next = arr.concat(parts);
      return next.length > 360 ? next.slice(next.length - 360) : next;
    });
    try { window?.WebSpatial?.haptics?.impact?.("light"); } catch {}
  }

  function spawnComboBurst(mult = 3) {
    const count = 60 + mult * 20;
    const parts = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 220 + mult * 30;
      parts.push({
        x: CENTER.x, y: CENTER.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 40,
        life: 1.0 + Math.random() * 0.6,
        maxLife: 1.4,
        r: 2.2 + Math.random() * 2.8,
        color: "#fff",
      });
    }
    setSparkles((arr) => {
      const next = arr.concat(parts);
      return next.length > 500 ? next.slice(next.length - 500) : next;
    });
  }

  function resolveMatches(current) {
    if (clearing) return;
    setClearing(true);
    let working = cloneGrid(current);
    let localCombo = 0;

    const chain = () => {
      const m = findMatches(working);
      if (m.size === 0) {
        setClearing(false);
        setCombo(0);
        return;
      }
      localCombo++;
      if (localCombo >= 3) {
        setComboFlash((v) => Math.min(1, v + 0.8));
        try { window?.WebSpatial?.haptics?.impact?.("heavy"); } catch {}
        spawnComboBurst(localCombo);
      }
      // clear matched
      m.forEach((key) => {
        const [r, s] = key.split(",").map(Number);
        const ttype = working[r][s].type;
        spawnSparklesAt(r, s, ttype);
        working[r][s].type = null;
      });
      setGrid(cloneGrid(working));
      setCombo(localCombo);
      const points = 10 * m.size + (localCombo - 1) * 5;
      setScore((sc) => {
        const ns = sc + points;
        if (!won && ns >= targetScore) setWon(true);
        return ns;
      });

      // respawn and continue chain
      setTimeout(() => {
        for (let r = 0; r < RINGS; r++) {
          for (let s = 0; s < SPOKES; s++) {
            if (!working[r][s].type) working[r][s].type = randGem();
          }
        }
        setGrid(cloneGrid(working));
        setTimeout(chain, 80);
      }, 180);
    };

    chain();
  }

  const webLines = useMemo(() => {
    const ringStep = WEB_RADIUS / (RINGS + 1);
    const rings = Array.from({ length: RINGS }, (_, r) => (
      <circle key={`ring-${r}`} cx={CENTER.x} cy={CENTER.y} r={ringStep * (r + 1)} stroke="#ffffff22" strokeWidth={1.4} fill="none" />
    ));
    const spokes = Array.from({ length: SPOKES }, (_, s) => {
      const a = (2 * Math.PI * s) / SPOKES - Math.PI / 2;
      const x = CENTER.x + Math.cos(a) * WEB_RADIUS;
      const y = CENTER.y + Math.sin(a) * WEB_RADIUS;
      return <line key={`spoke-${s}`} x1={CENTER.x} y1={CENTER.y} x2={x} y2={y} stroke="#ffffff1e" strokeWidth={1.2} />;
    });
    return <g>{rings}{spokes}</g>;
  }, []);

  // All gem nodes as SVG elements
  const gems = useMemo(() => {
    const list = [];
    for (let r = 0; r < RINGS; r++) {
      for (let s = 0; s < SPOKES; s++) {
        const cell = grid[r][s];
        const { x, y } = nodePos(r, s);
        list.push(
          <Gem
            key={`g-${r}-${s}-${cell.type ?? "none"}`}
            x={x}
            y={y}
            type={cell.type || GEM_TYPES[0].id}
            isSelected={!!selected && selected.r === r && selected.s === s}
            onPointerDown={() => handleSelect(r, s)}
          />
        );
      }
    }
    return list;
  }, [grid, selected]);

  const sparkleNodes = useMemo(
    () => sparkles.map((p, i) => (
      <circle
        key={p.id ?? i}
        cx={p.x}
        cy={p.y}
        r={p.r}
        fill={p.color}
        opacity={Math.max(0, p.life / (p.maxLife || 1))}
      />
    )),
    [sparkles]
  );

  const restart = () => {
    setScore(0);
    setSelected(null);
    setCombo(0);
    setClearing(false);
    setSparkles([]);
    setComboFlash(0);
    setWon(false);
    setGrid(makeGrid(true));
  };

  function openWinScene() {
    try {
      const w = window.open("", "SpiderGemWin", "width=520,height=520");
      if (w) {
        w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Spider Gem — You Win!</title><style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%, #ffffff, #e0e0ff 40%, #0b1020 70%);} .card{background:rgba(255,255,255,.08);backdrop-filter:blur(8px);padding:24px 28px;border-radius:16px;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.2);} button{margin-top:14px;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;cursor:pointer}</style></head><body><div class="card"><h1>✨ You Win! ✨</h1><p>Great run. Keep the combos going!</p><button onclick="window.close()">Close</button></div></body></html>`);
        w.document.close();
      }
    } catch {}
  }

  useEffect(() => {
    if (won) {
      try { window?.WebSpatial?.haptics?.impact?.("heavy"); } catch {}
      openWinScene();
    }
  }, [won]);

  return (
    <div
      className="w-full min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center p-6"
      enable-xr-monitor
    >
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-[360px_1fr] gap-6">
        {/* Sidebar */}
        <div
          enable-xr
          style={{ "--xr-background-material": "thin", "--xr-back": 40, position: "relative", transform: "translateZ(16px)" }}
          className="bg-white/5 backdrop-blur rounded-2xl p-5 shadow-xl border border-white/10"
        >
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <span role="img" aria-label="spider">🕷️</span> Spider Gem
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Swap adjacent jewels on the spider web to make lines of 3+. Clear combos for bonus points.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={restart}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition border border-white/10 shadow"
            >
              Restart
            </button>
            <div className="ml-auto text-right">
              <div className="text-xs uppercase tracking-wide text-slate-400">Score</div>
              <div className="text-2xl font-bold">{score}</div>
              <div className="text-xs text-slate-400">Target: {targetScore}</div>
              {combo > 1 && <div className="text-emerald-300 text-sm">{combo}x combo!</div>}
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-semibold text-slate-300">How to play</h2>
            <ul className="text-sm text-slate-300 list-disc ml-5 mt-2 space-y-1">
              <li>Click/tap a gem, then click/tap an adjacent gem to swap.</li>
              <li>Matches can be along a ring (wraps around) or a spoke.</li>
              <li>Cleared gems respawn instantly — chain them for combos.</li>
            </ul>
          </div>

          <div className="mt-6 text-xs text-slate-400">
            Tip: Works in any browser. Under WebSpatial, panel title + haptics auto-enable.
          </div>
        </div>

        {/* Game Board */}
        <div
          enable-xr
          style={{ "--xr-background-material": "translucent", "--xr-back": 60, position: "relative", transform: "translateZ(30px) rotateX(6deg)", transformOrigin: "center" }}
          className="bg-white/5 backdrop-blur rounded-2xl p-3 md:p-4 shadow-2xl border border-white/10"
        >
          <svg viewBox="0 0 640 640" className="w-full h-[520px] md:h-[640px] block" enable-xr>
            {/* subtle vignette */}
            <defs>
              <radialGradient id="vignette" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#0000" />
                <stop offset="100%" stopColor="#0005" />
              </radialGradient>
              <radialGradient id="comboGrad" cx="50%" cy="50%" r="65%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width="640" height="640" fill="url(#vignette)" />

            {/* Web silk center */}
            <circle cx={CENTER.x} cy={CENTER.y} r={8} fill="#ffffff55" />

            {/* Web */}
            <g>{webLines}</g>

            {/* Gems */}
            <g>{gems}</g>

            {/* Sparkles FX */}
            <g pointerEvents="none">{sparkleNodes}</g>

            {/* Combo flash overlay */}
            <rect x="0" y="0" width="640" height="640" fill="url(#comboGrad)" opacity={Math.min(0.6, comboFlash)} pointerEvents="none" />
          </svg>

          {won && (
            <div enable-xr style={{ "--xr-background-material": "thin", "--xr-back": 90 }} className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/60 backdrop-blur rounded-2xl p-6 border border-white/20 text-center max-w-sm">
                <div className="text-3xl font-bold mb-2">You Win!</div>
                <div className="text-sm opacity-80 mb-4">Score {score} • Target {targetScore}</div>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => { setWon(false); restart(); }} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition border border-white/10 shadow">
                    Play Again
                  </button>
                  <button onClick={openWinScene} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition border border-white/10 shadow">
                    Open Win Scene
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

