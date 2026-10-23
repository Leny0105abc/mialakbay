export const money = (cents: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
export const dayKey = (value: string | Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
export const date = (
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
) =>
  new Intl.DateTimeFormat('en-PH', { ...options, timeZone: 'Asia/Manila' }).format(new Date(value));
export const label = (s: string) =>
  s
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
export const categories = [
  'Beach & Island',
  'Mountain & Nature',
  'Adventure',
  'Cultural & Historical',
  'Family',
  'Group',
  'Educational',
  'Honeymoon',
  'International',
  'Customized',
];
export const statuses = [
  'PENDING_REVIEW',
  'PENDING_PAYMENT',
  'PAYMENT_UNDER_REVIEW',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'REFUND_PENDING',
  'REFUNDED',
];
