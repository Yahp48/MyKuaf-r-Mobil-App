import type { SalonProfile } from "./types";

export type SalonKind = SalonProfile["kind"];

/**
 * Hizmet işletmesi türleri: her tür panelde kendi adıyla, personel unvanıyla ve örnek metinleriyle görünür.
 * Hepsi kadınlara yönelik hizmet verir.
 */
export const KINDS: Record<
  SalonKind,
  { label: string; short: string; staffTitle: string; staffNav: string; placeholder: string; hint: string }
> = {
  HAIR: {
    label: "Kuaför",
    short: "Kuaför",
    staffTitle: "Kuaför, renk uzmanı…",
    staffNav: "Personel",
    placeholder: "Örn. Kesim, boya, balyaj, keratin ve gelin saçı.",
    hint: "Kesim, boya, bakım, fön ve gelin saçı",
  },
  BEAUTY: {
    label: "Güzellik merkezi",
    short: "Güzellik",
    staffTitle: "Güzellik uzmanı, estetisyen…",
    staffNav: "Uzmanlar",
    placeholder: "Örn. Ağda, lazer epilasyon, cilt bakımı ve bölgesel incelme.",
    hint: "Ağda, epilasyon, cilt ve vücut bakımı",
  },
  NAIL: {
    label: "Tırnak stüdyosu",
    short: "Tırnak",
    staffTitle: "Tırnak uzmanı, manikürist…",
    staffNav: "Uzmanlar",
    placeholder: "Örn. Kalıcı oje, protez tırnak, nail art, spa manikür-pedikür.",
    hint: "Manikür, pedikür, kalıcı oje, protez tırnak",
  },
  SKIN: {
    label: "Cilt bakım merkezi",
    short: "Cilt bakımı",
    staffTitle: "Cilt bakım uzmanı, estetisyen…",
    staffNav: "Uzmanlar",
    placeholder: "Örn. Hydrafacial, akne bakımı, dermapen, kimyasal peeling.",
    hint: "Cilt bakımı ve yenileme uygulamaları",
  },
  MASSAGE: {
    label: "Masaj ve spa",
    short: "Masaj ve spa",
    staffTitle: "Masaj terapisti, spa terapisti…",
    staffNav: "Terapistler",
    placeholder: "Örn. Kadınlara özel aromaterapi, sıcak taş masajı ve hamam ritüeli.",
    hint: "Kadınlara özel masaj, hamam ve spa",
  },
  BROW_LASH: {
    label: "Kaş ve kirpik stüdyosu",
    short: "Kaş ve kirpik",
    staffTitle: "Kirpik uzmanı, kaş tasarım uzmanı…",
    staffNav: "Uzmanlar",
    placeholder: "Örn. İpek kirpik, kirpik lifting, kaş laminasyonu ve microblading.",
    hint: "Kaş tasarımı, kirpik, kalıcı makyaj",
  },
  MAKEUP: {
    label: "Makyaj stüdyosu",
    short: "Makyaj",
    staffTitle: "Makyaj sanatçısı…",
    staffNav: "Ekip",
    placeholder: "Örn. Gelin, nişan ve özel gün makyajı.",
    hint: "Gelin, özel gün ve günlük makyaj",
  },
};

export const KIND_ORDER: SalonKind[] = ["HAIR", "BEAUTY", "NAIL", "SKIN", "BROW_LASH", "MAKEUP", "MASSAGE"];

export const kindOf = (salon: SalonProfile | null | undefined) => KINDS[salon?.kind ?? "HAIR"];
