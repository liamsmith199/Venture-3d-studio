import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function Section({ title, hint, children, defaultOpen = true, testId }: { title: string; hint?: string; children: ReactNode; defaultOpen?: boolean; testId?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`section${open ? ' open' : ''}`} data-testid={testId}>
      <button className="section-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="section-body">
          {hint && <p className="hint">{hint}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

export function NumberField({ label, value, onChange, step = 0.1, min, max, suffix, testId, title }: {
  label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; suffix?: string; testId?: string; title?: string;
}) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);
  return (
    <label className="num" title={title}>
      <span>{label}</span>
      <input
        type="number" step={step} min={min} max={max} value={text} data-testid={testId}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) onChange(n);
        }}
      />
      {suffix && <em>{suffix}</em>}
    </label>
  );
}

export function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01, format, testId }: {
  label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; format?: (n: number) => string; testId?: string;
}) {
  return (
    <label className="slider">
      <span>{label}<b>{format ? format(value) : value.toFixed(2)}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} data-testid={testId} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export function ColorField({ label, value, onChange, testId }: { label: string; value: string; onChange: (c: string) => void; testId?: string }) {
  return (
    <label className="color">
      <span>{label}</span>
      <input type="color" value={value} data-testid={testId} onChange={(e) => onChange(e.target.value)} />
      <code>{value.toUpperCase()}</code>
    </label>
  );
}
