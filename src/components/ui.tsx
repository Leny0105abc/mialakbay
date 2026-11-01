'use client';
import { useState, useId, Children, isValidElement, cloneElement } from 'react';
import type { ReactNode, FormEvent, ReactElement, InputHTMLAttributes } from 'react';
import { LoaderCircle, CheckCircle2, AlertCircle, ArrowUpRight, Eye, EyeOff } from 'lucide-react';
export async function api<T = Record<string, unknown>>(path: string, body?: unknown): Promise<T> {
  const res = await fetch('/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to complete the request.');
  return data as T;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        typeof child.type === 'string' &&
        ['input', 'select', 'textarea'].includes(child.type)
          ? cloneElement(child as ReactElement<Record<string, unknown>>, { 'aria-label': label })
          : child,
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function PasswordField({
  label = 'Password',
  hint,
  id,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: string; hint?: string }) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id || generatedId;
  const hintId = `${inputId}-hint`;
  const description = [props['aria-describedby'], hint && hintId].filter(Boolean).join(' ');
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className="password-control">
        <input
          {...props}
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-describedby={description || undefined}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-controls={inputId}
          aria-pressed={visible}
          disabled={props.disabled}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  );
}
export function Message({ error, success }: { error?: string; success?: string }) {
  return (
    <>
      {error && (
        <div role="alert" className="message error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div role="status" className="message success">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}
    </>
  );
}
export function Submit({
  busy,
  children = 'Save changes',
}: {
  busy: boolean;
  children?: ReactNode;
}) {
  return (
    <button className="btn primary" type="submit" disabled={busy}>
      {busy ? <LoaderCircle size={18} className="spin" /> : null}
      {children}
      {!busy && <ArrowUpRight size={17} />}
    </button>
  );
}
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function run(fn: () => Promise<void>, message = 'Changes saved.') {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await fn();
      setSuccess(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, success, run };
}
export const formValues = (event: FormEvent<HTMLFormElement>) =>
  Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
