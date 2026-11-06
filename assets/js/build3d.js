// Multihall: uma unidade em construção a seco se monta peça a peça conforme o scroll.
// Estrutura (0-0,26) -> telhado (0,26-0,46) -> paredes e divisórias (0,46-0,66) -> forro (0,66-0,82)
// -> a unidade fecha e se multiplica (0,82-1). Tudo é material sólido: perfis com seção em C e U,
// chapas com espessura, OSB, telha, luz com sombra. Poucas chamadas de desenho: cada par
// geometria + material é um InstancedMesh, e cada peça tem a sua janela de tempo.
//
// API: mountBuild(canvas, { mobile, reducedMotion, poster, start }) -> { setProgress, pause, resume, dispose, ready, info }
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

export const PHASES = {
  estrutura: [0, 0.26],
  telhado: [0.26, 0.46],
  paredes: [0.46, 0.66],
  forro: [0.66, 0.82],
  empreendimento: [0.82, 1],
};
/** até onde a introdução monta sozinha (laje, guias e a parede do fundo subindo) */
export const INTRO_END = 0.16;
const INTRO_MS = 2400;

// ---------------------------------------------------------------- medidas da unidade (m)
const W = 6, D = 4.4, H = 2.7;          // largura (x), profundidade (z), pé-direito
const OVER = 0.4, RISE = 1.1;           // beiral e altura da cumeeira sobre o pé-direito
const WALL = 0.09;                      // espessura da parede (alma do montante)
const PART_X = -0.6;                    // divisória interna, paralela a z
const DOOR = [-2.2, -1.3], WIN = [0.4, 1.9], WIN_Y = [1.0, 2.1], DOOR_H = 2.1;
const PDOOR = [1.0, 1.9];               // vão da divisória (z)
const SHEET = 0.02;                     // chapas (gesso, OSB, cimentícia): espessura exagerada de propósito, para ler na tela
const CEIL = H - 0.25;                  // nível dos perfis do forro
const SLOPE = Math.hypot(D / 2 + OVER, RISE), PITCH = Math.atan2(RISE, D / 2 + OVER);
// cópias da unidade pronta (empreendimento): posições em volta da original
const COPIES = [[-9, 0], [9, 0], [-9, -7.5], [0, -7.5], [9, -7.5], [-9, 7.5], [0, 7.5], [9, 7.5]];

// ---------------------------------------------------------------- texturas procedurais
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}
const rnd = (() => { let s = 1234567; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();

function osbTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#c69a5a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * w, y = rnd() * h, lw = 18 + rnd() * 70, lh = 6 + rnd() * 18;
      const l = 0.5 + rnd() * 0.5;
      g.save(); g.translate(x, y); g.rotate((rnd() - 0.5) * 1.2);
      g.fillStyle = `rgba(${Math.round(150 * l + 60)},${Math.round(105 * l + 40)},${Math.round(55 * l + 20)},${0.45 + rnd() * 0.4})`;
      g.fillRect(-lw / 2, -lh / 2, lw, lh); g.restore();
    }
  });
}
function noiseTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = 236 + Math.round((rnd() - 0.5) * 14);
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  });
}
function shingleTexture() {
  // uma fiada de shingle: base escura com grão e cortes das abas
  return canvasTex(512, 64, (g, w, h) => {
    g.fillStyle = '#51555c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 60 + rnd() * 70; g.fillStyle = `rgba(${v},${v + 2},${v + 6},${0.35 + rnd() * 0.4})`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 1 + rnd() * 2);
    }
    g.fillStyle = 'rgba(0,0,0,.55)';
    for (let x = 0; x < w; x += 128) g.fillRect(x + 62, 6, 3, h - 6);
    const gr = g.createLinearGradient(0, 0, 0, 10); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, 10);
  }, [12, 1]);
}
function floorTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(70,88,130,.55)'); gr.addColorStop(0.5, 'rgba(40,52,86,.28)'); gr.addColorStop(1, 'rgba(13,20,38,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

// ---------------------------------------------------------------- geometrias
/** perfil em C (montante) ou U (guia), extrudado ao longo de z, centrado: comprimento = escala z */
function profileGeo(h, b, t, lip) {
  const s = new THREE.Shape();
  const pts = lip
    ? [[0, -h / 2], [b, -h / 2], [b, -h / 2 + lip], [b - t, -h / 2 + lip], [b - t, -h / 2 + t], [t, -h / 2 + t],
       [t, h / 2 - t], [b - t, h / 2 - t], [b - t, h / 2 - lip], [b, h / 2 - lip], [b, h / 2], [0, h / 2]]
    : [[0, -h / 2], [b, -h / 2], [b, -h / 2 + t], [t, -h / 2 + t], [t, h / 2 - t], [b, h / 2 - t], [b, h / 2], [0, h / 2]];
  s.moveTo(pts[0][0] - b / 2, pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0] - b / 2, pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -0.5);
  g.computeVertexNormals();
  return g;
}
/** prisma triangular (sótão fechado das unidades prontas): base D, altura RISE*0.95, comprimento ao longo de x */
function gableGeo() {
  const s = new THREE.Shape();
  s.moveTo(-D / 2, 0); s.lineTo(D / 2, 0); s.lineTo(0, RISE * 0.95); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: false });
  g.translate(0, 0, -W / 2); g.rotateY(Math.PI / 2);
  return g;
}

// ---------------------------------------------------------------- cena: registros por grupo
function buildScene(mobile) {
  const groups = {};
  const rec = (name) => (groups[name] ||= { pos: [], quat: [], scl: [], t: [], off: [], n: 0 });
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);
  const add = (name, p, q, s, t0, t1, off) => {
    const g = rec(name);
    g.pos.push(p[0], p[1], p[2]); g.quat.push(q.x, q.y, q.z, q.w); g.scl.push(s[0], s[1], s[2]);
    g.t.push(t0, t1); g.off.push(off[0], off[1], off[2]); g.n++;
  };
  /** caixa alinhada aos eixos (rotações opcionais em radianos) */
  const box = (name, c, s, t0, t1, off = [0, 0.8, 0], rot = [0, 0, 0]) => {
    _e.set(rot[0], rot[1], rot[2]); _q.setFromEuler(_e);
    add(name, c, _q, s, t0, t1, off);
  };
  /** perfil de a até b; roll gira o perfil em torno do próprio eixo */
  const bar = (name, a, b, t0, t1, off = [0, 0.8, 0], roll = 0) => {
    _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const L = _v.length(); _v.normalize();
    const qr = new THREE.Quaternion().setFromAxisAngle(_z, roll);
    _q.setFromUnitVectors(_z, _v).multiply(qr);
    add(name, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], _q, [1, 1, L], t0, t1, off);
  };
  const sp = mobile ? 0.6 : 0.4;        // espaçamento dos montantes
  const UP = [0, 1.4, 0];

  // ======================= laje e guias (intro) =======================
  box('slab', [0, -0.07, 0], [W + 0.6, 0.14, D + 0.6], 0.0, 0.05, [0, -0.5, 0]);
  const TR = 0.046;                     // meia altura da guia
  const guide = (a, b, t0, t1, off, roll) => bar('u', a, b, t0, t1, off, roll);
  guide([-W / 2, TR, -D / 2], [W / 2, TR, -D / 2], 0.04, 0.065, [0, 0.5, -0.6], Math.PI / 2);
  guide([-W / 2, TR, -D / 2], [-W / 2, TR, D / 2], 0.055, 0.08, [-0.6, 0.5, 0], Math.PI / 2);
  guide([W / 2, TR, -D / 2], [W / 2, TR, D / 2], 0.055, 0.08, [0.6, 0.5, 0], Math.PI / 2);
  guide([-W / 2, TR, D / 2], [W / 2, TR, D / 2], 0.07, 0.095, [0, 0.5, 0.6], Math.PI / 2);
  guide([PART_X, TR, -D / 2], [PART_X, TR, PDOOR[0]], 0.085, 0.105, [0, 0.5, 0], Math.PI / 2);
  guide([PART_X, TR, PDOOR[1]], [PART_X, TR, D / 2], 0.09, 0.105, [0, 0.5, 0], Math.PI / 2);

  // ======================= estrutura (0,10-0,26) =======================
  const stud = (x, z, t0, t1, roll, y0 = 0, y1 = H) => bar('c', [x, y0, z], [x, y1, z], t0, t1, UP, roll);
  const xs = []; for (let x = -W / 2; x <= W / 2 + 1e-6; x += sp) xs.push(+x.toFixed(3));
  const zs = []; for (let z = -D / 2 + sp; z < D / 2 - 1e-6; z += sp) zs.push(+z.toFixed(3));
  // fundo (já na intro), laterais, frente com os vãos
  xs.forEach((x, i) => stud(x, -D / 2, 0.095 + (i / xs.length) * 0.055, 0.125 + (i / xs.length) * 0.055, 0));
  zs.forEach((z, i) => { const u = i / zs.length; stud(-W / 2, z, 0.15 + u * 0.04, 0.18 + u * 0.04, Math.PI / 2); stud(W / 2, z, 0.155 + u * 0.04, 0.185 + u * 0.04, Math.PI / 2); });
  const inOpen = (x, o) => x > o[0] + 0.01 && x < o[1] - 0.01;
  xs.forEach((x, i) => {
    const u = i / xs.length;
    if (inOpen(x, DOOR)) return;
    if (inOpen(x, WIN)) { stud(x, D / 2, 0.19 + u * 0.03, 0.215 + u * 0.03, 0, 0, WIN_Y[0]); stud(x, D / 2, 0.19 + u * 0.03, 0.215 + u * 0.03, 0, WIN_Y[1], H); return; }
    stud(x, D / 2, 0.185 + u * 0.035, 0.215 + u * 0.035, 0);
  });
  // ombreiras e vergas dos vãos da frente
  for (const x of [DOOR[0], DOOR[1], WIN[0], WIN[1]]) stud(x, D / 2, 0.2, 0.225, 0);
  bar('u', [DOOR[0], DOOR_H + TR, D / 2], [DOOR[1], DOOR_H + TR, D / 2], 0.215, 0.235, UP, Math.PI / 2);
  bar('u', [WIN[0], WIN_Y[1] + TR, D / 2], [WIN[1], WIN_Y[1] + TR, D / 2], 0.215, 0.235, UP, Math.PI / 2);
  bar('u', [WIN[0], WIN_Y[0] - TR, D / 2], [WIN[1], WIN_Y[0] - TR, D / 2], 0.215, 0.235, UP, Math.PI / 2);
  // divisória interna com o vão de passagem
  const pz = []; for (let z = -D / 2 + sp; z < D / 2 - 1e-6; z += sp) if (!(z > PDOOR[0] + 0.01 && z < PDOOR[1] - 0.01)) pz.push(z);
  pz.forEach((z, i) => stud(PART_X, z, 0.2 + (i / pz.length) * 0.03, 0.225 + (i / pz.length) * 0.03, Math.PI / 2));
  for (const z of PDOOR) stud(PART_X, z, 0.215, 0.235, Math.PI / 2);
  bar('u', [PART_X, DOOR_H + TR, PDOOR[0]], [PART_X, DOOR_H + TR, PDOOR[1]], 0.225, 0.24, UP, Math.PI / 2);
  // guias superiores
  const top = H + TR;
  guide([-W / 2, top, -D / 2], [W / 2, top, -D / 2], 0.2, 0.225, [0, 1.2, 0], Math.PI / 2);
  guide([-W / 2, top, -D / 2], [-W / 2, top, D / 2], 0.21, 0.235, [0, 1.2, 0], Math.PI / 2);
  guide([W / 2, top, -D / 2], [W / 2, top, D / 2], 0.21, 0.235, [0, 1.2, 0], Math.PI / 2);
  guide([-W / 2, top, D / 2], [W / 2, top, D / 2], 0.225, 0.25, [0, 1.2, 0], Math.PI / 2);
  guide([PART_X, top, -D / 2], [PART_X, top, D / 2], 0.23, 0.25, [0, 1.2, 0], Math.PI / 2);
  // fitas de contraventamento em X nas laterais e no fundo
  const strap = (a, b, t0) => { bar('strap', a, b, t0, t0 + 0.02, [0, 0, 0], 0); };
  for (const x of [-W / 2 - 0.03, W / 2 + 0.03]) {
    strap([x, 0.05, -D / 2 + 0.05], [x, H - 0.05, -D / 2 + 1.6], 0.235); strap([x, H - 0.05, -D / 2 + 0.05], [x, 0.05, -D / 2 + 1.6], 0.24);
    strap([x, 0.05, D / 2 - 0.05], [x, H - 0.05, D / 2 - 1.6], 0.24); strap([x, H - 0.05, D / 2 - 0.05], [x, 0.05, D / 2 - 1.6], 0.245);
  }
  strap([-W / 2 + 0.05, 0.05, -D / 2 - 0.03], [-W / 2 + 1.8, H - 0.05, -D / 2 - 0.03], 0.245); strap([-W / 2 + 0.05, H - 0.05, -D / 2 - 0.03], [-W / 2 + 1.8, 0.05, -D / 2 - 0.03], 0.25);
  strap([W / 2 - 0.05, 0.05, -D / 2 - 0.03], [W / 2 - 1.8, H - 0.05, -D / 2 - 0.03], 0.245); strap([W / 2 - 0.05, H - 0.05, -D / 2 - 0.03], [W / 2 - 1.8, 0.05, -D / 2 - 0.03], 0.25);

  // ======================= telhado (0,26-0,47) =======================
  const E = D / 2 + OVER, RY = H + RISE;
  const nT = mobile ? 7 : 8, tx0 = -W / 2 - 0.15, tx1 = W / 2 + 0.15;
  for (let i = 0; i < nT; i++) {
    const x = tx0 + (i / (nT - 1)) * (tx1 - tx0), t0 = 0.26 + (i / nT) * 0.08, t1 = t0 + 0.035, o = [0, 2.2, 0];
    bar('c', [x, H + 0.05, -E], [x, H + 0.05, E], t0, t1, o, Math.PI / 2);                 // banzo inferior
    bar('c', [x, H + 0.05, -E], [x, RY, 0], t0 + 0.005, t1 + 0.005, o, Math.PI / 2);        // banzos superiores
    bar('c', [x, RY, 0], [x, H + 0.05, E], t0 + 0.005, t1 + 0.005, o, Math.PI / 2);
    bar('c', [x, H + 0.05, 0], [x, RY - 0.06, 0], t0 + 0.01, t1 + 0.01, o, 0);              // pendural
    for (const s of [-1, 1]) {
      const zz = s * 1.35, yy = H + 0.05 + RISE * (1 - Math.abs(zz) / E);
      bar('c', [x, H + 0.05, zz], [x, yy - 0.04, zz], t0 + 0.012, t1 + 0.012, o, 0);        // montantes da tesoura
      bar('c', [x, H + 0.05, zz], [x, RY - 0.08, 0.1 * s], t0 + 0.015, t1 + 0.015, o, 0);   // diagonais
    }
  }
  // chapas OSB da cobertura: 3 colunas em x, 3 fiadas por água, deitadas sobre os banzos
  const deck = (t0, t1, s) => {
    const cols = [[-W / 2 - 0.2, -W / 2 - 0.2 + 2.4], [-W / 2 + 2.2, -W / 2 + 4.6], [-W / 2 + 4.6, W / 2 + 0.2]];
    const rows = [[0, 1.2], [1.2, 2.4], [2.4, SLOPE]];
    let k = 0;
    for (const [r0, r1] of rows) for (const [c0, c1] of cols) {
      const m = (r0 + r1) / 2, len = r1 - r0;                 // ao longo da água, do beiral à cumeeira
      const z = s * (E - m * Math.cos(PITCH)), y = H + 0.05 + 0.045 + m * Math.sin(PITCH) + 0.03;
      const tt = t0 + (k / 9) * (t1 - t0); k++;
      box('osb', [(c0 + c1) / 2, y, z], [c1 - c0, SHEET, len], tt, tt + 0.03, [0, 0.9, s * 0.3], [s * PITCH, 0, 0]);
    }
  };
  deck(0.34, 0.39, -1); deck(0.355, 0.405, 1);
  // telhas shingle em fiadas, do beiral até a cumeeira, cada fiada sobre a anterior
  const nR = Math.ceil(SLOPE / 0.26);
  for (const s of [-1, 1]) for (let i = 0; i < nR; i++) {
    const m0 = i * 0.26, m1 = Math.min(SLOPE, m0 + 0.32), m = (m0 + m1) / 2;
    const z = s * (E - m * Math.cos(PITCH)), y = H + 0.05 + 0.045 + SHEET + m * Math.sin(PITCH) + 0.045 + i * 0.004;
    const tt = 0.39 + (i / nR) * 0.07 + (s > 0 ? 0.01 : 0);
    box('shingle', [0, y, z], [W + 0.42, 0.012, m1 - m0], tt, tt + 0.025, [0, 0.5, s * 0.2], [s * PITCH, 0, 0]);
  }
  box('shingle', [0, RY + 0.1, 0], [W + 0.44, 0.03, 0.34], 0.465, 0.48, [0, 0.5, 0]);          // cumeeira

  // ======================= paredes e divisórias (0,46-0,66) =======================
  const halfW = WALL / 2;
  // OSB externo nas três paredes fechadas (fundo e laterais), 1,20 de largura
  const panels = (name, from, to, t0, t1, place, y0 = 0, y1 = H) => {
    const n = Math.ceil((to - from) / 1.2 - 1e-6);
    for (let i = 0; i < n; i++) {
      const a = from + i * 1.2, b = Math.min(to, a + 1.2), tt = t0 + (i / n) * (t1 - t0);
      place((a + b) / 2, b - a, tt, tt + 0.03, (y0 + y1) / 2, y1 - y0);
    }
  };
  const zo = D / 2 + halfW + SHEET / 2, zi = D / 2 - halfW - SHEET / 2, xo = W / 2 + halfW + SHEET / 2, xi = W / 2 - halfW - SHEET / 2;
  panels('osb', -W / 2, W / 2, 0.46, 0.5, (c, l, a, b, yc, yl) => box('osb', [c, yc, -zo], [l, yl, SHEET], a, b, [0, 0, -0.9]));
  panels('osb', -D / 2, D / 2, 0.47, 0.51, (c, l, a, b, yc, yl) => box('osb', [-xo, yc, c], [SHEET, yl, l], a, b, [-0.9, 0, 0]));
  panels('osb', -D / 2, D / 2, 0.475, 0.515, (c, l, a, b, yc, yl) => box('osb', [xo, yc, c], [SHEET, yl, l], a, b, [0.9, 0, 0]));
  // chapas de gesso por dentro das três paredes
  panels('gesso', -W / 2, W / 2, 0.52, 0.57, (c, l, a, b, yc, yl) => box('gesso', [c, yc, -zi], [l, yl, SHEET], a, b, [0, 0, 0.9]));
  panels('gesso', -D / 2, D / 2, 0.54, 0.585, (c, l, a, b, yc, yl) => box('gesso', [-xi, yc, c], [SHEET, yl, l], a, b, [0.9, 0, 0]));
  panels('gesso', -D / 2, D / 2, 0.55, 0.595, (c, l, a, b, yc, yl) => box('gesso', [xi, yc, c], [SHEET, yl, l], a, b, [-0.9, 0, 0]));
  // divisória: gesso nas duas faces, com o vão de passagem e a chapa sobre a verga
  for (const s of [-1, 1]) {
    const x = PART_X + s * (halfW + SHEET / 2), t0 = s < 0 ? 0.59 : 0.615;
    const segs = [[-D / 2, -1.0], [-1.0, 0.2], [0.2, PDOOR[0]], [PDOOR[1], D / 2]];
    segs.forEach(([a, b], i) => box('gesso', [x, H / 2, (a + b) / 2], [SHEET, H, b - a], t0 + i * 0.012, t0 + i * 0.012 + 0.03, [s * 0.7, 0, 0]));
    box('gesso', [x, (DOOR_H + H) / 2, (PDOOR[0] + PDOOR[1]) / 2], [SHEET, H - DOOR_H, PDOOR[1] - PDOOR[0]], t0 + 0.05, t0 + 0.075, [s * 0.7, 0, 0]);
  }

  // ======================= forro (0,66-0,82) =======================
  const nC = Math.round(D / 0.6);
  for (let i = 0; i <= nC; i++) {
    const z = -D / 2 + 0.2 + (i / nC) * (D - 0.4), tt = 0.66 + (i / nC) * 0.05;
    bar('f', [-W / 2 + 0.05, CEIL, z], [W / 2 - 0.05, CEIL, z], tt, tt + 0.03, [0, 0.5, 0], Math.PI / 2);   // perfil do forro
    for (let k = 0; k < nT; k++) {
      const x = tx0 + (k / (nT - 1)) * (tx1 - tx0);
      if (Math.abs(x) > W / 2 - 0.08) continue;
      box('rod', [x, (CEIL + H) / 2 + 0.03, z], [0.012, H - CEIL - 0.02, 0.012], tt - 0.01, tt + 0.02, [0, 0.4, 0]);   // tirante
    }
  }
  {
    const cols = [[-W / 2, -W / 2 + 2.4], [-W / 2 + 2.4, -W / 2 + 4.8], [-W / 2 + 4.8, W / 2]];
    const rows = [[-D / 2, -1.0], [-1.0, 0.2], [0.2, 1.4], [1.4, D / 2]];
    let k = 0;
    for (const [r0, r1] of rows) for (const [c0, c1] of cols) {
      const tt = 0.715 + (k / 12) * 0.09; k++;
      box('gesso', [(c0 + c1) / 2, CEIL - 0.03 - SHEET / 2, (r0 + r1) / 2], [c1 - c0, SHEET, r1 - r0], tt, tt + 0.035, [0, -0.8, 0]);
    }
  }

  // ======================= fecha e multiplica (0,82-1) =======================
  const zc = zo + SHEET, xc = xo + SHEET;        // cimentícia por fora do OSB
  panels('cim', -W / 2, W / 2, 0.82, 0.85, (c, l, a, b, yc, yl) => box('cim', [c, yc, -zc], [l, yl, SHEET], a, b, [0, 0, -0.9]));
  panels('cim', -D / 2, D / 2, 0.825, 0.855, (c, l, a, b, yc, yl) => box('cim', [-xc, yc, c], [SHEET, yl, l], a, b, [-0.9, 0, 0]));
  panels('cim', -D / 2, D / 2, 0.83, 0.86, (c, l, a, b, yc, yl) => box('cim', [xc, yc, c], [SHEET, yl, l], a, b, [0.9, 0, 0]));
  // frente: em volta da porta e da janela
  const zf = D / 2 + halfW + SHEET / 2;
  const front = (x0, x1, y0, y1, t0) => box('cim', [(x0 + x1) / 2, (y0 + y1) / 2, zf], [x1 - x0, y1 - y0, SHEET], t0, t0 + 0.03, [0, 0, 0.9]);
  front(-W / 2, DOOR[0], 0, H, 0.84); front(DOOR[0], DOOR[1], DOOR_H, H, 0.85); front(DOOR[1], WIN[0], 0, H, 0.855);
  front(WIN[0], WIN[1], 0, WIN_Y[0], 0.86); front(WIN[0], WIN[1], WIN_Y[1], H, 0.862); front(WIN[1], W / 2, 0, H, 0.865);
  const closing = (dx, dz, t0, off) => {
    box('door', [dx + (DOOR[0] + DOOR[1]) / 2, DOOR_H / 2, dz + zf + 0.02], [DOOR[1] - DOOR[0] - 0.04, DOOR_H - 0.02, 0.05], t0, t0 + 0.03, off);
    box('frame', [dx + (WIN[0] + WIN[1]) / 2, (WIN_Y[0] + WIN_Y[1]) / 2, dz + zf], [WIN[1] - WIN[0], WIN_Y[1] - WIN_Y[0], 0.07], t0 + 0.005, t0 + 0.035, off);
    box('glass', [dx + (WIN[0] + WIN[1]) / 2, (WIN_Y[0] + WIN_Y[1]) / 2, dz + zf + 0.03], [WIN[1] - WIN[0] - 0.1, WIN_Y[1] - WIN_Y[0] - 0.1, 0.02], t0 + 0.01, t0 + 0.04, off);
  };
  closing(0, 0, 0.87, [0, 0, 0.6]);
  box('gable', [0, H + 0.02, 0], [1, 1, 1], 0.86, 0.885, [0, 0.6, 0]);
  // unidades prontas em volta: laje, paredes, sótão, duas águas, cumeeira, porta e janela
  COPIES.forEach(([cx, cz], i) => {
    const dist = Math.hypot(cx, cz), t0 = 0.885 + (dist / 12) * 0.07, off = [0, -2.6, 0];
    box('slab', [cx, -0.07, cz], [W + 0.6, 0.14, D + 0.6], t0, t0 + 0.035, off);
    box('cim', [cx, H / 2, cz], [W + 2 * (halfW + SHEET * 1.5), H, D + 2 * (halfW + SHEET * 1.5)], t0 + 0.005, t0 + 0.04, off);
    box('gable', [cx, H + 0.02, cz], [1, 1, 1], t0 + 0.01, t0 + 0.045, off);
    for (const s of [-1, 1]) {
      const m = SLOPE / 2, z = cz + s * (E - m * Math.cos(PITCH)), y = H + 0.05 + m * Math.sin(PITCH) + 0.08;
      box('shingle', [cx, y, z], [W + 0.44, 0.1, SLOPE + 0.05], t0 + 0.015, t0 + 0.05, off, [s * PITCH, 0, 0]);
    }
    box('shingle', [cx, RY + 0.1, cz], [W + 0.44, 0.03, 0.34], t0 + 0.02, t0 + 0.055, off);
    closing(cx, cz, t0 + 0.02, off);
  });

  for (const g of Object.values(groups)) {
    g.pos = new Float32Array(g.pos); g.quat = new Float32Array(g.quat); g.scl = new Float32Array(g.scl);
    g.t = new Float32Array(g.t); g.off = new Float32Array(g.off);
  }
  return groups;
}

// ---------------------------------------------------------------- câmera por chaves (az em graus a partir da frente)
const CAM = [
  { p: 0.0, az: -30, el: 24, d: 18.5, tx: 0, ty: 0.9, tz: 0 },
  { p: 0.16, az: -36, el: 22, d: 18.0, tx: 0, ty: 1.1, tz: 0 },
  { p: 0.3, az: -44, el: 21, d: 17.5, tx: 0, ty: 1.4, tz: 0 },
  { p: 0.47, az: -30, el: 33, d: 19.5, tx: 0, ty: 1.6, tz: 0 },
  { p: 0.66, az: -17, el: 13, d: 16.5, tx: 0, ty: 1.5, tz: 0 },
  { p: 0.82, az: -8, el: 9, d: 15.5, tx: 0.3, ty: 1.5, tz: 0 },
  { p: 0.9, az: -28, el: 24, d: 21, tx: 0, ty: 1.2, tz: 0 },
  { p: 1.0, az: -36, el: 42, d: 52, tx: 0, ty: 0.4, tz: 0 },
];
const FIELDS = ['az', 'el', 'd', 'tx', 'ty', 'tz'];
function camAt(p) {
  const ks = CAM, out = {};
  let i = 0; while (i < ks.length - 2 && p > ks[i + 1].p) i++;
  const k0 = ks[i], k1 = ks[i + 1], h = k1.p - k0.p, u = Math.min(1, Math.max(0, (p - k0.p) / h));
  const u2 = u * u, u3 = u2 * u;
  for (const f of FIELDS) {
    const v0 = k0[f], v1 = k1[f];
    const vm = i > 0 ? ks[i - 1][f] : v0, vp = i < ks.length - 2 ? ks[i + 2][f] : v1;
    const pm = i > 0 ? ks[i - 1].p : k0.p - h, pp = i < ks.length - 2 ? ks[i + 2].p : k1.p + h;
    const m0 = ((v1 - vm) / (k1.p - pm)) * h, m1 = ((vp - v0) / (pp - k0.p)) * h;
    out[f] = (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * m1;
  }
  return out;
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);

// ---------------------------------------------------------------- ambiente para os reflexos do aço
function makeEnv(renderer) {
  const s = new THREE.Scene(), geo = new THREE.BoxGeometry();
  const room = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x2b3246, side: THREE.BackSide, roughness: 1, metalness: 0 }));
  room.scale.setScalar(14); s.add(room);
  const panel = (x, y, z, sx, sy, sz, r, g, b) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) }));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); s.add(m);
  };
  panel(0, 6.9, 0, 7, 0.1, 7, 9, 8.6, 7.8);        // teto quente e grande
  panel(-6.9, 2, 1, 0.1, 3.5, 6, 4.5, 5.2, 6.5);  // lateral fria
  panel(6.9, 1.5, -2, 0.1, 2.5, 4, 5, 3, 1.2);    // laranja do outro lado
  panel(0, 2, -6.9, 5, 2, 0.1, 2.5, 2.8, 3.4);
  s.add(new THREE.PointLight(0xffffff, 40, 40));
  const pm = new THREE.PMREMGenerator(renderer);
  const t = pm.fromScene(s, 0.04).texture;
  pm.dispose(); geo.dispose();
  return t;
}

// ---------------------------------------------------------------- montagem
export async function mountBuild(canvas, opts = {}) {
  const mobile = !!opts.mobile, reduced = !!opts.reducedMotion, poster = !!opts.poster;

  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: poster, stencil: false,
  });
  renderer.setClearColor(0x000000, 0);
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.environment = makeEnv(renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);

  // luzes: chave quente com sombra, céu frio, contraluz laranja da marca
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4);
  key.position.set(7, 12, 6); key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
  key.shadow.camera.near = 2; key.shadow.camera.far = 60;
  scene.add(key); scene.add(key.target);
  scene.add(new THREE.HemisphereLight(0x9db6e6, 0x1a2340, 0.85));
  const rim = new THREE.DirectionalLight(0xf58a1f, 0.75); rim.position.set(-8, 5, -7); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.35); fill.position.set(-5, 3, 8); scene.add(fill);

  // materiais
  const noise = noiseTexture();
  const mats = {
    galv: new THREE.MeshStandardMaterial({ color: 0xc3c9cf, metalness: 0.88, roughness: 0.3, envMapIntensity: 1.1 }),
    osb: new THREE.MeshStandardMaterial({ map: osbTexture(), roughness: 0.9, metalness: 0 }),
    gesso: new THREE.MeshStandardMaterial({ map: noise, color: 0xf1ede5, roughness: 0.95 }),
    gessoEdge: new THREE.MeshStandardMaterial({ color: 0xcfc3ad, roughness: 1 }),
    cim: new THREE.MeshStandardMaterial({ map: noise, color: 0xd6d9dc, roughness: 0.85 }),
    cimEdge: new THREE.MeshStandardMaterial({ color: 0xaeb3b8, roughness: 0.9 }),
    shingle: new THREE.MeshStandardMaterial({ map: shingleTexture(), roughness: 0.95, metalness: 0.05 }),
    shingleEdge: new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 1 }),
    concrete: new THREE.MeshStandardMaterial({ map: noise, color: 0x9a9da2, roughness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x262b33, roughness: 0.55, metalness: 0.2 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xa9cdee, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.55, envMapIntensity: 1.4 }),
  };
  // caixa com as bordas (faces x e y) em outro material: a espessura da chapa aparece
  const sheetMats = (face, edge) => [edge, edge, edge, edge, face, face];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const GEOM = {
    c: [profileGeo(WALL, 0.04, 0.008, 0.012), mats.galv],
    u: [profileGeo(WALL + 0.004, 0.042, 0.008, 0), mats.galv],
    f: [profileGeo(0.046, 0.03, 0.006, 0.008), mats.galv],
    strap: [new THREE.BoxGeometry(0.004, 0.05, 1), mats.galv],
    rod: [boxGeo, mats.galv],
    slab: [boxGeo, mats.concrete],
    osb: [boxGeo, mats.osb],
    gesso: [boxGeo, sheetMats(mats.gesso, mats.gessoEdge)],
    cim: [boxGeo, sheetMats(mats.cim, mats.cimEdge)],
    shingle: [boxGeo, sheetMats(mats.shingle, mats.shingleEdge)],
    door: [boxGeo, mats.dark],
    frame: [boxGeo, mats.dark],
    glass: [boxGeo, mats.glass],
    gable: [gableGeo(), mats.cim],
  };
  // a chapa de gesso deitada no forro e a telha mostram a face de cima/baixo (faces y da caixa): ajusta por grupo
  const data = buildScene(mobile);
  const meshes = [];
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  for (const [name, g] of Object.entries(data)) {
    const [geo, mat] = GEOM[name];
    let m = mat;
    if (name === 'shingle') m = sheetMats(mats.shingleEdge, mats.shingle).map((x, i) => (i === 2 || i === 3 ? mats.shingle : mats.shingleEdge));
    const im = new THREE.InstancedMesh(geo, m, g.n); im.name = name;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.castShadow = name !== 'glass'; im.receiveShadow = true; im.frustumCulled = false;
    scene.add(im); meshes.push([im, g]);
  }
  // chão: sombra projetada + um brilho suave no piso
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ color: 0x05080f, opacity: 0.5 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.14; ground.receiveShadow = true; scene.add(ground);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshBasicMaterial({ map: floorTexture(), transparent: true, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -0.15; scene.add(glow);

  let lastT = -1;
  function place(T) {
    if (T === lastT) return;
    lastT = T;
    for (const [im, g] of meshes) {
      for (let i = 0; i < g.n; i++) {
        const t0 = g.t[i * 2], t1 = g.t[i * 2 + 1];
        const r = (T - t0) / (t1 - t0);
        if (r <= 0) { _m.makeScale(0, 0, 0); im.setMatrixAt(i, _m); continue; }
        const e = r >= 1 ? 0 : 1 - easeOutCubic(r);
        _p.set(g.pos[i * 3] + g.off[i * 3] * e, g.pos[i * 3 + 1] + g.off[i * 3 + 1] * e, g.pos[i * 3 + 2] + g.off[i * 3 + 2] * e);
        _q.set(g.quat[i * 4], g.quat[i * 4 + 1], g.quat[i * 4 + 2], g.quat[i * 4 + 3]);
        _s.set(g.scl[i * 3], g.scl[i * 3 + 1], g.scl[i * 3 + 2]);
        _m.compose(_p, _q, _s); im.setMatrixAt(i, _m);
      }
      im.instanceMatrix.needsUpdate = true;
    }
    // a sombra abre quando o condomínio aparece
    const R = 7.5 + 11 * clamp01((T - 0.88) / 0.12);
    const sc = key.shadow.camera;
    if (Math.abs(sc.right - R) > 0.01) { sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.updateProjectionMatrix(); }
  }

  // --- estado
  let Wd = 1, Hd = 1;
  let pTarget = 0, pShown = 0;
  let intro = reduced || poster ? INTRO_END : 0, introActive = !(reduced || poster), introStart = 0;
  let parTX = 0, parTY = 0, parX = 0, parY = 0;
  let raf = 0, dirty = true, paused = false, hidden = document.visibilityState === 'hidden', disposed = false;
  let lastNow = 0, firstDone = false, readyResolve = null;
  const smooth = !reduced && !poster;

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    if (w === Wd && h === Hd) return;
    Wd = w; Hd = h; renderer.setSize(Wd, Hd, false); request();
  }
  function updateCamera() {
    const k = camAt(pShown), aspect = Wd / Hd, tall = aspect < 1;
    const mul = tall ? Math.min(1.75, 1.2 / aspect) : Math.max(1, 1.45 / aspect);
    const az = (k.az + parX * 3) * Math.PI / 180, el = (k.el + parY * 1.6) * Math.PI / 180, d = k.d * mul;
    // no celular o modelo fica na metade de baixo da tela (o texto está em cima)
    const ty = k.ty + (tall ? 0.6 + 1.1 * (d / 13) : 0);
    camera.position.set(k.tx + d * Math.sin(az) * Math.cos(el), ty + d * Math.sin(el), k.tz + d * Math.cos(az) * Math.cos(el));
    camera.lookAt(k.tx, ty, k.tz);
    camera.fov = tall ? 34 : 30; camera.aspect = aspect;
    // no computador o texto fica à esquerda: a cena anda para a direita
    camera.setViewOffset(Wd, Hd, tall ? 0 : -Wd * 0.1, 0, Wd, Hd);
    camera.updateProjectionMatrix();
    key.position.set(7, 12, 6).multiplyScalar(1 + 1.2 * clamp01((pShown - 0.88) / 0.12));
  }
  function render() {
    const T = Math.max(pShown, intro);
    place(T); updateCamera();
    renderer.render(scene, camera);
  }
  function request() {
    dirty = true;
    if (!raf && (!paused || !firstDone) && !hidden && !disposed) raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    raf = 0;
    if (disposed) return;
    const dt = lastNow ? Math.min(50, now - lastNow) : 16.7; lastNow = now;
    let moving = false;
    if (introActive) {
      if (!introStart) introStart = now;
      const u = Math.min(1, (now - introStart) / INTRO_MS);
      intro = INTRO_END * easeOutCubic(u);
      if (u >= 1) introActive = false; else moving = true;
    }
    if (smooth && firstDone) {
      const k = 1 - Math.pow(0.85, dt / 16.7), dP = pTarget - pShown;
      if (Math.abs(dP) > 1.5e-4) { pShown += dP * k; moving = true; } else pShown = pTarget;
      const kp = 1 - Math.pow(0.9, dt / 16.7), dx = parTX - parX, dy = parTY - parY;
      if (Math.abs(dx) > 4e-3 || Math.abs(dy) > 4e-3) { parX += dx * kp; parY += dy * kp; moving = true; } else { parX = parTX; parY = parTY; }
    } else pShown = pTarget;
    render();
    dirty = false;
    if (!firstDone) {
      firstDone = true;
      requestAnimationFrame(() => { readyResolve && readyResolve(); if (paused && raf) { cancelAnimationFrame(raf); raf = 0; } });
    }
    if (moving) raf = requestAnimationFrame(tick); else lastNow = 0;
  }

  // --- eventos (todos passivos: nunca seguram o scroll nem o toque)
  const onMove = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    parTX = (e.clientX / window.innerWidth) * 2 - 1; parTY = (e.clientY / window.innerHeight) * 2 - 1; request();
  };
  const finePointer = !mobile && !reduced && matchMedia('(pointer: fine)').matches;
  if (finePointer) window.addEventListener('pointermove', onMove, { passive: true });
  const onVis = () => { hidden = document.visibilityState === 'hidden'; if (hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; } else if (dirty || introActive) request(); };
  document.addEventListener('visibilitychange', onVis);
  const io = new IntersectionObserver((es) => {
    paused = !es[0].isIntersecting;
    if (paused) { if (raf) cancelAnimationFrame(raf); raf = 0; } else request();
  });
  io.observe(canvas);
  const ro = new ResizeObserver(() => resize()); ro.observe(canvas);
  resize();

  const ready = new Promise((res) => { readyResolve = res; });
  request();
  if (opts.debug) window.__build = { renderer, scene, camera, meshes, mats, render, THREE };

  return {
    ready,
    setProgress(p) {
      pTarget = clamp01(+p || 0);
      if (!smooth || !firstDone) {
        pShown = pTarget;
        if (!firstDone && pTarget >= INTRO_END) { introActive = false; intro = INTRO_END; }
      }
      request();
    },
    pause() { paused = true; if (raf) cancelAnimationFrame(raf); raf = 0; },
    resume() { paused = false; request(); },
    info() {
      let n = 0; for (const [, g] of meshes) n += g.n;
      return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, instances: n, dpr, size: [Wd, Hd], progress: pShown, timeline: Math.max(pShown, intro) };
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      if (finePointer) window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      io.disconnect(); ro.disconnect();
      for (const [im] of meshes) { im.geometry.dispose(); }
      for (const m of Object.values(mats)) m.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
