/* eslint-disable no-console */
/**
 * Bakımca geçici marka simgesi üretici (yazı tipi kullanmaz; geometrik "b" + nokta).
 * Profesyonel logo gelince bu dosya yerine tasarımcının çıktıları assets/ altına konur.
 * Çalıştırma: node scripts/make-icons.js
 */
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const BRAND = [0xc9, 0x18, 0x4a];
const WHITE = [255, 255, 255];
const SS = 4; // kenar yumuşatma için piksel başına 4x4 örnek

/** 1024'lük kanvasta "b" harfi ve nokta (merkez 512,512); scale ile güvenli alana küçültülür. */
function inGlyph(x, y, scale) {
  const ux = 512 + (x - 512) / scale;
  const uy = 512 + (y - 512) / scale;
  // Gövde: yuvarlak uçlu dikey çubuk
  const sx0 = 278, sx1 = 398, sy0 = 214, sy1 = 812, r = 60;
  if (ux >= sx0 && ux <= sx1 && uy >= sy0 + r && uy <= sy1 - r) return true;
  const cx = (sx0 + sx1) / 2;
  if (Math.hypot(ux - cx, uy - (sy0 + r)) <= r) return true;
  if (ux >= sx0 && ux <= sx1 && uy >= sy1 - r && uy <= sy1) return true; // alt düz (kase ile birleşir)
  // Kase: halka
  const d = Math.hypot(ux - 535, uy - 600);
  if (d <= 212 && d >= 100) return true;
  // Nokta
  if (Math.hypot(ux - 690, uy - 290) <= 56) return true;
  return false;
}

function render(size, { bg, fg, scale }) {
  const png = new PNG({ width: size, height: size });
  const k = 1024 / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (inGlyph((px + (sx + 0.5) / SS) * k, (py + (sy + 0.5) / SS) * k, scale)) hit++;
        }
      }
      const a = hit / (SS * SS);
      const i = (py * size + px) * 4;
      if (bg) {
        for (let c = 0; c < 3; c++) png.data[i + c] = Math.round(bg[c] * (1 - a) + fg[c] * a);
        png.data[i + 3] = 255;
      } else {
        for (let c = 0; c < 3; c++) png.data[i + c] = fg[c];
        png.data[i + 3] = Math.round(a * 255);
      }
    }
  }
  return PNG.sync.write(png);
}

const out = (name, buf) => {
  fs.writeFileSync(path.join(__dirname, "..", "assets", name), buf);
  console.log("assets/" + name);
};

// iOS/Android mağaza simgesi: saydamlık yok, tam renk zemin
out("icon.png", render(1024, { bg: BRAND, fg: WHITE, scale: 0.86 }));
// Android uyarlanır simge ön katmanı: saydam, güvenli alan (%66) içinde; zemin rengi app.config'te
out("adaptive-icon.png", render(1024, { bg: null, fg: WHITE, scale: 0.56 }));
// Açılış ekranı: beyaz zemin üzerinde marka renginde işaret
out("splash-icon.png", render(1024, { bg: null, fg: BRAND, scale: 0.6 }));
out("favicon.png", render(48, { bg: BRAND, fg: WHITE, scale: 0.86 }));
