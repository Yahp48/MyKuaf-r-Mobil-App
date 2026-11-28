import { useState } from "react";
import { usePageMeta } from "../../lib/seo";
import { dateShort, dateTime, money } from "../../lib/format";
import { PageHead, Stamp } from "../../components/ui";
import {
  APPOINTMENT_STATUS,
  FilterTabs,
  ListBody,
  ORDER_STATUS,
  PAYMENT_PURPOSE,
  PAYMENT_STATUS,
  SearchBox,
  Toolbar,
  useAdminList,
  useDebounced,
} from "./kit";

/** Platformdaki tüm randevular, siparişler ve ödemeler (salt okunur izleme). */

interface ApptRow {
  id: string;
  code: string;
  salon: string;
  district: string;
  staff: string;
  customer: string;
  startsAt: string;
  status: string;
  source: "APP" | "PANEL";
  total: number;
}

type When = "" | "today" | "upcoming" | "past";

export function AdminAppointments() {
  usePageMeta({ title: "Tüm randevular" });
  const [when, setWhen] = useState<When>("today");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = useAdminList<ApptRow>("appointments", {
    when: when || undefined,
    status: status || undefined,
    q: dq.trim() || undefined,
  });
  return (
    <>
      <PageHead
        kicker="Operasyon"
        title="Tüm randevular"
        sub="Bütün salonlardaki randevular; yeni randevular anında düşer."
      />
      <Toolbar>
        <FilterTabs<When>
          value={when}
          onChange={setWhen}
          options={[
            ["today", "Bugün"],
            ["upcoming", "Yaklaşan"],
            ["past", "Geçmiş"],
            ["", "Tümü"],
          ]}
        />
        <label className="field" style={{ minWidth: 160 }}>
          <span className="label">Durum</span>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Hepsi</option>
            {Object.entries(APPOINTMENT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <SearchBox value={q} onChange={setQ} placeholder="Kod, müşteri veya salon" />
      </Toolbar>
      <ListBody list={list} empty="Bu filtrede randevu yok">
        {(items) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Zaman</th>
                  <th>Salon</th>
                  <th>Müşteri</th>
                  <th>Personel</th>
                  <th className="right">Tutar</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {dateTime(a.startsAt)}
                      <div className="small faint mono">{a.code}</div>
                    </td>
                    <td>
                      {a.salon}
                      <div className="small faint">{a.district}</div>
                    </td>
                    <td>
                      {a.customer}
                      {a.source === "PANEL" ? <div className="small faint">Salon girdi</div> : null}
                    </td>
                    <td>{a.staff}</td>
                    <td className="right mono">{money(a.total)}</td>
                    <td>
                      <Stamp tone={APPOINTMENT_STATUS[a.status]?.tone}>
                        {APPOINTMENT_STATUS[a.status]?.label ?? a.status}
                      </Stamp>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListBody>
    </>
  );
}

interface OrderRow {
  id: string;
  orderNumber: string;
  seller: string;
  customer: string;
  items: number;
  status: string;
  paymentMethod: "CARD" | "WALLET";
  total: number;
  createdAt: string;
  carrier: string | null;
  trackingNumber: string | null;
}

export function AdminOrders() {
  usePageMeta({ title: "Tüm siparişler" });
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = useAdminList<OrderRow>("orders", { status: status || undefined, q: dq.trim() || undefined });
  return (
    <>
      <PageHead
        kicker="Operasyon"
        title="Tüm siparişler"
        sub="Bütün satıcıların siparişleri. Kargolanmayı bekleyenleri takip edin."
      />
      <Toolbar>
        <FilterTabs
          value={status}
          onChange={setStatus}
          options={[
            ["", "Tümü"],
            ["PAID", "Ödendi"],
            ["PREPARING", "Hazırlanıyor"],
            ["SHIPPED", "Kargoda"],
            ["DELIVERED", "Teslim"],
            ["CANCELLED", "İptal"],
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Sipariş no, e-posta veya satıcı" />
      </Toolbar>
      <ListBody list={list} empty="Bu filtrede sipariş yok">
        {(items) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sipariş</th>
                  <th>Satıcı</th>
                  <th>Müşteri</th>
                  <th className="right">Tutar</th>
                  <th>Kargo</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <span className="mono">{o.orderNumber}</span>
                      <div className="small faint">
                        {dateShort(o.createdAt)} · {o.items} ürün · {o.paymentMethod === "WALLET" ? "Cüzdan" : "Kart"}
                      </div>
                    </td>
                    <td>{o.seller}</td>
                    <td>{o.customer}</td>
                    <td className="right mono">{money(o.total)}</td>
                    <td className="small">{o.trackingNumber ? `${o.carrier ?? ""} ${o.trackingNumber}` : "—"}</td>
                    <td>
                      <Stamp tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label ?? o.status}</Stamp>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListBody>
    </>
  );
}

interface PaymentRow {
  id: string;
  purpose: string;
  status: string;
  provider: string;
  providerRef: string | null;
  amount: number;
  refunded: number;
  failureReason: string | null;
  customer: string | null;
  orders: string[];
  createdAt: string;
}

export function AdminPayments() {
  usePageMeta({ title: "Ödemeler" });
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState("");
  const list = useAdminList<PaymentRow>("payments", { status: status || undefined, purpose: purpose || undefined });
  return (
    <>
      <PageHead
        kicker="Operasyon"
        title="Ödemeler"
        sub="Ödeme kuruluşu üzerinden geçen tüm işlemler. Kart bilgisi bizde tutulmaz; burada yalnızca sonuçlar görünür."
      />
      <Toolbar>
        <FilterTabs
          value={status}
          onChange={setStatus}
          options={[
            ["", "Tümü"],
            ["SUCCEEDED", "Başarılı"],
            ["FAILED", "Başarısız"],
            ["PENDING", "Bekleyen"],
            ["REFUNDED", "İade"],
          ]}
        />
        <label className="field" style={{ minWidth: 180 }}>
          <span className="label">Amaç</span>
          <select className="select" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            <option value="">Hepsi</option>
            {Object.entries(PAYMENT_PURPOSE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </Toolbar>
      <ListBody list={list} empty="Bu filtrede ödeme yok">
        {(items) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Amaç</th>
                  <th>Müşteri</th>
                  <th className="right">Tutar</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {dateTime(p.createdAt)}
                      <div className="small faint mono">{p.provider}</div>
                    </td>
                    <td>
                      {PAYMENT_PURPOSE[p.purpose] ?? p.purpose}
                      {p.orders.length ? <div className="small faint mono">{p.orders.join(", ")}</div> : null}
                    </td>
                    <td className="small">{p.customer ?? "—"}</td>
                    <td className="right mono">
                      {money(p.amount)}
                      {p.refunded > 0 ? <div className="small faint">iade {money(p.refunded)}</div> : null}
                    </td>
                    <td>
                      <Stamp tone={PAYMENT_STATUS[p.status]?.tone}>{PAYMENT_STATUS[p.status]?.label ?? p.status}</Stamp>
                      {p.failureReason ? <div className="small faint">{p.failureReason}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListBody>
    </>
  );
}

interface ActivityRow {
  id: string;
  action: string;
  summary: string;
  admin: string;
  createdAt: string;
}

export function AdminActivity() {
  usePageMeta({ title: "İşlem geçmişi" });
  const list = useAdminList<ActivityRow>("activity", {});
  return (
    <>
      <PageHead
        kicker="Denetim"
        title="İşlem geçmişi"
        sub="Yöneticilerin yaptığı her doğrulama, askıya alma, gizleme ve yanıt burada kalıcı olarak tutulur."
      />
      <ListBody list={list} empty="Henüz işlem yok">
        {(items) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ne yapıldı</th>
                  <th>Yönetici</th>
                  <th>Zaman</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.summary}
                      <div className="small faint mono">{a.action}</div>
                    </td>
                    <td>{a.admin}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{dateTime(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListBody>
    </>
  );
}
