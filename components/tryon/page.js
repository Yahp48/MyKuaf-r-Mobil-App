// Canlı deneme sayfası (WebView içinde çalışır). Kamera görüntüsü cihazda işlenir; hiçbir sunucuya gönderilmez.
// MediaPipe Tasks Vision: yüz noktaları (makyaj, yüz şekli) + saç segmentasyonu (saç rengi).
// Not: Bu dosyadaki sayfa kodunda ters tırnak ve dolar-süslü parantez kullanılmaz (JS şablon dizesi içinde durur).

const MP_VERSION = "0.10.35";

export const TRYON_PAGE = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  video { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  canvas { position: fixed; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
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
const maskCanvas = document.createElement("canvas");
const mctx = maskCanvas.getContext("2d");
// Yalnızca saç pikselleri (doku korunarak açma/koyulaştırma için)
const hairLayer = document.createElement("canvas");
const hctx = hairLayer.getContext("2d");

const state = { hair: null, makeup: null, scanning: true };
const scan = { samples: [], need: 36, lastPost: 0 };
let face = null, seg = null, lastMask = null, maskW = 0, maskH = 0, maskImg = null;
let frame = 0, lastTs = -1, facePresent = null, lastFacePost = 0;

window.__tryon = {
  set(cmd) {
    if ("hair" in cmd) state.hair = cmd.hair;
    if ("makeup" in cmd) state.makeup = cmd.makeup;
    if (cmd.scan) { scan.samples = []; state.scanning = true; }
    if (cmd.capture) capture();
  },
};

// Yüz noktaları (MediaPipe Face Mesh dizinleri)
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

function loop() {
  requestAnimationFrame(loop);
  if (video.readyState < 2) return;
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ts = performance.now();
  if (ts <= lastTs) return;
  lastTs = ts;
  frame++;

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(video, 0, 0, w, h);

  let lm = null;
  try {
    const r = face.detectForVideo(video, ts);
    lm = r.faceLandmarks && r.faceLandmarks[0];
  } catch (e) {}
  reportFace(!!lm);

  if (state.hair) {
    if (frame % 2 === 0 || !lastMask) updateMask(ts);
    if (lastMask) drawHair(w, h);
  }
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

// ── Saç rengi ──
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
    }
    if (res.close) res.close();
  } catch (e) {}
}

function drawHair(w, h) {
  const c = state.hair;
  const col = hex(c.color);
  if (maskCanvas.width !== maskW || maskCanvas.height !== maskH || !maskImg) {
    maskCanvas.width = maskW;
    maskCanvas.height = maskH;
    maskImg = mctx.createImageData(maskW, maskH);
  }
  const d = maskImg.data;
  for (let i = 0, j = 0; i < lastMask.length; i++, j += 4) {
    let v = lastMask[i];
    v = v < 0.3 ? 0 : (v - 0.3) / 0.7;
    d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; d[j + 3] = v * 255;
  }
  mctx.putImageData(maskImg, 0, 0);
  if (c.lift || c.dark) {
    // Saçın kendisini kendisiyle "screen"/"multiply" karıştırmak, tellerin dokusunu koruyarak açar/koyulaştırır.
    if (hairLayer.width !== w || hairLayer.height !== h) { hairLayer.width = w; hairLayer.height = h; }
    hctx.globalCompositeOperation = "source-over";
    hctx.clearRect(0, 0, w, h);
    hctx.drawImage(video, 0, 0, w, h);
    hctx.globalCompositeOperation = "destination-in";
    hctx.drawImage(maskCanvas, 0, 0, w, h);
    if (c.lift) {
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = Math.min(1, c.lift * 1.6);
      ctx.drawImage(hairLayer, 0, 0, w, h);
      if (c.lift > 0.4) ctx.drawImage(hairLayer, 0, 0, w, h);
    }
    if (c.dark) {
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = Math.min(1, c.dark * 1.6);
      ctx.drawImage(hairLayer, 0, 0, w, h);
    }
  }
  ctx.globalCompositeOperation = "color";
  ctx.globalAlpha = c.alpha;
  ctx.drawImage(maskCanvas, 0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

// ── Makyaj ──
const pt = (lm, i, w, h) => [lm[i].x * w, lm[i].y * h];
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
