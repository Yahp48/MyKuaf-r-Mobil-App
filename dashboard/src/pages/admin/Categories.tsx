import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { Button, ErrorBox, Input, Loading, PageHead, Stamp, Switch } from "../../components/ui";
import { useToast } from "../../components/Toast";

interface Category {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export default function AdminCategories() {
  usePageMeta({ title: "Kategoriler" });
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const q = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => api.get<{ items: Category[] }>("/admin/categories").then((r) => r.items),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
  const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : "Kaydedilemedi", "bad");
  const add = useMutation({
    mutationFn: () => api.post("/admin/categories", { name: name.trim(), sortOrder: (q.data?.length ?? 0) + 1 }),
    onSuccess: () => {
      toast("Kategori eklendi; uygulamada görünür");
      setName("");
      refresh();
    },
    onError: fail,
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: Partial<Category> & { id: string }) => api.patch(`/admin/categories/${id}`, body),
    onSuccess: refresh,
    onError: fail,
  });

  return (
    <>
      <PageHead
        kicker="İçerik"
        title="Kategoriler"
        sub="Mağazadaki ürün kategorileri. Pasif kategori uygulamada görünmez; ürünleri silinmez."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length >= 2) add.mutate();
        }}
        style={{ display: "flex", gap: 8, alignItems: "end", maxWidth: 520, marginBottom: 20 }}
      >
        <div style={{ flex: 1 }}>
          <Input
            label="Yeni kategori"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Saç boyası"
          />
        </div>
        <Button type="submit" variant="primary" loading={add.isPending} disabled={name.trim().length < 2}>
          Ekle
        </Button>
      </form>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kategori</th>
                <th className="right">Ürün</th>
                <th className="right">Sıra</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {q.data!.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    <div className="small faint mono">{c.slug}</div>
                  </td>
                  <td className="right mono">{c.productCount}</td>
                  <td className="right">
                    <input
                      className="input mono"
                      style={{ width: 70, textAlign: "right" }}
                      type="number"
                      min={0}
                      max={999}
                      defaultValue={c.sortOrder}
                      aria-label={`${c.name} sırası`}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isInteger(v) && v !== c.sortOrder) update.mutate({ id: c.id, sortOrder: v });
                      }}
                    />
                  </td>
                  <td>
                    <Switch
                      checked={c.isActive}
                      onChange={(v) => update.mutate({ id: c.id, isActive: v })}
                      label={c.isActive ? "Yayında" : "Pasif"}
                    />
                    {!c.isActive && c.productCount ? <Stamp tone="warn">Ürünleri gizli</Stamp> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
