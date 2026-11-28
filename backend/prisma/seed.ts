// Geliştirme ortamı örnek verisi. Tekrar çalıştırılabilir (slug/e-posta üzerinden upsert).
// Çalıştırma: npm run db:seed
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { hashPassword } from "../src/lib/password.ts";
import { ISTANBUL_LISTINGS } from "./data/istanbul-salons.ts";
import { SERVICE_CATALOG } from "../src/modules/catalog/services.ts";
import { isValidVkn } from "../src/lib/tax-id.ts";

if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
  console.error("Seed production ortamında çalıştırılamaz (SEED_ALLOW_PRODUCTION=true ile zorlanabilir).");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const H = (h: number, m = 0) => h * 60 + m;

// Salon galerisi: yatay kırpım
const salonImg = (id: string) => `https://images.unsplash.com/${id}?w=1000&h=700&fit=crop`;

// Yalnızca yerel geliştirme: panel ve randevu akışını denemek için tek demo salon (adı açıkça "Demo").
// Gerçek salonlar prisma/data/istanbul-salons.ts (OpenStreetMap) içindedir ve rehber kaydı olarak eklenir.
const demoSalon = {
  slug: "mykuafor-demo-salon",
  kind: "HAIR" as const,
  photos: [
    salonImg("photo-1560066984-138dadb4c035"),
    salonImg("photo-1522337360788-8b13dee7a37e"),
    salonImg("photo-1633681926022-84c23e8cb2d6"),
  ],
  description: "Geliştirme ortamı demo salonu: randevu, panel ve ödeme akışlarını denemek içindir.",
  name: "MyKuaför Demo Salon",
  address: "Caferağa Mah. Moda Cad. No:1, 34710 Kadıköy/İstanbul",
  district: "Kadıköy",
  latitude: 40.9862,
  longitude: 29.0262,
  closes: H(20),
};

// Eski Kırşehir örnek verisinin slug'ları (temizlenir)
const LEGACY_SALON_SLUGS = [
  "zeynep-bayan-kuafor",
  "kentpark-kuafor",
  "ataturk-bulvari-kuafor",
  "masal-parki-kuafor",
  "hamidiye-kuafor",
];

const staffNames = [
  { name: "Zeynep", title: "Kuaför" },
  { name: "Elif", title: "Renk uzmanı" },
  { name: "Ayşe", title: "Kuaför" },
  { name: "Fatma", title: "Bakım uzmanı" },
];

const services = [
  { name: "Saç Kesimi", durationMinutes: 30, priceCents: 15000, category: "Kesim" },
  { name: "Fön", durationMinutes: 30, priceCents: 10000, category: "Fön ve şekillendirme" },
  { name: "Saç Şekillendirme", durationMinutes: 45, priceCents: 20000, category: "Fön ve şekillendirme" },
  { name: "Saç Bakımı", durationMinutes: 45, priceCents: 25000, category: "Saç bakımı" },
  { name: "Boya", durationMinutes: 90, priceCents: 30000, category: "Boya ve renk" },
];

const categories = [
  { slug: "sac-bakimi", name: "Saç Bakımı", sortOrder: 1 },
  { slug: "serum", name: "Serum", sortOrder: 2 },
  { slug: "maske", name: "Maskeler", sortOrder: 3 },
  { slug: "arac", name: "Araçlar", sortOrder: 4 },
  { slug: "sekillendirici", name: "Şekillendiriciler", sortOrder: 5 },
];

const img = (id: string) => `https://images.unsplash.com/${id}?w=600&h=600&fit=crop`;

const products = [
  {
    slug: "profesyonel-sac-bakim-seti",
    name: "Profesyonel Saç Bakım Seti",
    category: "sac-bakimi",
    brand: "ProfessionalCare",
    priceCents: 29999,
    compareAtPriceCents: 39999,
    stock: 25,
    isFeatured: true,
    description: "Şampuan, saç kremi ve bakım maskesinden oluşan profesyonel set. Tüm saç tipleri için uygundur.",
    features: ["Paraben içermez", "Dermatolojik olarak test edilmiştir", "500 ml"],
    images: [img("photo-1522338242992-e1a54906a8da"), img("photo-1571781926291-c477ebfd024b")],
  },
  {
    slug: "argan-yagi-serumu",
    name: "Argan Yağı Serumu",
    category: "serum",
    brand: "NaturalCare",
    priceCents: 14999,
    compareAtPriceCents: 19999,
    stock: 15,
    isFeatured: true,
    description: "Saf argan yağı ile kuru ve yıpranmış saç uçlarını onarır, parlaklık kazandırır.",
    features: ["%100 argan yağı", "Isıya karşı koruma", "50 ml"],
    images: [img("photo-1571781926291-c477ebfd024b")],
  },
  {
    slug: "keratin-bakim-maskesi",
    name: "Keratin Bakım Maskesi",
    category: "maske",
    brand: "ProfessionalCare",
    priceCents: 14999,
    compareAtPriceCents: null,
    stock: 30,
    isFeatured: false,
    description: "Keratin içeriğiyle saç telini güçlendiren yoğun bakım maskesi.",
    features: ["Keratin ve E vitamini", "Haftada 1-2 kez kullanım", "250 ml"],
    images: [img("photo-1608248543803-ba4f8c70ae0b")],
  },
  {
    slug: "seramik-sac-duzlestirici",
    name: "Seramik Saç Düzleştirici",
    category: "arac",
    brand: "TechStyle",
    priceCents: 89999,
    compareAtPriceCents: 99999,
    stock: 8,
    isFeatured: false,
    description: "Seramik kaplamalı plakalar ve dijital ısı ayarıyla saçı yıpratmadan düzleştirir.",
    features: ["80-230 °C dijital ayar", "Seramik kaplama", "2 yıl garanti"],
    images: [img("photo-1596462502278-27bfdc403348")],
  },
  {
    slug: "premium-sac-sampuani",
    name: "Premium Saç Şampuanı",
    category: "sac-bakimi",
    brand: "NaturalCare",
    priceCents: 8999,
    compareAtPriceCents: null,
    stock: 50,
    isFeatured: false,
    description: "Sülfatsız formülüyle saçı nazikçe temizler, boyalı saçlar için uygundur.",
    features: ["Sülfatsız", "Boyalı saçlar için uygun", "400 ml"],
    images: [img("photo-1535585209827-a15fcdbc4c2d")],
  },
  {
    slug: "guclu-tutus-sac-spreyi",
    name: "Güçlü Tutuş Saç Spreyi",
    category: "sekillendirici",
    brand: "TechStyle",
    priceCents: 12999,
    compareAtPriceCents: null,
    stock: 0,
    isFeatured: false,
    description: "Gün boyu kalıcı, yapışkanlık bırakmayan güçlü tutuşlu sprey.",
    features: ["24 saat tutuş", "Nem önleyici", "300 ml"],
    images: [img("photo-1535585209827-a15fcdbc4c2d")],
  },
];

/** Eski Kırşehir örnek salonlarını ve bağlı kayıtlarını siler. */
async function removeLegacySalons() {
  const legacy = await prisma.salon.findMany({ where: { slug: { in: LEGACY_SALON_SLUGS } }, select: { id: true } });
  if (!legacy.length) return;
  const ids = legacy.map((l) => l.id);
  await prisma.salonReview.deleteMany({ where: { salonId: { in: ids } } });
  await prisma.appointment.deleteMany({ where: { salonId: { in: ids } } });
  await prisma.favoriteSalon.deleteMany({ where: { salonId: { in: ids } } });
  await prisma.salon.updateMany({ where: { id: { in: ids } }, data: { businessId: null } });
  await prisma.salon.deleteMany({ where: { id: { in: ids } } });
  console.log(`Eski Kırşehir örnek verisi silindi: ${ids.length} salon`);
}

/** Gerçek İstanbul salonlarını rehber kaydı olarak ekler/günceller (kaynak: OpenStreetMap, ODbL). */
async function importListings() {
  for (const l of ISTANBUL_LISTINGS) {
    const data = {
      name: l.name,
      kind: l.kind,
      address: l.address,
      city: "İstanbul",
      district: l.district,
      latitude: l.latitude,
      longitude: l.longitude,
      phone: l.phone,
      whatsapp: l.whatsapp,
      website: l.website,
      isListing: true,
      dataSource: "OpenStreetMap",
      sourceRef: l.osm,
    };
    const salon = await prisma.salon.upsert({
      where: { slug: l.slug },
      create: { slug: l.slug, ...data },
      update: data,
    });
    // Rehber kaydı bir işletme tarafından sahiplenildiyse saatlerine dokunulmaz.
    if (salon.businessId) continue;
    await prisma.workingHours.deleteMany({ where: { salonId: salon.id } });
    if (l.hours) {
      await prisma.workingHours.createMany({
        data: l.hours.map((h) => ({
          salonId: salon.id,
          weekday: h.weekday,
          openMinute: h.open ?? 0,
          closeMinute: h.close ?? 0,
          isClosed: !!h.closed,
        })),
      });
    }
  }
  console.log(`Rehber: ${ISTANBUL_LISTINGS.length} İstanbul salonu (OpenStreetMap)`);
}

async function main() {
  await removeLegacySalons();
  await importListings();

  const categoryIds = new Map<string, string>();
  for (const c of categories) {
    const row = await prisma.category.upsert({ where: { slug: c.slug }, create: c, update: c });
    categoryIds.set(c.slug, row.id);
  }

  // Demo satıcı işletmesi: tüm örnek ürünler buna ait
  const seller = await prisma.business.upsert({
    where: { taxNumber: "1234567890" },
    create: {
      type: "SELLER",
      displayName: "Woman Hair Store",
      legalName: "Woman Hair Kozmetik Ticaret Ltd. Şti.",
      taxNumber: "1234567890",
      taxOffice: "Kadıköy",
      address: "Caferağa Mah. Moda Cad. No:3",
      city: "İstanbul",
      district: "Kadıköy",
      phone: "02160000010",
      email: "magaza@mykuafor.test",
      iban: "TR330006100519786457841326",
      returnPolicy: "Açılmamış ürünlerde 14 gün içinde ücretsiz iade.",
    },
    update: { taxOffice: "Kadıköy", address: "Caferağa Mah. Moda Cad. No:3", city: "İstanbul", district: "Kadıköy" },
  });

  for (const { category, ...p } of products) {
    const data = { ...p, categoryId: categoryIds.get(category)!, sellerId: seller.id };
    await prisma.product.upsert({ where: { slug: p.slug }, create: data, update: data });
  }

  // Yalnızca yerel geliştirme: demo hesaplar ve paneller boş görünmesin diye örnek hareketler
  if (process.env.NODE_ENV !== "production") {
    await seedDemo(seller);
  }

  console.log(`Seed tamam: ${ISTANBUL_LISTINGS.length} rehber salonu, ${products.length} ürün.`);
}

// ───────────── Örnek işletmeler (yalnızca yerel geliştirme) ─────────────
// Her işletme türünün paneli ve uygulama akışı denensin diye; adlarında "Örnek" geçer, yayına çıkmaz.
type DemoKind = "BEAUTY" | "NAIL" | "SKIN" | "MASSAGE" | "BROW_LASH" | "MAKEUP";
const DEMO_KINDS: {
  kind: DemoKind;
  name: string;
  email: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  staff: { name: string; title: string; specialties: string[] }[];
  perMinuteTL: number;
}[] = [
  {
    kind: "BEAUTY",
    name: "Örnek Güzellik Merkezi",
    email: "guzellik@mykuafor.test",
    district: "Şişli",
    address: "Teşvikiye Mah. Örnek Sok. No:1, Şişli/İstanbul",
    lat: 41.0505,
    lng: 28.9935,
    staff: [
      { name: "Derya", title: "Güzellik uzmanı", specialties: ["Ağda", "Lazer epilasyon"] },
      { name: "Sena", title: "Estetisyen", specialties: ["Cilt bakımı", "Bölgesel incelme"] },
    ],
    perMinuteTL: 10,
  },
  {
    kind: "NAIL",
    name: "Örnek Tırnak Stüdyosu",
    email: "tirnak@mykuafor.test",
    district: "Kadıköy",
    address: "Caferağa Mah. Örnek Sok. No:2, Kadıköy/İstanbul",
    lat: 40.9878,
    lng: 29.0281,
    staff: [
      { name: "Melis", title: "Tırnak uzmanı", specialties: ["Protez tırnak", "Nail art"] },
      { name: "Ece", title: "Manikürist", specialties: ["Kalıcı oje", "Spa pedikür"] },
    ],
    perMinuteTL: 9,
  },
  {
    kind: "SKIN",
    name: "Örnek Cilt Bakım Merkezi",
    email: "cilt@mykuafor.test",
    district: "Beşiktaş",
    address: "Levent Mah. Örnek Cad. No:3, Beşiktaş/İstanbul",
    lat: 41.0782,
    lng: 29.0127,
    staff: [
      { name: "Aslı", title: "Cilt bakım uzmanı", specialties: ["Hydrafacial", "Akne bakımı"] },
      { name: "Burcu", title: "Estetisyen", specialties: ["Dermapen", "Anti-aging"] },
    ],
    perMinuteTL: 15,
  },
  {
    kind: "MASSAGE",
    name: "Örnek Kadınlara Özel Spa",
    email: "spa@mykuafor.test",
    district: "Ataşehir",
    address: "Barbaros Mah. Örnek Sok. No:4, Ataşehir/İstanbul",
    lat: 40.9921,
    lng: 29.1105,
    staff: [
      { name: "Nur", title: "Masaj terapisti", specialties: ["Aromaterapi", "Sıcak taş"] },
      { name: "Gül", title: "Spa terapisti", specialties: ["Hamam ritüeli", "Refleksoloji"] },
    ],
    perMinuteTL: 16,
  },
  {
    kind: "BROW_LASH",
    name: "Örnek Kaş ve Kirpik Stüdyosu",
    email: "kirpik@mykuafor.test",
    district: "Bakırköy",
    address: "Zeytinlik Mah. Örnek Sok. No:5, Bakırköy/İstanbul",
    lat: 40.9805,
    lng: 28.8722,
    staff: [
      { name: "Zehra", title: "Kirpik uzmanı", specialties: ["İpek kirpik", "Kirpik lifting"] },
      { name: "İrem", title: "Kaş tasarım uzmanı", specialties: ["Microblading", "Kaş laminasyonu"] },
    ],
    perMinuteTL: 12,
  },
  {
    kind: "MAKEUP",
    name: "Örnek Makyaj Stüdyosu",
    email: "makyaj@mykuafor.test",
    district: "Üsküdar",
    address: "Mimar Sinan Mah. Örnek Sok. No:6, Üsküdar/İstanbul",
    lat: 41.0247,
    lng: 29.0154,
    staff: [{ name: "Damla", title: "Makyaj sanatçısı", specialties: ["Gelin makyajı", "Kalıcı makyaj"] }],
    perMinuteTL: 20,
  },
];

/** Örnek fiyat: süreye göre, 50 TL'ye yuvarlanmış (yalnızca yerel örnek veri). */
const demoPrice = (minutes: number, perMinute: number) =>
  Math.max(15_000, Math.round((minutes * perMinute) / 50) * 5_000);

async function seedDemoKinds(passwordHash: string) {
  for (const d of DEMO_KINDS) {
    const slug = `ornek-${d.kind.toLowerCase().replace("_", "-")}`;
    const salon = await prisma.salon.upsert({
      where: { slug },
      create: {
        slug,
        name: d.name,
        kind: d.kind,
        address: d.address,
        city: "İstanbul",
        district: d.district,
        latitude: d.lat,
        longitude: d.lng,
        phone: "+902160000000",
        description: "Geliştirme ortamı örnek işletmesi: panel ve randevu akışını denemek içindir.",
      },
      update: { name: d.name, kind: d.kind, isListing: false },
    });
    for (let weekday = 1; weekday <= 7; weekday++) {
      await prisma.workingHours.upsert({
        where: { salonId_weekday: { salonId: salon.id, weekday } },
        create: { salonId: salon.id, weekday, openMinute: H(10), closeMinute: H(20), isClosed: weekday === 7 },
        update: {},
      });
    }
    if ((await prisma.staff.count({ where: { salonId: salon.id } })) === 0) {
      await prisma.staff.createMany({ data: d.staff.map((st, n) => ({ ...st, salonId: salon.id, sortOrder: n })) });
    }
    if ((await prisma.service.count({ where: { salonId: salon.id } })) === 0) {
      const cats = SERVICE_CATALOG.filter((c) => c.kinds.includes(d.kind));
      let n = 0;
      await prisma.service.createMany({
        data: cats.flatMap((c) =>
          c.items.map((it) => ({
            salonId: salon.id,
            name: it.name,
            category: c.name,
            description: it.description,
            durationMinutes: it.durationMinutes,
            priceCents: demoPrice(it.durationMinutes, d.perMinuteTL),
            sortOrder: n++,
          })),
        ),
      });
    }
    const bizData = {
      type: "SALON" as const,
      displayName: d.name,
      legalName: `${d.name} (örnek)`,
      taxOffice: d.district,
      address: d.address,
      city: "İstanbul",
      district: d.district,
      phone: "02160000000",
      email: d.email.replace("@", "-isletme@"),
    };
    // Örnek VKN: algoritmaya uygun, gerçek bir şirkete ait değildir
    const taxNumber = demoVkn(d.kind);
    const biz = await prisma.business.upsert({
      where: { taxNumber },
      create: { ...bizData, taxNumber },
      update: bizData,
    });
    await prisma.salon.update({ where: { id: salon.id }, data: { businessId: biz.id } });
    await prisma.user.upsert({
      where: { email: d.email },
      create: { email: d.email, name: `${d.name} Yetkilisi`, passwordHash, role: "BUSINESS_OWNER", businessId: biz.id },
      update: { role: "BUSINESS_OWNER", businessId: biz.id },
    });
  }
  console.log(`Örnek işletmeler: ${DEMO_KINDS.length} tür`);
}

/** Örnek işletmeler için geçerli biçimde VKN üretir (sabit, tekrar çalıştırılabilir). */
function demoVkn(kind: string) {
  const seed = 900000000 + ([...kind].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 99999999);
  const base = String(seed).slice(0, 9);
  for (let c = 0; c <= 9; c++) if (isValidVkn(base + c)) return base + c;
  throw new Error("VKN üretilemedi");
}

async function seedDemo(seller: { id: string; shippingFeeCents: number; freeShippingThresholdCents: number }) {
  const passwordHash = await hashPassword("Demo12345");
  const customer = await prisma.user.upsert({
    where: { email: "demo@mykuafor.test" },
    create: { email: "demo@mykuafor.test", name: "Demo Kullanıcı", phone: "+905550000000", passwordHash },
    update: {},
  });

  // Demo kuaför işletmesi → MyKuaför Demo Salon (yalnızca yerel)
  const { closes, ...demo } = demoSalon;
  const salonData = { ...demo, city: "İstanbul", coverImageUrl: demo.photos[0], isListing: false };
  const salon = await prisma.salon.upsert({
    where: { slug: demo.slug },
    create: salonData,
    update: salonData,
  });
  for (let weekday = 1; weekday <= 7; weekday++) {
    const isClosed = weekday === 7;
    await prisma.workingHours.upsert({
      where: { salonId_weekday: { salonId: salon.id, weekday } },
      create: { salonId: salon.id, weekday, openMinute: H(9), closeMinute: closes, isClosed },
      update: { openMinute: H(9), closeMinute: closes, isClosed },
    });
  }
  if ((await prisma.staff.count({ where: { salonId: salon.id } })) === 0) {
    await prisma.staff.createMany({ data: staffNames.map((st, i) => ({ ...st, salonId: salon.id, sortOrder: i })) });
  }
  if ((await prisma.service.count({ where: { salonId: salon.id } })) === 0) {
    await prisma.service.createMany({ data: services.map((sv, i) => ({ ...sv, salonId: salon.id, sortOrder: i })) });
  }
  for (const sv of services) {
    await prisma.service.updateMany({
      where: { salonId: salon.id, name: sv.name, category: null },
      data: { category: sv.category },
    });
  }
  // Kuaför kataloğunun geri kalanı (kategoriyle)
  {
    const have = new Set((await prisma.service.findMany({ where: { salonId: salon.id } })).map((x) => x.name));
    let n = have.size;
    const extra = SERVICE_CATALOG.filter((c) => c.kinds.includes("HAIR")).flatMap((c) =>
      c.items
        .filter((it) => !have.has(it.name))
        .map((it) => ({
          salonId: salon.id,
          name: it.name,
          category: c.name,
          description: it.description,
          durationMinutes: it.durationMinutes,
          priceCents: demoPrice(it.durationMinutes, 12),
          sortOrder: n++,
        })),
    );
    if (extra.length) await prisma.service.createMany({ data: extra });
  }
  const bizData = {
    type: "SALON" as const,
    displayName: salon.name,
    legalName: "MyKuaför Demo Kuaförlük Hizmetleri",
    taxOffice: "Kadıköy",
    address: salon.address,
    city: "İstanbul",
    district: "Kadıköy",
    phone: "02160000001",
    email: "demo-salon@mykuafor.test",
  };
  const salonBiz = await prisma.business.upsert({
    where: { taxNumber: "10000000146" },
    create: { ...bizData, taxNumber: "10000000146" },
    update: bizData,
  });
  await prisma.salon.update({ where: { id: salon.id }, data: { businessId: salonBiz.id } });

  await seedDemoKinds(passwordHash);

  // Yerel platform yöneticisi (yönetim paneli: /yonetim)
  await prisma.user.upsert({
    where: { email: "admin@mykuafor.test" },
    create: { email: "admin@mykuafor.test", name: "Platform Yöneticisi", passwordHash, role: "ADMIN" },
    update: { role: "ADMIN" },
  });

  const owners: [string, string, string][] = [
    ["salon@mykuafor.test", "Zeynep Yıldız", salonBiz.id],
    ["satici@mykuafor.test", "Mert Aydın", seller.id],
  ];
  for (const [email, name, businessId] of owners) {
    await prisma.user.upsert({
      where: { email },
      create: { email, name, phone: "+905551112233", passwordHash, role: "BUSINESS_OWNER", businessId },
      update: { role: "BUSINESS_OWNER", businessId },
    });
  }

  if ((await prisma.appointment.count({ where: { salonId: salon.id, code: { startsWith: "RV-DEMO" } } })) === 0) {
    const staff = await prisma.staff.findMany({ where: { salonId: salon.id }, orderBy: { sortOrder: "asc" } });
    const svc = await prisma.service.findMany({ where: { salonId: salon.id }, orderBy: { sortOrder: "asc" } });
    const names = [
      "Elif Kaya",
      "Merve Şahin",
      "Seda Arslan",
      "Büşra Çelik",
      "Gizem Öztürk",
      "Derya Aksoy",
      "Ece Doğan",
    ];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let n = 0;
    // Son 20 günün sonuçlanmış randevuları + bugün ve yarın aktif randevular
    for (let day = -20; day <= 1; day++) {
      const perDay = day < 0 ? 2 + (Math.abs(day) % 3) : 4;
      for (let k = 0; k < perDay; k++) {
        const s = svc[(n + k) % svc.length]!;
        const st = staff[k % staff.length]!;
        const start = new Date(today);
        start.setDate(start.getDate() + day);
        start.setHours(10 + k * 2, day === 0 ? 0 : 30, 0, 0);
        if (start.getDay() === 0) continue; // Pazar kapalı
        const status = day < 0 ? (n % 9 === 0 ? "CANCELLED" : n % 13 === 0 ? "NO_SHOW" : "COMPLETED") : "CONFIRMED";
        const isApp = n % 3 === 0;
        await prisma.appointment.create({
          data: {
            code: `RV-DEMO${String(n).padStart(4, "0")}`,
            salonId: salon.id,
            staffId: st.id,
            userId: isApp ? customer.id : null,
            source: isApp ? "APP" : "MANUAL",
            status,
            startsAt: start,
            endsAt: new Date(start.getTime() + s.durationMinutes * 60_000),
            totalCents: s.priceCents,
            customerName: isApp ? customer.name : names[n % names.length]!,
            customerPhone: isApp ? customer.phone : `0555${String(1000000 + n * 7).slice(-7)}`,
            ...(status === "COMPLETED" ? { completedAt: start } : {}),
            ...(status === "CANCELLED" ? { cancelledAt: start, cancelReason: "Müşteri iptal etti" } : {}),
            services: {
              create: [
                { serviceId: s.id, nameSnapshot: s.name, priceCents: s.priceCents, durationMinutes: s.durationMinutes },
              ],
            },
          },
        });
        n++;
      }
    }
    const month = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
    const day = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    await prisma.ledgerEntry.createMany({
      data: [
        { businessId: salonBiz.id, type: "EXPENSE", category: "Kira", amountCents: 1_500_000, date: month },
        { businessId: salonBiz.id, type: "EXPENSE", category: "Maaş", amountCents: 4_200_000, date: month },
        { businessId: salonBiz.id, type: "EXPENSE", category: "Malzeme", amountCents: 380_000, date: day },
        { businessId: salonBiz.id, type: "EXPENSE", category: "Fatura", amountCents: 145_000, date: day },
        { businessId: salonBiz.id, type: "INCOME", category: "Ürün satışı", amountCents: 92_000, date: day },
      ],
    });
  }

  // Demo yorumları: tamamlanmış randevulara bağlı (gerçek akıştaki kural ile aynı)
  if ((await prisma.salonReview.count({ where: { salonId: salon.id } })) === 0) {
    const reviews: [string, number, string | null][] = [
      ["Elif Kaya", 5, "Zeynep Hanım'ın kesimi harika, tam istediğim gibi oldu. Salon çok temiz."],
      ["Merve Şahin", 5, "Boyam çok güzel tuttu, fiyatlar da makul. Randevu saatine tam uydular."],
      ["Seda Arslan", 4, "Fön güzeldi, sadece biraz beklemek zorunda kaldım."],
      ["Büşra Çelik", 5, "Keratin bakımından sonra saçlarım ipek gibi. Kesinlikle tavsiye ederim."],
      ["Gizem Öztürk", 4, null],
      ["Derya Aksoy", 5, "Güler yüzlü ekip, çay ikramı ve rahat ortam. Uygulamadan randevu almak çok kolay."],
    ];
    const done = await prisma.appointment.findMany({
      where: { salonId: salon.id, status: "COMPLETED", review: null },
      orderBy: { startsAt: "desc" },
      take: reviews.length,
    });
    for (let i = 0; i < done.length; i++) {
      const [name, rating, comment] = reviews[i]!;
      const email = `yorum${i + 1}@mykuafor.test`;
      const reviewer = await prisma.user.upsert({
        where: { email },
        create: { email, name, passwordHash },
        update: {},
      });
      await prisma.appointment.update({
        where: { id: done[i]!.id },
        data: { userId: reviewer.id, customerName: name },
      });
      await prisma.salonReview.create({
        data: {
          salonId: salon.id,
          userId: reviewer.id,
          appointmentId: done[i]!.id,
          rating,
          comment,
          createdAt: done[i]!.startsAt,
        },
      });
    }
    const agg = await prisma.salonReview.aggregate({
      where: { salonId: salon.id },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.salon.update({
      where: { id: salon.id },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });
  }

  if ((await prisma.order.count({ where: { sellerId: seller.id, orderNumber: { startsWith: "MK-DEMO" } } })) === 0) {
    const sellable = await prisma.product.findMany({ where: { sellerId: seller.id, stock: { gt: 0 } } });
    const statuses = [
      "PAID",
      "PAID",
      "PREPARING",
      "SHIPPED",
      "DELIVERED",
      "DELIVERED",
      "DELIVERED",
      "REFUNDED",
    ] as const;
    for (let i = 0; i < 14; i++) {
      const p = sellable[i % sellable.length]!;
      const qty = 1 + (i % 2);
      const subtotal = p.priceCents * qty;
      const shipping = subtotal >= seller.freeShippingThresholdCents ? 0 : seller.shippingFeeCents;
      const paidAt = new Date(Date.now() - (i * 2 + 0.2) * 86_400_000);
      const status = statuses[i % statuses.length]!;
      const shipped = status === "SHIPPED" || status === "DELIVERED";
      await prisma.order.create({
        data: {
          orderNumber: `MK-DEMO${String(i).padStart(5, "0")}`,
          userId: customer.id,
          sellerId: seller.id,
          paymentMethod: i % 3 === 0 ? "WALLET" : "CARD",
          status,
          subtotalCents: subtotal,
          shippingCents: shipping,
          totalCents: subtotal + shipping,
          customerEmail: customer.email,
          shippingAddress: {
            title: "Ev",
            fullName: "Demo Kullanıcı",
            phone: "05550000000",
            city: "İstanbul",
            district: "Kadıköy",
            line: "Caferağa Mah. Demo Sok. No:4 D:2",
            postalCode: "34710",
          },
          paidAt,
          ...(shipped ? { carrier: "Yurtiçi Kargo", trackingNumber: `YK${100000000 + i}`, shippedAt: paidAt } : {}),
          ...(status === "DELIVERED" ? { deliveredAt: paidAt } : {}),
          ...(status === "REFUNDED" ? { cancelledAt: paidAt, cancelReason: "Müşteri iptal etti" } : {}),
          items: {
            create: [
              {
                productId: p.id,
                nameSnapshot: p.name,
                imageSnapshot: p.images[0] ?? null,
                unitPriceCents: p.priceCents,
                quantity: qty,
                lineTotalCents: subtotal,
              },
            ],
          },
        },
      });
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
