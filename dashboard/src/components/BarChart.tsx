import { useId } from "react";
import { moneyShort } from "../lib/format";

interface Datum {
  label: string;
  value: number;
  /** İkinci seri (ör. gider) — çubuğun yanında soluk renkte */
  alt?: number;
  title?: string;
}

/**
 * Yalın SVG çubuk grafik. Kütüphane yok: hafif, temaya uyumlu ve ekran okuyucu için tablo özeti içerir.
 */
export function BarChart({
  data,
  height = 180,
  format = moneyShort,
  caption,
}: {
  data: Datum[];
  height?: number;
  format?: (v: number) => string;
  caption: string;
}) {
  const id = useId();
  const max = Math.max(1, ...data.flatMap((d) => [d.value, d.alt ?? 0]));
  const W = 720;
  const pad = { top: 10, right: 8, bottom: 26, left: 8 };
  const innerH = height - pad.top - pad.bottom;
  const slot = (W - pad.left - pad.right) / Math.max(1, data.length);
  const hasAlt = data.some((d) => d.alt !== undefined);
  const bw = Math.max(3, Math.min(28, slot * (hasAlt ? 0.36 : 0.62)));
  const every = Math.ceil(data.length / 10);

  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-labelledby={`${id}-cap`}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            className="grid"
            x1={0}
            x2={W}
            y1={pad.top + innerH * (1 - f)}
            y2={pad.top + innerH * (1 - f)}
          />
        ))}
        {data.map((d, i) => {
          const x = pad.left + slot * i + (slot - (hasAlt ? bw * 2 + 2 : bw)) / 2;
          const h = (d.value / max) * innerH;
          const ha = ((d.alt ?? 0) / max) * innerH;
          return (
            <g key={d.label + i}>
              <rect
                className="bar"
                x={x}
                y={pad.top + innerH - h}
                width={bw}
                height={Math.max(h, d.value ? 1 : 0)}
                rx={2}
              >
                <title>{`${d.title ?? d.label}: ${format(d.value)}`}</title>
              </rect>
              {hasAlt ? (
                <rect
                  className="bar alt"
                  x={x + bw + 2}
                  y={pad.top + innerH - ha}
                  width={bw}
                  height={Math.max(ha, d.alt ? 1 : 0)}
                  rx={2}
                >
                  <title>{`${d.title ?? d.label}: ${format(d.alt ?? 0)}`}</title>
                </rect>
              ) : null}
              {i % every === 0 ? (
                <text className="axis" x={pad.left + slot * i + slot / 2} y={height - 8} textAnchor="middle">
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <text className="axis" x={W - 4} y={pad.top + 10} textAnchor="end">
          {format(max)}
        </text>
      </svg>
      <figcaption id={`${id}-cap`} className="sr-only">
        {caption}. {data.map((d) => `${d.title ?? d.label}: ${format(d.value)}`).join(", ")}
      </figcaption>
    </figure>
  );
}
