// src/adventures/adventureGame.js
// Builds the Phaser game for one adventure. Kept framework-free of React:
// the caller passes a live `controls` object (React writes movement/interact
// into it) and a `bridge` of callbacks (the scene calls back into React for
// "near an NPC" / "start dialogue" / "ready"). Phaser itself is passed in so it
// can stay a lazily-imported, code-split chunk.

const TILE = 16;
const SPEED = 92;          // px/s walking speed
const TALK_RANGE = 38;     // px distance to allow talking to an NPC (across a counter)

// Breadth-first path on the tile grid (4-directional). Returns a list of
// [tx,ty] tiles to walk through (excluding the start), or null if unreachable.
function bfsPath(sx, sy, tx, ty, walkable) {
  if (sx === tx && sy === ty) return [];
  const key = (x, y) => `${x},${y}`;
  const prev = new Map([[key(sx, sy), null]]);
  const q = [[sx, sy]];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let head = 0, found = false;
  while (head < q.length) {
    const [x, y] = q[head++];
    if (x === tx && y === ty) { found = true; break; }
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || !walkable(nx, ny)) continue;
      prev.set(k, [x, y]); q.push([nx, ny]);
    }
  }
  if (!found) return null;
  const path = [];
  let cur = [tx, ty];
  while (cur) { path.push(cur); cur = prev.get(key(cur[0], cur[1])); }
  path.reverse(); path.shift();       // drop the tile we're standing on
  return path;
}

// Turn a packed 12-col sheet into per-frame texture coords by loading it as a
// spritesheet; frame index == the numbers we mapped in adventures.js.
export function buildAdventureGame(Phaser, { parent, adventure, controls, bridge }) {
  const CHAR_URL = '/adventures/kenney/tiny-dungeon/Tilemap/tilemap_packed.png';
  // Map tilesets. Tiny Town is a packed sheet (no spacing); the larger
  // Roguelike/RPG pack (grand buildings, fountains, market stalls…) has 1px
  // spacing between tiles, so it needs a different addTilesetImage call.
  const TILESETS = {
    town:  { url: '/adventures/kenney/tiny-town/Tilemap/tilemap_packed.png', spacing: 0 },
    rogue: { url: '/adventures/kenney/roguelike/roguelikeSheet.png',          spacing: 1 },
  };
  const TS = TILESETS[adventure.tileset] || TILESETS.town;

  const { map } = adventure;
  const worldW = map.width * TILE;
  const worldH = map.height * TILE;

  // "Cover" zoom: the world always fills the frame (no letterbox); the camera
  // follows the player through whatever doesn't fit. Clamped for pixel crispness.
  const zoomFor = (vw, vh) => Phaser.Math.Clamp(Math.max(vw / worldW, vh / worldH), 2, 6);

  // A proper Scene subclass — a plain-object scene does NOT get its update()
  // (nor the arcade world step) reliably wired, so the player never moves.
  class AdventureScene extends Phaser.Scene {
    constructor() {
      super('adventure');
      this._player = null;
      this._npcs = [];
      this._nearest = null;
      this._prevInteract = false;
      this._path = null;          // active tap-to-move path (list of [tx,ty])
      this._autoTalkNpc = null;   // NPC to greet when the path finishes
      this._baseZoom = 2;
      this._waypoint = null;
      this._waypointBaseY = 0;
      this._walkable = () => false;
    }

    preload() {
      this.load.image('mapts', TS.url);
      this.load.spritesheet('chars', CHAR_URL, { frameWidth: TILE, frameHeight: TILE });
    }

    create() {
      // ── Tile layers ──────────────────────────────────────────────────────
      const groundMap = this.make.tilemap({ data: map.ground, tileWidth: TILE, tileHeight: TILE });
      const groundTiles = groundMap.addTilesetImage('mapts', 'mapts', TILE, TILE, 0, TS.spacing);
      groundMap.createLayer(0, groundTiles, 0, 0);

      const decorMap = this.make.tilemap({ data: map.decor, tileWidth: TILE, tileHeight: TILE });
      const decorTiles = decorMap.addTilesetImage('mapts', 'mapts', TILE, TILE, 0, TS.spacing);
      const decorLayer = decorMap.createLayer(0, decorTiles, 0, 0);
      decorLayer.setCollisionByExclusion([-1]);     // every placed decor tile is solid

      this.physics.world.setBounds(0, 0, worldW, worldH);

      // ── NPCs (static bodies + a name label) ──────────────────────────────
      this._npcs = adventure.npcs.map((n) => {
        const sx = n.tx * TILE + TILE / 2;
        const sy = n.ty * TILE + TILE / 2;
        const spr = this.physics.add.staticSprite(sx, sy, 'chars', n.frame);
        spr.setData('npc', n);
        const label = this.add.text(sx, sy - 13, n.name, {
          fontFamily: 'sans-serif', fontSize: '7px', color: '#fff',
          backgroundColor: 'rgba(0,0,0,0.55)', padding: { x: 2, y: 1 },
        }).setOrigin(0.5, 1).setResolution(3);
        spr.setData('label', label);
        // little "!" bubble for not-yet-done NPCs
        const bubble = this.add.text(sx, sy - 20, '❕', { fontSize: '9px' }).setOrigin(0.5, 1).setResolution(3);
        spr.setData('bubble', bubble);
        return spr;
      });

      // ── Player ───────────────────────────────────────────────────────────
      const px = adventure.player.tx * TILE + TILE / 2;
      const py = adventure.player.ty * TILE + TILE / 2;
      const player = this.physics.add.sprite(px, py, 'chars', adventure.player.frame);
      player.setCollideWorldBounds(true);
      player.body.setSize(11, 11).setOffset(2.5, 4);   // tighter than the sprite
      this._player = player;
      this._baseY = 0;

      this.physics.add.collider(player, decorLayer);
      this._npcs.forEach((n) => this.physics.add.collider(player, n));

      // ── Camera ───────────────────────────────────────────────────────────
      const cam = this.cameras.main;
      cam.setBounds(0, 0, worldW, worldH);
      this._baseZoom = zoomFor(this.scale.width, this.scale.height);
      cam.setZoom(this._baseZoom);
      cam.startFollow(player, true, 0.15, 0.15);
      cam.setRoundPixels(true);

      // ── Life & guidance ──────────────────────────────────────────────────
      // Subtle "breathing" so NPCs don't read as cardboard cut-outs.
      this._npcs.forEach((spr, i) => {
        this.tweens.add({ targets: spr, scaleY: 1.06, duration: 1300 + i * 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      });

      // Bouncing beacon over the current objective NPC (React sets which one).
      this._waypoint = this.add.text(0, 0, '▼', { fontFamily: 'sans-serif', fontSize: '13px', color: '#FF7A1A', fontStyle: 'bold' })
        .setOrigin(0.5, 1).setResolution(3).setDepth(60).setVisible(false);

      // A tile is walkable if it has no solid decor and no NPC standing on it.
      const npcTiles = new Set(adventure.npcs.map((n) => `${n.tx},${n.ty}`));
      this._walkable = (x, y) =>
        x >= 0 && y >= 0 && x < map.width && y < map.height &&
        map.decor[y][x] === -1 && !npcTiles.has(`${x},${y}`);

      // Tap-to-move: walk to the tapped tile (or up to a tapped NPC, then greet).
      this.input.on('pointerdown', (pointer) => {
        if (controls.paused) return;
        this._moveTo(Math.floor(pointer.worldX / TILE), Math.floor(pointer.worldY / TILE));
      });

      bridge.onReady && bridge.onReady();
    }

    _moveTo(tx, ty) {
      const p = this._player;
      const sx = Math.floor(p.x / TILE), sy = Math.floor(p.y / TILE);
      const tappedNpc = this._npcs.find((s) => {
        const n = s.getData('npc'); return n && n.tx === tx && n.ty === ty;
      });
      let gx = tx, gy = ty;
      if (!this._walkable(tx, ty)) {
        // Aim for the walkable neighbour nearest the player (e.g. beside an NPC).
        let best = null, bestD = Infinity;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = tx + dx, ny = ty + dy;
          if (!this._walkable(nx, ny)) continue;
          const d = Math.abs(nx - sx) + Math.abs(ny - sy);
          if (d < bestD) { bestD = d; best = [nx, ny]; }
        }
        if (!best) return;
        [gx, gy] = best;
      }
      const path = bfsPath(sx, sy, gx, gy, this._walkable);
      if (!path) return;
      this._path = path;
      this._autoTalkNpc = tappedNpc ? tappedNpc.getData('npc') : null;
    }

    _onArrive() {
      if (!this._autoTalkNpc) return;
      const npc = this._autoTalkNpc; this._autoTalkNpc = null;
      const spr = this._npcs.find((s) => s.getData('npc')?.id === npc.id);
      if (spr && Phaser.Math.Distance.Between(this._player.x, this._player.y, spr.x, spr.y) < TALK_RANGE + 8) {
        bridge.onInteract && bridge.onInteract(npc);
      }
    }

    update(time) {
      const p = this._player;
      if (!p) return;

      // Bob the objective beacon.
      if (this._waypoint && this._waypoint.visible) {
        this._waypoint.y = this._waypointBaseY + Math.sin(time / 200) * 3;
      }

      if (controls.paused) {
        p.setVelocity(0, 0);
        return;
      }

      // Manual input (D-pad / keys) always wins and cancels any tap-to-move.
      const manual = (controls.dx || 0) !== 0 || (controls.dy || 0) !== 0;
      if (manual) this._path = null;

      let moving = false, faceDx = 0;
      if (manual) {
        const dx = controls.dx || 0, dy = controls.dy || 0;
        const len = Math.hypot(dx, dy) || 1;
        p.setVelocity((dx / len) * SPEED, (dy / len) * SPEED);
        moving = true; faceDx = dx;
      } else if (this._path && this._path.length) {
        const [ntx, nty] = this._path[0];
        const wx = ntx * TILE + TILE / 2, wy = nty * TILE + TILE / 2;
        const dx = wx - p.x, dy = wy - p.y, dist = Math.hypot(dx, dy);
        if (dist < 2) {
          this._path.shift();
          if (!this._path.length) { p.setVelocity(0, 0); this._onArrive(); }
        } else {
          p.setVelocity((dx / dist) * SPEED, (dy / dist) * SPEED);
          moving = true; faceDx = dx;
        }
      } else {
        p.setVelocity(0, 0);
      }
      if (faceDx < -0.5) p.setFlipX(true);
      else if (faceDx > 0.5) p.setFlipX(false);
      if (moving) p.y += Math.sin(time / 70) * 0.3;   // gentle walk bob

      // Nearest talkable NPC.
      let best = null, bestD = Infinity;
      for (const n of this._npcs) {
        const d = Phaser.Math.Distance.Between(p.x, p.y, n.x, n.y);
        if (d < TALK_RANGE && d < bestD) { best = n; bestD = d; }
      }
      const nearNpc = best ? best.getData('npc') : null;
      if (nearNpc !== this._nearest) {
        this._nearest = nearNpc;
        bridge.onNear && bridge.onNear(nearNpc);
      }

      // Interact edge-trigger (space / dpad talk button).
      if (controls.interact && !this._prevInteract && nearNpc) {
        bridge.onInteract && bridge.onInteract(nearNpc);
      }
      this._prevInteract = controls.interact;
    }
  }

  const w = parent.clientWidth || window.innerWidth || 360;
  const h = parent.clientHeight || window.innerHeight || 540;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: w,
    height: h,
    pixelArt: true,
    backgroundColor: '#6b8f3a',
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: AdventureScene,
  });

  // Keep the canvas matched to its container. RESIZE mode only re-measures on
  // window resize (never on element layout changes), which can boot at 0×0 and
  // never recover; a ResizeObserver on the parent is deterministic.
  const ro = new ResizeObserver(() => {
    const nw = parent.clientWidth, nh = parent.clientHeight;
    if (!nw || !nh) return;
    game.scale.resize(nw, nh);
    const s = game.scene.getScene('adventure');
    if (s && s.cameras?.main) {
      s._baseZoom = zoomFor(nw, nh);
      if (!s._focused) s.cameras.main.setZoom(s._baseZoom);
    }
  });
  ro.observe(parent);
  game.events.once('destroy', () => ro.disconnect());

  // Point the objective beacon at an NPC (or hide it with null).
  game.setWaypoint = (npcId) => {
    const s = game.scene.getScene('adventure');
    if (!s || !s._waypoint) return;
    const spr = npcId && (s._npcs || []).find((x) => x.getData('npc')?.id === npcId);
    if (!spr) { s._waypoint.setVisible(false); return; }
    s._waypointBaseY = spr.y - 24;
    s._waypoint.setPosition(spr.x, s._waypointBaseY).setVisible(true);
  };

  // Cinematic framing: zoom to an NPC when a conversation opens, restore after.
  game.focusNpc = (npcId) => {
    const s = game.scene.getScene('adventure');
    if (!s) return;
    const spr = (s._npcs || []).find((x) => x.getData('npc')?.id === npcId);
    if (!spr) return;
    const cam = s.cameras.main;
    s._focused = true;
    cam.stopFollow();
    // Pan below the NPC so it sits in the upper frame, above the dialogue sheet.
    cam.pan(spr.x, spr.y + 28, 350, 'Sine.easeInOut');
    cam.zoomTo(s._baseZoom * 1.3, 350, 'Sine.easeInOut');
  };
  game.unfocus = () => {
    const s = game.scene.getScene('adventure');
    if (!s) return;
    const cam = s.cameras.main;
    s._focused = false;
    cam.zoomTo(s._baseZoom, 300, 'Sine.easeInOut');
    cam.pan(s._player.x, s._player.y, 300, 'Sine.easeInOut', false, (c, prog) => {
      if (prog === 1) cam.startFollow(s._player, true, 0.15, 0.15);
    });
  };

  // Let React mark an NPC's quest done (drops the "!" and greys future talks).
  game.markNpcDone = (npcId) => {
    const s = game.scene.getScene('adventure');
    if (!s) return;
    for (const spr of s._npcs || []) {
      if (spr.getData('npc')?.id === npcId) {
        const b = spr.getData('bubble');
        if (b) b.setText('✓').setColor && b.setColor('#22c55e');
        spr.setTint(0xffffff);
      }
    }
  };

  return game;
}
