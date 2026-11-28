import { useCompany } from "../../components/Company";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { LinkButton } from "../../components/ui";

export function PublicLayout({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) {
  const year = new Date().getFullYear();
  const company = useCompany();
  return (
    <div className="public">
      <header className="public-top">
        <Link to="/" className="wordmark" aria-label="MyKuaför İşletme ana sayfa">
          <b>MyKuaför</b>
          <i aria-hidden />
          <span className="faint small" style={{ marginLeft: 4 }}>
            İşletme
          </span>
        </Link>
        {!hideNav ? (
          <nav aria-label="Hesap">
            <LinkButton to="/giris" variant="quiet">
              Giriş yap
            </LinkButton>
            <LinkButton to="/kayit" variant="primary">
              İşletmeni kaydet
            </LinkButton>
          </nav>
        ) : null}
      </header>
      {children}
      <footer className="public-foot">
        <span>© {year} {company?.shortName ?? "MyKuaför"}</span>
        <Link to="/kvkk">KVKK aydınlatma metni</Link>
        <Link to="/hizmet-sozlesmesi">İşletme hizmet sözleşmesi</Link>
        <span>
          Bu site yalnızca oturumun çalışması için zorunlu bir çerez kullanır; reklam veya izleme çerezi yoktur.
        </span>
      </footer>
    </div>
  );
}
