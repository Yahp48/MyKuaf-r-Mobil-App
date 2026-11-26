import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Link } from "react-router";
import { X } from "@phosphor-icons/react";
import { ApiError } from "../lib/api";

type BtnVariant = "default" | "primary" | "accent" | "quiet" | "danger";

export function Button({
  variant = "default",
  size,
  loading,
  block,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: "sm";
  loading?: boolean;
  block?: boolean;
}) {
  const cls = ["btn", variant !== "default" && `btn-${variant}`, size && `btn-${size}`, block && "btn-block", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  to,
  variant = "default",
  size,
  children,
}: {
  to: string;
  variant?: BtnVariant;
  size?: "sm";
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={["btn", variant !== "default" && `btn-${variant}`, size && `btn-${size}`].filter(Boolean).join(" ")}
    >
      {children}
    </Link>
  );
}

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (id: string, describedBy?: string) => ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id, describedBy)}
      {error ? (
        <span id={`${id}-err`} className="error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, d) => <input ref={ref} id={id} className="input" aria-invalid={!!error} aria-describedby={d} {...rest} />}
    </Field>
  );
});

export function Select({
  label,
  hint,
  error,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: ReactNode; error?: string }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, d) => (
        <select id={id} className="select" aria-invalid={!!error} aria-describedby={d} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function Textarea({
  label,
  hint,
  error,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode; error?: string }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, d) => <textarea id={id} className="textarea" aria-invalid={!!error} aria-describedby={d} {...rest} />}
    </Field>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
      <span className="switch">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span />
      </span>
      <span>{label}</span>
    </label>
  );
}

export type Tone = "ok" | "warn" | "bad" | "accent" | "faint" | undefined;

export function Stamp({ tone, children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="stamp" data-tone={tone}>
      {children}
    </span>
  );
}

export function PageHead({
  kicker,
  title,
  sub,
  actions,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        {kicker ? <div className="label kicker">{kicker}</div> : null}
        <h1>{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Figure({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="figure">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {note ? <div className="note">{note}</div> : null}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function Loading({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Yükleniyor" style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 44, opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.message : "Bir sorun oluştu.";
  return (
    <div className="alert" data-tone="bad" role="alert">
      <div style={{ flex: 1 }}>{message}</div>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Tekrar dene
        </Button>
      ) : null}
    </div>
  );
}

/** Yerel <dialog>: odak hapsetme, Esc ile kapanma ve erişilebilirlik tarayıcıdan gelir. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      style={wide ? { width: "min(760px, calc(100vw - 24px))" } : undefined}
      aria-labelledby="dlg-title"
    >
      {open ? (
        <>
          <div className="dialog-head">
            <h2 id="dlg-title">{title}</h2>
            <Button variant="quiet" size="sm" onClick={onClose} aria-label="Kapat">
              <X size={18} />
            </Button>
          </div>
          <div className="dialog-body">{children}</div>
          {footer ? <div className="dialog-foot">{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}

export function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className="stars" aria-label={`5 üzerinden ${value}`}>
      {"★".repeat(full)}
      <span style={{ opacity: 0.25 }}>{"★".repeat(5 - full)}</span>
    </span>
  );
}
