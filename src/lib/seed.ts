import type { DB } from './db';
import { defaultSettings } from './data';
const photos = {
  palawan: 'photo-1518509562904-e7ef99cdcc86',
  boracay: 'photo-1500375592092-40eb2168fd21',
  baguio: 'photo-1441974231531-c6227db76b6e',
  ilocos: 'photo-1533105079780-92b9be482077',
  cebu: 'photo-1518548419970-58e3b4079ab2',
  siargao: 'photo-1502680390469-be75c86b636f',
  singapore: 'photo-1525625293386-3f8f99389edd',
  hongkong: 'photo-1506970845246-18f21d533b20',
};
export const imageUrl = (key: keyof typeof photos) =>
  `https://images.unsplash.com/${photos[key]}?auto=format&fit=crop&w=1400&q=85`;
const seeds = [
  {
    key: 'palawan',
    destination: 'El Nido, Palawan',
    title: 'Palawan Island Adventure',
    category: 'Beach & Island',
    days: 4,
    price: 899000,
    child: 699000,
    desc: 'Find your own little paradise between limestone cliffs and impossibly blue lagoons. Slow island mornings, hidden beaches, and a little adventure in El Nido.',
    highlights: [
      'Shared island hopping tour',
      'Three nights in a boutique hotel',
      'Daily breakfast',
      'Local guide and boat transfers',
    ],
  },
  {
    key: 'boracay',
    destination: 'Boracay Island',
    title: 'Boracay Island Getaway',
    category: 'Beach & Island',
    days: 3,
    price: 649000,
    child: 449000,
    desc: 'Barefoot days and golden-hour skies. Settle into island life on White Beach, sail into the sunset, and leave room for doing absolutely nothing.',
    highlights: [
      'Two nights in a beachside hotel',
      'Airport and boat transfers',
      'Daily breakfast',
      'Shared sunset sailing',
    ],
  },
  {
    key: 'baguio',
    destination: 'Baguio City',
    title: 'Baguio Weekend Escape',
    category: 'Mountain & Nature',
    days: 3,
    price: 399000,
    child: 299000,
    desc: 'Trade the city rush for cool mountain air, pine-lined paths, local coffee, and creative corners in the City of Pines.',
    highlights: [
      'Round-trip shared land transfers',
      'Two nights hotel accommodation',
      'Guided city sightseeing',
      'Daily breakfast',
    ],
  },
  {
    key: 'ilocos',
    destination: 'Vigan & Laoag',
    title: 'Ilocos Heritage Tour',
    category: 'Cultural & Historical',
    days: 3,
    price: 499000,
    child: 349000,
    desc: 'Follow cobblestone streets, coastal roads, and the stories of the north. A thoughtfully paced journey through Ilocos heritage and food.',
    highlights: [
      'Two nights hotel accommodation',
      'Shared van transfers',
      'Heritage walking tour',
      'Local guide',
    ],
  },
  {
    key: 'cebu',
    destination: 'Cebu & Bohol',
    title: 'Cebu and Bohol Experience',
    category: 'Family',
    days: 5,
    price: 1299000,
    child: 999000,
    desc: 'A little history, a little island time, and plenty of wonder. Discover Cebu and Bohol with space for the whole family to explore.',
    highlights: [
      'Four nights hotel accommodation',
      'Inter-island ferry tickets',
      'Countryside sightseeing',
      'Daily breakfast',
    ],
  },
  {
    key: 'siargao',
    destination: 'Siargao Island',
    title: 'Siargao Island Adventure',
    category: 'Adventure',
    days: 4,
    price: 999000,
    child: 749000,
    desc: 'Palm-lined roads, tidal pools, and laid-back island days. Explore the beautiful corners of Siargao at a pace that feels like you.',
    highlights: [
      'Three nights guesthouse accommodation',
      'Shared island tour',
      'Land transfers',
      'Local guide',
    ],
  },
  {
    key: 'singapore',
    destination: 'Singapore',
    title: 'Singapore City Tour',
    category: 'International',
    days: 4,
    price: 2499000,
    child: 1999000,
    desc: 'Gardens in the sky, colorful neighborhoods, and a new favorite dish around every corner. Experience a city that is always a little surprising.',
    highlights: [
      'Three nights hotel accommodation',
      'Airport transfers',
      'Guided city tour',
      'Daily breakfast',
    ],
  },
  {
    key: 'hongkong',
    destination: 'Hong Kong',
    title: 'Hong Kong Family Tour',
    category: 'International',
    days: 4,
    price: 2299000,
    child: 1799000,
    desc: 'Harbor views, lively markets, and family discoveries. Make room for everyday adventures in one of Asia’s most energetic cities.',
    highlights: [
      'Three nights hotel accommodation',
      'Airport transfers',
      'Harbor sightseeing',
      'Daily breakfast',
    ],
  },
] as const;
export async function seed(db: DB) {
  if ((await db.query('SELECT id FROM packages LIMIT 1')).rows.length) return;
  await db.transaction(async (tx) => {
    for (const item of seeds) {
      const destination = (
        await tx.insertSQL<{ id: string }>(
          'INSERT INTO destinations(name,country,description,image_url,featured) VALUES($1,$2,$3,$4,true)',
          [
            item.destination,
            item.category === 'International' ? item.destination : 'Philippines',
            item.desc,
            imageUrl(item.key),
          ],
        )
      ).rows[0];
      const pkg = (
        await tx.insertSQL<{ id: string }>(
          "INSERT INTO packages(destination_id,slug,title,description,category,duration,min_participants,max_participants,meeting_point,transportation,accommodation,meals,guide,inclusions,exclusions,policies,notes,status,featured,demo) VALUES($1,$2,$3,$4,$5,$6,1,20,$7,$8,$9,$10,$11,$12,$13,$14,$15,'PUBLISHED',$16,true)",
          [
            destination.id,
            item.title.toLowerCase().replaceAll(' ', '-'),
            item.title,
            item.desc,
            item.category,
            item.days,
            `Arrival terminal in ${item.destination}; exact meeting details arranged by staff.`,
            item.category === 'International'
              ? 'Shared local transfers; international flights excluded.'
              : 'Shared local transfers as listed in the itinerary.',
            'Sample standard twin-share accommodation, subject to staff confirmation.',
            'Breakfast only unless listed.',
            'Local guide during scheduled sightseeing.',
            JSON.stringify(item.highlights),
            JSON.stringify([
              'Flights unless explicitly quoted',
              'Travel insurance',
              'Personal expenses',
              'Optional activities and meals not listed',
            ]),
            'Demonstration policy: 30% deposit after agency review; remaining balance before departure. Cancellation and refund requests require staff review. Actual agency terms must be configured before accepting live bookings.',
            'Fictional demonstration package. Prices, accommodations and departures are for application testing only.',
            item.key === 'palawan' || item.key === 'boracay' || item.key === 'siargao',
          ],
        )
      ).rows[0];
      await tx.query(
        'INSERT INTO package_pricing(package_id,adult_price,child_price) VALUES($1,$2,$3)',
        [pkg.id, item.price, item.child],
      );
      await tx.query('INSERT INTO package_images(package_id,url,alt) VALUES($1,$2,$3)', [
        pkg.id,
        imageUrl(item.key),
        `${item.destination} — illustrative travel photography`,
      ]);
      await tx.query('INSERT INTO package_images(package_id,url,alt,position) VALUES($1,$2,$3,1)', [
        pkg.id,
        imageUrl(item.key === 'palawan' ? 'boracay' : 'palawan'),
        'Illustrative island scenery; not a guaranteed itinerary location',
      ]);
      for (let d = 1; d <= item.days; d++) {
        const title =
          d === 1
            ? 'Arrive & settle in'
            : d === item.days
              ? 'One last slow morning'
              : d === 2
                ? 'Explore the highlights'
                : 'Make the day your own';
        const day = (
          await tx.insertSQL<{ id: string }>(
            'INSERT INTO itinerary_days(package_id,day,title) VALUES($1,$2,$3)',
            [pkg.id, d, title],
          )
        ).rows[0];
        await tx.query(
          'INSERT INTO itinerary_activities(day_id,time_label,title,description,location,included) VALUES($1,$2,$3,$4,$5,true)',
          [
            day.id,
            d === 1 ? '14:00' : d === item.days ? '11:00' : '08:00 – 16:00',
            title,
            d === 1
              ? 'Meet the local coordinator, transfer to your accommodation, and enjoy time to settle in.'
              : d === item.days
                ? 'Breakfast, check-out, and your scheduled departure transfer.'
                : 'Breakfast followed by shared sightseeing with a local guide. Final route depends on weather and operational conditions.',
            item.destination,
          ],
        );
        if (d === 3 && item.days > 3)
          await tx.query(
            "INSERT INTO itinerary_activities(day_id,sequence,time_label,title,description,included) VALUES($1,1,'Afternoon','Optional local experience','Ask staff for available activities and a separate quotation. Not included in the package.',false)",
            [day.id],
          );
      }
      for (const offset of [14, 28, 42, 56, 70]) {
        const start = new Date();
        start.setUTCDate(start.getUTCDate() + offset);
        start.setUTCHours(0, 0, 0, 0);
        const deadline = new Date(start.getTime() - 72 * 3600000);
        await tx.query(
          'INSERT INTO departures(package_id,departure_at,booking_deadline,capacity) VALUES($1,$2,$3,20)',
          [pkg.id, start.toISOString(), deadline.toISOString()],
        );
      }
    }
    const start = new Date();
    const end = new Date(start.getTime() + 180 * 86400000);
    await tx.query(
      "INSERT INTO promotions(name,code,discount_type,value,starts_at,ends_at,usage_limit,min_total) VALUES('A little more adventure','LAKBAY10','PERCENT',10,$1,$2,100,500000)",
      [start.toISOString(), end.toISOString()],
    );
    await tx.query("INSERT INTO app_settings(`key`,value) VALUES('business',$1)", [
      JSON.stringify(defaultSettings),
    ]);
    const content = [
      [
        'about',
        'Every great trip starts with a little curiosity.',
        'Lakbay Travel & Tours is a demonstration travel management application built around thoughtful itineraries, clear pricing, and a personal approach. Replace this introduction with your agency’s story before launch. No accreditation or operating history is claimed.',
      ],
      [
        'privacy',
        'Your privacy matters',
        'Demonstration privacy notice. We collect contact information and traveler names to manage reservations, payment references for manual verification, and account details for access. Configure your legal business identity, retention periods, lawful processing grounds, service providers, rights contact, and applicable policy before accepting live customer data.',
      ],
      [
        'terms',
        'Booking terms',
        'Demonstration booking terms. Submitting a reservation holds capacity for 48 hours; it does not confirm a trip. Staff must verify the required deposit. Package inclusions, original prices, and itinerary are preserved with the reservation. Weather and operational changes require agency coordination. Replace these sample terms with your approved booking terms.',
      ],
      [
        'cancellation',
        'Cancellation & refunds',
        'Demonstration policy. Request a cancellation from your booking page. Unpaid reservations may be cancelled and their seats released. Reservations with recorded payments require staff review. A refund status records an offline refund only after staff enters a transfer reference; the application does not move money. Configure actual fees, deadlines, and refund timelines before launch.',
      ],
      [
        'faq',
        'A few things you might be wondering',
        'How do I confirm a booking?|Choose a package and date, enter your travelers, and submit a reservation. Your booking is confirmed only after staff verifies the required deposit.\nAre flights included?|Only if the package specifically lists flights as an inclusion. Otherwise request a separate quotation.\nCan you arrange a custom trip?|Absolutely. Use the custom tour form to share dates, interests, group size, and budget. Staff can prepare a quotation.\nWhat happens if the weather changes?|Staff will coordinate changes according to the package policy. Safety and local operating conditions may affect activities.\nAre these real departure dates?|This installation starts with fictional demonstration packages and dates for testing. The agency must replace and approve them before live sales.',
      ],
      [
        'blog-packing',
        'Pack a little lighter. Travel a little further.',
        'Start with your itinerary and the season. Pack comfortable walking shoes, sun protection, a reusable water bottle, a small first-aid kit, and copies of important documents. Check baggage allowances directly with your transport provider. Keep valuables and essential medication in your hand luggage.',
      ],
      [
        'blog-islands',
        'A slower guide to island days',
        'Leave breathing room in your plans. Choose locally run experiences where possible, follow your guide’s instructions, respect protected areas, and take your rubbish with you. Weather can change quickly, so keep a flexible day in your itinerary.',
      ],
      [
        'home',
        'Discover Your Next Adventure.',
        'Extraordinary places. Meaningful moments. Thoughtfully planned journeys across the Philippines and beyond.',
      ],
    ];
    for (const [key, title, body] of content)
      await tx.query('INSERT INTO website_content(`key`,title,body) VALUES($1,$2,$3)', [
        key,
        title,
        body,
      ]);
  });
}
