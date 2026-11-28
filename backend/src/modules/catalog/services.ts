/**
 * Hazır hizmet kataloğu: işletmeler "Hazır listeden ekle" ile seçer, fiyatı kendileri girer.
 * Süreler yaygın uygulama sürelerine göre önerilir; işletme değiştirebilir.
 * Tıbbi işlem sayılan uygulamalar (dolgu, botoks, iğneli mezoterapi vb.) bilerek listede yoktur:
 * bunlar yalnızca hekim tarafından yapılabilir.
 */
export type SalonKindKey = "HAIR" | "BEAUTY" | "NAIL" | "SKIN" | "MASSAGE" | "BROW_LASH" | "MAKEUP";

export interface CatalogItem {
  name: string;
  durationMinutes: number;
  description?: string;
}

export interface CatalogCategory {
  key: string;
  name: string;
  /** Bu kategorinin öne çıktığı işletme türleri */
  kinds: SalonKindKey[];
  items: CatalogItem[];
}

const i = (name: string, durationMinutes: number, description?: string): CatalogItem => ({
  name,
  durationMinutes,
  ...(description ? { description } : {}),
});

export const SERVICE_CATALOG: CatalogCategory[] = [
  // ───────── Kuaför ─────────
  {
    key: "kesim",
    name: "Kesim",
    kinds: ["HAIR"],
    items: [
      i("Saç kesimi (kısa saç)", 30),
      i("Saç kesimi (orta boy)", 45),
      i("Saç kesimi (uzun saç)", 60),
      i("Uç alma", 20),
      i("Kâkül kesimi", 15),
      i("Katlı kesim", 60),
      i("Bob / lob kesim", 45),
      i("Pixie kesim", 45),
      i("Kıvırcık saç kesimi (kuru kesim)", 60),
      i("Kız çocuk saç kesimi", 30),
      i("Yıkama + kesim + fön", 75),
    ],
  },
  {
    key: "fon-sekillendirme",
    name: "Fön ve şekillendirme",
    kinds: ["HAIR"],
    items: [
      i("Fön (kısa saç)", 30),
      i("Fön (orta boy)", 40),
      i("Fön (uzun saç)", 50),
      i("Yıkama + fön", 45),
      i("Maşa / bukle", 45),
      i("Dalgalı şekillendirme (beach wave)", 45),
      i("Düzleştirici ile şekillendirme", 40),
      i("Topuz", 45),
      i("Örgü modelleri", 45),
      i("Abiye / nişan saçı", 60),
      i("Kına gecesi saçı", 60),
    ],
  },
  {
    key: "boya-renk",
    name: "Boya ve renk",
    kinds: ["HAIR"],
    items: [
      i("Dip boya", 90),
      i("Tüm saç boya", 120),
      i("Balyaj", 180),
      i("Ombre", 180),
      i("Sombre", 180),
      i("Röfle", 150),
      i("Highlight / babylight", 180),
      i("Air touch", 240),
      i("Renk açma (dekolorasyon)", 150),
      i("Gölge boya / toner", 45),
      i("Renk düzeltme", 240),
      i("Fantezi renk", 180),
      i("Bitkisel boya (kına)", 120),
      i("Beyaz kapatma", 75),
    ],
  },
  {
    key: "sac-bakimi",
    name: "Saç bakımı",
    kinds: ["HAIR"],
    items: [
      i("Keratin bakımı", 150),
      i("Brezilya fönü", 150),
      i("Saç botoksu (bakım)", 120),
      i("Kolajen bakımı", 90),
      i("Olaplex bakımı", 60),
      i("Nem bakımı / maske", 45),
      i("Onarıcı bakım (yıpranmış saç)", 60),
      i("Saç derisi bakımı", 45),
      i("Kepek ve yağlanma bakımı", 45),
      i("Kaynak saç bakımı", 60),
    ],
  },
  {
    key: "kaynak-perma",
    name: "Kaynak, perma ve kalıcı düzleştirme",
    kinds: ["HAIR"],
    items: [
      i("Mikro kaynak", 180),
      i("Bant kaynak", 120),
      i("Keratin (sıcak) kaynak", 240),
      i("Kaynak sökümü", 60),
      i("Kaynak yenileme / sıkılaştırma", 120),
      i("Perma", 150),
      i("Kalıcı düzleştirme (Japon)", 240),
      i("Afro / rasta örgü", 240),
    ],
  },
  {
    key: "gelin-ozel-gun",
    name: "Gelin ve özel gün",
    kinds: ["HAIR", "MAKEUP", "BEAUTY"],
    items: [
      i("Gelin saçı", 120),
      i("Gelin saçı provası", 90),
      i("Gelin makyajı", 90),
      i("Gelin paketi (saç + makyaj)", 180),
      i("Nişan saç ve makyaj", 150),
      i("Kına gecesi saç ve makyaj", 150),
      i("Gelin annesi / nedime saçı", 60),
    ],
  },

  // ───────── Tırnak ─────────
  {
    key: "manikur-pedikur",
    name: "Manikür ve pedikür",
    kinds: ["NAIL", "BEAUTY"],
    items: [
      i("Klasik manikür", 30),
      i("Klasik pedikür", 45),
      i("Spa manikür", 45),
      i("Spa pedikür", 60),
      i("Manikür + pedikür", 75),
      i("Medikal pedikür (nasır, batık tırnak bakımı)", 60, "Hekim gerektiren işlemler hariç"),
      i("Çocuk manikürü", 20),
      i("Parafin bakımı (el)", 20),
      i("Parafin bakımı (ayak)", 20),
    ],
  },
  {
    key: "kalici-oje",
    name: "Kalıcı oje",
    kinds: ["NAIL", "BEAUTY"],
    items: [
      i("Kalıcı oje (el)", 45),
      i("Kalıcı oje (ayak)", 45),
      i("Manikür + kalıcı oje", 60),
      i("Pedikür + kalıcı oje", 75),
      i("French kalıcı oje", 60),
      i("Babyboomer", 60),
      i("Kalıcı oje çıkarma", 20),
      i("Tırnak güçlendirme (rubber base / jel)", 60),
    ],
  },
  {
    key: "protez-tirnak",
    name: "Protez tırnak ve nail art",
    kinds: ["NAIL"],
    items: [
      i("Protez tırnak (jel)", 120),
      i("Protez tırnak (akrilik)", 120),
      i("Protez tırnak (poligel)", 120),
      i("Protez tırnak dolgu / bakım", 90),
      i("Protez tırnak çıkarma", 30),
      i("Kırık tırnak onarımı (tek tırnak)", 15),
      i("Nail art (tırnak başına)", 10),
      i("Nail art (tüm tırnaklar)", 45),
      i("Taş / süsleme uygulaması", 20),
    ],
  },

  // ───────── Cilt bakımı (tıbbi olmayan) ─────────
  {
    key: "cilt-bakimi",
    name: "Cilt bakımı",
    kinds: ["SKIN", "BEAUTY"],
    items: [
      i("Klasik cilt bakımı", 60),
      i("Derin temizlik (akne / siyah nokta bakımı)", 75),
      i("Hydrafacial", 60),
      i("Nem bakımı", 60),
      i("Anti-aging bakım", 75),
      i("Leke karşıtı bakım", 60),
      i("Oksijen bakımı", 60),
      i("Altın maske bakımı", 60),
      i("Göz çevresi bakımı", 30),
      i("Sırt bakımı", 45),
      i("Gelin cilt bakımı", 90),
    ],
  },
  {
    key: "cilt-teknoloji",
    name: "Cilt yenileme uygulamaları",
    kinds: ["SKIN", "BEAUTY"],
    items: [
      i("Kimyasal peeling", 45, "Yüzeysel peeling; derin peeling hekim işidir"),
      i("Karbon peeling", 45),
      i("Mikrodermabrazyon", 45),
      i("Dermapen (mikro iğneleme)", 60),
      i("Radyofrekans ile cilt sıkılaştırma", 45),
      i("LED ışık terapisi", 30),
    ],
  },

  // ───────── Epilasyon ve ağda ─────────
  {
    key: "agda",
    name: "Ağda",
    kinds: ["BEAUTY"],
    items: [
      i("Tüm bacak ağda", 45),
      i("Yarım bacak ağda", 30),
      i("Koltuk altı ağda", 15),
      i("Kol ağda", 30),
      i("Bikini bölgesi ağda", 20),
      i("Brezilya ağda", 40),
      i("Yüz ağda", 20),
      i("Bıyık ağda", 10),
      i("Tüm vücut ağda", 90),
      i("Şeker ağda (sir)", 45),
    ],
  },
  {
    key: "epilasyon",
    name: "Lazer ve iğneli epilasyon",
    kinds: ["BEAUTY", "SKIN"],
    items: [
      i("Lazer epilasyon (koltuk altı)", 15),
      i("Lazer epilasyon (bikini)", 20),
      i("Lazer epilasyon (tüm bacak)", 45),
      i("Lazer epilasyon (yüz)", 15),
      i("Lazer epilasyon (tüm vücut)", 90),
      i("İğneli epilasyon (seans)", 30),
    ],
  },
  {
    key: "vucut",
    name: "Vücut bakımı ve bölgesel incelme",
    kinds: ["BEAUTY", "MASSAGE"],
    items: [
      i("Bölgesel incelme (seans)", 45),
      i("G5 masajı", 30),
      i("Selülit bakımı", 45),
      i("Vücut peelingi", 30),
      i("Vücut maskesi / sargı", 45),
      i("Kaşıntısız bronzlaşma (sprey ten)", 30),
    ],
  },

  // ───────── Masaj ve spa (kadınlara özel) ─────────
  {
    key: "masaj",
    name: "Masaj",
    kinds: ["MASSAGE"],
    items: [
      i("Klasik (İsveç) masajı — 30 dk", 30),
      i("Klasik (İsveç) masajı — 60 dk", 60),
      i("Aromaterapi masajı", 60),
      i("Sıcak taş masajı", 75),
      i("Derin doku masajı", 60),
      i("Bali masajı", 60),
      i("Baş, boyun ve omuz masajı", 30),
      i("Refleksoloji (ayak masajı)", 45),
      i("Lenf drenaj masajı", 60),
      i("Anti-selülit masajı", 45),
      i("Hamile masajı", 60, "İkinci trimesterden itibaren, hekim onayıyla"),
      i("Yüz masajı", 30),
    ],
  },
  {
    key: "spa-hamam",
    name: "Spa ve hamam",
    kinds: ["MASSAGE"],
    items: [
      i("Hamam + kese köpük", 45),
      i("Hamam ritüeli", 90),
      i("Sauna / buhar odası", 30),
      i("Tuz peelingi", 30),
      i("Çikolata / kahve bakımı", 60),
      i("Spa paketi (hamam + masaj)", 120),
    ],
  },

  // ───────── Kaş ve kirpik ─────────
  {
    key: "kas",
    name: "Kaş",
    kinds: ["BROW_LASH", "BEAUTY", "HAIR"],
    items: [
      i("Kaş alma (cımbız)", 15),
      i("Kaş alma (iple)", 15),
      i("Kaş tasarımı", 30),
      i("Kaş laminasyonu", 45),
      i("Kaş boyama / kına", 20),
      i("Microblading", 120),
      i("Kaş microblading rötuşu", 60),
      i("Bıyık / yüz ipleme", 15),
    ],
  },
  {
    key: "kirpik",
    name: "Kirpik",
    kinds: ["BROW_LASH", "BEAUTY"],
    items: [
      i("Kirpik lifting", 60),
      i("Kirpik boyama", 20),
      i("İpek kirpik (klasik)", 120),
      i("İpek kirpik (volume)", 150),
      i("İpek kirpik bakım / dolgu", 60),
      i("İpek kirpik sökme", 30),
      i("Takma kirpik uygulaması", 15),
    ],
  },
  {
    key: "kalici-makyaj",
    name: "Kalıcı makyaj",
    kinds: ["BROW_LASH", "MAKEUP", "BEAUTY"],
    items: [
      i("Kalıcı eyeliner", 90),
      i("Dudak renklendirme", 120),
      i("Kalıcı kaş (nano / pudra)", 120),
      i("Kalıcı makyaj rötuşu", 60),
    ],
  },

  // ───────── Makyaj ─────────
  {
    key: "makyaj",
    name: "Makyaj",
    kinds: ["MAKEUP", "BEAUTY", "HAIR"],
    items: [
      i("Günlük makyaj", 45),
      i("Gece / abiye makyajı", 60),
      i("Nişan makyajı", 75),
      i("Fotoğraf çekimi makyajı", 60),
      i("Kişisel makyaj dersi", 90),
    ],
  },
];

/** Bir işletme türü için önerilen kategoriler önce, diğerleri sonra. */
export function catalogFor(kind: SalonKindKey) {
  return [...SERVICE_CATALOG].sort((a, b) => Number(b.kinds.includes(kind)) - Number(a.kinds.includes(kind)));
}
