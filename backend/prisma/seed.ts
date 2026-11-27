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

// Salon galerisi: yatay kırpım
const salonImg = (id: string) => `https://images.unsplash.com/${id}?w=1000&h=700&fit=crop`;

const salons = [
  {
    slug: "zeynep-bayan-kuafor",
    kind: "WOMEN" as const,
    photos: [
      salonImg("photo-1560066984-138dadb4c035"),
      salonImg("photo-1522337360788-8b13dee7a37e"),
      salonImg("photo-1633681926022-84c23e8cb2d6"),
      salonImg("photo-1599351431202-1e0f0137899a"),
      salonImg("photo-1580618672591-eb180b1a973f"),
    ],
    description:
      "Ahievran'ın 15 yıllık kadın kuaförü. Kesim, fön, boya, balyaj ve keratin bakımında uzman ekip; randevulu çalışırız.",
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
    kind: "WOMEN" as const,
    photos: [
      salonImg("photo-1600948836101-f9ffda59d250"),
      salonImg("photo-1562322140-8baeececf3df"),
      salonImg("photo-1559599101-f09722fb4948"),
      salonImg("photo-1527799820374-dcf8d9d4a388"),
    ],
    description: "Kentpark AVM içinde, otopark kolaylığıyla. Saç kesimi, fön ve özel gün saç tasarımları.",
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
    kind: "UNISEX" as const,
    photos: [
      salonImg("photo-1585747860715-2ba37e788b70"),
      salonImg("photo-1605497788044-5a32c7078486"),
      salonImg("photo-1521590832167-7bcbfaa6381f"),
      salonImg("photo-1595476108010-b4d1f102b1b1"),
    ],
    description: "Kadın ve erkek kuaförü. Modern kesimler, sakal tasarımı ve saç bakımı.",
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
    kind: "BEAUTY" as const,
    photos: [
      salonImg("photo-1595476108010-b4d1f102b1b1"),
      salonImg("photo-1634449571010-02389ed0f9b0"),
      salonImg("photo-1580618672591-eb180b1a973f"),
    ],
    description: "Saç bakımı ve güzellik hizmetleri; sakin ve ferah bir salon.",
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
    kind: "WOMEN" as const,
    photos: [
      salonImg("photo-1599351431202-1e0f0137899a"),
      salonImg("photo-1562322140-8baeececf3df"),
      salonImg("photo-1600948836101-f9ffda59d250"),
      salonImg("photo-1633681926022-84c23e8cb2d6"),
    ],
    description: "Mahallenin samimi kuaförü. Boya, fön ve kesimde uygun fiyat.",
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
    images: [img("photo-1535585209827-a15fcdbc4c2d")],
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
        description: s.description,
        kind: s.kind,
        photos: s.photos,
        coverImageUrl: s.photos[0],
      },
      update: {
        name: s.name,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        description: s.description,
        kind: s.kind,
        photos: s.photos,
        coverImageUrl: s.photos[0],
      },
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

  // Demo satıcı işletmesi: tüm örnek ürünler buna ait
  const seller = await prisma.business.upsert({
    where: { taxNumber: "1234567890" },
    create: {
      type: "SELLER",
      displayName: "Woman Hair Store",
      legalName: "Woman Hair Kozmetik Ticaret Ltd. Şti.",
      taxNumber: "1234567890",
      taxOffice: "Kırşehir",
      address: "Ahievran Mah. Aşk Paşa Blv. No:31",
      city: "Kırşehir",
      district: "Merkez",
      phone: "03862130010",
      email: "magaza@mykuafor.test",
      iban: "TR330006100519786457841326",
      returnPolicy: "Açılmamış ürünlerde 14 gün içinde ücretsiz iade.",
    },
    update: {},
  });

  for (const { category, ...p } of products) {
    const data = { ...p, categoryId: categoryIds.get(category)!, sellerId: seller.id };
    await prisma.product.upsert({ where: { slug: p.slug }, create: data, update: data });
  }

  // Yalnızca yerel geliştirme: demo hesaplar ve paneller boş görünmesin diye örnek hareketler
  if (process.env.NODE_ENV !== "production") {
    await seedDemo(seller);
  }

  console.log(`Seed tamam: ${salons.length} salon, ${products.length} ürün.`);
}

async function seedDemo(seller: { id: string; shippingFeeCents: number; freeShippingThresholdCents: number }) {
  const passwordHash = await hashPassword("Demo12345");
  const customer = await prisma.user.upsert({
    where: { email: "demo@mykuafor.test" },
    create: { email: "demo@mykuafor.test", name: "Demo Kullanıcı", phone: "+905550000000", passwordHash },
    update: {},
  });

  // Demo kuaför işletmesi → Zeynep Bayan Kuaför
  const salon = await prisma.salon.findUniqueOrThrow({ where: { slug: "zeynep-bayan-kuafor" } });
  const salonBiz = await prisma.business.upsert({
    where: { taxNumber: "10000000146" },
    create: {
      type: "SALON",
      displayName: salon.name,
      legalName: "Zeynep Yıldız - Kuaförlük Hizmetleri",
      taxNumber: "10000000146",
      taxOffice: "Kırşehir",
      address: salon.address,
      city: "Kırşehir",
      district: "Merkez",
      phone: "03862130001",
      email: "zeynep@mykuafor.test",
    },
    update: {},
  });
  await prisma.salon.update({ where: { id: salon.id }, data: { businessId: salonBiz.id } });

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
            city: "Kırşehir",
            district: "Merkez",
            line: "Kayabaşı Mah. Demo Sok. No:4 D:2",
            postalCode: "40100",
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
