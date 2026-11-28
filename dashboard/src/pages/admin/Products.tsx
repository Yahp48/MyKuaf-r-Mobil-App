import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { money, number } from "../../lib/format";
import { Button, Dialog, PageHead, Stamp, Textarea } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { FilterTabs, ListBody, SearchBox, Toolbar, useAdminList, useDebounced } from "./kit";

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  image: string | null;
  seller: string;
  category: string;
  price: number;
  stock: number;
  isActive: boolean;
  blockedAt: string | null;
  blockReason: string | null;
}

type Status = "" | "live" | "blocked";

/** Ürün denetimi: kurallara aykırı ürünü yayından kaldırır (satıcı yeniden açamaz). */
export default function AdminProducts() {
  usePageMeta({ title: "Ürün denetimi" });
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<Status>("");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [target, setTarget] = useState<ProductRow | null>(null);
  const [reason, setReason] = useState("");
  const list = useAdminList<ProductRow>("products", { status: status || undefined, q: dq.trim() || undefined });

  const block = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) =>
      api.post(`/admin/products/${id}/block`, blocked ? { blocked, reason: reason.trim() } : { blocked }),
    onSuccess: (_r, v) => {
      toast(v.blocked ? "Ürün yayından kaldırıldı; satıcıya bildirildi" : "Ürün yeniden yayında");
      setTarget(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "İşlem yapılamadı", "bad"),
  });

  return (
    <>
      <PageHead
        kicker="İçerik"
        title="Ürün denetimi"
        sub="Sahte, yasaklı veya yanıltıcı ürünleri yayından kaldırın. Kaldırılan ürün uygulamada ve sepetlerde görünmez."
      />
      <Toolbar>
        <FilterTabs<Status>
          value={status}
          onChange={setStatus}
          options={[
            ["", "Tümü"],
            ["live", "Yayında"],
            ["blocked", "Kaldırılan"],
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Ürün, marka veya satıcı" />
      </Toolbar>
      <ListBody list={list} empty="Ürün bulunamadı">
        {(items) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Satıcı</th>
                  <th className="right">Fiyat</th>
                  <th className="right">Stok</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {p.image ? <img className="thumb" src={p.image} alt="" loading="lazy" /> : null}
                        <span>
                          {p.name}
                          <div className="small faint">{[p.brand, p.category].filter(Boolean).join(" · ")}</div>
                        </span>
                      </div>
                    </td>
                    <td>{p.seller}</td>
                    <td className="right mono">{money(p.price)}</td>
                    <td className="right mono">{number(p.stock)}</td>
                    <td>
                      {p.blockedAt ? (
                        <>
                          <Stamp tone="bad">Kaldırıldı</Stamp>
                          <div className="small faint">{p.blockReason}</div>
                        </>
                      ) : p.isActive ? (
                        <Stamp tone="ok">Yayında</Stamp>
                      ) : (
                        <Stamp tone="faint">Satıcı kapattı</Stamp>
                      )}
                    </td>
                    <td className="right">
                      {p.blockedAt ? (
                        <Button
                          size="sm"
                          loading={block.isPending && block.variables?.id === p.id}
                          onClick={() => block.mutate({ id: p.id, blocked: false })}
                        >
                          Yayına al
                        </Button>
                      ) : (
                        <Button size="sm" variant="danger" onClick={() => setTarget(p)}>
                          Kaldır
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListBody>
      <Dialog
        open={!!target}
        onClose={() => setTarget(null)}
        title="Ürünü yayından kaldır"
        footer={
          <>
            <Button onClick={() => setTarget(null)}>Vazgeç</Button>
            <Button
              variant="danger"
              loading={block.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => target && block.mutate({ id: target.id, blocked: true })}
            >
              Kaldır
            </Button>
          </>
        }
      >
        <p style={{ marginTop: 0 }}>
          <b>{target?.name}</b> ({target?.seller}) uygulamadan kaldırılacak. Satıcı panelinde sebebi görür.
        </p>
        <Textarea label="Sebep" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoFocus />
      </Dialog>
    </>
  );
}
