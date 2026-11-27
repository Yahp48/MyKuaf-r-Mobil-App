import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { dateTime } from "../../lib/format";
import type { Page } from "../../lib/types";
import { Button, Empty, ErrorBox, Loading, PageHead, Stamp, Textarea } from "../../components/ui";
import { useToast } from "../../components/Toast";

interface Ticket {
  id: string;
  type: "SUPPORT" | "FEEDBACK" | "BUG";
  subject: string;
  message: string;
  rating: number | null;
  status: "OPEN" | "ANSWERED" | "CLOSED";
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

const TYPE = { SUPPORT: "Destek", FEEDBACK: "Geri bildirim", BUG: "Hata bildirimi" };
const STATUS = {
  OPEN: { tone: "warn", label: "Açık" },
  ANSWERED: { tone: "ok", label: "Yanıtlandı" },
  CLOSED: { tone: "faint", label: "Kapalı" },
} as const;

export default function AdminTickets() {
  usePageMeta({ title: "Destek talepleri" });
  const [status, setStatus] = useState<Ticket["status"] | "">("OPEN");
  const q = useQuery({
    queryKey: ["admin", "tickets", status],
    queryFn: () => api.get<Page<Ticket>>("/admin/tickets", { status: status || undefined, pageSize: 50 }),
  });
  return (
    <>
      <PageHead
        kicker="İçerik"
        title="Destek talepleri"
        sub="Uygulamadan gelen destek, geri bildirim ve hata bildirimleri. Yanıtınız kullanıcıya bildirim olarak gider."
      />
      <div className="tabs" role="tablist">
        {(["OPEN", "ANSWERED", "CLOSED", ""] as const).map((s) => (
          <button key={s || "all"} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}>
            {s ? STATUS[s].label : "Tümü"}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data!.items.length ? (
        <Empty title="Talep yok" />
      ) : (
        q.data!.items.map((t) => <TicketCard key={t.id} ticket={t} />)
      )}
    </>
  );
}

function TicketCard({ ticket: t }: { ticket: Ticket }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [reply, setReply] = useState("");
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin"] });
  const send = useMutation({
    mutationFn: () => api.post(`/admin/tickets/${t.id}/reply`, { reply: reply.trim() }),
    onSuccess: () => {
      toast("Yanıt gönderildi");
      setReply("");
      refresh();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Gönderilemedi", "bad"),
  });
  const close = useMutation({ mutationFn: () => api.post(`/admin/tickets/${t.id}/close`), onSuccess: refresh });

  return (
    <article className="leaf leaf-pad" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Stamp tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Stamp>
        <span className="small muted">{TYPE[t.type]}</span>
        {t.rating ? <span className="small">· {t.rating}/5</span> : null}
        <span className="small faint" style={{ marginLeft: "auto" }}>
          {dateTime(t.createdAt)}
        </span>
      </div>
      <h3 style={{ margin: "10px 0 4px", fontSize: 17 }}>{t.subject}</h3>
      <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{t.message}</p>
      <p className="small muted">{t.user ? `${t.user.name} · ${t.user.email}` : "Silinmiş hesap"}</p>
      {t.reply ? (
        <div className="small" style={{ borderLeft: "3px solid var(--accent)", paddingLeft: 10, marginTop: 8 }}>
          <b>Yanıtınız</b> · {t.repliedAt ? dateTime(t.repliedAt) : ""}
          <p style={{ whiteSpace: "pre-wrap", margin: "4px 0 0" }}>{t.reply}</p>
        </div>
      ) : null}
      {t.status !== "CLOSED" ? (
        <>
          {t.user ? (
            <Textarea
              label={t.reply ? "Yeni yanıt" : "Yanıt"}
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={3000}
            />
          ) : null}
          <div style={{ display: "flex", gap: 8 }}>
            {t.user ? (
              <Button
                variant="primary"
                size="sm"
                loading={send.isPending}
                disabled={reply.trim().length < 2}
                onClick={() => send.mutate()}
              >
                Yanıtla
              </Button>
            ) : null}
            <Button size="sm" onClick={() => close.mutate()}>
              Kapat
            </Button>
          </div>
        </>
      ) : null}
    </article>
  );
}
