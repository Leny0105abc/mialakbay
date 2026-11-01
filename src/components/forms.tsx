'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, Field, PasswordField, Submit, Message, useAction, formValues } from './ui';
import type { User } from '@/lib/types';
export function AuthForm({
  register = false,
  admin = false,
}: {
  register?: boolean;
  admin?: boolean;
}) {
  const state = useAction();
  const router = useRouter();
  const params = useSearchParams();
  return (
    <div className="container">
      <div className="auth-layout">
        <div className="auth-art">
          <img
            src="https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=900&q=80"
            alt="An island adventure awaits"
          />
          <div>
            <span className="eyebrow" style={{ color: '#efd8a7' }}>
              LESS PLANNING. MORE LIVING.
            </span>
            <h2>Your next chapter starts somewhere new.</h2>
            <p>All your journeys, thoughtfully kept in one place.</p>
          </div>
        </div>
        <div className="auth-form">
          <span className="eyebrow">{admin ? 'AGENCY PORTAL' : 'WELCOME TO LAKBAY'}</span>
          <h1>
            {register
              ? 'A world of possibilities.'
              : admin
                ? 'Let’s make great trips.'
                : 'Good to see you again.'}
          </h1>
          <p>
            {register
              ? 'Create an account to keep your travel plans together.'
              : admin
                ? 'Sign in with your authorized staff account.'
                : 'Sign in and pick up where your wanderlust left off.'}
          </p>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const data = formValues(e);
              state.run(async () => {
                const r = await api<{ user: User }>(
                  `auth/${register ? 'register' : 'login'}`,
                  data,
                );
                const next = params.get('next');
                router.push(
                  next &&
                    next.startsWith('/') &&
                    !next.startsWith('//') &&
                    !next.includes('\\') &&
                    new URL(next, window.location.origin).origin === window.location.origin
                    ? next
                    : admin && r.user.role !== 'CUSTOMER'
                      ? '/admin'
                      : '/account',
                );
                router.refresh();
              }, 'Signed in.');
            }}
          >
            {register && (
              <Field label="Your name">
                <input name="name" autoComplete="name" required minLength={2} maxLength={120} />
              </Field>
            )}
            <Field label="Email address">
              <input name="email" type="email" autoComplete="email" required maxLength={254} />
            </Field>
            <PasswordField
              label="Password"
              hint={register ? 'At least 12 characters. Use a unique password.' : undefined}
              name="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              minLength={register ? 12 : 1}
              maxLength={128}
              required
            />
            <Message error={state.error} />
            <Submit busy={state.busy}>{register ? 'Create my account' : 'Sign in'}</Submit>
          </form>
          <div className="auth-bottom">
            {admin ? (
              <Link href="/login">Customer sign in</Link>
            ) : register ? (
              <>
                Already have an account? <Link href="/login">Sign in</Link>
              </>
            ) : (
              <>
                New around here? <Link href="/register">Create an account</Link>
              </>
            )}
          </div>
          {admin && (
            <p className="mini-note">
              The first administrator is created with the documented CLI setup.
            </p>
          )}
          {!admin && (
            <p className="mini-note">
              <Link href="/lookup">Booked as a guest? Find your reservation.</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
export function InquiryForm({ user, compact = false }: { user: User | null; compact?: boolean }) {
  const state = useAction();
  const params = useSearchParams();
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const values = formValues(e);
        state.run(async () => {
          const r = await api<{ reference: string }>('inquiries', {
            ...values,
            budget: Math.round(Number(values.budget) * 100),
          });
          throwIfEmpty(r.reference);
        }, 'Your inquiry has been received. Our team can review it in the agency portal. If signed in, follow responses under My inquiries.');
      }}
    >
      <div className="form-grid">
        <Field label="Your name">
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={user?.name}
            autoComplete="name"
          />
        </Field>
        <Field label="Email address">
          <input
            name="email"
            type="email"
            required
            defaultValue={user?.email}
            autoComplete="email"
          />
        </Field>
        <Field label="Phone or mobile">
          <input
            name="phone"
            type="tel"
            required
            minLength={7}
            maxLength={30}
            defaultValue={user?.phone}
            autoComplete="tel"
          />
        </Field>
        <Field label="Where would you like to go?">
          <input
            name="destination"
            required
            minLength={2}
            maxLength={200}
            defaultValue={params.get('destination') || ''}
            placeholder="A destination or travel service"
          />
        </Field>
        <Field label="Preferred start date">
          <input name="start_date" type="date" required />
        </Field>
        <Field label="Preferred end date">
          <input name="end_date" type="date" required />
        </Field>
        <Field label="Number of travelers">
          <input name="travelers" type="number" min="1" max="1000" defaultValue="2" required />
        </Field>
        <Field label="Approximate total budget (PHP)">
          <input name="budget" type="number" min="1" max="10000000" defaultValue="20000" required />
        </Field>
        <Field label="Preferred accommodation">
          <select name="accommodation">
            <option>Comfortable mid-range hotel</option>
            <option>Budget-friendly stay</option>
            <option>Premium resort or hotel</option>
            <option>No accommodation needed</option>
            <option>Help me decide</option>
          </select>
        </Field>
        <Field label="Travel interests">
          <input
            name="interests"
            placeholder="Beaches, food, culture…"
            required
            minLength={2}
            maxLength={2000}
          />
        </Field>
        <Field label={compact ? 'Tell us how we can help' : 'Special requests'}>
          <textarea
            name="requests"
            maxLength={3000}
            placeholder="Anything else that would make this trip yours?"
          />
        </Field>
      </div>
      <small className="muted">
        This is an inquiry, with no payment or confirmed reservation. We collect these details to
        prepare a suitable response.{' '}
        <Link href="/privacy" style={{ textDecoration: 'underline' }}>
          Privacy notice
        </Link>
      </small>
      <Message error={state.error} success={state.success} />
      <Submit busy={state.busy}>Send my travel request</Submit>
    </form>
  );
}
function throwIfEmpty(s: string) {
  if (!s) throw new Error('Your request could not be recorded.');
}
export function LookupForm() {
  const state = useAction();
  const router = useRouter();
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const values = formValues(e);
        state.run(async () => {
          const r = await api<{ reference: string }>('bookings/lookup', {
            ...values,
            reference: values.reference.trim().toUpperCase(),
          });
          router.push(`/bookings/${r.reference}`);
        });
      }}
    >
      <Field label="Booking reference">
        <input name="reference" required placeholder="LKB-2026-…" maxLength={60} />
      </Field>
      <Field label="Email used for the reservation">
        <input type="email" name="email" required />
      </Field>
      <Field
        label="Private guest access key"
        hint="Shown once when the reservation was created. Keep it private."
      >
        <input name="access_token" required minLength={32} maxLength={128} autoComplete="off" />
      </Field>
      <Message error={state.error} />
      <Submit busy={state.busy}>Find my reservation</Submit>
    </form>
  );
}
export function ProfileForm({ user }: { user: User }) {
  const state = useAction();
  const router = useRouter();
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const v = formValues(e);
        state.run(async () => {
          await api('profile', v);
          router.refresh();
        });
      }}
    >
      <Field label="Full name">
        <input name="name" defaultValue={user.name} required minLength={2} maxLength={120} />
      </Field>
      <Field label="Email address">
        <input value={user.email} disabled />
        <small>For account security, email changes require agency support.</small>
      </Field>
      <Field label="Phone">
        <input name="phone" type="tel" defaultValue={user.phone} maxLength={30} />
      </Field>
      <Field label="Address (optional)">
        <textarea name="address" defaultValue={user.address} maxLength={500} />
      </Field>
      <Message error={state.error} success={state.success} />
      <Submit busy={state.busy} />
    </form>
  );
}
