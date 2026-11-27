import { Suspense, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpenText,
  CalendarDots,
  ChartBar,
  Clock,
  Gear,
  List,
  Package,
  Receipt,
  Scissors,
  SignOut,
  Star,
  Storefront,
  SunHorizon,
  Users,
} from "@phosphor-icons/react";
import { useBusiness, useSession } from "../lib/session";
import { useRealtime } from "../lib/realtime";
import { api } from "../lib/api";
import { Button, Loading } from "./ui";

interface Item {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  count?: number;
}

function SalonNav() {
  const { data } = useQuery({
    queryKey: ["salon", "overview"],
    queryFn: () => api.get<{ pendingApprovals: number }>("/business/salon/overview"),
  });
  const groups: { label: string; items: Item[] }[] = [
    {
      label: "Günlük",
      items: [
        { to: "/salon", label: "Bugün", icon: <SunHorizon size={18} />, end: true },
        {
          to: "/salon/randevular",
          label: "Randevu defteri",
          icon: <CalendarDots size={18} />,
          count: data?.pendingApprovals,
        },
      ],
    },
    {
      label: "Salon",
      items: [
        { to: "/salon/personel", label: "Personel", icon: <Users size={18} /> },
        { to: "/salon/hizmetler", label: "Hizmetler ve fiyatlar", icon: <Scissors size={18} /> },
        { to: "/salon/calisma-saatleri", label: "Çalışma saatleri", icon: <Clock size={18} /> },
      ],
    },
    {
      label: "İşletme",
      items: [
        { to: "/salon/gelir-gider", label: "Gelir ve gider", icon: <BookOpenText size={18} /> },
        { to: "/salon/yorumlar", label: "Yorumlar", icon: <Star size={18} /> },
        { to: "/salon/ayarlar", label: "Ayarlar", icon: <Gear size={18} /> },
      ],
    },
  ];
  return <Groups groups={groups} />;
}

function SellerNav() {
  const { data } = useQuery({
    queryKey: ["seller", "overview"],
    queryFn: () => api.get<{ kpis: { toShip: number } }>("/business/seller/overview"),
  });
  const groups: { label: string; items: Item[] }[] = [
    {
      label: "Satış",
      items: [
        { to: "/magaza", label: "Özet", icon: <ChartBar size={18} />, end: true },
        { to: "/magaza/siparisler", label: "Siparişler", icon: <Receipt size={18} />, count: data?.kpis.toShip },
        { to: "/magaza/urunler", label: "Ürünler ve stok", icon: <Package size={18} /> },
      ],
    },
    {
      label: "Mağaza",
      items: [
        { to: "/magaza/finans", label: "Finans", icon: <BookOpenText size={18} /> },
        { to: "/magaza/yorumlar", label: "Yorumlar", icon: <Star size={18} /> },
        { to: "/magaza/ayarlar", label: "Ayarlar", icon: <Gear size={18} /> },
      ],
    },
  ];
  return <Groups groups={groups} />;
}

function Groups({ groups }: { groups: { label: string; items: Item[] }[] }) {
  return (
    <nav aria-label="Panel menüsü">
      {groups.map((g) => (
        <div key={g.label} style={{ display: "contents" }}>
          <div className="label">{g.label}</div>
          {g.items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end}>
              {it.icon}
              {it.label}
              {it.count ? (
                <span className="count" aria-label={`${it.count} bekleyen`}>
                  {it.count}
                </span>
              ) : null}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function AdminNav() {
  const { data } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () =>
      api.get<{ pendingVerifications: number; pendingClaims: number; openTickets: number }>("/admin/overview"),
  });
  const groups: { label: string; items: Item[] }[] = [
    {
      label: "Platform",
      items: [
        { to: "/yonetim", label: "Genel bakış", icon: <ChartBar size={18} />, end: true },
        {
          to: "/yonetim/isletmeler",
          label: "İşletmeler",
          icon: <Storefront size={18} />,
          count: data?.pendingVerifications,
        },
        {
          to: "/yonetim/sahiplenme",
          label: "Sahiplenme talepleri",
          icon: <Scissors size={18} />,
          count: data?.pendingClaims,
        },
      ],
    },
    {
      label: "İçerik",
      items: [
        { to: "/yonetim/kategoriler", label: "Kategoriler", icon: <Package size={18} /> },
        { to: "/yonetim/destek", label: "Destek talepleri", icon: <Receipt size={18} />, count: data?.openTickets },
        { to: "/yonetim/yorumlar", label: "Yorum denetimi", icon: <Star size={18} /> },
      ],
    },
  ];
  return <Groups groups={groups} />;
}

/** Platform yöneticisi paneli: işletme paneliyle aynı düzen, kendi menüsü. */
export function AdminShell() {
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);
  return (
    <div className="shell" data-business="ADMIN">
      <aside className="index" data-open={open} aria-label="Gezinme">
        <a className="wordmark" href="/yonetim">
          <b>MyKuaför</b>
          <i aria-hidden />
        </a>
        <div className="index-business">Platform yönetimi</div>
        <AdminNav />
        <div className="index-foot">
          <span className="muted">{session?.owner.name}</span>
          <Button
            variant="quiet"
            size="sm"
            style={{ justifyContent: "flex-start", paddingLeft: 0 }}
            onClick={async () => {
              await signOut();
              navigate("/giris", { replace: true });
            }}
          >
            <SignOut size={16} /> Çıkış yap
          </Button>
        </div>
      </aside>
      <div>
        <div className="mobile-bar">
          <Button variant="quiet" size="sm" onClick={() => setOpen(true)} aria-label="Menüyü aç" aria-expanded={open}>
            <List size={22} />
          </Button>
          <b style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>Platform yönetimi</b>
        </div>
        <main className="main" id="icerik" onClick={() => open && setOpen(false)}>
          <Suspense fallback={<Loading rows={6} />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export function Shell() {
  const { business, owner } = useBusiness();
  const { signOut } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const connected = useRealtime(true);

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="shell" data-business={business.type}>
      <aside className="index" data-open={open} aria-label="Gezinme">
        <a className="wordmark" href={business.type === "SALON" ? "/salon" : "/magaza"}>
          <b>MyKuaför</b>
          <i aria-hidden />
        </a>
        <div className="index-business">
          {business.type === "SALON" ? <Scissors size={13} /> : <Storefront size={13} />} {business.displayName}
        </div>
        {business.type === "SALON" ? <SalonNav /> : <SellerNav />}
        <div className="index-foot">
          <span className="live-dot" data-on={connected}>
            {connected ? "Canlı bağlantı açık" : "Bağlanıyor…"}
          </span>
          <span className="muted">{owner.name}</span>
          <Button
            variant="quiet"
            size="sm"
            style={{ justifyContent: "flex-start", paddingLeft: 0 }}
            onClick={async () => {
              await signOut();
              navigate("/giris", { replace: true });
            }}
          >
            <SignOut size={16} /> Çıkış yap
          </Button>
        </div>
      </aside>

      <div>
        <div className="mobile-bar">
          <Button variant="quiet" size="sm" onClick={() => setOpen(true)} aria-label="Menüyü aç" aria-expanded={open}>
            <List size={22} />
          </Button>
          <b style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{business.displayName}</b>
        </div>
        <main className="main" id="icerik" onClick={() => open && setOpen(false)}>
          <Suspense fallback={<Loading rows={6} />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
