import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "@phosphor-icons/react";
import { api, ApiError } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { dateTime, formatPhone, money } from "../../lib/format";
import { Button, Dialog, ErrorBox, Input, Loading, PageHead, Select, Stamp, Textarea } from "../../components/ui";
import { useToast } from "../../components/Toast";
import type { Order } from "../../lib/types";
import { ORDER_STATUS } from "./shared";

export default function OrderDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: ["seller", "order", id],
    queryFn: () => api.get<{ order: Order }>(`/business/seller/orders/${id}`).then((r) => r.order),
  });
  const carriers = useQuery({
    queryKey: ["seller", "carriers"],
    queryFn: () => api.get<{ items: string[] }>("/business/seller/carriers").then((r) => r.items),
    staleTime: Infinity,
  });
  usePageMeta({ title: q.data ? `Sipariş ${q.data.orderNumber}` : "Sipariş" });

  const [shipOpen, setShipOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [reason, setReason] = useState("");

  const onDone = (msg: string) => {
    toast(msg);
    setShipOpen(false);
    setCancelOpen(false);
    void qc.invalidateQueries({ queryKey: ["seller"] });
  };
  const onFail = (e: unknown) => toast(e instanceof ApiError ? e.message : "İşlem yapılamadı", "bad");

  const status = useMutation({
    mutationFn: (body: Record<string, string>) => api.post(`/business/seller/orders/${id}/status`, body),
    onSuccess: (_r, v) =>
      onDone(
        v.status === "PREPARING"
          ? "Hazırlanıyor olarak işaretlendi"
          : v.status === "SHIPPED"
            ? "Kargoya verildi; müşteriye takip numarası gönderildi"
            : "Teslim edildi olarak işaretlendi",
      ),
    onError: onFail,
  });
  const cancel = useMutation({
    mutationFn: () => api.post(`/business/seller/orders/${id}/cancel`, { reason: reason.trim() }),
    onSuccess: () => onDone("Sipariş iptal edildi, tutar müşteriye iade edildi"),
    onError: onFail,
  });

  if (q.isLoading) return <Loading rows={6} />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const o = q.data!;
  const a = o.shippingAddress;

  const timeline: [string, string | null][] = [
    ["Sipariş verildi", o.createdAt],
    ["Ödeme alındı", o.paidAt],
    ["Kargoya verildi", o.shippedAt],
    ["Teslim edildi", o.deliveredAt],
  ];
  if (o.cancelledAt) timeline.push([o.status === "REFUNDED" ? "İade edildi" : "İptal edildi", o.cancelledAt]);

  return (
    <>
      <Link
        to="/magaza/siparisler"
        className="small muted"
        style={{ display: "inline-flex", gap: 6, alignItems: "center", marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> Siparişler
      </Link>
      <PageHead
        kicker={<>Sipariş · {o.paymentMethod === "CARD" ? "kartla ödendi" : "cüzdanla ödendi"}</>}
        title={
          <span className="mono" style={{ fontFamily: "var(--font-mono)", fontSize: "0.8em" }}>
            {o.orderNumber}
          </span>
        }
        sub={dateTime(o.paidAt ?? o.createdAt)}
        actions={
          <>
            <Stamp tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Stamp>
            <Button variant="quiet" onClick={() => window.print()}>
              <Printer size={16} /> Yazdır
            </Button>
          </>
        }
      />

      <div className="page-actions" style={{ marginBottom: 28 }}>
        {o.status === "PAID" ? (
          <Button onClick={() => status.mutate({ status: "PREPARING" })} loading={status.isPending}>
            Hazırlamaya başla
          </Button>
        ) : null}
        {o.status === "PAID" || o.status === "PREPARING" ? (
          <Button variant="accent" onClick={() => setShipOpen(true)}>
            Kargoya ver
          </Button>
        ) : null}
        {o.status === "SHIPPED" ? (
          <Button variant="primary" onClick={() => status.mutate({ status: "DELIVERED" })} loading={status.isPending}>
            Teslim edildi
          </Button>
        ) : null}
        {o.status === "PAID" || o.status === "PREPARING" ? (
          <Button variant="danger" onClick={() => setCancelOpen(true)}>
            İptal et ve iade et
          </Button>
        ) : null}
      </div>

      <div className="grid-2">
        <div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th className="right">Adet</th>
                  <th className="right">Birim</th>
                  <th className="right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.productId}>
                    <td>
                      <div className="cell-media">
                        {i.image ? <img className="thumb" src={i.image} alt="" /> : <span className="thumb" />}
                        <Link to={`/magaza/urunler/${i.productId}`}>{i.name}</Link>
                      </div>
                    </td>
                    <td className="right mono">{i.quantity}</td>
                    <td className="right mono">{money(i.unitPrice)}</td>
                    <td className="right mono">{money(i.lineTotal)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="right muted">
                    Ara toplam
                  </td>
                  <td className="right mono">{money(o.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="right muted">
                    Kargo
                  </td>
                  <td className="right mono">{o.shipping ? money(o.shipping) : "Ücretsiz"}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="right" style={{ fontWeight: 600 }}>
                    Toplam
                  </td>
                  <td className="right mono" style={{ fontWeight: 600 }}>
                    {money(o.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <section className="section">
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>Süreç</h2>
            <ol className="setup" style={{ padding: 0, margin: 0 }}>
              {timeline.map(([label, at]) => (
                <li key={label} data-done={!!at}>
                  <span style={{ flex: 1 }}>{label}</span>
                  <span className="small mono">{at ? dateTime(at) : "—"}</span>
                </li>
              ))}
            </ol>
            {o.cancelReason ? (
              <p className="small muted" style={{ marginTop: 10 }}>
                Sebep: {o.cancelReason}
              </p>
            ) : null}
          </section>
        </div>

        <aside>
          <div className="leaf leaf-pad">
            <div className="label" style={{ marginBottom: 12 }}>
              Teslimat adresi
            </div>
            <address style={{ fontStyle: "normal", lineHeight: 1.6 }}>
              <b style={{ fontWeight: 600 }}>{a.fullName}</b>
              <br />
              {a.line}
              <br />
              {a.district} / {a.city} {a.postalCode ?? ""}
              <br />
              <span className="mono">{formatPhone(a.phone)}</span>
            </address>
            {o.customerEmail ? (
              <p className="small muted" style={{ marginTop: 10 }}>
                {o.customerEmail}
              </p>
            ) : null}
          </div>
          {o.trackingNumber ? (
            <div className="leaf leaf-pad" style={{ marginTop: 16 }}>
              <div className="label" style={{ marginBottom: 8 }}>
                Kargo
              </div>
              <div>{o.carrier}</div>
              <div className="mono">{o.trackingNumber}</div>
            </div>
          ) : null}
        </aside>
      </div>

      <Dialog
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        title="Kargoya ver"
        footer={
          <>
            <Button onClick={() => setShipOpen(false)}>Vazgeç</Button>
            <Button
              variant="accent"
              loading={status.isPending}
              disabled={!carrier || tracking.trim().length < 5}
              onClick={() => status.mutate({ status: "SHIPPED", carrier, trackingNumber: tracking.trim() })}
            >
              Kaydet ve müşteriye bildir
            </Button>
          </>
        }
      >
        <Select label="Kargo firması" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
          <option value="">Seçin</option>
          {carriers.data?.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Input
          label="Takip numarası"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          className="input mono"
          autoFocus
        />
      </Dialog>

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Siparişi iptal et"
        footer={
          <>
            <Button onClick={() => setCancelOpen(false)}>Vazgeç</Button>
            <Button
              variant="danger"
              loading={cancel.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => cancel.mutate()}
            >
              İptal et ve {money(o.total)} iade et
            </Button>
          </>
        }
      >
        <p className="muted" style={{ marginBottom: 14 }}>
          Tutar müşteriye {o.paymentMethod === "WALLET" ? "cüzdanına" : "kartına"} iade edilir, ürünler stoğa geri
          eklenir. Bu işlem geri alınamaz.
        </p>
        <Textarea
          label="Sebep (müşteriye iletilir)"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
        />
      </Dialog>
    </>
  );
}
