// Geliştirme ortamı örnek verisi. Tekrar çalıştırılabilir (slug/e-posta üzerinden upsert).
// Çalıştırma: npm run db:seed
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { hashPassword } from "../src/lib/password.ts";

if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
  console.error("Seed production ortamında çalıştırılamaz (SEED_ALLOW_PRODUCTION=true ile zorlanabilir).");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const H = (h: number, m = 0) => h * 60 + m;

const salons = [
  {
    slug: "zeynep-bayan-kuafor",
    name: "Zeynep Bayan Kuaför",
    address: "Ahievran, Aşk Paşa Blv. No:29, 40100 Kırşehir Merkez/Kırşehir",
    district: "Merkez",
    latitude: 39.15,
    longitude: 34.16,
    phone: "+903862130001",
    website: "https://zeynep.kuafor.com.tr",
    closes: H(20),
  },
  {
    slug: "kentpark-kuafor",
    name: "Kentpark Kuaför",
    address: "Kentpark AVM, Kırşehir Merkez/Kırşehir",
    district: "Merkez",
    latitude: 39.148,
    longitude: 34.165,
    phone: "+903862130002",
    website: "https://kentpark.kuafor.com.tr",
    closes: H(19),
  },
  {
    slug: "ataturk-bulvari-kuafor",
    name: "Atatürk Bulvarı Kuaför",
    address: "Atatürk Bulvarı, Kırşehir Merkez/Kırşehir",
    district: "Merkez",
    latitude: 39.142,
    longitude: 34.158,
    phone: "+903862130003",
    website: null,
    closes: H(18),
  },
  {
    slug: "masal-parki-kuafor",
    name: "Masal Parkı Kuaför",
    address: "Masal Parkı yanı, Kırşehir Merkez/Kırşehir",
    district: "Merkez",
    latitude: 39.145,
    longitude: 34.168,
    phone: "+903862130004",
    website: null,
    closes: H(17),
  },
  {
    slug: "hamidiye-kuafor",
    name: "Hamidiye Kuaför",
    address: "Hamidiye Camii karşısı, Kırşehir Merkez/Kırşehir",
    district: "Merkez",
    latitude: 39.14,
    longitude: 34.155,
    phone: "+903862130005",
    website: null,
    closes: H(20),
  },
];

const staffNames = [
  { name: "Zeynep", title: "Kuaför" },
  { name: "Elif", title: "Renk uzmanı" },
  { name: "Ayşe", title: "Kuaför" },
  { name: "Fatma", title: "Bakım uzmanı" },
];

const services = [
  { name: "Saç Kesimi", durationMinutes: 30, priceCents: 15000 },
  { name: "Fön", durationMinutes: 30, priceCents: 10000 },
  { name: "Saç Şekillendirme", durationMinutes: 45, priceCents: 20000 },
  { name: "Saç Bakımı", durationMinutes: 45, priceCents: 25000 },
  { name: "Boya", durationMinutes: 90, priceCents: 30000 },
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
    images: [img("photo-1626015365107-12b2b1e7f8e9")],
  },
];

async function main() {
  for (const s of salons) {
    const salon = await prisma.salon.upsert({
      where: { slug: s.slug },
      create: {
        slug: s.slug,
        name: s.name,
        address: s.address,
        city: "Kırşehir",
        district: s.district,
        latitude: s.latitude,
        longitude: s.longitude,
        phone: s.phone,
        website: s.website,
        description: "Kadın kuaförü: kesim, fön, boya ve bakım hizmetleri.",
      },
      update: { name: s.name, address: s.address, latitude: s.latitude, longitude: s.longitude },
    });

    for (let weekday = 1; weekday <= 7; weekday++) {
      const isClosed = weekday === 7;
      await prisma.workingHours.upsert({
        where: { salonId_weekday: { salonId: salon.id, weekday } },
        create: { salonId: salon.id, weekday, openMinute: H(9), closeMinute: s.closes, isClosed },
        update: { openMinute: H(9), closeMinute: s.closes, isClosed },
      });
    }

    if ((await prisma.staff.count({ where: { salonId: salon.id } })) === 0) {
      await prisma.staff.createMany({
        data: staffNames.map((st, i) => ({ ...st, salonId: salon.id, sortOrder: i })),
      });
    }
    if ((await prisma.service.count({ where: { salonId: salon.id } })) === 0) {
      await prisma.service.createMany({
        data: services.map((sv, i) => ({ ...sv, salonId: salon.id, sortOrder: i })),
      });
    }
  }

  const categoryIds = new Map<string, string>();
  for (const c of categories) {
    const row = await prisma.category.upsert({ where: { slug: c.slug }, create: c, update: c });
    categoryIds.set(c.slug, row.id);
  }

  for (const { category, ...p } of products) {
    const data = { ...p, categoryId: categoryIds.get(category)! };
    await prisma.product.upsert({ where: { slug: p.slug }, create: data, update: data });
  }

  // Yalnızca yerel geliştirme için test hesabı.
  if (process.env.NODE_ENV !== "production") {
    await prisma.user.upsert({
      where: { email: "demo@mykuafor.test" },
      create: {
        email: "demo@mykuafor.test",
        name: "Demo Kullanıcı",
        phone: "+905550000000",
        passwordHash: await hashPassword("Demo12345"),
      },
      update: {},
    });
  }

  console.log(`Seed tamam: ${salons.length} salon, ${products.length} ürün.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
