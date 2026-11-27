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

/** Yüz şekline göre önerilen modeller (genel stil kuralları; kesin karar için kuaförünüze danışın). */
export const HAIRSTYLES = {
  OVAL: {
    women: [
      ["Uzun katlı kesim", "Dengeli hatları ön plana çıkarır"],
      ["Lob (uzun bob)", "Omuz hizasında modern ve kolay"],
      ["Perdeli kâkül", "Yüzü çerçeveler, gözleri öne çıkarır"],
      ["Pixie", "Yüz hatlarınız kısa kesimi taşır"],
    ],
    men: [
      ["Pompadour", "Tepe hacmi dengeli yüzde çok iyi durur"],
      ["Quiff", "Dağınık ön hacim, yanlar kısa"],
      ["Buzz cut", "Temiz ve bakımı kolay"],
      ["Yandan ayrık klasik", "Her ortama uyar"],
    ],
  },
  ROUND: {
    women: [
      ["Asimetrik bob", "Açılı hatlar yüzü inceltir"],
      ["Uzun katlı, yüzü çerçeveleyen", "Dikey çizgi yüzü uzun gösterir"],
      ["Yan ayrımlı uzun düz", "Yanak hattını gizler"],
      ["Tepe hacimli uzun pixie", "Yüksekliğe vurgu yapar"],
    ],
    men: [
      ["Yanlar fade, tepe quiff", "Yüzü uzun ve köşeli gösterir"],
      ["Pompadour", "Tepe hacmi yüzü uzatır"],
      ["Undercut", "Yanları sıkı, tepesi uzun"],
      ["Faux hawk", "Orta hattaki hacim yüzü inceltir"],
    ],
  },
  SQUARE: {
    women: [
      ["Yumuşak dalgalı lob", "Köşeli çene hattını yumuşatır"],
      ["Yan kâkül", "Alın çizgisini kırar"],
      ["Katlı shag", "Hareketli katlar hatları dengeler"],
      ["Uzun dalgalı", "Çene çevresinde yumuşaklık verir"],
    ],
    men: [
      ["Textured crop", "Dağınık doku sert hatları dengeler"],
      ["Yandan ayrık", "Güçlü çene hattıyla uyumlu"],
      ["Orta uzun dağınık", "Yumuşak bir görünüm verir"],
      ["Crew cut", "Belirgin hatları öne çıkarır"],
    ],
  },
  HEART: {
    women: [
      ["Çene hizası bob", "Dar çeneye hacim katar"],
      ["Yan kâkül", "Geniş alnı dengeler"],
      ["Uçları dışa dönük orta boy", "Alt yüzde dolgunluk sağlar"],
      ["Uzun, çenede hacimli katlar", "Yüzü dengeler"],
    ],
    men: [
      ["Yana taranmış orta uzunluk", "Alın genişliğini dengeler"],
      ["Perçemli (fringe)", "Alnı kısmen örter"],
      ["Dağınık kısa", "Tepede fazla hacimden kaçınır"],
    ],
  },
  OBLONG: {
    women: [
      ["Perdeli kâkül", "Yüzü görsel olarak kısaltır"],
      ["Omuz hizası dalgalı", "Yanlarda hacim yaratır"],
      ["Hacimli bob", "Genişlik katar"],
      ["Düz küt kâkül", "Alın boyunu kısaltır"],
    ],
    men: [
      ["Yanları uzun crop", "Tepede yükseklikten kaçınır"],
      ["Perçemli (fringe)", "Yüzü kısa gösterir"],
      ["Az fade, yanlar dolgun", "Genişlik katar"],
    ],
  },
  DIAMOND: {
    women: [
      ["Çene hizası bob", "Dar çeneyi dolgunlaştırır"],
      ["Yan kâkül ve uzun saç", "Alnı genişletir"],
      ["Dağınık pixie", "Elmacık kemiklerini öne çıkarır"],
      ["Kulak arkası uzun", "Elmacık hattını sergiler"],
    ],
    men: [
      ["Perçemli (fringe)", "Dar alnı dengeler"],
      ["Dokulu quiff", "Tepeye hacim katar"],
      ["Yana taranmış orta uzunluk", "Elmacık genişliğini dengeler"],
    ],
  },
};
