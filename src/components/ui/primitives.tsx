import Image from "next/image";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import {
  AlertCircle,
  Minus,
  Plus,
  Trash2,
  Wine,
  type LucideIcon,
} from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "quiet"
  | "danger"
  | "inverse";
type ButtonLook = {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  block?: boolean;
  className?: string;
};
/** Clases del botón para enlaces (`<Link>`): un solo patrón visual para botones y enlaces. */
export function buttonClass({
  variant = "primary",
  size = "md",
  block = false,
  className = "",
}: ButtonLook = {}) {
  return [
    "btn",
    variant,
    size !== "md" && size,
    block && "block",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}
export function Button({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonLook & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, block, className })}
    >
      {loading && <span className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      aria-label={label}
      className={`icon-btn ${className}`}
    >
      {children}
    </button>
  );
}
export function TextField({
  label,
  error,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} aria-invalid={!!error} />
      {hint && !error && <span className="hint">{hint}</span>}
      {error && (
        <span role="alert" className="field-error">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </span>
      )}
    </label>
  );
}
export function StatusBadge({
  children,
  tone = "neutral",
  plain = false,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "brand";
  plain?: boolean;
}) {
  return (
    <span
      className={`badge ${tone === "neutral" ? "" : tone} ${plain ? "plain" : ""}`}
    >
      {children}
    </span>
  );
}
export function Price({ amount }: { amount: number }) {
  return (
    <span className="money">
      {new Intl.NumberFormat("es-CR", {
        style: "currency",
        currency: "CRC",
        maximumFractionDigits: 0,
      }).format(amount / 100)}
    </span>
  );
}
export function PhotoFallback({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  return (
    <div
      className={`photo-fallback ${large ? "large" : ""}`}
      role="img"
      aria-label={`${name}, fotografía pendiente`}
    >
      <Wine size={large ? 48 : 24} strokeWidth={1.75} />
    </div>
  );
}
export function Notice({
  tone = "neutral",
  title,
  children,
  action,
}: {
  tone?: "neutral" | "warning" | "danger" | "success";
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={`notice ${tone === "neutral" ? "" : tone}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <div className="grow">
        {title && <strong>{title}</strong>}
        {children}
        {action && <div style={{ marginTop: 12 }}>{action}</div>}
      </div>
    </div>
  );
}
export function ErrorState({
  message,
  title = "No pudimos continuar",
  children,
}: {
  message: string;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <section className="state error" role="alert">
      <div className="glyph">
        <AlertCircle size={24} aria-hidden="true" />
      </div>
      <h2>{title}</h2>
      <p>{message}</p>
      {children}
    </section>
  );
}
export function EmptyState({
  title,
  icon: Icon,
  brand = false,
  action,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  brand?: boolean;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="state">
      <div className="glyph">
        {brand ? (
          <>
            <Image
              unoptimized
              className="brand-light"
              src="/brand/onza-shot.svg"
              width={22}
              height={25}
              alt=""
            />
            <Image
              unoptimized
              className="brand-dark"
              src="/brand/onza-shot-white.svg"
              width={22}
              height={25}
              alt=""
            />
          </>
        ) : Icon ? (
          <Icon size={24} aria-hidden="true" />
        ) : (
          <Wine size={24} aria-hidden="true" />
        )}
      </div>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </section>
  );
}
/** Con cantidad 1 el botón izquierdo es una papelera: quita la línea y nunca deja un artículo atrapado. */
export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 10,
  label = "Cantidad",
  enter = false,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  enter?: boolean;
}) {
  const removes = value <= min + 1 && min === 0;
  return (
    <div
      className={`stepper ${enter ? "enter" : ""}`}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label={removes ? "Quitar" : "Quitar una unidad"}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        {removes ? (
          <Trash2 size={16} aria-hidden="true" />
        ) : (
          <Minus size={16} aria-hidden="true" />
        )}
      </button>
      <output className="qty" aria-live="polite" aria-label="Cantidad">
        {value}
      </output>
      <button
        type="button"
        aria-label="Agregar una unidad"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  disabled,
  name,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <label className="toggle">
      <span className="grow t-label">{label}</span>
      <input
        type="checkbox"
        role="switch"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  block = false,
}: {
  value: T;
  options: readonly { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  label: string;
  block?: boolean;
}) {
  return (
    <div
      className={`seg ${block ? "block" : ""}`}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
/** Wordmark original en versión clara y oscura; el contenedor aporta la clase `brand`. */
export function BrandMark() {
  return (
    <>
      <Image
        unoptimized
        src="/brand/onza-wordmark.svg"
        className="brand-light"
        width="82"
        height="22"
        alt="Onza"
      />
      <Image
        unoptimized
        src="/brand/onza-wordmark-white.svg"
        className="brand-dark"
        width="82"
        height="22"
        alt="Onza"
      />
    </>
  );
}
