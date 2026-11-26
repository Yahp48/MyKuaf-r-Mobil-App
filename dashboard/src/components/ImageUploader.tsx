import { useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { api, ApiError } from "../lib/api";
import { useToast } from "./Toast";

/** Görselleri sunucuya yükler; ilk görsel vitrin görselidir. */
export function ImageUploader({
  value,
  onChange,
  max = 8,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const next = [...value];
    for (const f of Array.from(files).slice(0, max - value.length)) {
      if (f.size > 5 * 1024 * 1024) {
        toast(`${f.name}: en fazla 5 MB olabilir`, "bad");
        continue;
      }
      try {
        const { url } = await api.upload(f);
        next.push(url);
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Görsel yüklenemedi", "bad");
      }
    }
    onChange(next);
    setBusy(false);
  };

  return (
    <div className="uploader">
      {value.map((url, i) => (
        <figure key={url}>
          <img src={url} alt={i === 0 ? "Vitrin görseli" : `Görsel ${i + 1}`} />
          <button
            type="button"
            className="btn btn-sm"
            style={{ minHeight: 26, padding: "0 6px" }}
            onClick={() => onChange(value.filter((u) => u !== url))}
            aria-label={`Görsel ${i + 1}'i kaldır`}
          >
            <X size={14} />
          </button>
          {i === 0 ? <figcaption className="faint small">Vitrin</figcaption> : null}
        </figure>
      ))}
      {value.length < max ? (
        <label className="add">
          {busy ? (
            <span className="spinner" />
          ) : (
            <span>
              <Plus size={20} />
              <br />
              Görsel ekle
            </span>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void add(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      ) : null}
    </div>
  );
}
