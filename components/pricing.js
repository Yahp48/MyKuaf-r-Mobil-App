// Hizmet fiyatı ve indirim yardımcıları. Kesin fiyat her zaman sunucuda hesaplanır;
// bunlar yalnızca ekranda doğru tahmini göstermek içindir.

const localYmd = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** İndirim verilen günde (YYYY-AA-GG) geçerli mi? */
export const discountOn = (service, day = localYmd()) =>
  service?.discount && day >= service.discount.startsOn && day <= service.discount.endsOn ? service.discount : null;

/** Hizmetin o gün ödenecek fiyatı (TL). */
export const priceOn = (service, day) => discountOn(service, day)?.price ?? service.price;

const shortDate = (ymd) => new Date(`${ymd}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

/** "27 Kas – 11 Ara" */
export const discountRange = (d) =>
  d.startsOn === d.endsOn ? shortDate(d.startsOn) : `${shortDate(d.startsOn)} – ${shortDate(d.endsOn)}`;

// Sayıya yönelme eki: 20 → "ye" (%20'ye), 30 → "a" (%30'a), 15 → "e" (%15'e)
const ONES = ["", "e", "ye", "e", "e", "e", "ya", "ye", "e", "a"];
const TENS = ["", "a", "ye", "a", "a", "ye", "a", "e", "e", "a"];
export const dative = (n) => {
  const v = Math.round(n);
  if (v % 10) return ONES[v % 10];
  if (v % 100) return TENS[Math.floor(v / 10) % 10];
  return "e"; // yüz
};

/** "%20'ye varan indirim" */
export const upToDiscount = (percent) => `%${percent}'${dative(percent)} varan indirim`;
