// src/cms/AdventureMapEditor.jsx
// A visual scene painter for Adventures — the CMS "map builder". Fully
// controlled: the map definition lives in `value` and every edit calls
// onChange, so the parent owns state and can save it into the adventure
// override. The learner app renders exactly this via mergeAdventure (it applies
// an override `map` / `player` / NPC positions for single-scene adventures).
//
// Two layers (ground = always drawn, decor = solid props on top), a curated
// tile palette per tileset, drag-to-paint, NPC + player placement, and resize.
import { useEffect, useRef, useState } from "react";
import { Eraser, MapPin, User, Trash2, Move } from "lucide-react";

// Kenney sheet geometry (verified against the PNGs). stride = tile + gap.
const SHEETS = {
  town: { url: "/adventures/kenney/tiny-town/Tilemap/tilemap_packed.png", cols: 12, stride: 16, w: 192, h: 176 },
  rogue: { url: "/adventures/kenney/roguelike/roguelikeSheet.png", cols: 57, stride: 17, w: 968, h: 526 },
};
const CHARS = { url: "/adventures/kenney/tiny-dungeon/Tilemap/tilemap_packed.png", cols: 12, stride: 16, w: 192, h: 176 };

// Curated, human-named tiles per tileset so editors don't hunt raw indices.
const PALETTES = {
  town: {
    ground: [
      { n: "Grass", i: 0 }, { n: "Flowers", i: 1 }, { n: "Sparse", i: 2 },
      { n: "Cobble", i: 43 }, { n: "Stone floor", i: 109 }, { n: "Dirt", i: 25 },
    ],
    decor: [
      { n: "Tree", i: 4 }, { n: "Small tree", i: 6 }, { n: "Orange tree", i: 3 }, { n: "Bush", i: 5 },
      { n: "Roof L", i: 48 }, { n: "Roof M", i: 49 }, { n: "Roof R", i: 50 },
      { n: "Window", i: 84 }, { n: "Door", i: 85 }, { n: "Wall", i: 86 },
      { n: "Fence", i: 45 }, { n: "Signpost", i: 82 }, { n: "Crate", i: 107 }, { n: "Barrel", i: 106 },
    ],
  },
  rogue: {
    ground: [
      { n: "Grass", i: 5 }, { n: "Plaza", i: 120 }, { n: "Plaza tan", i: 122 }, { n: "Dirt", i: 6 },
    ],
    decor: [
      { n: "Tree", i: 583 }, { n: "Orange tree", i: 584 }, { n: "Pine", i: 586 }, { n: "Orange pine", i: 587 },
      { n: "Hedge", i: 646 }, { n: "Bush", i: 651 }, { n: "Bench", i: 304 }, { n: "Lamp", i: 416 }, { n: "Flowers", i: 469 },
      { n: "Awning O", i: 10 }, { n: "Awning G", i: 11 }, { n: "Stall", i: 358 },
      { n: "Fountain", i: 467 }, { n: "Building", i: 755 }, { n: "Door", i: 814 },
    ],
  },
};
const DEFAULT_GROUND = { town: 0, rogue: 5 };

const NPC_FRAMES = [
  { n: "Traveller", i: 98 }, { n: "Woman", i: 88 }, { n: "Princess", i: 99 },
  { n: "Elder", i: 100 }, { n: "Warrior", i: 85 }, { n: "Knight", i: 96 }, { n: "Elf", i: 112 },
];

// A single sprite drawn from a sheet by tile index, via CSS background.
function Sprite({ sheet, idx, scale = 2, style }) {
  if (idx == null || idx < 0) return <div style={{ width: 16 * scale, height: 16 * scale, ...style }} />;
  const col = idx % sheet.cols;
  const row = Math.floor(idx / sheet.cols);
  return (
    <div
      style={{
        width: 16 * scale, height: 16 * scale,
        backgroundImage: `url(${sheet.url})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${sheet.w * scale}px ${sheet.h * scale}px`,
        backgroundPosition: `-${col * sheet.stride * scale}px -${row * sheet.stride * scale}px`,
        imageRendering: "pixelated",
        ...style,
      }}
    />
  );
}

export default function AdventureMapEditor({ npcs: npcList = [], value, onChange }) {
  const sheet = SHEETS[value.tileset] || SHEETS.town;
  const pal = PALETTES[value.tileset] || PALETTES.town;
  const { width, height, ground, decor } = value.map;

  // Local UI state (not part of the saved definition).
  const [tool, setTool] = useState("ground");           // ground | decor | erase | npc:<id> | player
  const [groundTile, setGroundTile] = useState(pal.ground[0].i);
  const [decorTile, setDecorTile] = useState(pal.decor[0].i);
  const painting = useRef(false);

  useEffect(() => {
    const up = () => { painting.current = false; };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const cell = 26; // display px per tile

  function paintCell(x, y) {
    if (tool === "player") {
      onChange({ ...value, player: { ...value.player, tx: x, ty: y } });
      return;
    }
    if (tool.startsWith("npc:")) {
      const id = tool.slice(4);
      onChange({ ...value, npcs: { ...value.npcs, [id]: { ...value.npcs[id], tx: x, ty: y } } });
      return;
    }
    const layer = tool === "erase" ? "decor" : tool;      // ground | decor
    const tile = tool === "ground" ? groundTile : tool === "decor" ? decorTile : -1;
    const grid = value.map[layer].map((r) => r.slice());
    if (grid[y][x] === tile) return;                       // no-op → skip re-render churn
    grid[y][x] = tile;
    onChange({ ...value, map: { ...value.map, [layer]: grid } });
  }

  function resize(w, h) {
    w = Math.max(6, Math.min(24, w | 0));
    h = Math.max(6, Math.min(22, h | 0));
    const def = DEFAULT_GROUND[value.tileset] ?? 0;
    const ng = [], nd = [];
    for (let y = 0; y < h; y++) {
      ng.push([]); nd.push([]);
      for (let x = 0; x < w; x++) {
        ng[y].push(ground[y]?.[x] ?? def);
        nd[y].push(decor[y]?.[x] ?? -1);
      }
    }
    const clamp = (p) => ({ ...p, tx: Math.min(p.tx, w - 1), ty: Math.min(p.ty, h - 1) });
    const npcs = Object.fromEntries(Object.entries(value.npcs).map(([id, n]) => [id, clamp(n)]));
    onChange({ ...value, map: { width: w, height: h, ground: ng, decor: nd }, player: clamp(value.player), npcs });
  }

  const tabBtn = (active) =>
    "rounded-xl px-3 py-2 text-xs font-bold ring-1 transition " +
    (active ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50");
  const paletteBtn = (active) =>
    "relative grid place-items-center rounded-lg p-1 ring-2 transition " +
    (active ? "ring-brand-500 bg-brand-50" : "ring-transparent hover:ring-slate-200");

  return (
    <div className="space-y-3">
      {/* Toolbar: tileset + layer tools */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tileset</span>
        <select
          value={value.tileset}
          onChange={(e) => onChange({ ...value, tileset: e.target.value })}
          className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200"
        >
          <option value="town">Tiny Town</option>
          <option value="rogue">Roguelike (city)</option>
        </select>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <button type="button" onClick={() => setTool("ground")} className={tabBtn(tool === "ground")}>Ground</button>
        <button type="button" onClick={() => setTool("decor")} className={tabBtn(tool === "decor")}>Props</button>
        <button type="button" onClick={() => setTool("erase")} className={tabBtn(tool === "erase")}><Eraser className="inline h-3.5 w-3.5" /> Erase</button>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <button type="button" onClick={() => setTool("player")} className={tabBtn(tool === "player")}><MapPin className="inline h-3.5 w-3.5" /> Spawn</button>
      </div>

      {/* Palette for the active paint layer */}
      {(tool === "ground" || tool === "decor") && (
        <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200">
          {(tool === "ground" ? pal.ground : pal.decor).map((t) => {
            const active = (tool === "ground" ? groundTile : decorTile) === t.i;
            return (
              <button
                key={t.i}
                type="button"
                title={t.n}
                onClick={() => (tool === "ground" ? setGroundTile(t.i) : setDecorTile(t.i))}
                className={paletteBtn(active)}
              >
                <Sprite sheet={sheet} idx={t.i} scale={1.6} />
              </button>
            );
          })}
        </div>
      )}

      {/* The paintable grid */}
      <div className="overflow-auto rounded-2xl bg-slate-100 p-3 ring-1 ring-slate-200">
        <div
          style={{ display: "grid", gridTemplateColumns: `repeat(${width}, ${cell}px)`, width: width * cell, touchAction: "none", userSelect: "none" }}
          onPointerDown={() => { painting.current = true; }}
        >
          {Array.from({ length: height }).map((_, y) =>
            Array.from({ length: width }).map((__, x) => {
              const npcHere = Object.entries(value.npcs).find(([, n]) => n.tx === x && n.ty === y);
              const playerHere = value.player.tx === x && value.player.ty === y;
              return (
                <div
                  key={`${x},${y}`}
                  onPointerDown={() => paintCell(x, y)}
                  onPointerEnter={() => { if (painting.current) paintCell(x, y); }}
                  style={{ position: "relative", width: cell, height: cell, cursor: "crosshair", boxShadow: "inset 0 0 0 0.5px #0000000f" }}
                >
                  <Sprite sheet={sheet} idx={ground[y]?.[x] ?? 0} scale={cell / 16} style={{ position: "absolute", inset: 0 }} />
                  {decor[y]?.[x] >= 0 && <Sprite sheet={sheet} idx={decor[y][x]} scale={cell / 16} style={{ position: "absolute", inset: 0 }} />}
                  {playerHere && <Marker color="#2563eb" label="P" title="Player spawn" />}
                  {npcHere && <Sprite sheet={CHARS} idx={value.npcs[npcHere[0]].frame ?? 98} scale={cell / 16} style={{ position: "absolute", inset: 0 }} />}
                  {npcHere && <span style={{ position: "absolute", bottom: -1, right: -1, fontSize: 8, fontWeight: 800, color: "#fff", background: "#e11d48", borderRadius: 3, padding: "0 2px" }}>{npcHere[0][0].toUpperCase()}</span>}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Size */}
      <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
        <Move className="h-4 w-4 text-slate-400" />
        <label className="flex items-center gap-1">W
          <input type="number" min={6} max={24} value={width} onChange={(e) => resize(+e.target.value, height)} className="w-16 rounded-lg bg-slate-50 px-2 py-1 ring-1 ring-slate-200" />
        </label>
        <label className="flex items-center gap-1">H
          <input type="number" min={6} max={22} value={height} onChange={(e) => resize(width, +e.target.value)} className="w-16 rounded-lg bg-slate-50 px-2 py-1 ring-1 ring-slate-200" />
        </label>
        <span className="text-slate-400">Tap the grid to paint · drag to fill.</span>
      </div>

      {/* Characters: click "Place", then click the grid; pick sprite + voice */}
      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600"><User className="h-4 w-4 text-brand-500" /> Characters & spawn</div>
        <PlaceRow
          label="Player spawn" color="#2563eb"
          active={tool === "player"} onPlace={() => setTool("player")}
          pos={value.player}
        />
        {(npcList || []).map((npc) => {
          const n = value.npcs[npc.id] || {};
          return (
            <div key={npc.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-slate-200">
              <Sprite sheet={CHARS} idx={n.frame ?? npc.frame ?? 98} scale={1.4} />
              <span className="text-xs font-bold text-slate-700">{npc.name}</span>
              <span className="text-[10px] font-semibold text-slate-400">({n.tx ?? npc.tx}, {n.ty ?? npc.ty})</span>
              <button type="button" onClick={() => setTool(`npc:${npc.id}`)} className={tabBtn(tool === `npc:${npc.id}`) + " ml-auto"}>
                <MapPin className="inline h-3.5 w-3.5" /> Place
              </button>
              <select
                value={n.frame ?? npc.frame ?? 98}
                onChange={(e) => onChange({ ...value, npcs: { ...value.npcs, [npc.id]: { ...n, frame: +e.target.value } } })}
                className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200"
              >
                {NPC_FRAMES.map((f) => <option key={f.i} value={f.i}>{f.n}</option>)}
              </select>
              <select
                value={n.voice ?? npc.voice ?? "female"}
                onChange={(e) => onChange({ ...value, npcs: { ...value.npcs, [npc.id]: { ...n, voice: e.target.value } } })}
                className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200"
              >
                <option value="female">Female voice</option>
                <option value="male">Male voice</option>
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Marker({ color, label, title }) {
  return (
    <div title={title} style={{ position: "absolute", inset: 2, borderRadius: 5, background: color, color: "#fff", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", boxShadow: "0 1px 3px #0004" }}>
      {label}
    </div>
  );
}

function PlaceRow({ label, color, active, onPlace, pos }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-slate-200">
      <span style={{ width: 18, height: 18, borderRadius: 5, background: color }} />
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <span className="text-[10px] font-semibold text-slate-400">({pos.tx}, {pos.ty})</span>
      <button type="button" onClick={onPlace} className={
        "ml-auto rounded-xl px-3 py-2 text-xs font-bold ring-1 " + (active ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50")
      }>
        <MapPin className="inline h-3.5 w-3.5" /> Place
      </button>
    </div>
  );
}
