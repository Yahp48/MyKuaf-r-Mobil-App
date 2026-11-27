// Canlı deneme kataloğu: saç renkleri, makyaj görünümleri, yüz şekilleri ve şekle uygun saç modelleri.

/** color: ton, alpha: renk geçişi, lift: açma (sarı/platin), dark: koyulaştırma */
export const HAIR_COLORS = [
  { key: "natural", label: "Doğal", swatch: null },
  { key: "black", label: "Siyah", swatch: "#1B1716", color: "#1B1716", alpha: 0.55, dark: 0.45 },
  { key: "espresso", label: "Koyu kahve", swatch: "#3B2219", color: "#3B2219", alpha: 0.6, dark: 0.3 },
  { key: "chestnut", label: "Kestane", swatch: "#6A3A24", color: "#6A3A24", alpha: 0.65, dark: 0.12 },
  { key: "caramel", label: "Karamel", swatch: "#A86B3A", color: "#A86B3A", alpha: 0.65, lift: 0.18 },
  { key: "honey", label: "Bal köpüğü", swatch: "#C4975A", color: "#C4975A", alpha: 0.7, lift: 0.3 },
  { key: "ash", label: "Küllü sarı", swatch: "#C9BC9F", color: "#C9BC9F", alpha: 0.75, lift: 0.42 },
  { key: "silver", label: "Gümüş", swatch: "#C9C9C9", color: "#E6E2D8", alpha: 0.8, lift: 0.55 },
  { key: "copper", label: "Bakır", swatch: "#B5532A", color: "#B5532A", alpha: 0.7, lift: 0.12 },
  { key: "red", label: "Kızıl", swatch: "#8E2A1F", color: "#8E2A1F", alpha: 0.7 },
  { key: "burgundy", label: "Bordo", swatch: "#5C1428", color: "#5C1428", alpha: 0.7, dark: 0.15 },
  { key: "rose", label: "Pembe", swatch: "#D98AA8", color: "#D98AA8", alpha: 0.75, lift: 0.35 },
  { key: "lilac", label: "Lila", swatch: "#9B86C9", color: "#9B86C9", alpha: 0.75, lift: 0.3 },
  { key: "blue", label: "Gece mavisi", swatch: "#2F4E8C", color: "#2F4E8C", alpha: 0.7 },
];

export const MAKEUP_LOOKS = [
  { key: "none", label: "Yok", swatch: null },
  { key: "natural", label: "Doğal", swatch: "#C9767A", lips: "#C46A6A", lipsA: 0.28, blush: "#E8899A", blushA: 0.16 },
  { key: "nude", label: "Nude", swatch: "#B98472", lips: "#B97A6A", lipsA: 0.38, shadow: "#A07860", shadowA: 0.22 },
  {
    key: "rose",
    label: "Pembe",
    swatch: "#E0708E",
    lips: "#D65B7A",
    lipsA: 0.4,
    blush: "#F08AA0",
    blushA: 0.2,
    shadow: "#D9A0A8",
    shadowA: 0.25,
  },
  { key: "classic", label: "Kırmızı ruj", swatch: "#B3122E", lips: "#B3122E", lipsA: 0.6, liner: true, wing: true },
  { key: "fuchsia", label: "Fuşya", swatch: "#C9184A", lips: "#C9184A", lipsA: 0.55, blush: "#E86A8A", blushA: 0.16 },
  {
    key: "bronze",
    label: "Bronz",
    swatch: "#A0603C",
    lips: "#A0523C",
    lipsA: 0.42,
    blush: "#C97A4A",
    blushA: 0.2,
    shadow: "#8A5A2E",
    shadowA: 0.35,
    liner: true,
  },
  {
    key: "night",
    label: "Gece",
    swatch: "#5A2338",
    lips: "#7A1F3D",
    lipsA: 0.55,
    shadow: "#3A2A3A",
    shadowA: 0.5,
    liner: true,
    wing: true,
  },
];

export const FACE_SHAPES = {
  OVAL: {
    label: "Oval",
    text: "Alın ve çene dengeli, yüz uzunluğu genişliğinden biraz fazla. Çoğu saç modeli size yakışır.",
  },
  ROUND: {
    label: "Yuvarlak",
    text: "Yüz uzunluğu ve genişliği birbirine yakın, hatlar yumuşak. Tepede hacim ve dikey çizgiler yüzü uzun gösterir.",
  },
  SQUARE: {
    label: "Kare",
    text: "Alın, elmacık ve çene genişliği yakın, çene hattı belirgin. Yumuşak dalgalar ve katlar hatları dengeler.",
  },
  HEART: {
    label: "Kalp",
    text: "Alın geniş, çene ince ve sivri. Çene hizasında hacim veren modeller dengeyi sağlar.",
  },
  OBLONG: {
    label: "Uzun",
    text: "Yüz uzunluğu genişliğinden belirgin şekilde fazla. Kâkül ve yanlarda hacim yüzü kısaltır.",
  },
  DIAMOND: {
    label: "Elmas",
    text: "Elmacık kemikleri geniş, alın ve çene dar. Alın ve çene hizasında dolgunluk veren modeller uygundur.",
  },
};

/**
 * Denenebilir saç modelleri. Görseller Unsplash lisanslı portrelerden yalnızca saç bölgesi ayrılarak üretildi
 * (kaynaklar anchors.json içinde). anchors: göz merkezleri ve çene, yüze yerleştirmek için.
 * suits: bu modelin yakıştığı yüz şekilleri.
 */
const ANCHORS = require("../../assets/tryon/hair/anchors.json");

const style = (key, label, length, suits, image) => ({
  key,
  label,
  length,
  suits,
  image,
  anchors: ANCHORS[key].anchors,
});

export const HAIRSTYLES = [
  style("pixie", "Kâküllü pixie", "Kısa", ["OVAL", "HEART", "DIAMOND"], require("../../assets/tryon/hair/pixie.webp")),
  style(
    "short-platinum",
    "Kısa platin",
    "Kısa",
    ["OVAL", "OBLONG", "HEART"],
    require("../../assets/tryon/hair/short-platinum.webp"),
  ),
  style(
    "short-bob",
    "Kısa bob",
    "Kısa",
    ["OVAL", "HEART", "DIAMOND", "SQUARE"],
    require("../../assets/tryon/hair/short-bob.webp"),
  ),
  style(
    "bangs-bob",
    "Kâküllü küt",
    "Orta",
    ["OBLONG", "OVAL", "HEART", "DIAMOND"],
    require("../../assets/tryon/hair/bangs-bob.webp"),
  ),
  style(
    "shoulder",
    "Omuz hizası",
    "Orta",
    ["ROUND", "SQUARE", "OVAL", "OBLONG"],
    require("../../assets/tryon/hair/shoulder.webp"),
  ),
  style(
    "long-straight",
    "Uzun düz",
    "Uzun",
    ["ROUND", "OVAL", "HEART"],
    require("../../assets/tryon/hair/long-straight.webp"),
  ),
  style(
    "long-balayage",
    "Uzun balyaj",
    "Uzun",
    ["ROUND", "OVAL", "SQUARE"],
    require("../../assets/tryon/hair/long-balayage.webp"),
  ),
  style(
    "long-wavy",
    "Uzun dalgalı",
    "Uzun",
    ["SQUARE", "OBLONG", "HEART", "OVAL"],
    require("../../assets/tryon/hair/long-wavy.webp"),
  ),
  style(
    "long-curly",
    "Uzun kıvırcık",
    "Uzun",
    ["SQUARE", "OBLONG", "OVAL", "DIAMOND"],
    require("../../assets/tryon/hair/long-curly.webp"),
  ),
  style(
    "long-bangs",
    "Kâküllü uzun",
    "Uzun",
    ["OBLONG", "OVAL", "DIAMOND", "HEART"],
    require("../../assets/tryon/hair/long-bangs.webp"),
  ),
];
