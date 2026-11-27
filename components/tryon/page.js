// Canlı deneme sayfası (WebView içinde çalışır). Kamera görüntüsü cihazda işlenir; hiçbir sunucuya gönderilmez.
// MediaPipe Tasks Vision: yüz noktaları (makyaj, yüz şekli, saç modeli yerleşimi) + saç segmentasyonu (renk, saç gizleme).
// Not: Sayfa kodunda ters tırnak ve dolar-süslü parantez kullanılmaz (JS şablon dizesi içinde durur).

const MP_VERSION = "0.10.35";

export const TRYON_PAGE = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  video { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  canvas#c { position: fixed; inset: 0; width: 100%; height: 100%; transform: scaleX(-1); }
</style>
</head>
<body>
<video id="v" playsinline muted autoplay></video>
<canvas id="c"></canvas>
<script type="module">
const BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAIR_MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite";

const post = (m) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m));
const video = document.getElementById("v");
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const mk = () => { const c = document.createElement("canvas"); return [c, c.getContext("2d")]; };
const [maskCanvas, mctx] = mk();   // kullanıcının saç maskesi (beyaz + alfa)
const [tint, tctx] = mk();         // renkli saç maskesi
const [hairLayer, hctx] = mk();    // yalnızca saç pikselleri (doku koruyarak açma/koyulaştırma)
const [over, octx] = mk();         // yerleştirilmiş saç modeli
const [plate, pctx] = mk();        // saçın arkasını dolduran tahmini zemin
const [rmask, rctx] = mk();        // gizlenecek kendi saç bölgesi
const [hard, hdctx] = mk();        // güçlendirilmiş ve hafif genişletilmiş saç maskesi
const [bg, bgctx] = mk();          // bulanık arka plan için küçük kopya

const state = { hair: null, makeup: null, style: null, scanning: true, padTop: 0, padBottom: 0 };
const scan = { samples: [], need: 36, lastPost: 0 };
const styleCache = {};
let face = null, seg = null, lastMask = null, maskW = 0, maskH = 0, maskImg = null;
let frame = 0, lastTs = -1, facePresent = null, lastFacePost = 0, smooth = null;

window.__tryon = {
  set(cmd) {
    if ("hair" in cmd) state.hair = cmd.hair;
    if ("makeup" in cmd) state.makeup = cmd.makeup;
    if ("style" in cmd) setStyle(cmd.style);
    if (cmd.viewport) { state.padTop = cmd.viewport.top || 0; state.padBottom = cmd.viewport.bottom || 0; }
    if (cmd.scan) { scan.samples = []; state.scanning = true; }
    if (cmd.scanDone) state.scanning = false;
    if (cmd.capture) capture();
  },
};

function setStyle(s) {
  if (!s) { state.style = null; return; }
  const cached = styleCache[s.key];
  if (cached) { state.style = cached; return; }
  const img = new Image();
  img.onload = () => {
    styleCache[s.key] = { key: s.key, img, anchors: s.anchors };
    if (!state.style || state.style.key !== s.key) state.style = styleCache[s.key];
    post({ type: "styleReady", key: s.key });
  };
  img.src = s.src;
  state.style = null;
}

const LIPS_OUT = [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185];
const LIPS_IN = [78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191];
const EYE_A = [33,246,161,160,159,158,157,173,133];
const EYE_B = [263,466,388,387,386,385,384,398,362];
const BROW_A = [46,53,52,65,55];
const BROW_B = [276,283,282,295,285];

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const rgba = (c, a) => "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.max(0, Math.min(1, a)) + ")";

async function start() {
  post({ type: "status", status: "camera" });
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
      audio: false,
    });
  } catch (e) {
    post({ type: "error", code: "camera", message: String((e && e.name) || e) });
    return;
  }
  video.srcObject = stream;
  try { await video.play(); } catch (e) {}
  post({ type: "status", status: "loading" });
  try {
    const mp = await import(BASE + "/vision_bundle.mjs");
    const fileset = await mp.FilesetResolver.forVisionTasks(BASE + "/wasm");
    const create = (delegate) => Promise.all([
      mp.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
      }),
      mp.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: HAIR_MODEL, delegate },
        runningMode: "VIDEO",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      }),
    ]);
    try { [face, seg] = await create("GPU"); } catch (e) { [face, seg] = await create("CPU"); }
  } catch (e) {
    post({ type: "error", code: "load", message: String((e && e.message) || e) });
    return;
  }
  post({ type: "status", status: "ready" });
  requestAnimationFrame(loop);
}

// Görüntü ekrana yakınlaştırılmadan sığdırılır (en fazla %30 kırpma) ve üst/alt kontrollerin arasındaki
// görünür alana ortalanır; kalan boşluk bulanık arka planla dolar.
function layout(w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.round(window.innerWidth * dpr), ch = Math.round(window.innerHeight * dpr);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  const top = state.padTop * dpr, availH = Math.max(ch * 0.5, ch - top - state.padBottom * dpr);
  const coverAll = Math.max(cw / w, ch / h);
  const cover = Math.max(cw / w, availH / h), contain = Math.min(cw / w, availH / h);
  const s = Math.min(cover, contain * 1.3);
  return { cw, ch, coverAll, s, dx: (cw - w * s) / 2, dy: top + (availH - h * s) / 2 };
}

function loop() {
  requestAnimationFrame(loop);
  if (video.readyState < 2) return;
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return;
  const ts = performance.now();
  if (ts <= lastTs) return;
  lastTs = ts;
  frame++;
  const L = layout(w, h);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  // Bulanık arka plan: küçük bir kopyayı büyütmek, her karede filtre uygulamaktan çok daha hafiftir.
  if (bg.width !== 24) { bg.width = 24; bg.height = Math.max(1, Math.round((24 * h) / w)); }
  bgctx.drawImage(video, 0, 0, bg.width, bg.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bg, (L.cw - w * L.coverAll) / 2, (L.ch - h * L.coverAll) / 2, w * L.coverAll, h * L.coverAll);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, L.cw, L.ch);
  ctx.setTransform(L.s, 0, 0, L.s, L.dx, L.dy);
  ctx.drawImage(video, 0, 0, w, h);

  let lm = null;
  try {
    const r = face.detectForVideo(video, ts);
    lm = r.faceLandmarks && r.faceLandmarks[0];
  } catch (e) {}
  reportFace(!!lm);

  const needMask = !!state.hair || !!state.style;
  if (needMask && (frame % 2 === 0 || !lastMask)) updateMask(ts);

  if (state.style && lm) drawStyle(lm, w, h);
  else if (state.hair && lastMask) drawHairColor(w, h);

  if (lm) {
    if (state.scanning) scanStep(lm, w, h);
    if (state.makeup) drawMakeup(lm, w, h);
  }
}

function reportFace(present) {
  const now = performance.now();
  if (present !== facePresent || now - lastFacePost > 2000) {
    facePresent = present;
    lastFacePost = now;
    post({ type: "face", present });
  }
}

// ── Saç maskesi ──
function updateMask(ts) {
  try {
    const res = seg.segmentForVideo(video, ts);
    const masks = res.confidenceMasks;
    const m = masks && (masks[1] || masks[0]);
    if (m) {
      const data = m.getAsFloat32Array();
      maskW = m.width;
      maskH = m.height;
      if (!lastMask || lastMask.length !== data.length) lastMask = new Float32Array(data.length);
      lastMask.set(data);
      buildMask();
    }
    if (res.close) res.close();
  } catch (e) {}
}

function buildMask() {
  if (maskCanvas.width !== maskW || maskCanvas.height !== maskH || !maskImg) {
    maskCanvas.width = maskW;
    maskCanvas.height = maskH;
    maskImg = mctx.createImageData(maskW, maskH);
  }
  const d = maskImg.data;
  for (let i = 0, j = 0; i < lastMask.length; i++, j += 4) {
    let v = lastMask[i];
    v = v < 0.3 ? 0 : (v - 0.3) / 0.7;
    d[j] = 255; d[j + 1] = 255; d[j + 2] = 255; d[j + 3] = v * 255;
  }
  mctx.putImageData(maskImg, 0, 0);
  if (state.style) {
    // Kendi saçını gizlemek için maske sertleştirilir ve kenarları biraz genişletilir.
    if (hard.width !== maskW || hard.height !== maskH) { hard.width = maskW; hard.height = maskH; }
    hdctx.clearRect(0, 0, maskW, maskH);
    hdctx.filter = "blur(" + Math.max(2, Math.round(maskW / 120)) + "px)";
    for (let i = 0; i < 4; i++) hdctx.drawImage(maskCanvas, 0, 0);
    hdctx.filter = "none";
    for (let i = 0; i < 2; i++) hdctx.drawImage(hard, 0, 0);
  }
}

function tinted(source, color) {
  if (tint.width !== source.width || tint.height !== source.height) { tint.width = source.width; tint.height = source.height; }
  tctx.globalCompositeOperation = "source-over";
  tctx.clearRect(0, 0, tint.width, tint.height);
  tctx.drawImage(source, 0, 0);
  tctx.globalCompositeOperation = "source-in";
  tctx.fillStyle = color;
  tctx.fillRect(0, 0, tint.width, tint.height);
  return tint;
}

// ── Saç rengi (kendi saçına) ──
function drawHairColor(w, h) {
  const c = state.hair;
  if (c.lift || c.dark) {
    if (hairLayer.width !== w || hairLayer.height !== h) { hairLayer.width = w; hairLayer.height = h; }
    hctx.globalCompositeOperation = "source-over";
    hctx.clearRect(0, 0, w, h);
    hctx.drawImage(video, 0, 0, w, h);
    hctx.globalCompositeOperation = "destination-in";
    hctx.drawImage(maskCanvas, 0, 0, w, h);
    shade(hairLayer, c, w, h);
  }
  ctx.globalCompositeOperation = "color";
  ctx.globalAlpha = c.alpha;
  ctx.drawImage(tinted(maskCanvas, c.color), 0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

/** Saç katmanını kendisiyle karıştırarak dokuyu koruyup açar ("screen") veya koyulaştırır ("multiply"). */
function shade(layer, c, w, h) {
  if (c.lift) {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = Math.min(1, c.lift * 1.6);
    ctx.drawImage(layer, 0, 0, w, h);
    if (c.lift > 0.4) ctx.drawImage(layer, 0, 0, w, h);
  }
  if (c.dark) {
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = Math.min(1, c.dark * 1.6);
    ctx.drawImage(layer, 0, 0, w, h);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

// ── Saç modeli ──
const pt = (lm, i, w, h) => [lm[i].x * w, lm[i].y * h];
const midPt = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** 3 nokta çiftinden afin dönüşüm: kaynak (src) → hedef (dst). [a, b, c, d, e, f] */
function affine(src, dst) {
  const [x1, y1] = src[0], [x2, y2] = src[1], [x3, y3] = src[2];
  const det = x1 * (y2 - y3) - x2 * (y1 - y3) + x3 * (y1 - y2);
  if (Math.abs(det) < 1e-6) return null;
  const solve = (v1, v2, v3) => [
    (v1 * (y2 - y3) - v2 * (y1 - y3) + v3 * (y1 - y2)) / det,
    (x1 * (v2 - v3) - x2 * (v1 - v3) + x3 * (v1 - v2)) / det,
    (x1 * (y2 * v3 - y3 * v2) - x2 * (y1 * v3 - y3 * v1) + x3 * (y1 * v2 - y2 * v1)) / det,
  ];
  const [a, c, e] = solve(dst[0][0], dst[1][0], dst[2][0]);
  const [b, d, f] = solve(dst[0][1], dst[1][1], dst[2][1]);
  return [a, b, c, d, e, f];
}

/**
 * Saç arkasındaki zemini tahmin eder (push-pull doldurma): saç pikselleri silinir, görüntü küçültülerek
 * çevredeki renklerle boşluklar doldurulur. Kendi saçını gizlemek için kullanılır.
 */
const pyramid = [];
function buildPlate(w, h) {
  const bw = Math.max(32, Math.round(w / 4)), bh = Math.max(32, Math.round(h / 4));
  if (plate.width !== bw || plate.height !== bh) { plate.width = bw; plate.height = bh; }
  pctx.globalCompositeOperation = "source-over";
  pctx.clearRect(0, 0, bw, bh);
  pctx.drawImage(video, 0, 0, bw, bh);
  pctx.globalCompositeOperation = "destination-out";
  pctx.drawImage(hard, 0, 0, bw, bh);
  let lw = bw, lh = bh, prev = plate, k = 0;
  while (lw > 1 || lh > 1) {
    lw = Math.max(1, lw >> 1);
    lh = Math.max(1, lh >> 1);
    if (!pyramid[k]) pyramid[k] = mk();
    const [cv, cx] = pyramid[k];
    cv.width = lw;
    cv.height = lh;
    cx.drawImage(prev, 0, 0, lw, lh);
    prev = cv;
    k++;
  }
  // En alt seviye (1×1, saç dışı ortalama renk) opak yapılır; böylece üst seviyelerde boşluk kalmaz.
  const lastCx = pyramid[k - 1][1];
  const px = lastCx.getImageData(0, 0, 1, 1);
  px.data[3] = 255;
  lastCx.putImageData(px, 0, 0);
  for (let i = k - 1; i >= 0; i--) {
    const [cv, cx] = pyramid[i];
    const lower = i === k - 1 ? null : pyramid[i + 1][0];
    if (lower) {
      cx.globalCompositeOperation = "destination-over";
      cx.drawImage(lower, 0, 0, cv.width, cv.height);
      cx.globalCompositeOperation = "source-over";
    }
  }
  pctx.globalCompositeOperation = "destination-over";
  pctx.drawImage(pyramid[0][0], 0, 0, bw, bh);
  pctx.globalCompositeOperation = "source-over";
}

function drawStyle(lm, w, h) {
  const st = state.style;
  const user = [midPt(pt(lm, 33, w, h), pt(lm, 133, w, h)), midPt(pt(lm, 263, w, h), pt(lm, 362, w, h)), pt(lm, 152, w, h)];
  // Titremeyi azaltmak için yumuşatma
  if (!smooth) smooth = user.map((p) => p.slice());
  else for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) smooth[i][j] += (user[i][j] - smooth[i][j]) * 0.55;
  const A = affine([st.anchors.eyeA, st.anchors.eyeB, st.anchors.chin], smooth);
  if (!A) return;

  // Seçilen model (renk seçildiyse boyanır)
  if (over.width !== w || over.height !== h) { over.width = w; over.height = h; }
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, w, h);
  octx.setTransform(A[0], A[1], A[2], A[3], A[4], A[5]);
  octx.drawImage(st.img, 0, 0);
  octx.setTransform(1, 0, 0, 1, 0, 0);

  // Kendi saçını gizle: kendi saç maskesi − yeni model
  if (lastMask) {
    buildPlate(w, h);
    if (rmask.width !== maskW || rmask.height !== maskH) { rmask.width = maskW; rmask.height = maskH; }
    rctx.globalCompositeOperation = "source-over";
    rctx.clearRect(0, 0, maskW, maskH);
    rctx.drawImage(hard, 0, 0);
    rctx.globalCompositeOperation = "destination-out";
    rctx.drawImage(over, 0, 0, maskW, maskH);
    pctx.globalCompositeOperation = "destination-in";
    pctx.drawImage(rmask, 0, 0, plate.width, plate.height);
    pctx.globalCompositeOperation = "source-over";
    ctx.filter = "blur(2px)";
    ctx.drawImage(plate, 0, 0, w, h);
    ctx.filter = "none";
  }

  ctx.drawImage(over, 0, 0, w, h);
  const c = state.hair;
  if (c) {
    shade(over, c, w, h);
    ctx.globalCompositeOperation = "color";
    ctx.globalAlpha = c.alpha;
    ctx.drawImage(tinted(over, c.color), 0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}

// ── Makyaj ──
function poly(points) {
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

function drawMakeup(lm, w, h) {
  const m = state.makeup;
  const a = pt(lm, 234, w, h), b = pt(lm, 454, w, h);
  const faceW = Math.hypot(a[0] - b[0], a[1] - b[1]);
  ctx.save();

  if (m.shadow) {
    ctx.globalCompositeOperation = "multiply";
    ctx.filter = "blur(" + Math.max(2, Math.round(faceW * 0.014)) + "px)";
    ctx.fillStyle = rgba(hex(m.shadow), m.shadowA || 0.35);
    for (const pair of [[EYE_A, BROW_A], [EYE_B, BROW_B]]) {
      const lid = pair[0].map((i) => pt(lm, i, w, h));
      const brow = pair[1];
      const top = lid.map((p, k) => {
        const q = pt(lm, brow[Math.round((k * (brow.length - 1)) / (lid.length - 1))], w, h);
        return [p[0] + (q[0] - p[0]) * 0.55, p[1] + (q[1] - p[1]) * 0.55];
      });
      ctx.beginPath();
      poly(lid.concat(top.reverse()));
      ctx.fill();
    }
    ctx.filter = "none";
  }

  if (m.blush) {
    ctx.globalCompositeOperation = "multiply";
    const col = hex(m.blush);
    for (const i of [50, 280]) {
      const p = pt(lm, i, w, h);
      const r = faceW * 0.13;
      const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
      g.addColorStop(0, rgba(col, m.blushA || 0.2));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (m.liner) {
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = rgba([24, 16, 18], 0.85);
    ctx.lineWidth = Math.max(1.5, faceW * 0.007);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const lidIdx of [EYE_A, EYE_B]) {
      const p = lidIdx.map((i) => pt(lm, i, w, h));
      ctx.beginPath();
      ctx.moveTo(p[p.length - 1][0], p[p.length - 1][1]);
      for (let i = p.length - 2; i >= 0; i--) ctx.lineTo(p[i][0], p[i][1]);
      if (m.wing) {
        const dx = p[0][0] - p[1][0], dy = p[0][1] - p[1][1];
        const len = Math.hypot(dx, dy) || 1;
        ctx.lineTo(p[0][0] + (dx / len) * faceW * 0.045, p[0][1] + (dy / len) * faceW * 0.045 - faceW * 0.02);
      }
      ctx.stroke();
    }
  }

  if (m.lips) {
    const col = hex(m.lips);
    const la = m.lipsA || 0.5;
    const outline = () => {
      ctx.beginPath();
      poly(LIPS_OUT.map((i) => pt(lm, i, w, h)));
      poly(LIPS_IN.map((i) => pt(lm, i, w, h)));
    };
    ctx.filter = "blur(" + Math.max(1, Math.round(faceW * 0.004)) + "px)";
    ctx.globalCompositeOperation = "color";
    ctx.fillStyle = rgba(col, la);
    outline();
    ctx.fill("evenodd");
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = rgba(col, la * 0.55);
    outline();
    ctx.fill("evenodd");
    ctx.filter = "none";
  }
  ctx.restore();
}

// ── Yüz şekli ──
const dist = (lm, i, j, w, h) => Math.hypot((lm[i].x - lm[j].x) * w, (lm[i].y - lm[j].y) * h);

// Eşikler MediaPipe'ın ortalama yüz modeline göre ayarlandı (ortalama: L 1.15, F 0.82, J 0.78, C 0.42).
function classify(M) {
  if (M.L >= 1.27) return "OBLONG";
  if (M.J >= 0.83 && M.C >= 0.45 && M.L < 1.2) return "SQUARE";
  if (M.L <= 1.07) return "ROUND";
  if (M.F - M.J >= 0.09 && M.C < 0.41) return "HEART";
  if (M.F < 0.77 && M.J < 0.74) return "DIAMOND";
  return "OVAL";
}

function scanStep(lm, w, h) {
  const now = performance.now();
  const cheek = dist(lm, 234, 454, w, h);
  const mid = (lm[234].x + lm[454].x) / 2;
  const yaw = Math.abs(lm[1].x - mid) / Math.abs(lm[454].x - lm[234].x);
  const roll = Math.abs(lm[33].y - lm[263].y) * h / dist(lm, 33, 263, w, h);
  const frontal = yaw < 0.07 && roll < 0.09;
  if (frontal) {
    scan.samples.push({
      L: dist(lm, 10, 152, w, h) / cheek,
      F: dist(lm, 54, 284, w, h) / cheek,
      J: dist(lm, 172, 397, w, h) / cheek,
      C: dist(lm, 149, 378, w, h) / cheek,
    });
  }
  if (now - scan.lastPost > 150) {
    scan.lastPost = now;
    post({ type: "scan", progress: scan.samples.length / scan.need, frontal });
  }
  if (scan.samples.length >= scan.need) {
    state.scanning = false;
    const med = (k) => {
      const arr = scan.samples.map((s) => s[k]).sort((x, y) => x - y);
      return arr[arr.length >> 1];
    };
    const M = { L: med("L"), F: med("F"), J: med("J"), C: med("C") };
    post({ type: "shape", shape: classify(M), metrics: M });
  }
}

// ── Fotoğraf ──
function capture() {
  try {
    const out = document.createElement("canvas");
    const max = 1280;
    const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    const o = out.getContext("2d");
    o.translate(out.width, 0);
    o.scale(-1, 1);
    o.drawImage(canvas, 0, 0, out.width, out.height);
    post({ type: "photo", data: out.toDataURL("image/jpeg", 0.88).split(",")[1] });
  } catch (e) {
    post({ type: "error", code: "capture", message: String(e) });
  }
}

start();
</script>
</body>
</html>`;
