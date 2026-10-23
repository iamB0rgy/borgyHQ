import * as T from "./vendor/three.module.min.js";

const DEG = Math.PI / 180;
const ORANGE = 0xF26A1B;
const SCREEN = {working:0x6FE3A8, waiting:0xFFB44D, done:0xF3F0EC, idle:0x3A3A3F, reading:0xF3F0EC};
const LABEL = {working:"Working", waiting:"Needs you", done:"Done", idle:"Idle"};
const LOOKS = {
  ceo:     {skin:0xE8B692, hair:0x1E1612, shirt:0x24262E, woman:false},
  pulse:   {skin:0xF1C4A6, hair:0x2B1A12, shirt:0xF26A1B, woman:true},
  forge:   {skin:0xD79B74, hair:0x4A2E1D, shirt:0x1F9E97, woman:false},
  radar:   {skin:0xB87B58, hair:0x15110F, shirt:0x7A5BB5, woman:false},
  shelf:   {skin:0xF5D1B8, hair:0x9A4A22, shirt:0x3E9B5B, woman:true},
  pitch:   {skin:0xE9B88F, hair:0xC9A063, shirt:0x8A8E96, woman:false}
};
const SPARE_LOOKS = Object.values(LOOKS).slice(1);
export const HOODIES = [0x5B6CF9, 0xE0557A, 0x2BB3A3, 0xF0A030, 0x8E6BD6, 0x3CA55C, 0xD9623B, 0x4A90D9];
const SKINS = [0xE8B692, 0xD79B74, 0xF5D1B8, 0xB87B58, 0xF1C4A6, 0xE9B88F];
const HAIRS = [0x1E1612, 0x4A2E1D, 0x9A4A22, 0x15110F, 0xC9A063, 0x2B1A12];
export function hoodieIndex(name){
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % HOODIES.length;
}
const DEFAULT_DESKS = {ceo:[-10.8, -6.0, 180]};
const FLOOR = {x0:-13, x1:17, z0:-8, z1:20.2};
const SZ = 10.6;
const CHATTY = {chat:"corridor", pool:"rec room", darts:"rec room", coffee:"pantry", snack:"pantry", lounge:"lounge", gym:"gym", meeting:"meeting room"};
const LANE = {A:-3.8, B:1.4, C:6.6, D:11.8, E:17.0};
const CROSS = [-12.4, 0, 12.4];
const ROWS = [[-3.2, LANE.A], [2.0, LANE.B], [7.2, LANE.C], [12.4, LANE.D]];
const COLS = [-11.8, -8.07, -4.33, -0.6, 0.6, 4.33, 8.07, 11.8];
const CELLS = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7]].map(([a, b]) => [COLS[a], COLS[b]]);
const ROOM_D = 4.0, MAX_ROOMS = 6 * ROWS.length, MAX_DESKS = 6, WALK = 1.35, STAND_Y = 0.85, VIEW_H = 24;
const RESEARCH_TOOLS = new Set(["WebSearch", "WebFetch"]);
const ACTS = {
  desk:     {w:3, dur:[20, 50], say:["Waiting for the next task", "Tidying up"]},
  coffee:   {w:2, dur:[12, 30], say:["Coffee?", "Need caffeine", "Espresso time", "One more cup"]},
  snack:    {w:1, dur:[10, 25], say:["Snack break", "Anyone want a biscuit?"]},
  water:    {w:1, dur:[8, 20], say:["Hydrating", "Water break"]},
  printer:  {w:1, dur:[10, 25], say:["Printing…", "Paper jam again?", "Who left this here?"]},
  phone:    {w:1, dur:[15, 40], say:["On a call", "Quick call", "Calling back"]},
  meeting:  {w:1, dur:[25, 55], say:["Quick sync", "Stand-up", "Let's align on this"]},
  lounge:   {w:2, dur:[20, 45], say:["Taking five", "Stretching my legs"]},
  research: {w:1, dur:[20, 45], say:["Searching the internet", "Reading up on this", "Checking the docs"]},
  reception:{w:0.5, dur:[8, 20], say:["Any mail for me?", "Visitor coming?"]},
  restroom: {w:1, dur:[15, 30], say:["Back in five"]},
  pool:     {w:2, dur:[25, 50], say:["Rack 'em", "Best of three?", "Corner pocket", "Nice shot"]},
  darts:    {w:1.5, dur:[15, 35], say:["Bullseye!", "Just warming up", "Double top", "Triple 20", "One eighty!"]},
  gym:      {w:1.5, dur:[25, 50], say:["Leg day", "Just a quick 5K", "Stretching first", "Protein later?", "Mind over matter"]},
  chat:     {w:1.5, dur:[15, 35], say:["Did you see the PR?", "Lunch?", "How's it going?", "Almost done", "Deploy went fine", "The boss approved it"]}
};
const WAIT_SAY = ["Need an answer from the boss", "Waiting for a decision", "Quick question for the CEO"];

const mats = new Map();
function M(hex, opts = {}){
  const key = hex + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new T.MeshStandardMaterial({color:hex, roughness:0.85, metalness:0, ...opts}));
  return mats.get(key);
}
const GLASS = new T.MeshStandardMaterial({color:0xBFE3F5, roughness:0.1, transparent:true, opacity:0.22, depthWrite:false, side:T.DoubleSide});
const WHITE = M(0xF7F4F0), WALL = M(0xF4EFE9), FRAME = M(0x2B2B2F), DARK = M(0x1E1E22), WOODL = M(0xE3C79F), STEM = M(0x6B4A2B),
  LEAF = M(0x3F9A4D, {roughness:0.7}), LEAF2 = M(0x2E7D3A, {roughness:0.7}), POT = M(0xD8CFC4), ORG = M(ORANGE, {roughness:0.6}),
  RUG = M(0xE9D6C3, {roughness:1}), SOFA = M(0xE87B2F, {roughness:0.95}), STEEL = M(0xB8BCC2, {roughness:0.35, metalness:0.6}),
  LIGHT = M(0xEDEDED), CARPET = M(0xD9D4CC), BOARD = M(0x24262E), CUP = M(0xFFFFFF), CORK = M(0xC9A06B, {roughness:1}),
  PODRUG = M(0xEFE3D6, {roughness:1}), TEAL = M(0x1F9E97, {roughness:0.9}), LANES = M(0xD2CBC2, {roughness:1}),
  LED = new T.MeshStandardMaterial({color:0x113322, emissive:0x3CFF7A, emissiveIntensity:1.4}),
  PINS = [M(0xE0557A), M(0x2BB3A3), M(0xF0A030), M(0x5B6CF9)],
  BOOKS = [M(0x2E6FD8), M(0xC2410C), M(0x1FA463), M(0x7A5BB5), M(0xF0C419), M(0x171412)];

function canvasTex(w, h, draw){
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function woodTexture(){
  const t = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#C99A6B"; g.fillRect(0, 0, w, h);
    const rows = 8, ph = h / rows;
    for (let r = 0; r < rows; r++){
      let x = -((r * 173) % 200);
      while (x < w){
        const len = 180 + ((r * 37 + x) % 140), tone = 190 + ((r * 53 + x * 7) % 40);
        g.fillStyle = `rgb(${tone + 10},${tone - 50},${tone - 95})`;
        g.fillRect(x + 2, r * ph + 2, len - 4, ph - 4);
        g.strokeStyle = "rgba(90,50,20,.18)"; g.lineWidth = 1;
        for (let k = 0; k < 3; k++){ g.beginPath(); g.moveTo(x + 6, r * ph + 8 + k * 18); g.lineTo(x + len - 6, r * ph + 10 + k * 18); g.stroke(); }
        x += len;
      }
    }
  });
  t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(6.5, 4.1);
  return t;
}
const FONT = "'Avenir Next Condensed','Arial Narrow','Helvetica Neue',sans-serif";
const BODY = "-apple-system,'SF Pro Text',system-ui,'Segoe UI','Helvetica Neue',sans-serif";
function textTexture(text, w, h, px, color, glow){
  return canvasTex(w, h, g => {
    g.font = `800 ${px}px ${FONT}`;
    g.textAlign = "center"; g.textBaseline = "middle";
    if (glow){ g.shadowColor = color; g.shadowBlur = glow; }
    g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 4);
    if (glow){ g.shadowBlur = 0; g.globalAlpha = 0.55; g.fillStyle = "#FFF2E6"; g.fillText(text, w / 2, h / 2 + 4); }
  });
}
function signTexture(name){
  const text = String(name).toUpperCase();
  return canvasTex(512, 192, (g, w, h) => {
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#F26A1B"; g.fillRect(0, h - 18, w, 18);
    g.font = `800 ${Math.min(104, 1040 / Math.max(4, text.length))}px ${FONT}`;
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#171412";
    g.fillText(text, w / 2, h / 2 - 4);
  });
}
function badgeTexture(n){
  return canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#F26A1B"; g.beginPath(); g.arc(w / 2, h / 2, 60, 0, Math.PI * 2); g.fill();
    g.font = `800 ${n > 99 ? 56 : 68}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#FFFFFF";
    g.fillText(String(n), w / 2, h / 2 + 4);
  });
}
function blurred(tex, px){
  const src = tex.image, c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  const g = c.getContext("2d"); g.filter = `blur(${px}px)`; g.drawImage(src, 0, 0);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
function linesTexture(){
  const t = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = "#6E6E6E"; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 12){ g.fillStyle = `rgba(255,255,255,${0.4 + (y % 36) / 60})`; g.fillRect(6, y, 10 + (y * 7) % 36, 3); }
  });
  t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}
function spriteTexture(){
  return canvasTex(64, 64, g => {
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    r.addColorStop(0, "rgba(255,255,255,.9)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  });
}
function wrapText(g, text, maxW, maxLines){
  const words = text.split(/\s+/), lines = [];
  let cur = "";
  for (const w of words){
    const test = cur ? cur + " " + w : w;
    if (g.measureText(test).width > maxW && cur){ lines.push(cur); cur = w; } else cur = test;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
  return lines;
}

class Bubble {
  constructor(text, border, grey, t, persist){
    this.text = text.length > (persist ? 200 : 90) ? text.slice(0, (persist ? 200 : 90) - 1).trimEnd() + "…" : text;
    this.border = border; this.grey = grey; this.t0 = t; this.shown = -1; this.persist = persist;
    this.canvas = document.createElement("canvas"); this.canvas.width = 512; this.canvas.height = 256;
    this.tex = new T.CanvasTexture(this.canvas); this.tex.colorSpace = T.SRGBColorSpace; this.tex.anisotropy = 4;
    this.sprite = new T.Sprite(new T.SpriteMaterial({map:this.tex, transparent:true, depthWrite:false, depthTest:false, toneMapped:false}));
    this.sprite.scale.set(2.8, 1.4, 1); this.sprite.renderOrder = 10; this.sprite.center.set(0.5, 0);
  }
  draw(n){
    const g = this.canvas.getContext("2d"), w = 512, h = 256;
    g.clearRect(0, 0, w, h);
    g.lineWidth = 9; g.strokeStyle = this.grey ? "#B9B0AA" : this.border; g.fillStyle = this.grey ? "#ECE8E3" : "#FFFFFF";
    g.beginPath(); g.roundRect(14, 14, w - 28, 182, 30); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(w / 2 - 26, 192); g.lineTo(w / 2, 240); g.lineTo(w / 2 + 26, 192); g.closePath(); g.fill();
    g.strokeStyle = this.grey ? "#B9B0AA" : this.border; g.beginPath(); g.moveTo(w / 2 - 26, 194); g.lineTo(w / 2, 240); g.lineTo(w / 2 + 26, 194); g.stroke();
    g.fillStyle = this.grey ? "#ECE8E3" : "#FFFFFF"; g.fillRect(w / 2 - 24, 184, 48, 12);
    g.font = `${this.grey ? 500 : 600} 34px ${BODY}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = this.grey ? "#5A524D" : "#171412";
    g.font = `${this.grey ? 500 : 600} ${this.persist ? 26 : 34}px ${BODY}`;
    const lines = wrapText(g, this.text.slice(0, n), w - 90, this.persist ? 5 : 3), lh = this.persist ? 32 : 42, y0 = 105 - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => g.fillText(l, w / 2, y0 + i * lh));
    this.tex.needsUpdate = true;
  }
  update(t){
    const age = t - this.t0, n = Math.min(this.text.length, Math.ceil(age / 1.5 * this.text.length));
    if (n !== this.shown){ this.shown = n; this.draw(n); }
    const life = this.persist ? Infinity : 8 + Math.min(4, this.text.length / 25);
    this.sprite.material.opacity = Math.max(0, Math.min(1, age * 4, (life + 0.7 - age) / 0.7));
    return age < life + 0.7;
  }
  dispose(){ this.sprite.removeFromParent(); this.tex.dispose(); this.sprite.material.dispose(); }
}

class Builder {
  constructor(){ this.parts = new Map(); }
  add(geo, mat, x = 0, y = 0, z = 0, ry = 0, parent){
    const m = new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(1, 1, 1));
    if (parent) m.premultiply(parent);
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(m);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return this;
  }
  box(w, h, d, mat, x, y, z, ry = 0, parent){ return this.add(new T.BoxGeometry(w, h, d), mat, x, y, z, ry, parent); }
  cyl(rt, rb, h, mat, x, y, z, seg = 16, parent){ return this.add(new T.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, 0, parent); }
  sphere(r, mat, x, y, z, parent){ return this.add(new T.SphereGeometry(r, 14, 10), mat, x, y, z, 0, parent); }
  build(parent){
    for (const [mat, geos] of this.parts){
      const n = geos.reduce((s, g) => s + g.attributes.position.count, 0);
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      let o = 0;
      for (const g of geos){
        pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
        o += g.attributes.position.count;
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(pos, 3));
      g.setAttribute("normal", new T.BufferAttribute(nor, 3));
      g.setAttribute("uv", new T.BufferAttribute(uv, 2));
      const mesh = new T.Mesh(g, mat);
      mesh.castShadow = !mat.transparent; mesh.receiveShadow = true;
      parent.add(mesh);
    }
    this.parts.clear();
  }
}

function wallWithWindows(b, len, height, thick, windows, place, ry){
  let x = 0;
  for (const [s, e, sill, top] of windows){
    if (s > x) b.box(s - x, height, thick, WALL, ...place(x + (s - x) / 2, height / 2), ry);
    const w = e - s, mid = s + w / 2, cy = (sill + top) / 2;
    if (sill > 0) b.box(w, sill, thick, WALL, ...place(mid, sill / 2), ry);
    b.box(w, height - top, thick, WALL, ...place(mid, top + (height - top) / 2), ry);
    b.box(w + 0.1, 0.06, thick + 0.05, WHITE, ...place(mid, sill + 0.03), ry);
    b.box(w + 0.1, 0.06, thick + 0.05, WHITE, ...place(mid, top - 0.03), ry);
    b.box(0.06, top - sill, thick + 0.05, WHITE, ...place(s + 0.03, cy), ry);
    b.box(0.06, top - sill, thick + 0.05, WHITE, ...place(e - 0.03, cy), ry);
    b.box(0.05, top - sill, thick + 0.05, WHITE, ...place(mid, cy), ry);
    b.box(w, top - sill, 0.02, GLASS, ...place(mid, cy), ry);
    x = e;
  }
  if (x < len) b.box(len - x, height, thick, WALL, ...place(x + (len - x) / 2, height / 2), ry);
}
function glassWall(b, ax, from, to, at, h, gap){
  const slab = (s, e, mat, y, hgt, thick) => { const len = e - s, m = (s + e) / 2; if (ax === "x") b.box(len, hgt, thick, mat, m, y, at); else b.box(thick, hgt, len, mat, at, y, m); };
  const post = m => ax === "x" ? b.box(0.08, h, 0.08, FRAME, m, h / 2, at) : b.box(0.08, h, 0.08, FRAME, at, h / 2, m);
  const segs = gap ? [[from, gap[0]], [gap[1], to]] : [[from, to]];
  for (const [s, e] of segs){
    if (e - s < 0.05) continue;
    slab(s, e, GLASS, h / 2, h, 0.04); slab(s, e, FRAME, h - 0.04, 0.08, 0.08); slab(s, e, FRAME, 0.04, 0.08, 0.08); post(s); post(e);
  }
  if (gap) slab(gap[0], gap[1], FRAME, h - 0.04, 0.08, 0.08);
}
function plant(b, parent, sway, x, z, size = 1, tall = false){
  b.cyl(0.14 * size, 0.11 * size, 0.26 * size, POT, x, 0.13 * size, z, 12, parent.matrixWorld);
  const g = new T.Group(); g.position.set(x, 0, z); parent.add(g); sway.push(g);
  const lb = new Builder();
  let blobs;
  if (tall){
    lb.cyl(0.02, 0.025, 0.9 * size, STEM, 0, 0.71 * size, 0, 6);
    blobs = [[0, 0.95, 0, 0.28], [0.18, 0.78, 0.1, 0.2], [-0.16, 0.86, -0.1, 0.22], [0.05, 0.7, -0.18, 0.18], [-0.08, 1.1, 0.12, 0.17]];
  } else blobs = [[0, 0.36, 0, 0.13], [0.09, 0.32, 0.06, 0.1], [-0.08, 0.33, -0.05, 0.1], [0.02, 0.3, -0.1, 0.08]];
  blobs.forEach(([dx, dy, dz, r], i) => lb.sphere(r * size, i % 2 ? LEAF2 : LEAF, dx * size, dy * size, dz * size));
  lb.build(g);
}
function chair(b, x, z, ry, mat = ORG){
  b.box(0.46, 0.08, 0.46, mat, x, 0.42, z, ry);
  b.box(0.44, 0.5, 0.06, mat, x + Math.sin(ry) * 0.23, 0.72, z + Math.cos(ry) * 0.23, ry);
  b.cyl(0.03, 0.03, 0.38, STEEL, x, 0.19, z, 8); b.cyl(0.2, 0.2, 0.02, FRAME, x, 0.02, z, 12);
}
function shelfUnit(b, x, z, ry = 0){
  const m = new T.Matrix4().makeRotationY(ry).setPosition(x, 0, z);
  b.box(1.4, 1.5, 0.36, WHITE, 0, 0.75, 0, 0, m);
  b.box(1.32, 1.4, 0.3, M(0xFBF3EE), 0, 0.77, 0.03, 0, m);
  for (let i = 0; i < 3; i++) b.box(1.32, 0.03, 0.34, WOODL, 0, 0.42 + i * 0.44, 0.01, 0, m);
  for (let i = 0; i < 18; i++){
    const w = 0.07 + (i % 3) * 0.02, h = 0.22 + (i % 4) * 0.03, row = Math.floor(i / 6);
    b.box(w, h, 0.26, BOOKS[(i + row) % BOOKS.length], -0.55 + (i % 6) * 0.2 + row * 0.03, 0.435 + row * 0.44 + h / 2, 0.03, 0, m);
  }
}
function spot(o){ return {cap:1, users:new Set(), seat:false, sitY:0.5, hide:false, rot:0, ...o}; }
function route(a, b){
  if (Math.abs(a[1] - b[1]) < 1e-6) return [b];
  let best = CROSS[0], cost = Infinity;
  for (const s of CROSS){ const c = Math.abs(a[0] - s) + Math.abs(b[0] - s); if (c < cost){ cost = c; best = s; } }
  return [[best, a[1]], [best, b[1]], b];
}
const ENTRANCE = spot({act:"entrance", at:[-3.4, -7.6], rot:180, door:[-3.4, LANE.A], inside:[[-3.4, -5.2], [-3.4, -7.6]], cap:99});

function buildShell(scene){
  const groups = {};
  const floor = new T.Mesh(new T.BoxGeometry(FLOOR.x1 - FLOOR.x0, 0.12, FLOOR.z1 - FLOOR.z0), new T.MeshStandardMaterial({map:woodTexture(), roughness:0.8}));
  floor.position.set((FLOOR.x0 + FLOOR.x1) / 2, -0.06, (FLOOR.z0 + FLOOR.z1) / 2); floor.receiveShadow = true; scene.add(floor);
  const b = new Builder();
  b.box(FLOOR.x1 - FLOOR.x0 + 0.4, 0.1, FLOOR.z1 - FLOOR.z0 + 0.4, M(0xE5D6C8), 0, -0.12, 0.25);
  for (const z of Object.values(LANE)) b.box(z === LANE.A ? 30 : 26, 0.008, 1.0, LANES, z === LANE.A ? 2 : 0, 0.004, z);
  for (const x of CROSS) b.box(1.0, 0.008, LANE.E - LANE.A, LANES, x, 0.004, (LANE.A + LANE.E) / 2);
  b.build(scene);
  const depth = FLOOR.z1 - FLOOR.z0, side = [[1, 2.8, 0.9, 2.5], [5.5, 8, 0.9, 2.5], [9.5, 12.5, 0.9, 2.5], [13.5, 15.5, 0.9, 2.5], [18.5, 21.5, 0.9, 2.5], [23.5, 26.5, 0.9, 2.5]];
  const walls = {
    n:[30, [[0.6, 3.4, 0.9, 2.5], [5.2, 7.6, 0.9, 2.5], [9.0, 10.2, 0, 2.3], [14.0, 16.6, 0.9, 2.5], [18.4, 21.4, 0.9, 2.5], [24.4, 25.6, 1.4, 2.5], [27.0, 29.2, 0.9, 2.5]], (x, y) => [FLOOR.x0 + x, y, FLOOR.z0 - 0.075], 0],
    s:[30, [[1, 4.2, 1.6, 2.6], [8.5, 11.5, 0.9, 2.5], [14.5, 17.5, 0.9, 2.5], [20.6, 22.6, 1.6, 2.6], [27.0, 29.2, 0.9, 2.5]], (x, y) => [FLOOR.x0 + x, y, FLOOR.z1 + 0.075], 0],
    w:[depth, side, (z, y) => [FLOOR.x0 - 0.075, y, FLOOR.z0 + z], Math.PI / 2],
    e:[depth, side, (z, y) => [FLOOR.x1 + 0.075, y, FLOOR.z0 + z], Math.PI / 2]
  };
  for (const [k, [len, win, place, ry]] of Object.entries(walls)){
    const g = new T.Group(); scene.add(g); groups[k] = g;
    const wb = new Builder();
    wallWithWindows(wb, len, 3, 0.15, win, place, ry);
    if (k === "n" || k === "s") wb.box(len, 0.12, 0.05, WHITE, (FLOOR.x0 + FLOOR.x1) / 2, 0.06, place(0, 0)[2] + (k === "n" ? 0.1 : -0.1));
    else wb.box(0.05, 0.12, len, WHITE, place(0, 0)[0] + (k === "w" ? 0.1 : -0.1), 0.06, (FLOOR.z0 + FLOOR.z1) / 2);
    wb.build(g);
  }
  return groups;
}

function buildCommon(scene, sway, north){
  const b = new Builder(), spots = [], dyn = {};
  const zA = FLOOR.z0, zS = -4.4;
  b.box(4.3, 0.01, 3.5, CARPET, -10.8, 0.005, -6.2);
  glassWall(b, "z", zA, zS, -8.6, 2.6);
  glassWall(b, "x", FLOOR.x0, -8.6, zS, 2.6, [-11.3, -10.3]);
  shelfUnit(b, -12.65, -6.3, Math.PI / 2);
  plant(b, scene, sway, -9.1, -7.5, 1.2, true);
  [[-11.5, -4.95], [-10.8, -4.95], [-10.1, -4.95]].forEach(([x, z]) => spots.push(spot({act:"wait", at:[x, z], rot:0, door:[-10.8, LANE.A], inside:[[-10.8, -4.75], [x, z]]})));
  spots.push(spot({act:"wait", at:[-11.9, -5.4], rot:270, door:[-10.8, LANE.A], inside:[[-10.8, -4.75], [-11.9, -4.75], [-11.9, -5.4]]}));
  [[-10.3, -3.95], [-11.3, -3.95], [-10.8, -3.35]].forEach(([x, z]) => spots.push(spot({act:"wait", at:[x, z], rot:0, door:[x, LANE.A], inside:[[x, z]]})));

  b.box(4.3, 0.01, 3.5, CARPET, -6.4, 0.005, -6.2);
  glassWall(b, "z", zA, zS, -4.2, 2.6);
  glassWall(b, "x", -8.6, -4.2, zS, 2.6, [-6.9, -5.9]);
  b.box(2.2, 0.06, 1.0, WOODL, -6.4, 0.74, -6.2); b.box(2.0, 0.68, 0.8, WHITE, -6.4, 0.37, -6.2);
  b.box(1.9, 1.0, 0.04, WHITE, -6.4, 1.65, zA + 0.1); b.box(1.95, 1.05, 0.03, FRAME, -6.4, 1.65, zA + 0.085);
  [[-7.1, -6.95, Math.PI], [-6.4, -6.95, Math.PI], [-5.7, -6.95, Math.PI], [-7.1, -5.45, 0], [-6.4, -5.45, 0], [-5.7, -5.45, 0]].forEach(([x, z, ry]) => {
    chair(b, x, z, ry, FRAME);
    const north = ry > 1, side = x < -6.4 ? -8.1 : -4.7;
    spots.push(spot({act:"meeting", at:[x, z], rot:north ? 180 : 0, seat:true, door:[-6.4, LANE.A],
      inside:north ? [[-6.4, -5.0], [side, -5.0], [side, z], [x, z]] : [[-6.4, -5.0], [x, -5.0], [x, z]]}));
  });

  b.box(2.4, 1.05, 0.6, WHITE, -1.9, 0.52, -6.5); b.box(2.5, 0.05, 0.7, WOODL, -1.9, 1.07, -6.5); b.box(2.4, 0.3, 0.02, ORG, -1.9, 0.9, -6.19);
  b.box(0.4, 0.26, 0.03, FRAME, -1.4, 1.3, -6.6); b.cyl(0.02, 0.02, 0.1, FRAME, -1.4, 1.12, -6.6, 8);
  b.box(1.8, 0.7, 0.06, BOARD, -1.9, 1.75, zA + 0.08);
  const logo = new T.Mesh(new T.PlaneGeometry(1.6, 0.55), new T.MeshBasicMaterial({transparent:true}));
  logo.position.set(-1.9, 1.75, zA + 0.12); north.add(logo); dyn.logo = logo;
  b.box(2.6, 0.015, 1.6, RUG, -1.9, 0.008, -5.4);
  spots.push(spot({act:"reception", at:[-1.9, -5.7], rot:0, door:[-1.9, LANE.A], inside:[[-1.9, -5.0], [-1.9, -5.7]]}));
  plant(b, scene, sway, -0.4, -7.5, 1.1, true); plant(b, scene, sway, -4.0, -5.0, 0.9, true);

  b.box(4.0, 0.9, 0.7, WHITE, 2.6, 0.45, -7.65); b.box(4.1, 0.06, 0.8, WOODL, 2.6, 0.93, -7.65);
  b.box(0.42, 0.42, 0.36, DARK, 1.4, 1.17, -7.6); b.box(0.3, 0.1, 0.3, STEEL, 1.4, 1.0, -7.6); b.box(0.18, 0.08, 0.06, LIGHT, 1.4, 1.0, -7.4);
  [[2.3, -7.6], [2.55, -7.5], [2.8, -7.65], [3.1, -7.55]].forEach(([x, z]) => b.cyl(0.06, 0.05, 0.1, CUP, x, 1.01, z, 10));
  b.box(0.8, 0.22, 0.3, LIGHT, 3.7, 1.07, -7.65);
  b.box(0.75, 1.9, 0.75, STEEL, 4.35, 0.95, -7.6); b.box(0.04, 0.5, 0.05, FRAME, 4.0, 1.2, -7.2); b.box(0.74, 0.02, 0.76, FRAME, 4.35, 1.05, -7.6);
  b.box(1.4, 0.8, 0.5, WHITE, 1.8, 0.4, -5.2); b.box(1.5, 0.05, 0.6, WOODL, 1.8, 0.83, -5.2);
  [[1.5, -5.75], [2.1, -5.75]].forEach(([x, z]) => { b.cyl(0.18, 0.18, 0.06, ORG, x, 0.68, z, 16); b.cyl(0.025, 0.035, 0.66, STEEL, x, 0.33, z, 8); b.cyl(0.14, 0.16, 0.02, STEEL, x, 0.01, z, 16); });
  spots.push(spot({act:"coffee", at:[1.4, -6.8], rot:0, door:[0.9, LANE.A], inside:[[0.9, -5.0], [0.9, -6.8], [1.4, -6.8]]}));
  spots.push(spot({act:"snack", at:[3.2, -6.8], rot:0, door:[3.2, LANE.A], inside:[[3.2, -5.0], [3.2, -6.8]]}));
  plant(b, scene, sway, 0.8, -7.5, 1.0, true);

  b.box(3.6, 0.02, 2.6, RUG, 7.0, 0.01, -6.4);
  b.box(2.4, 0.42, 0.9, SOFA, 7.0, 0.3, -7.3); b.box(2.4, 0.55, 0.22, SOFA, 7.0, 0.75, -7.65);
  [-1, 1].forEach(s => b.box(0.22, 0.6, 0.9, SOFA, 7.0 + s * 1.31, 0.3, -7.3));
  b.cyl(0.42, 0.42, 0.04, WOODL, 7.0, 0.4, -6.3, 24); b.cyl(0.05, 0.08, 0.38, FRAME, 7.0, 0.19, -6.3, 10); b.cyl(0.2, 0.2, 0.02, FRAME, 7.0, 0.02, -6.3, 16);
  b.cyl(0.07, 0.07, 0.07, CUP, 7.15, 0.455, -6.4, 10); b.box(0.3, 0.03, 0.22, BOOKS[1], 6.85, 0.435, -6.2);
  const bean = (x, z) => { b.add(new T.SphereGeometry(0.5, 16, 12).scale(1, 0.5, 1), TEAL, x, 0.24, z); b.add(new T.SphereGeometry(0.42, 16, 12).scale(1, 0.55, 0.9), TEAL, x, 0.36, z + 0.2); };
  bean(5.4, -6.0); bean(8.6, -6.0);
  b.box(1.6, 0.9, 0.06, FRAME, 7.0, 1.8, zA + 0.08);
  const tv = new T.Mesh(new T.PlaneGeometry(1.5, 0.82), new T.MeshStandardMaterial({color:0x111111, emissive:0xFFFFFF, emissiveIntensity:0.5, roughness:0.4}));
  tv.position.set(7.0, 1.8, zA + 0.115); scene.add(tv); dyn.tv = tv;
  [[6.3, [[6.3, -5.0], [6.3, -7.3]]], [7.0, [[7.7, -5.0], [7.7, -6.9], [7.0, -7.3]]], [7.7, [[7.7, -5.0], [7.7, -7.3]]]].forEach(([x, inside]) =>
    spots.push(spot({act:"lounge", at:[x, -7.3], rot:180, seat:true, sitY:0.5, door:[x, LANE.A], inside})));
  [5.4, 8.6].forEach(x => spots.push(spot({act:"lounge", at:[x, -5.95], rot:180, seat:true, sitY:0.34, door:[x, LANE.A], inside:[[x, -5.0], [x, -5.95]]})));
  plant(b, scene, sway, 9.0, -7.5, 1.3, true);

  b.box(2.0, 2.6, 2.3, WALL, 15.8, 1.3, -6.85);
  [15.3, 16.3].forEach((x, i) => {
    b.box(0.8, 2.0, 0.06, WOODL, x, 1.0, -5.67); b.cyl(0.02, 0.02, 0.12, STEEL, x + 0.3, 1.0, -5.62, 8);
    b.box(0.18, 0.18, 0.02, i ? M(0xE0557A) : M(0x5B6CF9), x, 1.6, -5.63);
    spots.push(spot({act:"restroom", at:[x, -5.3], rot:0, hide:true, door:[x, LANE.A], inside:[[x, -5.0], [x, -5.3]]}));
  });
  const wc = new T.Mesh(new T.PlaneGeometry(1.2, 0.3), new T.MeshBasicMaterial({map:textTexture("RESTROOMS", 512, 128, 72, "#171412", 0), transparent:true}));
  wc.position.set(15.8, 2.25, -5.68); scene.add(wc);
  b.box(1.8, 0.08, 0.5, WOODL, 10.2, 0.45, -7.4); b.box(1.8, 0.4, 0.08, WOODL, 10.2, 0.7, -7.62); [-0.8, 0.8].forEach(dx => b.box(0.08, 0.42, 0.5, FRAME, 10.2 + dx, 0.21, -7.4));
  plant(b, scene, sway, 10.2, -5.6, 1.0, true);

  b.box(1.0, 0.8, 0.6, WHITE, 12.2, 0.4, -7.5); b.box(0.64, 0.28, 0.52, LIGHT, 12.2, 0.94, -7.5); b.box(0.5, 0.04, 0.3, DARK, 12.2, 1.1, -7.6);
  b.box(0.4, 0.06, 0.08, FRAME, 12.2, 1.0, -7.22);
  const paper = new T.Mesh(new T.PlaneGeometry(0.3, 0.4), new T.MeshStandardMaterial({color:0xFFFFFF, side:T.DoubleSide}));
  paper.rotation.x = -Math.PI / 2 + 0.15; paper.position.set(12.2, 1.1, -7.5); scene.add(paper); dyn.paper = paper;
  b.box(0.6, 2.0, 0.8, DARK, 11.5, 1.0, -7.5); b.box(0.52, 1.9, 0.02, FRAME, 11.5, 1.0, -7.09);
  const leds = new Builder();
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) leds.box(0.05, 0.03, 0.02, LED, 11.5 + s * 0.17, 0.4 + i * 0.22, -7.08);
  leds.build(scene);
  spots.push(spot({act:"printer", at:[12.2, -6.7], rot:0, door:[12.2, LANE.A], inside:[[12.2, -5.0], [12.2, -6.7]]}));
  plant(b, scene, sway, 12.75, -5.3, 1.0, true);

  const southG = new T.Group(); southG.position.z = SZ; scene.add(southG); southG.updateMatrixWorld(true);
  const sb = new Builder(), Z1 = FLOOR.z1 - SZ, n0 = spots.length;
  [-12.3, -10.7, -9.1].forEach(x => shelfUnit(sb, x, 9.3, Math.PI));
  [-12.5, -9.0].forEach(x => {
    sb.box(0.7, 0.4, 0.7, TEAL, x, 0.3, 7.5); sb.box(0.7, 0.5, 0.18, TEAL, x, 0.65, 7.8); [-1, 1].forEach(s => sb.box(0.14, 0.55, 0.7, TEAL, x + s * 0.3, 0.35, 7.5));
    spots.push(spot({act:"research", at:[x, 7.5], rot:0, seat:true, sitY:0.44, door:[x, LANE.C], inside:[[x, 7.1], [x, 7.5]]}));
  });
  [-11.4, -10.0].forEach(x => spots.push(spot({act:"research", at:[x, 7.6], rot:180, door:[x, LANE.C], inside:[[x, 7.1], [x, 7.6]]})));
  sb.cyl(0.18, 0.18, 0.06, ORG, -10.7, 1.42, 7.5, 16); sb.cyl(0.02, 0.02, 1.4, STEEL, -10.7, 0.7, 7.5, 8); sb.cyl(0.14, 0.16, 0.02, STEEL, -10.7, 0.01, 7.5, 16);
  const booth = x => {
    sb.box(0.95, 0.1, 0.95, FRAME, x, 2.25, 7.85); sb.box(0.9, 0.012, 0.9, CARPET, x, 0.006, 7.85);
    sb.box(0.04, 2.2, 0.9, GLASS, x - 0.45, 1.1, 7.85); sb.box(0.04, 2.2, 0.9, GLASS, x + 0.45, 1.1, 7.85); sb.box(0.9, 2.2, 0.04, GLASS, x, 1.1, 8.3);
    [[x - 0.45, 7.4], [x + 0.45, 7.4], [x - 0.45, 8.3], [x + 0.45, 8.3]].forEach(([px, pz]) => sb.box(0.06, 2.2, 0.06, FRAME, px, 1.1, pz));
    sb.box(0.6, 0.04, 0.3, WOODL, x, 1.0, 8.12); sb.box(0.12, 0.2, 0.06, DARK, x, 1.12, 8.25);
    spots.push(spot({act:"phone", at:[x, 7.8], rot:0, door:[x, LANE.C], inside:[[x, 7.1], [x, 7.8]]}));
  };
  booth(-7.6); booth(-6.3);
  sb.cyl(0.17, 0.17, 0.9, WHITE, -4.8, 0.45, 8.1, 14); sb.cyl(0.13, 0.11, 0.42, GLASS, -4.8, 1.12, 8.1, 12); sb.box(0.12, 0.08, 0.1, STEEL, -4.8, 0.72, 7.93);
  [[-4.55, 7.95], [-5.05, 7.95]].forEach(([x, z]) => sb.cyl(0.03, 0.025, 0.07, CUP, x, 0.935, z, 8));
  spots.push(spot({act:"water", at:[-4.8, 7.45], rot:180, door:[-4.8, LANE.C], inside:[[-4.8, 7.1], [-4.8, 7.45]]}));
  sb.box(6.4, 0.015, 2.4, M(0xD9C9B8, {roughness:1}), 9.5, 0.008, 8.35);
  const recSign = new T.Mesh(new T.PlaneGeometry(2.0, 0.42), new T.MeshBasicMaterial({map:textTexture("REC ROOM", 512, 128, 80, "#F26A1B", 0), transparent:true, side:T.DoubleSide}));
  recSign.position.set(9.5, 2.2, 7.05); southG.add(recSign);
  const FELT = M(0x1E8A4C, {roughness:1}), CUE = M(0x8B5A2B);
  sb.box(2.2, 0.16, 1.2, WOODL, 8.0, 0.74, 8.4); sb.box(2.0, 0.02, 1.0, FELT, 8.0, 0.83, 8.4);
  [-1, 1].forEach(s => { sb.box(2.2, 0.06, 0.1, WOODL, 8.0, 0.85, 8.4 + s * 0.55); sb.box(0.1, 0.06, 1.2, WOODL, 8.0 + s * 1.05, 0.85, 8.4); });
  [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(([dx, dz]) => sb.box(0.12, 0.74, 0.12, DARK, 8.0 + dx, 0.37, 8.4 + dz));
  [[-1, -0.5], [0, -0.5], [1, -0.5], [-1, 0.5], [0, 0.5], [1, 0.5]].forEach(([dx, dz]) => sb.cyl(0.06, 0.06, 0.03, DARK, 8.0 + dx, 0.86, 8.4 + dz, 12));
  sb.box(0.9, 1.3, 0.04, WOODL, 8.0, 1.0, Z1 - 0.1);
  for (let i = 0; i < 4; i++) sb.cyl(0.012, 0.008, 1.3, CUE, 7.7 + i * 0.2, 1.0, Z1 - 0.14, 6);
  dyn.balls = [0xFFFFFF, 0xF0C419, 0x2E6FD8, 0xC2410C, 0x7A5BB5, 0xF26A1B, 0x1FA463, 0x171412].map((hex, i) => {
    const mesh = new T.Mesh(new T.SphereGeometry(0.035, 12, 10), M(hex, {roughness:0.3}));
    mesh.position.set(i ? 8.35 + Math.floor((i - 1) / 2) * 0.07 : 7.5, 0.875, 8.4 + (i % 2 ? -0.04 : 0.04) * Math.ceil(i / 2)); mesh.castShadow = true; southG.add(mesh);
    return {mesh, v:[0, 0]};
  });
  dyn.pool = [[7.3, true], [8.7, false]].map(([x, cue]) => spot({act:"pool", at:[x, 7.35], rot:180, cue, door:[x, LANE.C], inside:[[x, 7.1], [x, 7.35]]}));
  spots.push(...dyn.pool);
  [[0.26, DARK], [0.2, M(0xE0557A)], [0.14, M(0x1FA463)], [0.08, CUP], [0.03, M(0xE0557A)]].forEach(([r, mat], i) => sb.add(new T.CylinderGeometry(r, r, 0.03, 24).rotateX(Math.PI / 2), mat, 11.3, 1.6, Z1 - 0.12 - i * 0.006));
  sb.box(1.2, 0.01, 0.04, WHITE, 11.0, 0.006, 7.6);
  dyn.darts = [[11.3, 7.4], [10.6, 7.45]].map(([x, z]) => {
    const sp = spot({act:"darts", at:[x, z], rot:180, door:[x, LANE.C], inside:[[x, 7.1], [x, z]]});
    spots.push(sp);
    const pool = Array.from({length:3}, () => {
      const g = new T.Group(); g.visible = false; southG.add(g);
      g.add(new T.Mesh(new T.CylinderGeometry(0.006, 0.004, 0.16, 6).rotateX(Math.PI / 2), STEEL));
      const fl = new T.Mesh(new T.BoxGeometry(0.03, 0.03, 0.04), M(0xE0557A)); fl.position.z = 0.07; g.add(fl);
      return g;
    });
    return {spot:sp, pool, stuck:[], fly:null, next:0};
  });
  sb.cyl(0.3, 0.3, 0.04, WOODL, 10.0, 1.05, 9.0, 20); sb.cyl(0.03, 0.03, 1.03, STEEL, 10.0, 0.52, 9.0, 8); sb.cyl(0.2, 0.22, 0.02, STEEL, 10.0, 0.01, 9.0, 16);
  [[9.6, 8.55], [10.4, 8.55]].forEach(([x, z]) => { sb.cyl(0.18, 0.18, 0.06, ORG, x, 0.68, z, 16); sb.cyl(0.025, 0.035, 0.66, STEEL, x, 0.33, z, 8); sb.cyl(0.14, 0.16, 0.02, STEEL, x, 0.01, z, 16); });
  sb.box(0.7, 1.8, 0.8, DARK, 12.4, 0.9, 9.1); sb.box(0.72, 0.25, 0.3, ORG, 12.4, 1.95, 9.0); sb.box(0.7, 0.08, 0.3, LIGHT, 12.4, 1.0, 8.75);
  const arcade = new T.Mesh(new T.PlaneGeometry(0.5, 0.4), new T.MeshStandardMaterial({color:0x111111, emissive:0x5B6CF9, emissiveIntensity:0.9, roughness:0.4}));
  arcade.position.set(12.4, 1.4, 8.695); arcade.rotation.x = -0.2; southG.add(arcade); dyn.arcade = arcade;
  sb.build(southG);
  for (const sp of spots.slice(n0)){ sp.at[1] += SZ; sp.inside.forEach(pt => { pt[1] += SZ; }); sp.door = [sp.door[0], LANE.E]; }
  b.box(3.4, 0.012, 9.0, M(0x4A4E55, {roughness:1}), 15.0, 0.006, 1.4);
  glassWall(b, "z", -3.2, 6.0, 13.2, 2.3, [0.85, 1.95]); glassWall(b, "x", 13.2, FLOOR.x1, -3.2, 2.3); glassWall(b, "x", 13.2, FLOOR.x1, 6.0, 2.3);
  const gymSign = new T.Mesh(new T.PlaneGeometry(1.4, 0.42), new T.MeshBasicMaterial({map:textTexture("GYM", 512, 128, 86, "#F26A1B", 0), transparent:true, side:T.DoubleSide}));
  gymSign.position.set(13.15, 2.55, 1.4); gymSign.rotation.y = Math.PI / 2; scene.add(gymSign);
  const mirror = new T.Mesh(new T.PlaneGeometry(8.6, 2.2), new T.MeshStandardMaterial({color:0xDCE9F2, metalness:0.55, roughness:0.12}));
  mirror.position.set(FLOOR.x1 - 0.1, 1.2, 1.4); mirror.rotation.y = -Math.PI / 2; scene.add(mirror);
  b.box(8.7, 0.06, 0.06, FRAME, FLOOR.x1 - 0.12, 2.32, 1.4); b.box(8.7, 0.06, 0.06, FRAME, FLOOR.x1 - 0.12, 0.08, 1.4);
  dyn.gym = [];
  [-1.6, 0.2].forEach(z => {
    b.box(0.8, 0.15, 1.8, DARK, 15.9, 0.075, z); b.box(0.6, 0.02, 1.5, M(0x3A3D44, {roughness:1}), 15.9, 0.16, z);
    b.box(0.06, 1.2, 0.06, STEEL, 16.5, 0.6, z - 0.5); b.box(0.06, 1.2, 0.06, STEEL, 16.5, 0.6, z + 0.5);
    b.box(0.1, 0.05, 1.1, STEEL, 16.5, 1.2, z); b.box(0.3, 0.3, 0.05, FRAME, 16.5, 1.4, z);
    const sp = spot({act:"gym", gym:"run", at:[15.9, z], rot:270, floorY:0.15, door:[13.0, LANE.B], inside:[[13.6, 1.4], [14.9, 1.4], [14.9, z], [15.9, z]]});
    spots.push(sp); dyn.gym.push(sp);
  });
  b.box(0.5, 0.08, 1.3, M(0x7A1F2B, {roughness:0.9}), 14.2, 0.46, 3.4); [[-0.5], [0.5]].forEach(([dz]) => b.box(0.08, 0.42, 0.08, STEEL, 14.2, 0.21, 3.4 + dz));
  spots.push(spot({act:"gym", gym:"bench", at:[14.2, 3.0], rot:0, seat:true, sitY:0.52, door:[13.0, LANE.B], inside:[[13.6, 1.4], [14.2, 1.4], [14.2, 3.0]]}));
  b.box(1.4, 0.5, 0.4, DARK, 14.5, 0.25, 5.65);
  for (let i = 0; i < 4; i++){ const x = 13.95 + i * 0.36; b.add(new T.CylinderGeometry(0.015, 0.015, 0.3, 6).rotateZ(Math.PI / 2), STEEL, x, 0.56, 5.65); [-0.12, 0.12].forEach(d => b.add(new T.CylinderGeometry(0.05 + i * 0.01, 0.05 + i * 0.01, 0.04, 10).rotateZ(Math.PI / 2), FRAME, x + d, 0.56, 5.65)); }
  b.box(0.7, 0.02, 1.8, M(0x7A5BB5, {roughness:1}), 14.0, 0.011, -1.2); b.box(0.7, 0.02, 1.8, TEAL, 14.0, 0.011, 0.9);
  spots.push(spot({act:"gym", gym:"yoga", at:[14.0, -1.2], rot:270, seat:true, sitY:0.14, door:[13.0, LANE.B], inside:[[13.6, 1.4], [14.0, 1.4], [14.0, -1.2]]}));
  b.cyl(0.17, 0.17, 0.9, WHITE, 13.6, 0.45, -2.8, 14); b.cyl(0.13, 0.11, 0.42, GLASS, 13.6, 1.12, -2.8, 12);
  plant(b, scene, sway, 13.6, -7.5, 1.3, true); plant(b, scene, sway, 13.7, -5.0, 1.0, true); plant(b, scene, sway, 16.5, -4.8, 1.0, true);
  const zs = FLOOR.z1 - 0.5;
  plant(b, scene, sway, 13.6, zs, 1.2, true); plant(b, scene, sway, 16.5, zs, 1.3, true); plant(b, scene, sway, 16.5, zs - 2.5, 1.0, true); plant(b, scene, sway, 16.5, 8.0, 1.0, true); plant(b, scene, sway, 16.5, 12.5, 1.0, true);
  b.box(1.8, 0.08, 0.5, WOODL, 13.9, 0.45, -6.3); b.box(1.8, 0.4, 0.08, WOODL, 13.9, 0.7, -6.52); [-0.8, 0.8].forEach(dx => b.box(0.08, 0.42, 0.5, FRAME, 13.9 + dx, 0.21, -6.3));
  b.box(1.8, 0.08, 0.5, WOODL, 15.0, 0.45, zs - 1.1); b.box(1.8, 0.4, 0.08, WOODL, 15.0, 0.7, zs - 0.88); [-0.8, 0.8].forEach(dx => b.box(0.08, 0.42, 0.5, FRAME, 15.0 + dx, 0.21, zs - 1.1));
  [[[-5.6, 7.5 + SZ, 270], [-4.0, 7.5 + SZ, 90]], [[-0.45, LANE.B, 270], [0.45, LANE.B, 90]], [[-0.45, LANE.C, 270], [0.45, LANE.C, 90]], [[-0.45, LANE.D, 270], [0.45, LANE.D, 90]], [[12.4, -0.9, 0], [12.4, -0.2, 180]], [[-12.4, 3.6, 180], [-12.4, 4.4, 0]], [[-12.4, 8.8, 180], [-12.4, 9.6, 0]]].forEach((pair, i) =>
    pair.forEach(([x, z, rot], slot) => spots.push(spot({act:"chat", pair:i, slot, at:[x, z], rot, door:[x, Object.values(LANE).reduce((a, l) => Math.abs(l - z) < Math.abs(a - z) ? l : a)], inside:[[x, z]]}))));
  plant(b, scene, sway, -12.6, -4.9, 1.1, true); plant(b, scene, sway, 5.0, -7.6, 0.9, true); plant(b, scene, sway, 6.4, 9.2, 1.2, true); plant(b, scene, sway, -3.5, 8.1, 1.0, true);
  b.build(scene);
  return {spots, dyn};
}

function screenMesh(w, h){
  return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({color:0x111111, emissive:SCREEN.idle, emissiveIntensity:1, roughness:0.4}));
}
function chairAt(parent, x, z, ry){
  const chair = new T.Group(); chair.position.set(x, 0, z); chair.rotation.y = ry; parent.add(chair);
  const seat = new T.Mesh(new T.BoxGeometry(0.46, 0.08, 0.46), ORG); seat.position.y = 0.42; seat.castShadow = true; chair.add(seat);
  const back = new T.Mesh(new T.BoxGeometry(0.44, 0.5, 0.06), ORG); back.position.set(0, 0.72, 0.23); back.rotation.x = -0.08; back.castShadow = true; chair.add(back);
  const base = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.38, 8), STEEL); base.position.y = 0.19; chair.add(base);
  const ring = new T.Mesh(new T.RingGeometry(0.5, 0.64, 40), new T.MeshBasicMaterial({color:0xFFB44D, transparent:true, opacity:0, side:T.DoubleSide, depthWrite:false}));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; chair.add(ring);
  return {chair, back, ring};
}
function buildDesk(parent, b, sway, x, z, rot, withPlant){
  const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot * DEG; parent.add(g);
  g.updateMatrixWorld(true);
  const m = g.matrixWorld;
  b.box(1.2, 0.05, 0.6, WOODL, 0, 0.74, 0, 0, m);
  [[-0.55, -0.24], [0.55, -0.24], [-0.55, 0.24], [0.55, 0.24]].forEach(([lx, lz]) => b.box(0.05, 0.72, 0.05, WHITE, lx, 0.36, lz, 0, m));
  b.box(0.05, 0.05, 0.5, WHITE, -0.55, 0.4, 0, 0, m); b.box(0.05, 0.05, 0.5, WHITE, 0.55, 0.4, 0, 0, m);
  b.box(0.36, 0.02, 0.12, LIGHT, 0, 0.775, 0.12, 0, m); b.box(0.06, 0.015, 0.09, LIGHT, 0.3, 0.775, 0.12, 0, m);
  b.cyl(0.04, 0.035, 0.08, CUP, -0.48, 0.805, 0.1, 10, m);
  const screens = [-1, 1].map(s => {
    const mon = new T.Group(); mon.position.set(s * 0.23, 1.0, -0.2); mon.rotation.y = -s * 0.14; g.add(mon); mon.updateMatrixWorld(true);
    b.box(0.42, 0.27, 0.03, FRAME, 0, 0, 0, 0, mon.matrixWorld); b.cyl(0.025, 0.025, 0.1, FRAME, 0, -0.185, 0.02, 8, mon.matrixWorld); b.box(0.18, 0.02, 0.1, FRAME, 0, -0.235, 0.02, 0, mon.matrixWorld);
    const screen = screenMesh(0.38, 0.23); screen.position.z = 0.017; mon.add(screen);
    return screen;
  });
  if (withPlant){ const pot = new T.Group(); pot.position.set(0.5, 0.765, -0.12); g.add(pot); pot.updateMatrixWorld(true); plant(b, pot, sway, 0, 0, 0.6); }
  const seat = chairAt(g, 0, 0.5, 0);
  const r = rot * DEG;
  return {group:g, screens, ...seat, at:[x + Math.sin(r) * 0.5, z + Math.cos(r) * 0.5], rot};
}

function buildDept(info, i, nDesks){
  const [x0, x1] = CELLS[i % 6], [z0, lane] = ROWS[Math.floor(i / 6)];
  const cx = (x0 + x1) / 2, cz = z0 + ROOM_D / 2, w = x1 - x0, hz = ROOM_D / 2;
  const g = new T.Group(); g.position.set(cx, 0, cz);
  const b = new Builder();
  b.box(w - 0.3, 0.012, ROOM_D - 0.3, PODRUG, 0, 0.006, 0);
  const lx0 = -w / 2 + 0.06, lx1 = w / 2 - 0.06, lz0 = -hz + 0.06, lz1 = hz - 0.06, H = 2.3;
  glassWall(b, "x", lx0, lx1, lz0, H, [-0.55, 0.55]);
  glassWall(b, "x", lx0, lx1, lz1, H);
  glassWall(b, "z", lz0, lz1, lx0, H); glassWall(b, "z", lz0, lz1, lx1, H);
  b.box(0.56, 0.46, 0.03, WOODL, lx1 - 0.8, 1.3, lz1 - 0.05); b.box(0.5, 0.4, 0.03, CORK, lx1 - 0.8, 1.3, lz1 - 0.07);
  [[-0.14, 0.1], [0.05, 0.13], [0.16, -0.06], [-0.08, -0.1]].forEach(([dx, dy], k) => {
    b.box(0.12, 0.09, 0.005, WHITE, lx1 - 0.8 + dx, 1.3 + dy, lz1 - 0.09);
    b.cyl(0.012, 0.012, 0.015, PINS[k % PINS.length], lx1 - 0.8 + dx, 1.3 + dy + 0.04, lz1 - 0.1, 8);
  });
  const sway = [];
  plant(b, g, sway, lx0 + 0.35, lz1 - 0.35, 1.0, true);
  const desks = [];
  for (let k = 0; k < nDesks; k++){
    const dx = k % 2 ? 0.9 : -0.9, dz = -hz + 0.9 + Math.floor(k / 2) * 1.15;
    const d = buildDesk(g, b, sway, dx, dz, 0, k === 0);
    const chairZ = cz + dz + 0.5, x = cx + dx;
    desks.push({...d, kind:"desk", act:"desk", at:[x, chairZ], rot:0, seat:true, sitY:0.5, cap:1, users:new Set(), hide:false, dept:info.key,
      door:[cx, lane], inside:[[cx, z0 + 0.35], [cx, chairZ], [x, chairZ]]});
  }
  b.build(g);
  const signTex = signTexture(info.name), signMat = new T.MeshBasicMaterial({map:signTex});
  const sign = new T.Mesh(new T.PlaneGeometry(1.3, 0.48), signMat); sign.position.set(0, H + 0.3, lz0 - 0.03); sign.userData.dept = info.key; g.add(sign);
  const sign2 = new T.Mesh(new T.PlaneGeometry(1.3, 0.48), signMat); sign2.position.set(0, H + 0.3, lz0 + 0.03); sign2.rotation.y = Math.PI; sign2.userData.dept = info.key; g.add(sign2);
  const badgeMat = new T.MeshBasicMaterial({map:badgeTexture(0), transparent:true, depthWrite:false});
  const badge = new T.Mesh(new T.PlaneGeometry(0.3, 0.3), badgeMat);
  badge.position.set(0.85, H + 0.3, lz0 - 0.03); badge.visible = false; g.add(badge);
  return {group:g, sign, sign2, badge, badgeMat, desks, sway, nDesks, pending:-1};
}
function buildPerson(look, kind){
  const isCeo = kind === "ceo", hoodie = kind === "session" || kind === "subagent";
  const skin = M(look.skin), hair = M(look.hair), shirt = new T.MeshStandardMaterial({color:look.shirt, roughness:0.9}), trousers = M(isCeo ? 0x24262E : 0x3A4150);
  const root = new T.Group();
  const hips = new T.Group(); hips.position.y = STAND_Y; root.add(hips);
  const body = new T.Group(); hips.add(body);
  const torso = new T.Mesh(new T.CapsuleGeometry(0.19, 0.3, 4, 12), shirt); torso.scale.set(1.15, 1, 0.72); torso.position.y = 0.3; body.add(torso);
  if (isCeo){ const sh = new T.Mesh(new T.BoxGeometry(0.1, 0.26, 0.04), CUP); sh.position.set(0, 0.36, -0.13); body.add(sh); }
  else if (hoodie){
    const col = new T.Mesh(new T.TorusGeometry(0.17, 0.06, 8, 18), shirt); col.rotation.x = Math.PI / 2; col.position.set(0, 0.54, 0.02); body.add(col);
    const hood = new T.Mesh(new T.BoxGeometry(0.26, 0.2, 0.1), shirt); hood.position.set(0, 0.46, 0.17); hood.rotation.x = 0.5; body.add(hood);
    if (kind === "subagent"){ const badge = new T.Mesh(new T.BoxGeometry(0.08, 0.1, 0.015), CUP); badge.position.set(0.06, 0.2, -0.145); body.add(badge); }
  }
  else { const col = new T.Mesh(new T.CylinderGeometry(0.075, 0.09, 0.05, 10), skin); col.position.y = 0.52; body.add(col); }
  const neck = new T.Group(); neck.position.y = 0.56; body.add(neck);
  const head = new T.Mesh(new T.SphereGeometry(0.17, 18, 14), skin); head.position.y = 0.17; neck.add(head);
  const cap = new T.Mesh(new T.SphereGeometry(0.178, 18, 10, 0, Math.PI * 2, 0, look.woman ? Math.PI * 0.62 : Math.PI * 0.5), hair); cap.position.set(0, 0.19, 0.012); neck.add(cap);
  if (look.woman){ const tail = new T.Mesh(new T.CapsuleGeometry(0.07, 0.2, 3, 8), hair); tail.position.set(0, 0.0, 0.16); neck.add(tail); }
  if (kind === "agent"){
    const band = new T.Mesh(new T.TorusGeometry(0.19, 0.022, 8, 24, Math.PI), FRAME); band.position.y = 0.19; neck.add(band);
    [-1, 1].forEach(s => { const ear = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.04, 12), FRAME); ear.rotation.z = Math.PI / 2; ear.position.set(s * 0.185, 0.16, 0); neck.add(ear); });
  }
  let cup = null, cue = null;
  const arms = [-1, 1].map(s => {
    const sh = new T.Group(); sh.position.set(s * 0.24, 0.5, 0); body.add(sh);
    const up = new T.Mesh(new T.CapsuleGeometry(0.05, 0.22, 3, 8), shirt); up.position.y = -0.14; sh.add(up);
    const el = new T.Group(); el.position.y = -0.27; sh.add(el);
    const fore = new T.Mesh(new T.CapsuleGeometry(0.045, 0.2, 3, 8), hoodie ? shirt : skin); fore.position.y = -0.12; el.add(fore);
    const hand = new T.Mesh(new T.SphereGeometry(0.055, 10, 8), skin); hand.position.y = -0.25; el.add(hand);
    if (s === 1){
      cup = new T.Mesh(new T.CylinderGeometry(0.04, 0.035, 0.09, 10), CUP); cup.position.set(0, -0.27, -0.06); cup.visible = false; el.add(cup);
      cue = new T.Mesh(new T.CylinderGeometry(0.012, 0.008, 1.3, 6), M(0x8B5A2B)); cue.position.set(0.05, -0.3, -0.45); cue.rotation.x = -1.87; cue.visible = false; el.add(cue);
    }
    return {sh, el};
  });
  const legs = [-1, 1].map(s => {
    const hip = new T.Group(); hip.position.set(s * 0.11, 0, 0); hips.add(hip);
    const th = new T.Mesh(new T.BoxGeometry(0.16, 0.42, 0.15), trousers); th.position.y = -0.21; hip.add(th);
    const knee = new T.Group(); knee.position.y = -0.42; hip.add(knee);
    const shin = new T.Mesh(new T.BoxGeometry(0.14, 0.4, 0.14), trousers); shin.position.y = -0.2; knee.add(shin);
    const shoe = new T.Mesh(new T.BoxGeometry(0.14, 0.07, 0.24), DARK); shoe.position.set(0, -0.405, -0.04); knee.add(shoe);
    return {hip, knee};
  });
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const base = new T.Color(look.shirt), grey = base.clone().lerp(new T.Color(0x9A9A9A), 0.6);
  return {root, hips, body, neck, arms, legs, cup, cue, shirt, base, grey};
}
function disposeTree(obj, materials = []){
  obj.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  materials.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
  obj.removeFromParent();
}

const ease = (a, b, k) => a + (b - a) * k;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
const ARMS = {
  working:[0.9, 0.65, 0.9, 0.65, -0.08], reading:[0.9, 0.65, 0.5, 0.6, -0.08], done:[0.25, 0.3, 0.25, 0.3, -0.08],
  idle:[0.45, 0.7, 0.45, 0.7, -0.08], waiting:[0.25, 0.3, 2.95, 0.35, -0.3],
  stand:[0.1, 0.15, 0.1, 0.15, -0.08], wait:[0.6, 1.5, 0.6, 1.5, -0.08], coffee:[0.1, 0.15, 1.3, 1.1, -0.2], snack:[0.1, 0.15, 1.3, 1.1, -0.2],
  water:[0.1, 0.15, 1.3, 1.1, -0.2], phone:[0.1, 0.15, 1.5, 2.3, -0.55], chat:[0.5, 0.9, 0.3, 0.6, -0.08], printer:[0.8, 0.5, 0.8, 0.5, -0.08],
  research:[1.0, 0.9, 1.0, 0.9, -0.08], meeting:[0.9, 0.7, 0.9, 0.7, -0.08], lounge:[0.3, 0.4, 0.3, 0.4, -0.08], reception:[0.4, 0.9, 0.4, 0.9, -0.08],
  pool:[1.2, 0.3, 1.1, 0.6, -0.1], darts:[0.1, 0.15, 1.6, 1.4, -0.1], visit:[0.5, 0.9, 0.3, 0.6, -0.08],
  bench:[0.25, 0.5, 0.25, 0.5, -0.08], yoga:[2.9, 0.1, 2.9, 0.1, -0.2]
};

export function createOffice({canvas, stage, tagsEl, posEl, tipEl, onSelect, onPair}){
  const renderer = new T.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  const cam = new T.OrthographicCamera(-1, 1, 1, -1, 1, 300);
  const HOME = {az:45, el:32, zoom:0.9, tx:2.6, tz:6.0};
  const view = {...HOME}, cur = {...HOME};
  let drag = null, interacted = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  scene.add(new T.HemisphereLight(0xFFF6EC, 0xD9C3B0, 1.1));
  const sun = new T.DirectionalLight(0xFFF2E0, 2.2);
  sun.position.set(-12, 26, 22); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, {left:-26, right:26, top:26, bottom:-26, near:1, far:90});
  scene.add(sun, sun.target);
  const fill = new T.DirectionalLight(0xDDEBFF, 0.5); fill.position.set(16, 10, -8); scene.add(fill);

  const sway = [];
  const walls = buildShell(scene);
  const {spots, dyn} = buildCommon(scene, sway, walls.n);
  const roomSway = sway.length;

  const signMat = new T.MeshBasicMaterial({transparent:true, toneMapped:false});
  const sign = new T.Mesh(new T.PlaneGeometry(4.2, 1.05), signMat); sign.position.set(0.9, 2.45, FLOOR.z0 + 0.01); walls.n.add(sign);
  const glowMat = new T.MeshBasicMaterial({transparent:true, blending:T.AdditiveBlending, depthWrite:false, opacity:0.75, toneMapped:false});
  const glow = new T.Mesh(new T.PlaneGeometry(5.0, 1.3), glowMat); glow.position.set(0.9, 2.45, FLOOR.z0 + 0.005); walls.n.add(glow);
  const signLight = new T.PointLight(ORANGE, 8, 7, 2); signLight.position.set(0.9, 2.3, FLOOR.z0 + 0.6); scene.add(signLight);
  let names = {};
  function setNames(n){
    if (n.company === names.company && n.ceo === names.ceo) return;
    names = {...n};
    const company = String(n.company || "AI HQ").toUpperCase();
    [signMat.map, glowMat.map, dyn.logo.material.map].forEach(m => m && m.dispose());
    const tex = textTexture(/\bHQ$/.test(company) ? company : company + " HQ", 1024, 256, Math.min(118, 2400 / Math.max(8, company.length + 3)), "#FF7A1F", 18);
    signMat.map = tex; glowMat.map = blurred(tex, 14); signMat.needsUpdate = glowMat.needsUpdate = true;
    dyn.logo.material.map = textTexture(company, 512, 192, Math.min(86, 1000 / Math.max(6, company.length)), "#F26A1B", 0); dyn.logo.material.needsUpdate = true;
    const ceo = persons.get("ceo"); if (ceo) ceo.info.name = n.ceo || "CEO";
  }

  const lines = linesTexture();
  dyn.tv.material.emissiveMap = lines; dyn.tv.material.needsUpdate = true;
  const steamTex = spriteTexture();
  const steam = Array.from({length:7}, (_, i) => {
    const s = new T.Sprite(new T.SpriteMaterial({map:steamTex, transparent:true, opacity:0, depthWrite:false}));
    s.scale.setScalar(0.12); s.userData.t = i / 7; scene.add(s); return s;
  });

  const deskLayer = new T.Group(); scene.add(deskLayer);
  const deptLayer = new T.Group(); scene.add(deptLayer);
  const peopleLayer = new T.Group(); scene.add(peopleLayer);
  const persons = new Map(), depts = new Map();
  let desks = {...DEFAULT_DESKS}, deptList = [], hovered = null, hoveredDept = null, t = 0, loaded = false, visit = null;
  const visits = [];

  function placeCeo(){
    const old = persons.get("ceo");
    if (old) disposeTree(old.fig.root, [old.fig.shirt]);
    deskLayer.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    deskLayer.clear(); sway.length = roomSway;
    const b = new Builder();
    const [x, z, rot] = desks.ceo || DEFAULT_DESKS.ceo;
    const desk = buildDesk(deskLayer, b, sway, x, z, rot, true);
    b.build(deskLayer);
    const fig = buildPerson(LOOKS.ceo, "ceo");
    fig.root.traverse(o => { o.userData.id = "ceo"; });
    peopleLayer.add(fig.root);
    const sp = {...desk, kind:"desk", act:"desk", seat:true, sitY:0.5, cap:1, users:new Set(["ceo"]), hide:false, door:[x, LANE.A], inside:[[x, z + 0.7], [x + 0.9, z + 0.7], [x + 0.9, z - 0.5], [x, z - 0.5]]};
    persons.set("ceo", {id:"ceo", kind:"ceo", desk:sp, spot:sp, fig, lift:0, status:"idle", scale:1, alive:true, mode:"sit", sit:1, yaw:rot * DEG, yawT:rot * DEG,
      pos:new T.Vector3(sp.at[0], 0, sp.at[1]), path:[], step:0, phase:0, until:Infinity, act:"working", screenCol:new T.Color(SCREEN.idle), info:{name:names.ceo || "CEO"}});
  }
  placeCeo();
  setNames({company:"AI HQ", ceo:"CEO"});
  const ceoPos = new T.Vector3();

  function lookFor(p){
    if (p.kind === "agent") return LOOKS[p.id] || SPARE_LOOKS[hoodieIndex(p.id) % SPARE_LOOKS.length];
    const i = hoodieIndex(p.id), hue = Number.isInteger(p.hue) ? p.hue : hoodieIndex(p.name);
    return {skin:SKINS[i % SKINS.length], hair:HAIRS[(i * 7 + 3) % HAIRS.length], shirt:HOODIES[hue % HOODIES.length], woman:i % 3 === 1};
  }
  const RANK = {session:0, subagent:1, agent:2};
  function setDepartments(list){
    deptList = list;
    const active = list.slice(0, MAX_ROOMS);
    const want = new Map();
    for (const info of active){
      const members = [...info.people].sort((a, b) => (RANK[a.kind] ?? 3) - (RANK[b.kind] ?? 3));
      let n = 0;
      for (const p of members){
        if (want.has(p.id) || n >= MAX_DESKS) continue;
        want.set(p.id, {dept:info.key, seat:n++, info:p});
      }
      info.seated = n;
    }
    const seen = new Set();
    active.forEach((info, i) => {
      seen.add(info.key);
      const nDesks = Math.min(MAX_DESKS, Math.max(2, Math.ceil(info.seated / 2) * 2));
      let e = depts.get(info.key);
      if (e && (e.dept.nDesks !== nDesks || e.slot !== i)){
        for (const q of persons.values()) if (q.deptKey === info.key){ q.desk = null; }
        disposeDept(e); depts.delete(info.key); e = null;
      }
      if (!e){
        e = {key:info.key, dept:buildDept(info, i, nDesks), scale:0, alive:true, slot:i};
        e.dept.group.scale.setScalar(0.001);
        deptLayer.add(e.dept.group); depts.set(info.key, e);
      }
      e.info = info; e.alive = true;
      if (e.dept.pending !== info.pending){
        e.dept.pending = info.pending;
        e.dept.badgeMat.map.dispose(); e.dept.badgeMat.map = badgeTexture(info.pending); e.dept.badgeMat.needsUpdate = true;
        e.dept.badge.visible = info.pending > 0;
      }
    });
    for (const e of depts.values()) if (!seen.has(e.key)) e.alive = false;
    let delay = 0;
    for (const [id, w] of want){
      let q = persons.get(id);
      const desk = depts.get(w.dept).dept.desks[w.seat];
      if (!q){
        const fig = buildPerson(lookFor(w.info), w.info.kind);
        fig.root.traverse(o => { o.userData.id = id; });
        fig.root.scale.setScalar(0.001); fig.root.visible = false;
        peopleLayer.add(fig.root);
        q = {id, kind:w.info.kind, fig, lift:0, scale:0, alive:true, mode:"stand", sit:0, yaw:Math.PI, yawT:Math.PI, pos:new T.Vector3(ENTRANCE.at[0], 0, ENTRANCE.at[1]),
          path:[], step:0, phase:0, until:0, act:"entrance", spot:ENTRANCE, fresh:true, enterAt:t + delay, bubble:null, said:null, sayAt:0};
        delay += 0.6;
        persons.set(id, q);
      }
      if (q.desk !== desk){
        const wasAtDesk = q.spot && q.spot.kind === "desk" && q.spot.dept === w.dept;
        if (q.desk) q.desk.users.delete(id);
        q.desk = desk; desk.users.add(id);
        if (wasAtDesk || !q.spot || (q.spot.kind === "desk" && q.spot !== desk)){ q.spot = desk; q.pos.set(desk.at[0], 0, desk.at[1]); q.yaw = q.yawT = desk.rot * DEG; if (q.mode === "walk"){ q.mode = "sit"; q.path = []; } }
        if (q.target && q.target.kind === "desk") q.target = desk;
      }
      q.deptKey = w.dept; q.alive = true; q.leaving = false; q.status = w.info.status; q.info = w.info;
      if (w.info.status === "waiting" && w.info.question && q.question !== w.info.question){ q.question = w.info.question; if ((q.act === "wait" || q.act === "waiting") && q.mode !== "walk") speak(q, w.info.question, false, true); }
      if (w.info.asked_at && q.askedAt !== w.info.asked_at){
        if (q.askedAt !== undefined || (loaded && q.fresh)) visits.push({to:q, by:w.info.parent && persons.get(w.info.parent) || persons.get("ceo"), text:w.info.asked});
        q.askedAt = w.info.asked_at;
      }
      if (w.info.said && q.said !== w.info.said){
        q.said = w.info.said;
        if (visit && visit.to === q && visit.state === "asking") visit.reply = w.info.said;
        else { q.pendingSay = w.info.said; q.sayAt = t + (q.fresh ? delay + rand(1, 4) : rand(0, 1.5)); }
      }
    }
    loaded = true;
    for (const q of persons.values()) if (q.id !== "ceo" && !want.has(q.id)) q.alive = false;
  }
  function disposeDept(e){
    disposeTree(e.dept.group, [e.dept.sign.material, e.dept.badgeMat, ...e.dept.desks.flatMap(d => [...d.screens.map(s => s.material), d.ring.material])]);
  }

  function fit(){
    const w = stage.clientWidth, h = Math.round(w * 10 / 16);
    if (!w) return;
    renderer.setSize(w, h, false);
    const H = VIEW_H, a = w / h;
    cam.left = -H * a / 2; cam.right = H * a / 2; cam.top = H / 2; cam.bottom = -H / 2;
    cam.updateProjectionMatrix();
  }
  new ResizeObserver(fit).observe(stage); fit();

  const target = new T.Vector3();
  function placeCamera(dt){
    const k = reduced ? 1 : 1 - Math.exp(-dt * 9);
    for (const key of ["az", "el", "zoom", "tx", "tz"]) cur[key] = ease(cur[key], view[key], k);
    const drift = reduced || t - interacted < 20 ? 0 : Math.sin(t / 60 * Math.PI * 2) * 2;
    const az = (cur.az + drift) * DEG, el = cur.el * DEG, d = 120;
    target.set(cur.tx, 0, cur.tz);
    cam.position.set(target.x - Math.sin(az) * Math.cos(el) * d, target.y + Math.sin(el) * d, target.z + Math.cos(az) * Math.cos(el) * d);
    cam.lookAt(target); cam.zoom = cur.zoom; cam.updateProjectionMatrix();
    walls.n.visible = Math.cos(az) > -0.12; walls.s.visible = Math.cos(az) < 0.12;
    walls.e.visible = Math.sin(az) > -0.12; walls.w.visible = Math.sin(az) < 0.12;
  }
  function resetView(){ Object.assign(view, HOME); interacted = t; }
  const ZOOM = [0.5, 8];
  function basis(v){ const a = v.az * DEG; return {right:[Math.cos(a), Math.sin(a)], fwd:[Math.sin(a), -Math.cos(a)], se:Math.sin(v.el * DEG)}; }
  function floorOffset(nx, ny, v){
    const {right, fwd, se} = basis(v), kx = nx * VIEW_H * canvas.clientWidth / canvas.clientHeight / 2 / v.zoom, ky = ny * VIEW_H / 2 / v.zoom / se;
    return [kx * right[0] + ky * fwd[0], kx * right[1] + ky * fwd[1]];
  }
  function ndcOf(e){ const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1]; }
  function floorUnder(e){
    const [nx, ny] = ndcOf(e), [ox, oz] = floorOffset(nx, ny, view), x = view.tx + ox, z = view.tz + oz;
    return x < FLOOR.x0 || x > FLOOR.x1 || z < FLOOR.z0 || z > FLOOR.z1 ? [view.tx, view.tz] : [x, z];
  }
  function zoomAt(e, factor){
    const [nx, ny] = ndcOf(e), before = floorOffset(nx, ny, view);
    view.zoom = Math.max(ZOOM[0], Math.min(ZOOM[1], view.zoom * factor));
    const after = floorOffset(nx, ny, view);
    view.tx += before[0] - after[0]; view.tz += before[1] - after[1]; interacted = t;
  }
  function flyTo(x, z, zoom){ view.tx = x; view.tz = z; view.zoom = Math.max(view.zoom, zoom); interacted = t; }

  const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
  function aim(e){ ndc.fromArray(ndcOf(e)); ray.setFromCamera(ndc, cam); }
  function pickAt(e){
    aim(e);
    const figs = [...persons.values()].filter(p => p.alive && p.fig.root.visible).map(p => p.fig.root);
    const signs = [...depts.values()].filter(p => p.alive).flatMap(p => [p.dept.sign, p.dept.sign2]);
    const hits = ray.intersectObjects([...figs, ...signs], true);
    if (!hits.length) return null;
    const o = hits[0].object, pt = hits[0].point;
    return o.userData.dept ? {kind:"pod", key:o.userData.dept, x:pt.x, z:pt.z} : {kind:"person", id:o.userData.id, x:pt.x, z:pt.z};
  }
  function placeTip(e){
    const r = stage.getBoundingClientRect();
    tipEl.hidden = false;
    const x = Math.min(e.clientX - r.left + 14, r.width - tipEl.offsetWidth - 8), y = Math.min(e.clientY - r.top + 14, r.height - tipEl.offsetHeight - 8);
    tipEl.style.left = Math.max(4, x) + "px"; tipEl.style.top = Math.max(4, y) + "px";
  }
  function showTip(e, h){
    if (!tipEl) return;
    tipEl.innerHTML = "";
    if (h.kind === "pod"){
      const info = deptList.find(d => d.key === h.key);
      if (!info){ tipEl.hidden = true; return; }
      const hd = document.createElement("b"); hd.textContent = info.name; tipEl.append(hd);
      const s = document.createElement("div"); s.className = "tipline"; s.textContent = info.status_line || "quiet"; tipEl.append(s);
      if (info.items && info.items.length){
        const ul = document.createElement("ul");
        info.items.slice(0, 3).forEach(x => { const li = document.createElement("li"); li.textContent = x; ul.append(li); });
        tipEl.append(ul);
        if (info.pending > 3){ const m = document.createElement("div"); m.className = "tipmore"; m.textContent = `+${info.pending - 3} more pending`; tipEl.append(m); }
      }
    } else {
      const p = persons.get(h.id);
      if (!p){ tipEl.hidden = true; return; }
      const hd = document.createElement("b"); hd.textContent = p.info.name || p.id; tipEl.append(hd);
      const s = document.createElement("div"); s.className = "tipline";
      s.textContent = p.id === "ceo" ? "In the CEO office" : `${LABEL[p.status] || p.status}${p.info.caption ? " · " + p.info.caption : ""} · ${p.mode === "walk" ? "walking" : p.act}`; tipEl.append(s);
      const q = p.status === "waiting" && p.info.question;
      if (q || p.info.task){ const d = document.createElement("div"); d.className = "tiptask"; d.textContent = q || p.info.task; tipEl.append(d); }
      if (q && p.info.options && p.info.options.length){ const ul = document.createElement("ul"); p.info.options.forEach((o, i) => { const li = document.createElement("li"); li.textContent = `${i + 1}. ${o.label}${o.description ? " — " + o.description : ""}`; ul.append(li); }); tipEl.append(ul); }
    }
    placeTip(e);
  }
  let lastClick = 0;
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("pointerdown", e => {
    if (e.button === 1) e.preventDefault();
    const [nx, ny] = ndcOf(e), pivot = floorUnder(e), {right, fwd, se} = basis(view), dx = view.tx - pivot[0], dz = view.tz - pivot[1];
    drag = {x:e.clientX, y:e.clientY, az:view.az, el:view.el, tx:view.tx, tz:view.tz, nx, ny, pivot, dr:dx * right[0] + dz * right[1], df:(dx * fwd[0] + dz * fwd[1]) * se,
      pan:e.button === 1 || e.button === 2 || e.shiftKey, moved:false};
    canvas.setPointerCapture(e.pointerId); interacted = t;
  });
  canvas.addEventListener("pointermove", e => {
    if (drag){
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.pan){
        const [nx, ny] = ndcOf(e), v0 = {az:drag.az, el:drag.el, zoom:view.zoom}, a = floorOffset(drag.nx, drag.ny, v0), b = floorOffset(nx, ny, v0);
        view.tx = drag.tx + a[0] - b[0]; view.tz = drag.tz + a[1] - b[1];
      } else {
        view.az = drag.az - dx * 0.3;
        view.el = Math.max(8, Math.min(85, drag.el + dy * 0.25));
        const {right, fwd, se} = basis(view), df = drag.df / se;
        view.tx = drag.pivot[0] + drag.dr * right[0] + df * fwd[0]; view.tz = drag.pivot[1] + drag.dr * right[1] + df * fwd[1];
      }
      interacted = t;
      return;
    }
    const h = pickAt(e);
    hovered = h && h.kind === "person" ? h.id : null;
    hoveredDept = h && h.kind === "pod" ? h.key : null;
    canvas.style.cursor = h ? "pointer" : "grab";
    if (h) showTip(e, h); else if (tipEl) tipEl.hidden = true;
    if (ray.ray.intersectPlane(plane, hit)) posEl.textContent = `x ${hit.x.toFixed(2)}  z ${hit.z.toFixed(2)}`;
  });
  const endDrag = e => {
    if (!drag) return;
    const click = !drag.moved && !drag.pan; drag = null;
    if (!click) return;
    const now = performance.now(), h = pickAt(e), dbl = now - lastClick < 350;
    lastClick = dbl ? 0 : now;
    if (dbl){ const p = h && h.kind === "person" && persons.get(h.id); const [x, z] = p ? [p.pos.x, p.pos.z] : h ? [h.x, h.z] : floorUnder(e); flyTo(x, z, 4); return; }
    if (h) onSelect(h);
  };
  canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => { hovered = null; hoveredDept = null; if (tipEl) tipEl.hidden = true; });
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.deltaX === 0) return zoomAt(e, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0015)));
    const r = canvas.getBoundingClientRect(), o = floorOffset(e.deltaX * 2 / r.width, -e.deltaY * 2 / r.height, view);
    view.tx += o[0]; view.tz += o[1]; interacted = t;
  }, {passive:false});
  window.addEventListener("keydown", e => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey) return;
    const keys = {ArrowLeft:() => view.az += 15, ArrowRight:() => view.az -= 15, ArrowUp:() => view.el = Math.min(85, view.el + 8), ArrowDown:() => view.el = Math.max(8, view.el - 8),
      "+":() => view.zoom = Math.min(ZOOM[1], view.zoom * 1.2), "=":() => view.zoom = Math.min(ZOOM[1], view.zoom * 1.2), "-":() => view.zoom = Math.max(ZOOM[0], view.zoom / 1.2), "0":resetView, r:resetView, R:resetView, Home:resetView};
    if (keys[e.key]){ keys[e.key](); interacted = t; e.preventDefault(); }
  });

  const tmp = new T.Vector3();
  function placeTags(){
    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const el of tagsEl.children){
      const p = persons.get(el.dataset.id);
      if (!p || !p.alive || p.scale < 0.6 || p.mode === "hidden"){ el.style.display = "none"; continue; }
      p.fig.neck.getWorldPosition(tmp); tmp.y += 0.5;
      tmp.project(cam);
      el.style.display = ""; el.style.left = ((tmp.x + 1) / 2 * w).toFixed(1) + "px"; el.style.top = ((1 - tmp.y) / 2 * h).toFixed(1) + "px";
      el.classList.toggle("hot", hovered === p.id);
    }
  }

  function freeSpots(act){ return spots.filter(s => s.act === act && s.users.size < s.cap); }
  function pathTo(p, to){
    let pts;
    if (p.mode === "walk" && p.path.length){
      const rest = p.path.slice(p.step), j = rest.findIndex(w => w.c);
      if (j >= 0) pts = rest.slice(0, j + 1);
      else { let k = p.step - 1; while (k > 0 && !p.path[k].c) k--; pts = p.path.slice(k, p.step).reverse(); }
    } else {
      const from = p.spot || ENTRANCE;
      pts = [...from.inside.slice(0, -1).reverse().map(([x, z]) => ({x, z, c:false})), {x:from.door[0], z:from.door[1], c:true}];
    }
    const start = pts[pts.length - 1];
    const corridor = route([start.x, start.z], to.door).map(([x, z]) => ({x, z, c:true}));
    return [...pts, ...corridor, ...to.inside.map(([x, z]) => ({x, z, c:false}))];
  }
  function go(p, to, act, dur){
    if (to === p.spot && p.mode !== "walk"){ p.act = act; p.until = t + dur; return; }
    if (p.target && p.target !== p.spot && p.target !== p.desk) p.target.users.delete(p.id);
    if (p.spot && p.spot !== p.desk && p.spot !== to) p.spot.users.delete(p.id);
    to.users.add(p.id);
    p.target = to; p.act = act; p.dur = dur;
    p.path = pathTo(p, to); p.step = 0; p.mode = "walk";
    if (p.spot && p.spot.hide) p.fig.root.visible = true;
  }
  function arrive(p){
    const s = p.target;
    if (p.spot && p.spot !== s && p.spot !== p.desk) p.spot.users.delete(p.id);
    p.spot = s; p.target = null;
    p.pos.set(s.at[0], 0, s.at[1]); p.yawT = s.rot * DEG;
    p.mode = s.hide ? "hidden" : s.seat ? "sit" : "stand";
    p.fig.root.visible = !s.hide;
    p.until = t + (p.dur ?? 20);
    if (s === ENTRANCE && p.leaving) p.gone = true;
    if (p.fresh && s.kind === "desk") p.fresh = false;
    const cfg = ACTS[p.act === "idle" ? "desk" : p.act], say = p.act === "wait" ? WAIT_SAY : cfg && cfg.say;
    if ((p.act === "wait" || p.act === "waiting") && p.info && p.info.question){ speak(p, p.info.question, false, true); return; }
    if (say && !s.hide && Math.random() < 0.6 && !(p.bubble && !p.bubble.grey)) speak(p, pick(say), true);
    if (CHATTY[s.act] && p.status === "idle" && !p.convo){
      const q = [...persons.values()].find(q => q !== p && q.alive && q.status === "idle" && q.mode !== "walk" && q.mode !== "hidden" && q.spot && CHATTY[q.spot.act] === CHATTY[s.act] && !q.convo);
      if (q) startConvo(p, q);
    }
  }
  function needsMove(p, st){
    if (st === "working" || st === "done") return p.spot !== p.desk && (!p.target || p.target !== p.desk);
    if (st === "waiting") return !(p.act === "wait" || p.act === "waiting");
    return p.act === "wait" || p.act === "waiting" || p.act === "working" || p.act === "done";
  }
  function decide(p, st){
    p.statusAt = st;
    if (p.fresh){ go(p, p.desk, st === "working" || st === "done" ? st : "idle", rand(8, 40)); return; }
    if (st === "working" || st === "done"){ go(p, p.desk, st, Infinity); return; }
    if (st === "waiting"){
      const w = freeSpots("wait")[0];
      if (w) go(p, w, "wait", Infinity); else go(p, p.desk, "waiting", Infinity);
      return;
    }
    const research = p.info && Array.isArray(p.info.tools) && p.info.tools.some(x => RESEARCH_TOOLS.has(x));
    const opts = [];
    for (const [act, cfg] of Object.entries(ACTS)){
      if (act === p.act && act !== "desk") continue;
      let w = cfg.w;
      if (act === "research") w *= research ? 5 : 1;
      if (act === "desk") opts.push([act, w, p.desk]);
      else if (act === "chat" || act === "pool"){ const pr = pairUp(p, act), free = freeSpots(act); if (pr) opts.push([act, w, pr]); else if (act === "pool" && free.length) opts.push([act, w, free[0]]); }
      else { const free = freeSpots(act); if (free.length) opts.push([act, w, pick(free)]); }
    }
    let total = opts.reduce((s, o) => s + o[1], 0), r = Math.random() * total, choice = opts[opts.length - 1];
    for (const o of opts){ r -= o[1]; if (r <= 0){ choice = o; break; } }
    const [act, , target] = choice, dur = rand(...ACTS[act].dur);
    if (target.partner){ go(p, target.a, act, dur); go(target.partner, target.b, act, dur); target.partner.statusAt = "idle"; startConvo(p, target.partner); return; }
    go(p, target, act === "desk" ? "idle" : act, dur);
  }
  function pairUp(p, act){
    const partner = [...persons.values()].find(q => q !== p && q.alive && q.kind !== "ceo" && q.status === "idle" && q.mode !== "hidden" && q.act !== act && !q.fresh && !q.leaving);
    if (!partner) return null;
    const free = freeSpots(act);
    if (act !== "chat") return free.length >= 2 ? {a:free[0], b:free[1], partner} : null;
    const pairs = new Map();
    for (const s of free){ if (!pairs.has(s.pair)) pairs.set(s.pair, []); pairs.get(s.pair).push(s); }
    const full = [...pairs.values()].filter(x => x.length === 2);
    if (!full.length) return null;
    const [a, b] = pick(full);
    return {a, b, partner};
  }
  function startConvo(p, q){
    if (!onPair || p.convo || q.convo || p.id === "ceo" || q.id === "ceo") return;
    const c = {a:p, b:q, lines:null, i:0, next:0, started:t};
    p.convo = q.convo = c;
    Promise.resolve().then(() => onPair(p.id, q.id, CHATTY[(p.target || p.spot || {}).act] || "")).then(r => { c.lines = r && Array.isArray(r.lines) && r.lines.length >= 2 ? r.lines : []; }).catch(() => { c.lines = []; });
  }
  function endConvo(c){ for (const x of [c.a, c.b]){ if (x.convo === c){ x.convo = null; x.faceTo = null; } } }
  function convosTick(){
    const seen = new Set();
    for (const p of persons.values()){
      const c = p.convo;
      if (!c || seen.has(c)) continue;
      seen.add(c);
      const away = x => !x.alive || x.mode === "walk" || x.mode === "hidden" || x.convo !== c;
      if (away(c.a) || away(c.b) || t > c.started + 120 || (c.lines && c.i >= c.lines.length && t >= c.next)){ endConvo(c); continue; }
      if (!c.lines || c.i >= c.lines.length || t < c.next) continue;
      const l = c.lines[c.i++], who = l.who === c.b.id ? c.b : c.a;
      c.a.faceTo = c.b; c.b.faceTo = c.a;
      speak(who, l.text, false);
      c.next = t + 3 + Math.min(3, l.text.length / 40);
    }
  }
  function speak(p, text, grey, persist){
    if (!text) return;
    if (p.bubble) p.bubble.dispose();
    p.bubble = new Bubble(text, persist ? "#FFB44D" : "#" + p.fig.base.getHexString(), grey, t, persist);
    scene.add(p.bubble.sprite);
  }

  function think(p, dt){
    if (p.id === "ceo"){ if (p.mode === "walk") walk(p, dt); return; }
    if (!p.alive){
      if (!p.leaving){
        p.leaving = true;
        if (p.mode === "hidden"){ p.gone = true; return; }
        if (p.spot === ENTRANCE && p.mode !== "walk"){ p.gone = true; return; }
        go(p, ENTRANCE, "leave", 0);
      }
      if (p.mode === "walk") walk(p, dt);
      return;
    }
    if (p.fresh && p.mode !== "walk" && p.spot === ENTRANCE){
      if (t < p.enterAt) return;
      p.fig.root.visible = true;
      decide(p, p.status);
    }
    const st = p.status;
    if (p.mode === "walk"){
      if (st !== p.statusAt && (st === "working" || st === "waiting") && !p.fresh) decide(p, st);
      walk(p, dt);
      return;
    }
    if (t >= p.until || (st !== p.statusAt && needsMove(p, st))) decide(p, st);
  }
  function walk(p, dt){
    const w = p.path[p.step];
    if (!w){ arrive(p); return; }
    const dx = w.x - p.pos.x, dz = w.z - p.pos.z, d = Math.hypot(dx, dz), step = WALK * dt;
    if (d <= step){ p.pos.set(w.x, 0, w.z); p.step++; if (p.step >= p.path.length) arrive(p); return; }
    p.pos.x += dx / d * step; p.pos.z += dz / d * step;
    p.yawT = Math.atan2(-dx, -dz); p.phase += dt * WALK * 4.6;
  }

  const want = new T.Color();
  function pose(p, dt, anyWorking){
    const k = 1 - Math.exp(-dt * 3), f = p.fig, isCeo = p.id === "ceo", walking = p.mode === "walk";
    const act = p.act === "pool" && !(p.spot && p.spot.cue) ? "stand" : p.act === "gym" && p.spot && p.spot.gym ? p.spot.gym : p.act;
    const st = isCeo && p.mode === "sit" ? (anyWorking ? "working" : "reading") : walking ? "stand" : (ARMS[act] ? act : p.mode === "sit" ? "idle" : "stand");
    const running = !walking && act === "run";
    if (running && !reduced) p.phase += dt * 9;
    const typing = st === "working" && !reduced, wobble = typing ? Math.sin(t * 9) * 0.08 : 0;
    p.lift = ease(p.lift, hovered === p.id ? 0.06 : 0, k);
    p.sit = ease(p.sit, p.mode === "sit" ? 1 : 0, reduced ? 1 : 1 - Math.exp(-dt * 6));
    p.yaw += wrapAngle(p.yawT - p.yaw) * Math.min(1, dt * 8);
    f.root.position.set(p.pos.x, p.lift + (walking || running ? Math.abs(Math.sin(p.phase)) * 0.03 : 0) + (!walking && p.spot && p.spot.floorY || 0), p.pos.z);
    f.root.rotation.y = p.yaw;
    const sitY = p.spot && p.spot.sitY != null ? p.spot.sitY : 0.5;
    f.hips.position.y = ease(STAND_Y, sitY, p.sit);
    const swing = walking || running ? Math.sin(p.phase) * (running ? 0.75 : 0.55) : 0;
    f.legs.forEach((L, i) => {
      const s = i ? -swing : swing;
      L.hip.rotation.x = ease(s, Math.PI / 2, p.sit);
      L.knee.rotation.x = ease(walking || running ? -Math.max(0, -s) * 1.1 : 0, -Math.PI / 2, p.sit);
    });
    f.body.rotation.x = ease(f.body.rotation.x, st === "done" ? 0.22 : st === "lounge" ? 0.1 : st === "pool" ? 0.35 : 0, k);
    if (p.spot && p.spot.back && p.spot === p.desk) p.spot.back.rotation.x = -0.08 - f.body.rotation.x * 0.8;
    const [L, R] = f.arms;
    if (walking || running){
      L.sh.rotation.x = ease(L.sh.rotation.x, -Math.sin(p.phase) * 0.45, k * 3); R.sh.rotation.x = ease(R.sh.rotation.x, Math.sin(p.phase) * 0.45, k * 3);
      L.el.rotation.x = ease(L.el.rotation.x, 0.3, k); R.el.rotation.x = ease(R.el.rotation.x, 0.3, k);
      L.sh.rotation.z = ease(L.sh.rotation.z, 0.08, k); R.sh.rotation.z = ease(R.sh.rotation.z, -0.08, k);
    } else {
      const [lsh, lel, rsh, rel, rz] = ARMS[st] || ARMS.stand, gesture = st === "chat" || p.convo ? Math.sin(t * 2.2 + p.phase) * 0.15 : 0, curl = st === "bench" ? (Math.sin(t * 3) + 1) * 0.7 : 0;
      L.sh.rotation.x = ease(L.sh.rotation.x, lsh + gesture, k); L.el.rotation.x = ease(L.el.rotation.x, lel + wobble + curl, k * 2); L.sh.rotation.z = ease(L.sh.rotation.z, 0.08, k);
      R.sh.rotation.x = ease(R.sh.rotation.x, rsh - gesture, k); R.el.rotation.x = ease(R.el.rotation.x, rel - wobble + curl, k * 2); R.sh.rotation.z = ease(R.sh.rotation.z, rz, k);
    }
    if (f.cup) f.cup.visible = !walking && (st === "coffee" || st === "water" || st === "snack");
    if (f.cue) f.cue.visible = st === "pool";
    let yaw = 0, pitch = typing ? Math.sin(t * 1.3) * 0.04 : 0;
    if (st === "reading" || st === "research") pitch = -0.4;
    if (st === "done") pitch = 0.12;
    if (st === "phone") yaw = 0.3;
    if (st === "waiting" || st === "wait" || p.faceTo){
      const local = f.body.worldToLocal(p.faceTo ? tmp.copy(p.faceTo.pos).setY(1.3) : tmp.copy(ceoPos));
      yaw = Math.max(-1.2, Math.min(1.2, Math.atan2(-local.x, -local.z)));
      pitch = 0.05;
    }
    f.neck.rotation.y = ease(f.neck.rotation.y, yaw, k); f.neck.rotation.x = ease(f.neck.rotation.x, pitch, k);
    f.shirt.color.lerp(!isCeo && p.status === "idle" ? f.grey : f.base, k);
    if (p.bubble && p.bubble.persist && !((p.act === "wait" || p.act === "waiting") && p.status === "waiting" && p.mode !== "walk")){ p.bubble.dispose(); p.bubble = null; }
    if (p.bubble){
      f.neck.getWorldPosition(p.bubble.sprite.position); p.bubble.sprite.position.y += 0.95;
      p.bubble.sprite.visible = f.root.visible && p.scale > 0.6;
      if (!p.bubble.update(t)){ p.bubble.dispose(); p.bubble = null; }
    }
    if (p.pendingSay && t >= p.sayAt && p.mode !== "hidden" && p.scale > 0.6){ speak(p, p.pendingSay, false); p.pendingSay = null; }
  }
  function screens(dt, anyWorking){
    const k = 1 - Math.exp(-dt * 3), pulse = (Math.sin(t * 1.8) + 1) / 2;
    const all = [persons.get("ceo").desk, ...[...depts.values()].flatMap(e => e.dept.desks)];
    for (const d of all){
      const pid = [...d.users][0], p = pid && persons.get(pid);
      const st = !p ? "idle" : p.id === "ceo" ? (anyWorking ? "working" : "reading") : (SCREEN[p.status] ? p.status : "idle");
      if (!d.col) d.col = new T.Color(SCREEN.idle);
      d.col.lerp(want.setHex(SCREEN[st]), k);
      d.screens.forEach((s, i) => {
        const sm = s.material; sm.emissive.copy(d.col);
        const needLines = i === 0 && st === "working" && p && p.id !== "ceo";
        if ((sm.emissiveMap === lines) !== needLines){ sm.emissiveMap = needLines ? lines : null; sm.needsUpdate = true; }
        sm.emissiveIntensity = st === "idle" ? 0.25 : st === "reading" ? 0.9 : 1.1;
      });
      const ring = d.ring.material;
      ring.opacity = ease(ring.opacity, st === "waiting" ? 0.4 + pulse * 0.45 : 0, k * 2);
      d.ring.scale.setScalar(1 + pulse * 0.08);
    }
  }
  function settle(dt){
    const k = reduced ? 1 : 1 - Math.exp(-dt * 4);
    for (const e of depts.values()){
      e.scale = ease(e.scale, e.alive ? 1 : 0, k);
      e.dept.group.scale.setScalar(Math.max(0.001, e.scale));
      if (!e.alive && e.scale < 0.02){ disposeDept(e); depts.delete(e.key); }
    }
    for (const q of persons.values()){
      if (q.id === "ceo") continue;
      const show = q.alive ? !(q.fresh && q.spot === ENTRANCE && q.mode !== "walk") : !q.gone;
      q.scale = ease(q.scale, show ? 1 : 0, k);
      q.fig.root.scale.setScalar(Math.max(0.001, q.scale) * (q.kind === "subagent" ? 0.9 : 1));
      if (!q.alive && q.gone && q.scale < 0.02){
        if (q.bubble) q.bubble.dispose();
        if (q.convo) endConvo(q.convo);
        for (const s of spots) s.users.delete(q.id);
        if (q.desk) q.desk.users.delete(q.id);
        disposeTree(q.fig.root, [q.fig.shirt]); persons.delete(q.id);
      }
    }
  }

  function besideSpot(desk){
    const cx = desk.door[0], side = cx > desk.at[0] ? 1 : -1, x = desk.at[0] + side * 0.75;
    return spot({act:"visit", at:[x, desk.at[1]], rot:side > 0 ? 90 : 270, door:desk.door, inside:[desk.inside[0], [cx, desk.at[1]], [x, desk.at[1]]]});
  }
  function visitsTick(){
    while (!visit && visits.length){
      const v = visits.shift();
      if (!v.to.alive || !v.by || !v.by.alive || v.to === v.by || !v.to.desk) continue;
      visit = v; v.spot = besideSpot(v.to.desk); v.state = "going"; v.until = t + 60;
      go(v.by, v.spot, "visit", Infinity);
      if (v.to.spot !== v.to.desk || v.to.mode === "walk") go(v.to, v.to.desk, v.to.status === "working" ? "working" : "idle", 90); else v.to.until = Math.max(v.to.until, t + 90);
    }
    if (!visit) return;
    const v = visit;
    if (v.state === "going" && v.by.spot === v.spot && v.by.mode !== "walk"){ v.state = "asking"; v.until = t + 25; v.to.faceTo = v.by; v.by.faceTo = v.to; speak(v.by, v.text, false); }
    if (v.state === "asking" && (v.reply || t >= v.until)){ v.state = "replying"; v.until = t + (v.reply ? 7 : 1); if (v.reply) speak(v.to, v.reply, false); }
    if ((v.state === "replying" && t >= v.until) || t >= v.until + 60 || !v.to.alive || !v.by.alive){
      v.to.faceTo = null; v.by.faceTo = null; v.to.until = Math.min(v.to.until, t);
      if (v.by.alive) go(v.by, v.by.desk, v.by.id === "ceo" ? "working" : (v.by.status === "working" ? "working" : "idle"), v.by.id === "ceo" ? Infinity : 5);
      visit = null;
    }
  }
  function atSpot(s){ const p = persons.get([...s.users][0]); return p && p.spot === s && p.mode === "stand" ? p : null; }
  function recRoom(dt){
    const playing = dyn.pool.every(atSpot);
    let moving = false;
    for (const ball of dyn.balls){
      if (Math.hypot(...ball.v) < 0.02){ ball.v = [0, 0]; continue; }
      moving = true;
      const m = ball.mesh.position, f = Math.max(0, 1 - 1.1 * dt);
      m.x += ball.v[0] * dt; m.z += ball.v[1] * dt; ball.v[0] *= f; ball.v[1] *= f;
      if (m.x < 7.05 || m.x > 8.95){ ball.v[0] *= -1; m.x = Math.max(7.05, Math.min(8.95, m.x)); }
      if (m.z < 7.95 || m.z > 8.85){ ball.v[1] *= -1; m.z = Math.max(7.95, Math.min(8.85, m.z)); }
      ball.mesh.rotation.x += ball.v[1] * dt / 0.035; ball.mesh.rotation.z -= ball.v[0] * dt / 0.035;
    }
    if (!playing) dyn.nextShot = t + 1.5;
    else if (!moving && t >= (dyn.nextShot || 0)){
      const ball = pick(dyn.balls), a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random();
      ball.v = [Math.cos(a) * sp, Math.sin(a) * sp]; dyn.nextShot = t + 3 + Math.random() * 3;
    }
    for (const d of dyn.darts){
      const p = atSpot(d.spot);
      if (!p){ d.next = t + 2; continue; }
      if (d.fly){
        const u = Math.min(1, (t - d.fly.t0) / 0.35);
        d.fly.mesh.position.lerpVectors(d.fly.from, d.fly.to, u); d.fly.mesh.position.y += Math.sin(u * Math.PI) * 0.12;
        if (u >= 1){ d.stuck.push(d.fly.mesh); d.fly = null; d.next = t + 2.5 + Math.random() * 2; if (Math.random() < 0.5) speak(p, pick(ACTS.darts.say), true); }
      } else if (t >= d.next){
        if (d.stuck.length >= 3) d.stuck.splice(0).forEach(m => { m.visible = false; });
        const mesh = d.pool.find(m => !m.visible);
        if (!mesh) continue;
        const a = Math.random() * Math.PI * 2, r = Math.random() * 0.22;
        mesh.visible = true;
        d.fly = {mesh, t0:t, from:new T.Vector3(d.spot.at[0] + 0.2, 1.35, d.spot.at[1] + 0.25 - SZ), to:new T.Vector3(11.3 + Math.cos(a) * r, 1.6 + Math.sin(a) * r, FLOOR.z1 - SZ - 0.22)};
      }
    }
    dyn.arcade.material.emissiveIntensity = 0.6 + Math.max(0, Math.sin(t * 5.3)) * 0.6;
  }

  let last = performance.now(), raf = 0, flick = 0;
  function frame(now){
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reduced) t += dt;
    settle(dt);
    const ceo = persons.get("ceo"); if (ceo) ceo.fig.neck.getWorldPosition(ceoPos);
    let anyWorking = false;
    for (const p of persons.values()) if (p.id !== "ceo" && p.alive && p.status === "working") anyWorking = true;
    visitsTick(); convosTick();
    for (const p of persons.values()) think(p, dt);
    for (const p of persons.values()) pose(p, dt, anyWorking);
    screens(dt, anyWorking);
    lines.offset.y = -(t * 0.35) % 1;
    if (!reduced){
      if (flick > 0){ flick -= dt; signMat.opacity = 0.55 + Math.random() * 0.3; glowMat.opacity = 0.3; }
      else { signMat.opacity = 1; glowMat.opacity = 0.75; if (Math.random() < dt / 25) flick = 0.12 + Math.random() * 0.15; }
      signLight.intensity = 8 * signMat.opacity;
      steam.forEach(s => {
        s.userData.t = (s.userData.t + dt * 0.25) % 1;
        const u = s.userData.t;
        s.position.set(1.4 + Math.sin(u * 9) * 0.04, 1.4 + u * 0.55, -7.6 + Math.cos(u * 7) * 0.03);
        s.material.opacity = Math.sin(u * Math.PI) * 0.45; s.scale.setScalar(0.1 + u * 0.16);
      });
      sway.forEach((g, i) => { g.rotation.z = Math.sin(t * 0.6 + i) * 0.015; g.rotation.x = Math.cos(t * 0.5 + i * 2) * 0.01; });
      LED.emissiveIntensity = 0.8 + Math.max(0, Math.sin(t * 7)) * 1.2;
      recRoom(dt);
      const printing = spots.some(s => s.act === "printer" && s.users.size);
      dyn.paper.position.z = printing ? -7.5 + ((t * 0.3) % 1) * 0.4 : -7.5;
      dyn.paper.visible = printing;
    }
    placeCamera(dt);
    renderer.render(scene, cam);
    placeTags();
  }
  function start(){ if (!raf){ last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop(){ cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  start();

  return {
    renderer, scene, view, cur, resetView, flyTo, zoomAt, floorUnder,
    setLayout(o){ if (o && o.desks && o.desks.ceo){ desks = {ceo:o.desks.ceo}; placeCeo(); } },
    setDepartments, setNames,
    departments(){ return [...depts.values()].filter(e => e.alive).map(e => e.key); },
    seated(){ return [...persons.values()].filter(p => p.alive).map(p => p.id); },
    send(id, act){ const p = persons.get(id), s = freeSpots(act)[0]; if (p && s) go(p, s, act, 90); },
    visit(to, by, text){ visits.push({to:persons.get(to), by:persons.get(by || "ceo"), text}); },
    where(){ return [...persons.values()].filter(p => p.alive && p.id !== "ceo").map(p => ({id:p.id, mode:p.mode, act:p.act, x:+p.pos.x.toFixed(2), z:+p.pos.z.toFixed(2)})); }
  };
}
