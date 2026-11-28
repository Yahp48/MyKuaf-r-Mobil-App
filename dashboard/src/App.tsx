import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { homeFor, useSession } from "./lib/session";
import { AdminShell, Shell } from "./components/Shell";
import { Loading } from "./components/ui";
import Landing from "./pages/public/Landing";
import Login from "./pages/public/Login";
import Register from "./pages/public/Register";
import ResetPassword from "./pages/public/ResetPassword";
import { Kvkk, NotFound, Terms } from "./pages/public/Legal";
import type { BusinessType } from "./lib/types";

// Panel sayfaları ayrı paketlerde: tanıtım sayfası hızlı açılsın (SEO / Core Web Vitals)
const SalonToday = lazy(() => import("./pages/salon/Today"));
const SalonBook = lazy(() => import("./pages/salon/Book"));
const SalonAppointment = lazy(() => import("./pages/salon/AppointmentDetail"));
const SalonStaff = lazy(() => import("./pages/salon/Staff"));
const SalonServices = lazy(() => import("./pages/salon/Services"));
const SalonHours = lazy(() => import("./pages/salon/Hours"));
const SalonFinance = lazy(() => import("./pages/salon/Finance"));
const SalonReviews = lazy(() => import("./pages/salon/Reviews"));
const SalonSettings = lazy(() => import("./pages/salon/Settings"));

const SellerOverview = lazy(() => import("./pages/seller/Overview"));
const SellerOrders = lazy(() => import("./pages/seller/Orders"));
const SellerOrder = lazy(() => import("./pages/seller/OrderDetail"));
const SellerProducts = lazy(() => import("./pages/seller/Products"));
const SellerProduct = lazy(() => import("./pages/seller/ProductEdit"));
const SellerFinance = lazy(() => import("./pages/seller/Finance"));
const SellerReviews = lazy(() => import("./pages/seller/Reviews"));
const SellerSettings = lazy(() => import("./pages/seller/Settings"));

const AdminOverview = lazy(() => import("./pages/admin/Overview"));
const AdminBusinesses = lazy(() => import("./pages/admin/Businesses"));
const AdminClaims = lazy(() => import("./pages/admin/Claims"));
const AdminCategories = lazy(() => import("./pages/admin/Categories"));
const AdminTickets = lazy(() => import("./pages/admin/Tickets"));
const AdminReviews = lazy(() => import("./pages/admin/Reviews"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminProducts = lazy(() => import("./pages/admin/Products"));
const AdminAppointments = lazy(() =>
  import("./pages/admin/Operations").then((m) => ({ default: m.AdminAppointments })),
);
const AdminOrders = lazy(() => import("./pages/admin/Operations").then((m) => ({ default: m.AdminOrders })));
const AdminPayments = lazy(() => import("./pages/admin/Operations").then((m) => ({ default: m.AdminPayments })));
const AdminActivity = lazy(() => import("./pages/admin/Operations").then((m) => ({ default: m.AdminActivity })));

function FullPageLoading() {
  return (
    <div style={{ padding: 48, maxWidth: 520, margin: "10vh auto" }}>
      <Loading rows={3} />
    </div>
  );
}

/** Oturum yoksa girişe; yanlış türdeki panele girilirse kendi paneline yönlendirir. */
function RequireBusiness({ type, children }: { type: BusinessType; children: ReactNode }) {
  const { status, session } = useSession();
  const location = useLocation();
  if (status === "loading") return <FullPageLoading />;
  if (!session) return <Navigate to="/giris" replace state={{ from: location.pathname }} />;
  if (session.isAdmin || session.business.type !== type) return <Navigate to={homeFor(session)} replace />;
  return <>{children}</>;
}

/** Yönetim bölümü yalnızca platform yöneticilerine açıktır. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, session } = useSession();
  const location = useLocation();
  if (status === "loading") return <FullPageLoading />;
  if (!session) return <Navigate to="/giris" replace state={{ from: location.pathname }} />;
  if (!session.isAdmin) return <Navigate to={homeFor(session)} replace />;
  return <>{children}</>;
}

/** Oturumu açık işletme giriş/kayıt sayfasına gelirse doğrudan paneline gider. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { status, session } = useSession();
  if (status === "loading") return <FullPageLoading />;
  if (session) return <Navigate to={homeFor(session)} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/giris"
          element={
            <GuestOnly>
              <Login />
            </GuestOnly>
          }
        />
        <Route
          path="/kayit"
          element={
            <GuestOnly>
              <Register />
            </GuestOnly>
          }
        />
        <Route path="/sifre-sifirla" element={<ResetPassword />} />
        <Route path="/kvkk" element={<Kvkk />} />
        <Route path="/hizmet-sozlesmesi" element={<Terms />} />

        <Route
          path="/salon"
          element={
            <RequireBusiness type="SALON">
              <Shell />
            </RequireBusiness>
          }
        >
          <Route index element={<SalonToday />} />
          <Route path="randevular" element={<SalonBook />} />
          <Route path="randevular/:id" element={<SalonAppointment />} />
          <Route path="personel" element={<SalonStaff />} />
          <Route path="hizmetler" element={<SalonServices />} />
          <Route path="calisma-saatleri" element={<SalonHours />} />
          <Route path="gelir-gider" element={<SalonFinance />} />
          <Route path="yorumlar" element={<SalonReviews />} />
          <Route path="ayarlar" element={<SalonSettings />} />
        </Route>

        <Route
          path="/yonetim"
          element={
            <RequireAdmin>
              <AdminShell />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="isletmeler" element={<AdminBusinesses />} />
          <Route path="sahiplenme" element={<AdminClaims />} />
          <Route path="kategoriler" element={<AdminCategories />} />
          <Route path="destek" element={<AdminTickets />} />
          <Route path="yorumlar" element={<AdminReviews />} />
          <Route path="musteriler" element={<AdminUsers />} />
          <Route path="randevular" element={<AdminAppointments />} />
          <Route path="siparisler" element={<AdminOrders />} />
          <Route path="odemeler" element={<AdminPayments />} />
          <Route path="urunler" element={<AdminProducts />} />
          <Route path="islem-gecmisi" element={<AdminActivity />} />
        </Route>

        <Route
          path="/magaza"
          element={
            <RequireBusiness type="SELLER">
              <Shell />
            </RequireBusiness>
          }
        >
          <Route index element={<SellerOverview />} />
          <Route path="siparisler" element={<SellerOrders />} />
          <Route path="siparisler/:id" element={<SellerOrder />} />
          <Route path="urunler" element={<SellerProducts />} />
          <Route path="urunler/yeni" element={<SellerProduct />} />
          <Route path="urunler/:id" element={<SellerProduct />} />
          <Route path="finans" element={<SellerFinance />} />
          <Route path="yorumlar" element={<SellerReviews />} />
          <Route path="ayarlar" element={<SellerSettings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
