export type Role = 'SUPER_ADMIN' | 'STAFF' | 'CUSTOMER';
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  address?: string;
};
export type Tour = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  duration: number;
  destination_id: string;
  destination: string;
  country: string;
  image_url: string;
  adult_price: number;
  child_price: number;
  deposit_percent: number;
  min_participants: number;
  max_participants: number;
  meeting_point: string;
  transportation: string;
  accommodation: string;
  meals: string;
  guide: string;
  inclusions: string[];
  exclusions: string[];
  policies: string;
  notes: string;
  status: string;
  featured: boolean;
  popularity: number;
  demo: boolean;
};
export type Departure = {
  id: string;
  package_id: string;
  departure_at: string;
  booking_deadline: string;
  capacity: number;
  reserved: number;
  price_adjustment: number;
  available: boolean;
  title?: string;
  slug?: string;
};
export type Day = {
  id: string;
  day: number;
  title: string;
  activities: {
    id: string;
    time_label: string;
    title: string;
    description: string;
    location: string;
    photo_url?: string;
    included: boolean;
  }[];
};
export type BookingStatus =
  | 'PENDING_REVIEW'
  | 'PENDING_PAYMENT'
  | 'PAYMENT_UNDER_REVIEW'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED';
export type Booking = {
  id: string;
  reference: string;
  user_id: string | null;
  departure_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  adults: number;
  children: number;
  subtotal: number;
  discount: number;
  total: number;
  deposit_due: number;
  payment_method: string;
  status: BookingStatus;
  snapshot: {
    title: string;
    destination: string;
    departure_at: string;
    duration: number;
    image_url: string;
    meeting_point: string;
    policies: string;
    inclusions: string[];
    itinerary: Day[];
    adult_price: number;
    child_price: number;
  };
  created_at: string;
  expires_at: string | null;
  cancellation_reason: string | null;
  seats_released: boolean;
  guest_token_hash: string;
  paid: number;
};
export type PaymentSubmission = {
  id: string;
  booking_id: string;
  amount: number;
  method: string;
  reference: string;
  status: string;
  review_note: string | null;
  created_at: string;
  booking_reference?: string;
  contact_name?: string;
};
export type Inquiry = {
  id: string;
  name: string;
  email: string;
  phone: string;
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  budget: number;
  accommodation: string;
  interests: string;
  requests: string;
  status: string;
  created_at: string;
};
export type Promotion = {
  id: string;
  name: string;
  code: string;
  discount_type: 'PERCENT' | 'FIXED';
  value: number;
  starts_at: string;
  ends_at: string;
  usage_limit: number;
  used: number;
  min_total: number;
  active: boolean;
  package_ids?: string[];
};
export type Settings = {
  brand: string;
  tagline: string;
  logo_url?: string;
  hero_image?: string;
  email: string;
  phone: string;
  address: string;
  whatsapp: string;
  messenger: string;
  instagram: string;
  facebook: string;
  payment_instructions: Record<string, string>;
};
