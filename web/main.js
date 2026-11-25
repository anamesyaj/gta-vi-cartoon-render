import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt } from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const M = {
  plank: texM(P.planks(1), 1, 6), beam: texM(P.beam(2), 1, 2), beamDark: texM(P.beam(3, [28, 36, 30]), 1, 2),
  rot: texM(P.rotten(4), 1, 1), rotB: texM(P.rotten(14), 1, 1),
  stone: texM(P.stone(4), 1, 1), stoneMoss: texM(P.mossy(P.stone(4), 5, 1.2), 1, 1),
  grass: texM(P.grass(6), 40, 40), dirt: texM(P.dirt(7), 6, 30), plaster: texM(P.plaster(8), 1, 1), plaster2: texM(P.plaster(18, 28), 1, 1),
  roof: texM(P.roof(9), 2, 2), marble: texM(P.marble(10), 1, 1), marbleTop: toon({ color: '#ece2cf' }),
  trunk: toon({ color: '#6a4a32' }), cypress: toon({ color: '#3f6b36' }), pine: toon({ color: '#5c8a3c' }), bush: toon({ color: '#6c9a42' }),
  hill: toon({ color: '#7aa64c' }), hillFar: toon({ color: '#86ad60' }), mount: toon({ color: '#8fa7b8' }), snow: toon({ color: '#f4f6fa' }),
  iron: toon({ color: '#5c5a57' }), bronze: toon({ color: '#b08a4a' }), wood: toon({ color: '#7a5434' }), door: toon({ color: '#5a3a24' }),
  window: toon({ color: '#2b2430' }), red: toon({ color: '#b8282b' }),
};
M.banner = new THREE.MeshToonMaterial({ gradientMap: grad, map: P.tex(P.banner()), alphaTest: 0.5, side: THREE.DoubleSide });
// helmet
const helmetIn = P.tex(P.helmetInside()); helmetIn.wrapS = helmetIn.wrapT = THREE.ClampToEdgeWrapping;
M.helmIn = new THREE.MeshToonMaterial({ gradientMap: grad, map: helmetIn, side: THREE.BackSide });
M.helmOut = toon({ color: '#8f8a7e' });

// ---------- ink / normal-depth contract ----------
const NOINK = 'noink'; // userData flag: never outlined (cards, fx, water handled specially)
const ndMat = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; varying float vD; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vN; varying float vD; void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*.5+.5, vD); }`,
  side: THREE.DoubleSide,
});
const cardNd = (map) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map } },
  vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`,
  side: THREE.DoubleSide,
});
const waterNd = new THREE.ShaderMaterial({
  vertexShader: `varying float vD; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying float vD; void main(){ gl_FragColor=vec4(.5,1.,.5,vD); }`,
});

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const uvScale = (geo, su, sv) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; };
/** box with world-scaled UVs per face (texel density 1 tile per `t` metres) */
const tbox = (w, h, d, t = 2) => {
  const g = box(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
  return g;
};

// ---------- sky ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize; varying vec3 vP;
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .35*pow(max(s,0.), 24.)*step(.001,sunSize));
      gl_FragColor = vec4(c,1.); }`,
}));
sky.userData.sky = true; scene.add(sky);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
const lampLight = new THREE.PointLight('#ffb46c', 14, 12, 1.6); lampLight.position.set(0.3, 8.2, -2.4); scene.add(lampLight);
const screenLight = new THREE.PointLight('#7fd4ff', 9, 10, 1.6); screenLight.position.set(-2.7, 8.4, -2.2); scene.add(screenLight);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ---------- world ----------
const DECK = 6;
const world = new THREE.Group(); scene.add(world);
// --- painted canvas textures for this story ---
const posterCanvas = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 340; const g = c.getContext('2d');
  g.fillStyle = '#f2e6c8'; g.fillRect(0, 0, 256, 340);
  g.fillStyle = '#e8b23a'; g.beginPath(); g.arc(200, 60, 34, 0, 7); g.fill();
  g.fillStyle = '#c97e2e'; g.beginPath(); // rough Australia blob
  g.moveTo(40, 120); g.lineTo(90, 95); g.lineTo(150, 100); g.lineTo(205, 130); g.lineTo(215, 180); g.lineTo(185, 215); g.lineTo(150, 235); g.lineTo(120, 215); g.lineTo(80, 225); g.lineTo(55, 185); g.lineTo(35, 155); g.closePath(); g.fill();
  g.fillStyle = '#8a5a34'; g.beginPath(); g.ellipse(150, 300, 60, 10, 0, 0, 7); g.fill();
  return c; })();
const screenCanvas = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 300; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, '#7ec8f2'); gr.addColorStop(0.6, '#c3e8f7'); gr.addColorStop(0.6, '#5d8a3a'); gr.addColorStop(1, '#3f6b36');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 300);
  g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(420, 60, 34, 0, 7); g.fill();
  g.fillStyle = '#4a7a2e'; g.beginPath(); g.ellipse(140, 210, 180, 60, 0, 0, 7); g.fill();
  g.fillStyle = '#6c9a42'; g.beginPath(); g.ellipse(380, 230, 200, 55, 0, 0, 7); g.fill();
  g.fillStyle = '#8a5a34'; g.fillRect(230, 180, 52, 120);
  g.fillStyle = '#f2f2f2'; g.beginPath(); g.ellipse(120, 70, 60, 18, 0, 0, 7); g.ellipse(180, 85, 45, 14, 0, 0, 7); g.fill();
  return c; })();
// --- materials ---
const wallMat = M.plaster2.clone(); wallMat.color.set('#7a80a8'); const floorMat = M.plank;
const screenMat = new THREE.MeshToonMaterial({ gradientMap: grad, map: P.tex(screenCanvas) });
const posterMat = new THREE.MeshToonMaterial({ gradientMap: grad, map: P.tex(posterCanvas) });
const darkGlass = new THREE.MeshBasicMaterial({ color: '#0d1533' });
const moonMat = new THREE.MeshBasicMaterial({ color: '#f4ecd8' });
const starMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const lampShadeMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0' });
const lapMat = new THREE.MeshBasicMaterial({ color: '#7fd4ff' });
const rugMat = toon({ color: '#7a4a6b' });
const bedMat = toon({ color: '#5d8a3a' });
const chairWood = toon({ color: '#7a5434' });
const snackCols = ['#c4452c', '#e8b23a', '#5d8a3a', '#3f7fb8', '#c25a7a', '#e6b13a', '#8a5a34', '#4f7fb8'].map((c) => toon({ color: c }));
// --- bedroom shell (floor y=DECK) ---
add(tbox(16, 0.3, 13, 2), floorMat, 0, DECK - 0.15, 0, world);
const rug = add(new THREE.PlaneGeometry(5.2, 3.6), rugMat, 0, DECK + 0.02, 1.4, world, { cast: false }); rug.rotation.x = -Math.PI / 2;
add(tbox(16, 6, 0.3, 2), wallMat, 0, DECK + 3, -4.5, world);
add(tbox(0.3, 6, 13, 2), wallMat, -8, DECK + 3, 0, world);
add(tbox(0.3, 6, 13, 2), wallMat, 8, DECK + 3, 0, world);
// --- window with night sky + moon ---
add(new THREE.PlaneGeometry(2.6, 2.8), darkGlass, 3.4, DECK + 2.8, -4.32, world, { cast: false });
for (const [dx, dy] of [[-0.9, 0.9], [-0.4, 1.1], [0.3, 0.6], [0.9, 1.0], [0.6, -0.7]]) add(new THREE.PlaneGeometry(0.09, 0.09), starMat, 3.4 + dx, DECK + 2.8 + dy, -4.3, world, { cast: false });
const moon = add(new THREE.CircleGeometry(0.32, 24), moonMat, 4.0, DECK + 3.6, -4.3, world, { cast: false });
add(tbox(2.9, 0.14, 0.1, 1), chairWood, 3.4, DECK + 4.25, -4.32, world);
add(tbox(2.9, 0.14, 0.1, 1), chairWood, 3.4, DECK + 1.35, -4.32, world);
add(tbox(0.14, 3.0, 0.1, 1), chairWood, 2.05, DECK + 2.8, -4.32, world);
add(tbox(0.14, 3.0, 0.1, 1), chairWood, 4.75, DECK + 2.8, -4.32, world);
// --- Australia poster ---
add(tbox(2.0, 2.6, 0.08, 1), chairWood, -3.6, DECK + 2.9, -4.34, world);
add(new THREE.PlaneGeometry(1.8, 2.4), posterMat, -3.6, DECK + 2.9, -4.29, world, { cast: false });
// --- wall clock (hands driven by worldState) ---
const clockFace = add(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 32), toon({ color: '#f2ead8' }), 0.6, DECK + 3.8, -4.32, world);
clockFace.rotation.x = Math.PI / 2;
const minHand = new THREE.Group(); minHand.position.set(0.6, DECK + 3.8, -4.26); world.add(minHand);
add(tbox(0.05, 0.48, 0.02, 1), toon({ color: '#241726' }), 0, 0.2, 0, minHand);
const hourHand = new THREE.Group(); hourHand.position.set(0.6, DECK + 3.8, -4.25); world.add(hourHand);
add(tbox(0.06, 0.32, 0.02, 1), toon({ color: '#241726' }), 0, 0.13, 0, hourHand);
// --- desk + monitors + lamp ---
add(tbox(3.6, 0.14, 1.5, 1), chairWood, -1.5, DECK + 0.95, -2.9, world);
for (const [lx, lz] of [[-3.2, -3.5], [0.2, -3.5], [-3.2, -2.3], [0.2, -2.3]]) add(tbox(0.12, 0.95, 0.12, 1), chairWood, lx, DECK + 0.48, lz, world);
add(tbox(1.85, 1.15, 0.1, 1), toon({ color: '#1c1e24' }), -1.5, DECK + 2.0, -3.5, world);
add(new THREE.PlaneGeometry(1.7, 1.0), screenMat, -1.5, DECK + 2.0, -3.44, world, { cast: false });
add(tbox(0.2, 0.5, 0.3, 1), toon({ color: '#1c1e24' }), -1.5, DECK + 1.05, -3.48, world);
const laptop = add(new THREE.PlaneGeometry(0.95, 0.6), lapMat, 0.15, DECK + 1.55, -2.75, world, { cast: false }); laptop.rotation.y = -0.45; laptop.rotation.x = -0.15;
add(tbox(1.0, 0.05, 0.7, 1), toon({ color: '#2e3138' }), 0.15, DECK + 1.22, -2.75, world);
add(new THREE.CylinderGeometry(0.09, 0.12, 0.5, 10), toon({ color: '#3a3f4a' }), 0.3, DECK + 1.25, -3.2, world);
add(new THREE.ConeGeometry(0.32, 0.3, 12, 1, true), lampShadeMat, 0.3, DECK + 1.6, -3.2, world);
// --- chair (rib-slat back for the skeleton gag) ---
const chair = new THREE.Group(); chair.position.set(0, DECK, -0.4); world.add(chair);
add(tbox(1.0, 0.12, 0.95, 1), chairWood, 0, 0.55, 0, chair);
for (let i = -2; i <= 2; i++) add(tbox(0.13, 1.25, 0.08, 1), chairWood, i * 0.19, 1.25, -0.44, chair);
add(tbox(1.0, 0.12, 0.08, 1), chairWood, 0, 1.9, -0.44, chair);
for (const [lx, lz] of [[-0.42, -0.4], [0.42, -0.4], [-0.42, 0.4], [0.42, 0.4]]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), chairWood, lx, 0.27, lz, chair);
// --- snack tower (boxes revealed by worldState) ---
const snackGroup = new THREE.Group(); snackGroup.position.set(1.4, DECK, -1.6); world.add(snackGroup);
const snackBoxes = [];
for (let i = 0; i < 8; i++) {
  const w = 0.62 - i * 0.03;
  const b = add(tbox(w, 0.3, w, 1), snackCols[i], (i % 2 ? 0.04 : -0.04), 0.15 + i * 0.3, 0, snackGroup);
  b.visible = false; snackBoxes.push(b);
}
const snackTopper = add(new THREE.SphereGeometry(0.2, 12, 8), toon({ color: '#e8b23a' }), 0, 0.15 + 8 * 0.3 + 0.12, 0, snackGroup); snackTopper.visible = false;
// --- bed + shelf dressing ---
add(tbox(3.2, 0.5, 1.8, 1), chairWood, -5.2, DECK + 0.25, 1.6, world);
add(tbox(3.0, 0.3, 1.7, 1), toon({ color: '#f2ead8' }), -5.2, DECK + 0.65, 1.6, world);
add(tbox(0.7, 0.25, 1.2, 1), toon({ color: '#ffffff' }), -6.4, DECK + 0.9, 1.6, world);
add(tbox(2.0, 0.18, 1.75, 1), bedMat, -4.6, DECK + 0.85, 1.6, world);
add(tbox(2.2, 0.1, 0.6, 1), chairWood, 5.2, DECK + 2.2, -4.2, world);
for (let i = 0; i < 4; i++) add(tbox(0.22, 0.55 + (i % 2) * 0.15, 0.4, 1), snackCols[(i + 2) % 8], 4.5 + i * 0.3, DECK + 2.5, -4.2, world);
// --- pool set (explanatory world, offset x=+40, ground y=0) ---
const poolGround = add(new THREE.PlaneGeometry(18, 18), M.grass, 40, 0.01, 0, world, { cast: false }); poolGround.rotation.x = -Math.PI / 2;
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const waterMat = new THREE.ShaderMaterial({
  uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...waterU }, fog: true,
  vertexShader: `#include <fog_pars_vertex>
    varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vec4 mvPosition = viewMatrix*w; gl_Position = projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader: `#include <fog_pars_fragment>
    uniform float t; uniform vec3 deep, shal, glint; varying vec3 vW;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
    void main(){ vec2 p = vW.xz*vec2(.35,.12) + vec2(0., -t*.25);
      float n = noise(p) * .6 + noise(p*2.3 + 7.) * .4; float edge = smoothstep(10., 17., abs(vW.x));
      vec3 c = mix(deep, shal, .35 + .4*n + .4*edge);
      float streak = smoothstep(.72, .78, noise(vW.xz*vec2(.8,.09) + vec2(0., -t*.6))) * (1.-edge*.5);
      c = mix(c, glint, streak*.75);
      gl_FragColor = vec4(c,1.);
      #include <fog_fragment>
    }`,
});
for (const [px, pz, pw, pd] of [[40, -1.55, 4.8, 0.3], [40, 1.55, 4.8, 0.3], [37.7, 0, 0.3, 2.8], [42.3, 0, 0.3, 2.8]])
  add(tbox(pw, 0.5, pd, 1), toon({ color: '#e8e2d4' }), px, 0.25, pz, world);
const poolWater = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.8), waterMat); poolWater.rotation.x = -Math.PI / 2; poolWater.position.set(40, 0.42, 0); poolWater.userData.nd = waterNd; world.add(poolWater);
add(tbox(0.5, 0.9, 0.5, 1), chairWood, 37.2, 0.45, 0, world);
const board = add(tbox(2.6, 0.1, 0.6, 1), M.plank, 38.3, 1.0, 0, world); board.rotation.z = -0.06;
// tap at pool edge + trickle
add(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 10), toon({ color: '#8f8a7e' }), 42.0, 0.55, 1.3, world);
add(tbox(0.5, 0.14, 0.14, 1), toon({ color: '#b08a4a' }), 41.85, 1.08, 1.3, world);
const tapHandle = new THREE.Group(); tapHandle.position.set(42.0, 1.18, 1.3); world.add(tapHandle);
add(tbox(0.34, 0.06, 0.1, 1), toon({ color: '#c4452c' }), 0, 0, 0, tapHandle);
const trickleGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.62, 8); trickleGeo.translate(0, -0.31, 0);
const trickle = new THREE.Mesh(trickleGeo, new THREE.MeshBasicMaterial({ color: '#9fd4ff' })); trickle.position.set(41.62, 1.05, 1.3); trickle.visible = false; trickle.userData.ndSkip = true; world.add(trickle);
// no clouds at night; keep the name for renderFrame
const clouds = [];
// ---------- helmet prop (unused in this story; stub keeps helmetState safe) ----------
const helmet = new THREE.Group(); scene.add(helmet); helmet.visible = false;

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25; // canvas px, card height in metres (design 600x1000 -> 2.25 m)
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor(scale = 1) {
    [this.c, this.g] = (() => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; return [c, c.getContext('2d')]; })();
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(cardGeo, this.mat); this.mesh.userData.nd = cardNd(this.t); this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.userData.ndSkip = true; this.blob.renderOrder = 1;
    scene.add(this.mesh); scene.add(this.blob); this.key = ''; this.mesh.visible = this.blob.visible = false;
  }
  draw(key, fn) {
    if (key === this.key) return; this.key = key;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CW, CH); g.setTransform(CW / 600, 0, 0, CH / 1000, 0, 0);
    const p = new T.Pen(g); fn(p); this.t.needsUpdate = true;
  }
}
const cards = []; const getCard = (i) => cards[i] || (cards[i] = new Card());

// ---------- render targets & post ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };
const inkU = { col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, px: { value: 1.6 }, fogCol: { value: new THREE.Color() },
  sat: { value: 1.08 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 } };
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
  float edgeAt(vec2 uv, float r){
    vec4 c = texture2D(nd, uv); if (dot(c.rgb,c.rgb) < .01) return 0.; float d = c.a; vec3 n = c.rgb*2.-1.;
    float e = 0.; float rr = r * clamp(7./d, .62, 1.25);
    for (int i=0;i<16;i++){ float a = float(i)*.785398 + (i>7 ? .39 : 0.); float k = i>7 ? .5 : 1.;
      vec2 o = vec2(cos(a), sin(a))*rr*k/res; vec4 s = texture2D(nd, uv+o);
      float ds = s.a; bool card = dot(s.rgb,s.rgb) < .01;
      if (card && ds > 0.) continue;            // character cards: never outlined by the world ink
      if (card) ds = 1e4;                        // sky
      vec3 ns = s.rgb*2.-1.;
      e = max(e, smoothstep(.006, .02, (ds - d)/d));                           // depth jump, near side only
      if (!card && abs(ds-d)/d < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .9); // crease
    }
    return e * (1. - smoothstep(140., 520., d)*.8);
  }
  void main(){
    vec3 c = texture2D(col, vUv).rgb;
    float e = edgeAt(vUv, px);
    c = mix(c, vec3(.012,.01,.014), e);
    if (flash < -0.5) c = vec3(e);
    float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
    c = c*gain + lift;
    vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.2;
    c = mix(c, vec3(1.), flash);
    gl_FragColor = vec4(c,1.); }` }));
const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
  float coc(vec2 uv){ float d = texture2D(nd, uv).a; if (d <= 0.) d = 2000.; float k = 1. - focus/d; return k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); }
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3), 1.)); }` }));
// final copy with sRGB handled by the renderer output (we render to screen with linear->sRGB in the shader chunk)
dofScene.children[0].material.toneMapped = false;

// ---------- per-frame state ----------
const tmpV = new THREE.Vector3();
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
  waterU.deep.value.set(L.waterDeep); waterU.shal.value.set(L.waterShal); waterU.glint.value.set(L.glint);
  lampLight.intensity = 14 * (L.lamp ?? 1); screenLight.intensity = 9 * (L.screen ?? 1);
}
function placeSun(L, focus) {
  // sun direction from azimuth/elevation in world space
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}

function worldState(S, f) {
  snackBoxes.forEach((bw, i) => { bw.visible = S.tower * snackBoxes.length > i; });
  snackTopper.visible = S.tower * snackBoxes.length > 7.5;
  snackGroup.rotation.z = S.wobble ? Math.sin(f * 0.45) * 0.035 * S.wobble : 0;
  snackGroup.rotation.x = S.wobble ? Math.cos(f * 0.4) * 0.02 * S.wobble : 0;
  minHand.rotation.z = -0.12 - (S.clockT || 0) * 0.3;
  hourHand.rotation.z = -0.35 - (S.clockT || 0) * 0.04;
  tapHandle.rotation.z = (S.tap || 0) * 1.4;
  trickle.visible = (S.trickle || 0) > 0.01;
  trickle.scale.y = Math.max(0.01, (S.trickle || 0) * 0.9);
  poolWater.position.y = 0.42 + (S.waterLevel || 0) * 0.05;
  const sv = 0.55 + 0.45 * (S.screens ?? 1);
  screenMat.color.setRGB(sv, sv, sv);
  waterU.t.value = f / 30;
}

function drawActors(list, cam) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i);
    c.draw(a.key, a.draw);
    c.mesh.visible = true; c.mesh.position.set(a.x, a.y, a.z);
    const s = a.s || 1; c.mesh.scale.set(s * (a.flip ? -1 : 1), s, s);
    c.mesh.rotation.set(0, Math.atan2(cam.position.x - a.x, cam.position.z - a.z) + (a.yaw || 0), a.roll || 0);
    c.mat.color.set(a.tint || '#ffffff'); c.mat.opacity = a.alpha ?? 1;
    c.mesh.castShadow = a.shadow !== false;
    c.mesh.renderOrder = a.order || 2;
    if (a.blob !== false && a.y < DECK + 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? DECK) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}

const helmetState = (h) => {
  helmet.visible = !!h; if (!h) return;
  helmet.position.set(h.x, h.y, h.z); helmet.rotation.set(h.rx || 0, h.ry || 0, h.rz || 0); helmet.scale.setScalar(h.s || 0.17);
};

const swapForNd = (on) => {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      o.userData.mat0 = o.material;
      if (o.userData.ndSkip) { o.userData.vis0 = o.visible; o.visible = false; return; }
      if (o === sky || o.userData.sky) { o.userData.vis0 = o.visible; o.visible = false; return; }
      o.material = o.userData.nd || ndMat;
    } else {
      o.material = o.userData.mat0; if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
    }
  });
};

window.renderFrame = (f) => {
  const S = shotAt(f), L = lightFor(S, f), C = camAt(f);
  applyLight(L, f);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const W_ = worldAt(f); worldState(W_, f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors([...actorsAt(f, T), ...fxAt(f, T)], camera);
  helmetState(W_.helmet);
  sky.position.copy(camera.position);
  for (const c of clouds) c.quaternion.copy(camera.quaternion);
  // pass A: colour
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  // pass B: normal + depth
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  if (window.DEBUG_ND) { const dm = new THREE.MeshBasicMaterial({ map: rtNd.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  // ink + grade
  const D = dofAt(f);
  inkU.px.value = 2.5; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  // lens
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
