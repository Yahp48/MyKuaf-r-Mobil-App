import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { dateShort, dateTime, formatPhone, money, number } from "../../lib/format";
import { Button, Dialog, ErrorBox, Loading, PageHead, Stamp, Textarea } from "../../components/ui";
import { useToast } from "../../components/Toast";
import {
  APPOINTMENT_STATUS,
  FilterTabs,
  ListBody,
  ORDER_STATUS,
  SearchBox,
  Toolbar,
  useAdminList,
  useDebounced,
} from "./kit";

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  suspendedAt: string | null;
  appointments: number;
  orders: number;
}

interface UserDetail extends Omit<UserRow, "appointments" | "orders"> {
  deleted: boolean;
  suspendReason: string | null;
  walletBalance: number;
  loyaltyPoints: number;
  marketingOptIn: boolean;
  counts: { appointments: number; orders: number; reviews: number; tickets: number };
  appointments: { id: string; code: string; salon: string; startsAt: string; status: string; total: number }[];
  orders: { id: string; orderNumber: string; seller: string; status: string; total: number; createdAt: string }[];
}

type Status = "" | "active" | "suspended";

export default function AdminUsers() {
  usePageMeta({ title: "Müşteriler" });
  const [status, setStatus] = useState<Status>("");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useAdminList<UserRow>("users", { status: status || undefined, q: dq.trim() || undefined });

  return (
    <>
      <PageHead
        kicker="Platform"
        title="Müşteriler"
        sub="Uygulamayı kullanan müşteriler. Kurallara aykırı davranan hesabı askıya alabilirsiniz."
      />
      <Toolbar>
        <FilterTabs<Status>
          value={status}
          onChange={setStatus}
          options={[
            ["", "Tümü"],
            ["active", "Etkin"],
            ["suspended", "Askıda"],
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Ad, e-posta veya telefon" />
      </Toolbar>
      <ListBody list={list} empty="Müşteri bulunamadı">
        {(items) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Müşteri</th>
                  <th>Telefon</th>
                  <th className="right">Randevu</th>
                  <th className="right">Sipariş</th>
                  <th>Kayıt</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} data-href onClick={() => setOpenId(u.id)}>
                    <td>
                      <b>{u.name}</b>
                      <div className="small faint">{u.email}</div>
                    </td>
                    <td className="mono">{formatPhone(u.phone) || "—"}</td>
                    <td className="right mono">{number(u.appointments)}</td>
                    <td className="right mono">{number(u.orders)}</td>
                    <td>{dateShort(u.createdAt)}</td>
                    <td>{u.suspendedAt ? <Stamp tone="bad">Askıda</Stamp> : <Stamp tone="ok">Etkin</Stamp>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListBody>
      <UserDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

function UserDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  const q = useQuery({
    queryKey: ["admin", "user", id],
    queryFn: () => api.get<{ user: UserDetail }>(`/admin/users/${id}`).then((r) => r.user),
    enabled: !!id,
  });
  const u = q.data;
  const setStatus = useMutation({
    mutationFn: (suspended: boolean) =>
      api.post(`/admin/users/${id}/status`, suspended ? { suspended, reason: reason.trim() } : { suspended }),
    onSuccess: (_r, suspended) => {
      toast(suspended ? "Hesap askıya alındı; açık oturumları kapatıldı" : "Hesap yeniden etkin");
      setAsking(false);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "İşlem yapılamadı", "bad"),
  });

  const close = () => {
    setAsking(false);
    setReason("");
    onClose();
  };

  return (
    <Dialog
      open={!!id}
      onClose={close}
      title={u?.name ?? "Müşteri"}
      wide
      footer={
        u ? (
          u.suspendedAt ? (
            <Button variant="primary" loading={setStatus.isPending} onClick={() => setStatus.mutate(false)}>
              Hesabı yeniden etkinleştir
            </Button>
          ) : asking ? (
            <>
              <Button onClick={() => setAsking(false)}>Vazgeç</Button>
              <Button
                variant="danger"
                loading={setStatus.isPending}
                disabled={reason.trim().length < 3}
                onClick={() => setStatus.mutate(true)}
              >
                Askıya al
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setAsking(true)}>
              Hesabı askıya al
            </Button>
          )
        ) : null
      }
    >
      {q.isLoading ? (
        <Loading rows={4} />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : u ? (
        <>
          {u.suspendedAt ? (
            <p className="small" style={{ marginTop: 0, color: "var(--bad)" }}>
              {dateTime(u.suspendedAt)} tarihinde askıya alındı: {u.suspendReason}
            </p>
          ) : null}
          <dl className="facts">
            <dt>E-posta</dt>
            <dd>{u.email}</dd>
            <dt>Telefon</dt>
            <dd>{formatPhone(u.phone) || "—"}</dd>
            <dt>Kayıt</dt>
            <dd>{dateTime(u.createdAt)}</dd>
            <dt>Cüzdan</dt>
            <dd>{money(u.walletBalance)}</dd>
            <dt>Puan</dt>
            <dd>{number(u.loyaltyPoints)}</dd>
            <dt>Etkinlik</dt>
            <dd>
              {u.counts.appointments} randevu · {u.counts.orders} sipariş · {u.counts.reviews} yorum ·{" "}
              {u.counts.tickets} destek talebi
            </dd>
            <dt>Kampanya izni</dt>
            <dd>{u.marketingOptIn ? "Var" : "Yok"}</dd>
          </dl>
          {asking ? (
            <Textarea
              label="Askıya alma sebebi (işlem geçmişine yazılır)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              autoFocus
            />
          ) : null}
          <h3 style={{ marginBottom: 6 }}>Son randevular</h3>
          {u.appointments.length ? (
            <div className="rows">
              {u.appointments.map((a) => (
                <div key={a.id} className="row">
                  <span className="grow">
                    {a.salon} <span className="small faint mono">{a.code}</span>
                  </span>
                  <span className="small">{dateTime(a.startsAt)}</span>
                  <Stamp tone={APPOINTMENT_STATUS[a.status]?.tone}>
                    {APPOINTMENT_STATUS[a.status]?.label ?? a.status}
                  </Stamp>
                </div>
              ))}
            </div>
          ) : (
            <p className="small faint">Randevu yok.</p>
          )}
          <h3 style={{ marginBottom: 6 }}>Son siparişler</h3>
          {u.orders.length ? (
            <div className="rows">
              {u.orders.map((o) => (
                <div key={o.id} className="row">
                  <span className="grow">
                    <span className="mono">{o.orderNumber}</span> <span className="small faint">{o.seller}</span>
                  </span>
                  <span className="mono small">{money(o.total)}</span>
                  <Stamp tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label ?? o.status}</Stamp>
                </div>
              ))}
            </div>
          ) : (
            <p className="small faint">Sipariş yok.</p>
          )}
        </>
      ) : null}
    </Dialog>
  );
}
