// src/adventures/adventureGame.js
// Builds the Phaser game for one adventure. Kept framework-free of React:
// the caller passes a live `controls` object (React writes movement/interact
// into it) and a `bridge` of callbacks (the scene calls back into React for
// "near an NPC" / "start dialogue" / "ready"). Phaser itself is passed in so it
// can stay a lazily-imported, code-split chunk.

const TILE = 16;
const SPEED = 92;          // px/s walking speed
const TALK_RANGE = 38;     // px distance to allow talking to an NPC (across a counter)

// Turn a packed 12-col sheet into per-frame texture coords by loading it as a
// spritesheet; frame index == the numbers we mapped in adventures.js.
export function buildAdventureGame(Phaser, { parent, adventure, controls, bridge }) {
  const TOWN_URL = '/adventures/kenney/tiny-town/Tilemap/tilemap_packed.png';
  const CHAR_URL = '/adventures/kenney/tiny-dungeon/Tilemap/tilemap_packed.png';

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
    }

    preload() {
      this.load.image('town', TOWN_URL);
      this.load.spritesheet('chars', CHAR_URL, { frameWidth: TILE, frameHeight: TILE });
    }

    create() {
      // ── Tile layers ──────────────────────────────────────────────────────
      const groundMap = this.make.tilemap({ data: map.ground, tileWidth: TILE, tileHeight: TILE });
      const groundTiles = groundMap.addTilesetImage('town');
      groundMap.createLayer(0, groundTiles, 0, 0);

      const decorMap = this.make.tilemap({ data: map.decor, tileWidth: TILE, tileHeight: TILE });
      const decorTiles = decorMap.addTilesetImage('town');
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
      cam.setZoom(zoomFor(this.scale.width, this.scale.height));
      cam.startFollow(player, true, 0.15, 0.15);
      cam.setRoundPixels(true);

      bridge.onReady && bridge.onReady();
    }

    update(time) {
      const p = this._player;
      if (!p) return;

      if (controls.paused) {
        p.setVelocity(0, 0);
        return;
      }

      // Movement — normalised so diagonals aren't faster.
      let dx = controls.dx || 0;
      let dy = controls.dy || 0;
      const len = Math.hypot(dx, dy) || 1;
      p.setVelocity((dx / len) * SPEED, (dy / len) * SPEED);
      const moving = dx !== 0 || dy !== 0;
      if (dx < 0) p.setFlipX(true);
      else if (dx > 0) p.setFlipX(false);

      // Fake a walk cycle: gentle vertical bob while moving.
      p.y += moving ? Math.sin(time / 70) * 0.35 : 0;

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
    if (s && s.cameras?.main) s.cameras.main.setZoom(zoomFor(nw, nh));
  });
  ro.observe(parent);
  game.events.once('destroy', () => ro.disconnect());

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
