import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, X } from "@phosphor-icons/react";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { money } from "../../lib/format";
import { Button, ErrorBox, Input, Loading, PageHead, Select, Switch, Textarea } from "../../components/ui";
import { ImageUploader } from "../../components/ImageUploader";
import { useToast } from "../../components/Toast";
import type { Product } from "../../lib/types";

const parseMoney = (v: string) => Number(v.replace(/\./g, "").replace(",", "."));
const showMoney = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));

export default function ProductEdit() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  usePageMeta({ title: isNew ? "Yeni ürün" : "Ürünü düzenle" });

  const categories = useQuery({
    queryKey: ["seller", "categories"],
    queryFn: () =>
      api.get<{ items: { id: string; name: string }[] }>("/business/seller/categories").then((r) => r.items),
    staleTime: 10 * 60_000,
  });
  const product = useQuery({
    queryKey: ["seller", "product", id],
    queryFn: () => api.get<{ product: Product }>(`/business/seller/products/${id}`).then((r) => r.product),
    enabled: !isNew,
  });

  const [f, setF] = useState({
    name: "",
    brand: "",
    sku: "",
    categoryId: "",
    price: "",
    compareAtPrice: "",
    stock: "0",
    description: "",
    images: [] as string[],
    features: [] as string[],
    isActive: true,
  });
  const [feature, setFeature] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const p = product.data;
    if (!p) return;
    setF({
      name: p.name,
      brand: p.brand ?? "",
      sku: p.sku ?? "",
      categoryId: p.category.id,
      price: showMoney(p.price),
      compareAtPrice: showMoney(p.compareAtPrice),
      stock: String(p.stock),
      description: p.description ?? "",
      images: p.images,
      features: p.features,
      isActive: p.isActive,
    });
  }, [product.data]);

  useEffect(() => {
    if (isNew && !f.categoryId && categories.data?.[0]) setF((x) => ({ ...x, categoryId: categories.data![0]!.id }));
  }, [categories.data, isNew, f.categoryId]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name.trim(),
        brand: f.brand.trim() || null,
        sku: f.sku.trim() || null,
        categoryId: f.categoryId,
        price: parseMoney(f.price),
        compareAtPrice: f.compareAtPrice ? parseMoney(f.compareAtPrice) : null,
        stock: Number(f.stock || 0),
        description: f.description.trim() || null,
        images: f.images,
        features: f.features,
        isActive: f.isActive,
      };
      return isNew
        ? api.post<{ product: Product }>("/business/seller/products", body)
        : api.patch<{ product: Product }>(`/business/seller/products/${id}`, body);
    },
    onSuccess: ({ product: p }) => {
      toast(isNew ? "Ürün eklendi ve satışa çıktı" : "Ürün kaydedildi");
      void qc.invalidateQueries({ queryKey: ["seller"] });
      if (isNew) navigate(`/magaza/urunler/${p.id}`, { replace: true });
    },
    onError: (e) => {
      setErrors(fieldErrors(e));
      toast(e instanceof ApiError ? e.message : "Kaydedilemedi", "bad");
    },
  });

  const remove = useMutation({
    mutationFn: () => api.del<{ deleted: boolean }>(`/business/seller/products/${id}`),
    onSuccess: (r) => {
      toast(r.deleted ? "Ürün silindi" : "Satılmış ürün silinemez; satıştan kaldırıldı");
      void qc.invalidateQueries({ queryKey: ["seller"] });
      navigate("/magaza/urunler", { replace: true });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Silinemedi", "bad"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.name.trim().length < 3) er.name = "Ürün adı en az 3 karakter";
    const price = parseMoney(f.price);
    if (!(price > 0)) er.price = "Geçerli bir fiyat girin";
    if (f.compareAtPrice && !(parseMoney(f.compareAtPrice) > price))
      er.compareAtPrice = "Satış fiyatından yüksek olmalı";
    if (!f.categoryId) er.categoryId = "Kategori seçin";
    setErrors(er);
    if (!Object.keys(er).length) save.mutate();
  };

  if (!isNew && product.isLoading) return <Loading rows={8} />;
  if (!isNew && product.error) return <ErrorBox error={product.error} onRetry={() => product.refetch()} />;

  const price = parseMoney(f.price);
  const cmp = parseMoney(f.compareAtPrice);
  const discount = f.compareAtPrice && cmp > price && price > 0 ? Math.round((1 - price / cmp) * 100) : 0;

  return (
    <form onSubmit={submit} noValidate>
      <Link
        to="/magaza/urunler"
        className="small muted"
        style={{ display: "inline-flex", gap: 6, alignItems: "center", marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> Ürünler
      </Link>
      <PageHead
        kicker={isNew ? "Yeni ürün" : product.data?.sku ? `Stok kodu ${product.data.sku}` : "Ürün"}
        title={f.name || (isNew ? "Yeni ürün" : "Ürün")}
        actions={
          <>
            {!isNew ? (
              <Button
                variant="danger"
                onClick={() => confirm("Ürün silinsin mi? Satılmışsa satıştan kaldırılır.") && remove.mutate()}
                loading={remove.isPending}
              >
                Sil
              </Button>
            ) : null}
            <Button type="submit" variant="primary" loading={save.isPending}>
              {isNew ? "Ürünü yayınla" : "Kaydet"}
            </Button>
          </>
        }
      />

      <div className="grid-2">
        <div>
          <Input label="Ürün adı" value={f.name} onChange={set("name")} error={errors.name} maxLength={150} />
          <div className="form-row">
            <Input label="Marka" value={f.brand} onChange={set("brand")} />
            <Input label="Stok kodu (SKU)" value={f.sku} onChange={set("sku")} className="input mono" />
          </div>
          <Textarea
            label="Açıklama"
            rows={6}
            value={f.description}
            onChange={set("description")}
            maxLength={5000}
            hint="İçerik, kullanım şekli, hacim/ağırlık gibi bilgileri yazın."
          />
          <div className="field">
            <span>Görseller</span>
            <span className="hint">İlk görsel vitrinde görünür. JPG, PNG veya WEBP, en fazla 5 MB.</span>
            <ImageUploader value={f.images} onChange={(images) => setF((x) => ({ ...x, images }))} />
          </div>
          <div className="field">
            <span>Öne çıkan özellikler</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                value={feature}
                placeholder="Örn. Paraben içermez"
                onChange={(e) => setFeature(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (feature.trim()) setF((x) => ({ ...x, features: [...x.features, feature.trim()].slice(0, 12) }));
                    setFeature("");
                  }
                }}
                aria-label="Özellik ekle"
              />
              <Button
                onClick={() => {
                  if (feature.trim()) setF((x) => ({ ...x, features: [...x.features, feature.trim()].slice(0, 12) }));
                  setFeature("");
                }}
                aria-label="Özelliği ekle"
              >
                <Plus size={16} />
              </Button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {f.features.map((x, i) => (
                <span
                  key={x + i}
                  className="stamp"
                  style={{ textTransform: "none", letterSpacing: 0, fontSize: 13, fontWeight: 400 }}
                >
                  {x}
                  <button
                    type="button"
                    onClick={() => setF((s) => ({ ...s, features: s.features.filter((_, j) => j !== i) }))}
                    style={{ border: 0, background: "none", cursor: "pointer", padding: 0, display: "flex" }}
                    aria-label={`${x} özelliğini kaldır`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <aside>
          <div className="leaf leaf-pad">
            <Switch
              checked={f.isActive}
              onChange={(v) => setF((x) => ({ ...x, isActive: v }))}
              label={f.isActive ? "Satışta" : "Satış dışı"}
            />
            <hr style={{ border: 0, borderTop: "1px solid var(--rule)", margin: "18px 0" }} />
            <Select label="Kategori" value={f.categoryId} onChange={set("categoryId")} error={errors.categoryId}>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input
              label="Satış fiyatı (TL)"
              inputMode="decimal"
              value={f.price}
              onChange={(e) => setF((x) => ({ ...x, price: e.target.value.replace(/[^\d.,]/g, "") }))}
              error={errors.price}
              className="input mono"
            />
            <Input
              label="İndirim öncesi fiyat (isteğe bağlı)"
              inputMode="decimal"
              value={f.compareAtPrice}
              onChange={(e) => setF((x) => ({ ...x, compareAtPrice: e.target.value.replace(/[^\d.,]/g, "") }))}
              error={errors.compareAtPrice}
              hint={discount ? `Uygulamada %${discount} indirim olarak gösterilir` : "Üstü çizili gösterilir"}
              className="input mono"
            />
            <Input
              label="Stok adedi"
              inputMode="numeric"
              value={f.stock}
              onChange={(e) => setF((x) => ({ ...x, stock: e.target.value.replace(/\D/g, "") }))}
              className="input mono"
              hint={Number(f.stock) === 0 ? "Stok 0 iken ürün 'tükendi' görünür" : undefined}
            />
            {price > 0 ? (
              <p className="small muted">
                Müşteri görünümü: <b className="mono">{money(price)}</b>
                {discount ? (
                  <span className="faint mono" style={{ textDecoration: "line-through", marginLeft: 6 }}>
                    {money(cmp)}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </form>
  );
}
