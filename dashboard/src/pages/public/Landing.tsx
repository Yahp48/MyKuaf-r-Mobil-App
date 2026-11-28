import { usePageMeta } from "../../lib/seo";
import { LinkButton } from "../../components/ui";
import { PublicLayout } from "./PublicLayout";

const FAQ = [
  {
    q: "Bakımca İşletme ücretli mi?",
    a: "Kayıt olmak ve paneli kullanmak ücretsizdir. Uygulama üzerinden alınan randevular için ödeme müşteri ile salon arasında salonda yapılır.",
  },
  {
    q: "Salonum uygulamada ne zaman görünür?",
    a: "Kaydı tamamlayıp en az bir personel ve bir hizmet eklediğiniz anda salonunuz Bakımca uygulamasının haritasında görünür. Panelden dilediğiniz zaman geçici olarak gizleyebilirsiniz.",
  },
  {
    q: "Telefonla gelen randevuları da girebilir miyim?",
    a: "Evet. Randevu defterine telefonla veya kapıdan gelen müşterileri ekleyebilirsiniz; aynı saate ikinci randevu verilmesi sistem tarafından engellenir.",
  },
  {
    q: "Ürün satıcıları ödemeyi nasıl alır?",
    a: "Müşteri ödemeyi uygulama içinde lisanslı ödeme kuruluşunun güvenli sayfasında yapar. Kart bilgisi ne sizin ne de bizim sunucularımızdan geçer. Siparişi kargo firması ve takip numarasıyla panelden kapatırsınız.",
  },
  {
    q: "Hangi bilgilerle kayıt olunur?",
    a: "Ticari unvan, vergi kimlik numarası (şahıs işletmelerinde TC kimlik numarası), vergi dairesi, işletme adresi ve iletişim bilgileri istenir. Numaralar Gelir İdaresi'nin doğrulama algoritmasıyla kontrol edilir.",
  },
];

export default function Landing() {
  usePageMeta({
    title: "Bakımca İşletme",
    description:
      "Kuaför, güzellik merkezi, tırnak, cilt bakımı ve spa işletmenizin randevu defterini, ekibini, gelir-giderini; ürün mağazanızın siparişlerini tek panelden yönetin. Ücretsiz kayıt olun, müşterileriniz sizi haritada bulsun.",
    path: "/",
    index: true,
  });

  return (
    <PublicLayout>
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div>
            <div className="label" style={{ marginBottom: 18 }}>
              Kadınlara hizmet veren güzellik işletmeleri ve kozmetik satıcıları için
            </div>
            <h1 id="hero-title">
              Randevu defteriniz artık <em>cebinizde</em>, müşterileriniz haritada.
            </h1>
            <p className="lead">
              Gün içi randevular, personel ve izinler, hizmet fiyatları, gelir-gider defteri; ürün satıyorsanız
              siparişler, kargo ve stok. Hepsi tek panelde, Bakımca uygulamasıyla anlık bağlantılı.
            </p>
            <div className="hero-cta">
              <LinkButton to="/kayit" variant="accent">
                Ücretsiz kayıt ol
              </LinkButton>
              <LinkButton to="/giris">Panele giriş</LinkButton>
            </div>
          </div>

          <div className="specimen" aria-hidden="true">
            <div className="specimen-head">
              <span>Perşembe · Randevu defteri</span>
              <span>2 personel</span>
            </div>
            <div className="specimen-row" style={{ minHeight: 26 }}>
              <span />
              <span className="small">Zeynep</span>
              <span className="small">Elif</span>
            </div>
            {[
              ["10:00", ["Ayşe K. · Kesim", "done"], ["Merve Ş. · Fön", "done"]],
              ["11:00", ["Seda A. · Boya", ""], null],
              ["12:00", null, ["Büşra Ç. · Bakım", ""]],
              ["13:30", ["Gizem Ö. · Şekillendirme", ""], ["Ece D. · Kesim", ""]],
              ["15:00", null, null],
            ].map(([time, a, b]) => (
              <div className="specimen-row" key={time as string}>
                <span>{time as string}</span>
                <span>{a ? <i className={(a as string[])[1]}>{(a as string[])[0]}</i> : null}</span>
                <span>{b ? <i className={(b as string[])[1]}>{(b as string[])[0]}</i> : null}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="band" aria-labelledby="who">
          <h2 id="who">İki tür işletme, iki ayrı çalışma masası</h2>
          <div className="pillars">
            <article className="pillar">
              <div className="label">Kuaför, güzellik, tırnak, cilt ve spa</div>
              <h3>Defter, personel ve kasa</h3>
              <p className="muted">Ön masada bir bakışta günün tamamı: kim, kaçta, hangi koltukta.</p>
              <ul>
                <li>Personel sütunlu günlük randevu defteri</li>
                <li>Uygulamadan gelen randevular anında defterde</li>
                <li>Telefon randevusu, saat taşıma, gelmedi işaretleme</li>
                <li>Personel izinleri ve çalışma saatleri</li>
                <li>Aylık gelir, gider ve personel bazlı ciro</li>
              </ul>
            </article>
            <article className="pillar">
              <div className="label">Ürün satıcıları</div>
              <h3>Sipariş, kargo ve stok</h3>
              <p className="muted">
                Ödemesi alınmış siparişler hazırlama sırasına düşer; kargoya verince müşteri bilgilenir.
              </p>
              <ul>
                <li>Hazırlanacak, kargoda, kapanan sekmeleri</li>
                <li>Kargo firması ve takip numarasıyla gönderim</li>
                <li>Ürün, görsel, indirimli fiyat ve stok yönetimi</li>
                <li>Düşük stok uyarıları ve en çok satanlar</li>
                <li>İade ve iptallerde otomatik stok iadesi</li>
              </ul>
            </article>
            <article className="pillar">
              <div className="label">Her ikisi için</div>
              <h3>Uygulamayla canlı bağlantı</h3>
              <p className="muted">Panelde yaptığınız değişiklik müşterinin telefonuna saniyeler içinde yansır.</p>
              <ul>
                <li>Yeni salon kaydı haritada hemen görünür</li>
                <li>Fiyat, saat ve stok değişiklikleri anında güncellenir</li>
                <li>Onay, iptal ve kargo bildirimleri müşteriye gider</li>
                <li>Vergi bilgileri doğrulanmış kayıt</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="band" aria-labelledby="sss">
          <h2 id="sss">Sık sorulan sorular</h2>
          <div className="faq" style={{ maxWidth: 820 }}>
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
          <script
            type="application/ld+json"
            // Arama sonuçlarında SSS zengin sonucu için yapılandırılmış veri
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: FAQ.map((f) => ({
                  "@type": "Question",
                  name: f.q,
                  acceptedAnswer: { "@type": "Answer", text: f.a },
                })),
              }),
            }}
          />
        </section>
      </main>
    </PublicLayout>
  );
}
