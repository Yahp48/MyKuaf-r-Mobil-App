import { Link } from "react-router";
import { usePageMeta } from "../../lib/seo";
import { PublicLayout } from "./PublicLayout";

// Not: Bu metinler genel çerçevedir; yayından önce bir hukukçuya gözden geçirtilmelidir.

export function Kvkk() {
  usePageMeta({
    title: "KVKK aydınlatma metni",
    description: "MyKuaför işletme hesapları için 6698 sayılı KVKK kapsamında aydınlatma metni.",
    path: "/kvkk",
    index: true,
  });
  return (
    <PublicLayout>
      <article className="prose">
        <div className="label">Kişisel verilerin korunması</div>
        <h1>KVKK aydınlatma metni</h1>
        <p>
          Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 10. maddesi uyarınca, MyKuaför işletme paneline
          kayıt olan işletme yetkililerinin kişisel verilerinin işlenmesine ilişkin olarak hazırlanmıştır.
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
        <p>
          <Link to="/">Ana sayfaya dön</Link>
        </p>
      </article>
    </PublicLayout>
  );
}

export function Terms() {
  usePageMeta({
    title: "İşletme hizmet sözleşmesi",
    description: "MyKuaför işletme paneli kullanım koşulları.",
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
          Bu sözleşme, MyKuaför platformu ile panele kayıt olan kuaför salonu veya ürün satıcısı işletme arasında,
          işletmenin randevu ve ürün satış hizmetlerini platform üzerinden sunmasına ilişkin koşulları düzenler.
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
