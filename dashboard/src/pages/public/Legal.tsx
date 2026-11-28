import { Link } from "react-router";
import { usePageMeta } from "../../lib/seo";
import { PublicLayout } from "./PublicLayout";
import { CompanyFacts, useCompany } from "../../components/Company";

// Not: Bu metinler genel çerçevedir; yayından önce bir hukukçuya gözden geçirtilmelidir.

export function Kvkk() {
  const company = useCompany();
  usePageMeta({
    title: "KVKK aydınlatma metni",
    description: "Bakımca işletme hesapları için 6698 sayılı KVKK kapsamında aydınlatma metni.",
    path: "/kvkk",
    index: true,
  });
  return (
    <PublicLayout>
      <article className="prose">
        <div className="label">Kişisel verilerin korunması</div>
        <h1>KVKK aydınlatma metni</h1>
        <p>
          Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 10. maddesi uyarınca veri sorumlusu{" "}
          {company?.legalName ?? "Bakımca"} tarafından, Bakımca işletme paneline kayıt olan işletme yetkililerinin
          kişisel verilerinin işlenmesine ilişkin olarak hazırlanmıştır.
        </p>
        <h2>İşlenen veriler</h2>
        <ul>
          <li>Kimlik ve iletişim: yetkili adı soyadı, e-posta, cep telefonu</li>
          <li>
            İşletme: ticari unvan, vergi kimlik numarası veya TC kimlik numarası, vergi dairesi, MERSİS, KEP, adres,
            IBAN
          </li>
          <li>İşlem güvenliği: oturum kayıtları, cihaz/tarayıcı bilgisi, IP adresi</li>
        </ul>
        <h2>İşleme amaçları ve hukuki sebepler</h2>
        <p>
          Veriler; üyelik sözleşmesinin kurulması ve ifası (md. 5/2-c), işletmenin uygulamada listelenmesi, sipariş ve
          randevu süreçlerinin yürütülmesi, fatura ve vergi mevzuatından doğan yükümlülükler (md. 5/2-ç) ile bilgi
          güvenliğinin sağlanması (md. 5/2-f) amaçlarıyla işlenir.
        </p>
        <h2>Aktarım</h2>
        <p>
          Veriler, yalnızca hizmetin sunulması için gerekli olduğu ölçüde barındırma, e-posta ve lisanslı ödeme hizmeti
          sağlayıcılarına ve kanunen yetkili kamu kurumlarına aktarılabilir. Müşterilere yalnızca işletmenin görünen
          adı, adresi ve iletişim telefonu gösterilir.
        </p>
        <h2>Haklarınız</h2>
        <p>
          KVKK md. 11 kapsamında verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini isteme,
          itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz. Başvurularınızı panel içindeki destek
          kanalından veya kayıtlı e-posta adresinizden iletebilirsiniz.
        </p>
        <CompanyFacts title="Veri sorumlusu" />
        <p>
          <Link to="/">Ana sayfaya dön</Link>
        </p>
      </article>
    </PublicLayout>
  );
}

export function Terms() {
  const company = useCompany();
  usePageMeta({
    title: "İşletme hizmet sözleşmesi",
    description: "Bakımca işletme paneli kullanım koşulları.",
    path: "/hizmet-sozlesmesi",
    index: true,
  });
  return (
    <PublicLayout>
      <article className="prose">
        <div className="label">Kullanım koşulları</div>
        <h1>İşletme hizmet sözleşmesi</h1>
        <h2>1. Taraflar ve konu</h2>
        <p>
          Bu sözleşme, Bakımca platformunu işleten {company?.legalName ?? "platform işletmecisi"} ile panele kayıt
          olan hizmet işletmesi (kuaför, güzellik merkezi, tırnak, cilt bakımı, kaş-kirpik, makyaj, kadınlara özel
          spa) veya ürün satıcısı arasında, işletmenin randevu ve ürün satış hizmetlerini platform üzerinden sunmasına
          ilişkin koşulları düzenler.
        </p>
        <h2>2. İşletmenin yükümlülükleri</h2>
        <ul>
          <li>Kayıtta verilen ticari unvan, vergi ve adres bilgilerinin doğru ve güncel tutulması</li>
          <li>Hizmet ve ürün fiyatlarının, stok ve çalışma saatlerinin gerçeği yansıtması</li>
          <li>Kabul edilen randevulara uyulması; iptal gerekiyorsa müşterinin sebep belirtilerek bilgilendirilmesi</li>
          <li>Satılan ürünlerin mevzuata uygun, faturalı ve belirtilen sürede kargoya verilmesi</li>
          <li>Tüketicinin cayma ve iade haklarına (6502 sayılı Kanun) uyulması</li>
        </ul>
        <h2>3. Ödemeler</h2>
        <p>
          Randevu hizmet bedelleri salonda tahsil edilir. Ürün satışlarında ödeme, lisanslı ödeme kuruluşu aracılığıyla
          alınır; kart bilgileri platform veya işletme tarafından görülmez ve saklanmaz.
        </p>
        <h2>4. Askıya alma</h2>
        <p>
          Yanlış bilgi, tekrarlayan müşteri şikâyeti veya mevzuata aykırılık hâlinde platform işletme hesabını askıya
          alabilir; askıdaki işletme uygulamada gösterilmez.
        </p>
        <h2>5. Kişisel veriler</h2>
        <p>
          İşletme, platformdan edindiği müşteri bilgilerini yalnızca ilgili randevu veya siparişin yerine getirilmesi
          için kullanır; ayrıntılar <Link to="/kvkk">KVKK aydınlatma metninde</Link> yer alır.
        </p>
        <CompanyFacts title="Hizmet sağlayıcı" />
      </article>
    </PublicLayout>
  );
}

/**
 * Uygulama kullanıcıları için gizlilik politikası (App Store ve Google Play mağaza kaydında herkese açık adres ister).
 * Metin uygulamadaki Gizlilik ve KVKK ekranıyla aynı tutulmalı (screens/PrivacyScreen.js).
 */
export function CustomerPrivacy() {
  const company = useCompany();
  usePageMeta({
    title: "Gizlilik politikası",
    description: "Bakımca uygulamasında kişisel verilerin işlenmesi, paylaşılması ve haklarınız (KVKK).",
    path: "/gizlilik",
    index: true,
  });
  return (
    <PublicLayout>
      <article className="prose">
        <div className="label">Bakımca uygulaması</div>
        <h1>Gizlilik politikası ve KVKK aydınlatma metni</h1>
        <p>
          Veri sorumlusu {company?.legalName ?? "Bakımca"}, Bakımca mobil uygulamasında kişisel verilerinizi 6698 sayılı
          Kişisel Verilerin Korunması Kanunu'na uygun şekilde işler. Bu metin hangi verileri neden işlediğimizi ve
          haklarınızı özetler.
        </p>
        <h2>Hangi verileri işliyoruz?</h2>
        <p>
          Ad soyad, e-posta, cep telefonu; randevu ve sipariş bilgileri; teslimat adresleri; bildirim almak için cihaz
          anahtarınız. Konumunuz yalnızca izin verdiğinizde, yakındaki işletmeleri göstermek için telefonunuzda kullanılır
          ve sunucularımıza gönderilmez. Kart bilgileriniz uygulamaya ve sunucularımıza hiç ulaşmaz; ödeme lisanslı ödeme
          kuruluşunun güvenli sayfasında yapılır.
        </p>
        <h2>Neden işliyoruz?</h2>
        <p>
          Hesabınızı oluşturmak ve korumak, randevu ve siparişlerinizi ilgili işletmeye/satıcıya iletmek, ödeme ve
          iadeleri yürütmek, randevu ve sipariş bildirimleri göndermek ve yasal yükümlülükleri (fatura, vergi kayıtları)
          yerine getirmek için. Hukuki sebepler: sözleşmenin kurulması ve ifası, hukuki yükümlülük ve meşru menfaat (KVKK
          md. 5/2-c, ç, f). Pazarlama iletişimi yalnızca açık rızanızla yapılır.
        </p>
        <h2>Kimlerle paylaşıyoruz?</h2>
        <p>
          Randevu aldığınız işletmeyle adınız ve telefonunuz; sipariş verdiğiniz satıcıyla teslimat adresiniz paylaşılır.
          Ayrıca barındırma, e-posta ve ödeme hizmeti sağlayıcılarımız ile kanunen yetkili kurumlar. Verileriniz satılmaz
          ve reklam amacıyla üçüncü kişilere verilmez; uygulamada izleme (tracking) yoktur.
        </p>
        <h2>Canlı deneme ve fotoğraflar</h2>
        <p>
          Canlı denemede (saç modeli, renk, makyaj) kamera görüntünüz yalnızca telefonunuzda işlenir; sunucularımıza
          gönderilmez ve kaydedilmez. "Yapay zekâ ile gerçekçi dene" özelliğini kullanırsanız, yalnızca açık rızanızla
          çektiğiniz fotoğraf yurt dışındaki görüntü işleme hizmet sağlayıcısına gönderilir (KVKK md. 9); fotoğraf
          saklanmaz, oluşturulan görseller 24 saat sonra silinir. Yorumlara eklediğiniz fotoğraflar işletme sayfasında
          herkese açık yayınlanır.
        </p>
        <h2>Saklama süresi</h2>
        <p>
          Hesabınız açık olduğu sürece verileriniz saklanır. Hesabınızı sildiğinizde profil, adres, favori, sepet ve
          bildirimleriniz silinir; yasal olarak saklanması gereken fatura ve sipariş kayıtları kimliğinizden ayrılarak
          kanuni süre boyunca tutulur.
        </p>
        <h2>Haklarınız</h2>
        <p>
          KVKK md. 11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini isteme,
          işlemeye itiraz etme ve zararın giderilmesini talep etme haklarınız vardır. Hesabınızı uygulamadan kendiniz
          silebilirsiniz (<Link to="/hesap-silme">nasıl?</Link>).
          {company?.email ? ` Diğer talepleriniz için: ${company.email}` : ""}
          {company?.kep ? ` · KEP: ${company.kep}` : ""}
        </p>
        <CompanyFacts title="Veri sorumlusu" />
      </article>
    </PublicLayout>
  );
}

/** Hesap silme yolu (Google Play, uygulama dışından erişilebilen bir sayfa ister). */
export function AccountDeletion() {
  const company = useCompany();
  usePageMeta({
    title: "Hesabınızı silme",
    description: "Bakımca hesabınızı ve verilerinizi nasıl silebileceğiniz.",
    path: "/hesap-silme",
    index: true,
  });
  return (
    <PublicLayout>
      <article className="prose">
        <div className="label">Bakımca uygulaması</div>
        <h1>Hesabınızı silme</h1>
        <h2>Uygulamadan</h2>
        <ol>
          <li>Bakımca uygulamasında Profil › Hesap ayarları'nı açın.</li>
          <li>"Hesabımı sil" bölümüne şifrenizi yazın ve onaylayın.</li>
        </ol>
        <p>İşlem hemen gerçekleşir ve geri alınamaz.</p>
        <h2>Uygulamaya erişemiyorsanız</h2>
        <p>
          {company?.email ? (
            <>
              Hesabınızda kayıtlı e-posta adresinizden <a href={`mailto:${company.email}`}>{company.email}</a> adresine
              "Hesap silme" konulu bir e-posta gönderin. Kimliğinizi doğruladıktan sonra en geç 30 gün içinde silinir.
            </>
          ) : (
            "Müşteri hizmetlerimize hesabınızda kayıtlı e-posta adresinizden yazın; kimliğiniz doğrulandıktan sonra en geç 30 gün içinde silinir."
          )}
        </p>
        <h2>Neler silinir, neler saklanır?</h2>
        <ul>
          <li>Silinir: ad, telefon, e-posta, adresler, favoriler, sepet, bildirimler, kayıtlı kart anahtarları.</li>
          <li>Gelecekteki randevularınız iptal edilir ve işletmeye bildirilir.</li>
          <li>
            Saklanır (kimliğinizden ayrılarak): kanunen saklanması zorunlu fatura ve sipariş kayıtları, yasal süre
            boyunca.
          </li>
        </ul>
        <p>
          Ayrıntılar: <Link to="/gizlilik">Gizlilik politikası</Link>
        </p>
      </article>
    </PublicLayout>
  );
}

export function NotFound() {
  usePageMeta({ title: "Sayfa bulunamadı" });
  return (
    <PublicLayout>
      <div className="prose">
        <div className="label">404</div>
        <h1>Bu sayfa defterde yok.</h1>
        <p>Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.</p>
        <p>
          <Link to="/">Ana sayfaya dön</Link>
        </p>
      </div>
    </PublicLayout>
  );
}
