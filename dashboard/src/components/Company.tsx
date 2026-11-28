import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface Company {
  legalName: string;
  address: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  mersisNo: string | null;
  kep: string | null;
  email: string | null;
  phone: string | null;
}

/** Platformu işleten şirket (sunucudaki COMPANY_* ayarları). Ayarlı değilse null; hiçbir şey gösterilmez. */
export function useCompany() {
  return useQuery({
    queryKey: ["meta", "company"],
    queryFn: () => api.get<{ company: Company | null }>("/meta/company").then((r) => r.company),
    staleTime: 60 * 60_000,
  }).data;
}

export function CompanyFacts({ title }: { title: string }) {
  const c = useCompany();
  if (!c) return null;
  const rows: [string, string | null][] = [
    ["Ticari unvan", c.legalName],
    ["Adres", c.address],
    ["Vergi dairesi / no", [c.taxOffice, c.taxNumber].filter(Boolean).join(" / ") || null],
    ["MERSİS no", c.mersisNo],
    ["KEP", c.kep],
    ["E-posta", c.email],
    ["Telefon", c.phone],
  ];
  return (
    <>
      <h2>{title}</h2>
      <dl className="facts">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
    </>
  );
}
