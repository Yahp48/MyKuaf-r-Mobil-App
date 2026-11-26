import { useEffect } from "react";

const SITE = "MyKuaför İşletme";
const ORIGIN = "https://isletme.mykuafor.app";

function setMeta(selector: string, attr: string, key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Sayfa başlığı, açıklama, kanonik adres ve robots. Panel sayfaları (giriş arkası)
 * arama motorlarına kapatılır; kamuya açık sayfalar indekslenir.
 */
export function usePageMeta(opts: { title: string; description?: string; path?: string; index?: boolean }) {
  useEffect(() => {
    document.title = opts.title === SITE ? SITE : `${opts.title} · ${SITE}`;
    if (opts.description) {
      setMeta('meta[name="description"]', "name", "description", opts.description);
      setMeta('meta[property="og:description"]', "property", "og:description", opts.description);
    }
    setMeta('meta[property="og:title"]', "property", "og:title", document.title);
    setMeta('meta[name="robots"]', "name", "robots", opts.index ? "index, follow" : "noindex, nofollow");
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical && opts.path) canonical.href = ORIGIN + opts.path;
  }, [opts.title, opts.description, opts.path, opts.index]);
}
