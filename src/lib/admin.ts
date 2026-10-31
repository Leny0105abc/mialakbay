import { z } from 'zod';
import type { DB } from './db';
import type { User } from './types';
import { AppError, staff, audit, hashPassword } from './security';
import { notify } from './booking';
export const imageSchema = z
  .string()
  .max(2048)
  .refine(
    (v) => v.startsWith('/api/assets/') || /^https:\/\/images\.unsplash\.com\//.test(v),
    'Use an uploaded image or an images.unsplash.com URL.',
  );
const packageSchema = z
  .object({
    id: z.string().optional(),
    destination_id: z.string().min(1),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(150),
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(20).max(10000),
    category: z.string().min(2).max(80),
    duration: z.coerce.number().int().min(1).max(90),
    min_participants: z.coerce.number().int().min(1),
    max_participants: z.coerce.number().int().min(1).max(100),
    meeting_point: z.string().min(2).max(1000),
    transportation: z.string().min(2).max(2000),
    accommodation: z.string().min(2).max(2000),
    meals: z.string().min(2).max(2000),
    guide: z.string().min(2).max(1000),
    inclusions: z.array(z.string().max(300)).min(1).max(30),
    exclusions: z.array(z.string().max(300)).max(30),
    policies: z.string().min(10).max(5000),
    notes: z.string().max(3000),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
    featured: z.boolean(),
    demo: z.boolean(),
    adult_price: z.coerce.number().int().positive().max(1000000000),
    child_price: z.coerce.number().int().min(0).max(1000000000),
    deposit_percent: z.coerce.number().int().min(1).max(100),
    images: z.array(imageSchema).min(1).max(12),
  })
  .refine((v) => v.max_participants >= v.min_participants, {
    message: 'Maximum participants must be at least the minimum.',
  });
export async function savePackage(db: DB, raw: unknown, user: User | null) {
  staff(user);
  const p = packageSchema.parse(raw);
  return db.transaction(async (tx) => {
    let id = p.id;
    if (p.status === 'PUBLISHED') {
      const days = id
        ? (
            await tx.query<{ day: number; count: number }>(
              'SELECT d.day,(SELECT count(*) FROM itinerary_activities a WHERE a.day_id=d.id) count FROM itinerary_days d WHERE package_id=$1 ORDER BY day',
              [id],
            )
          ).rows
        : [];
      if (days.length !== p.duration || days.some((d, i) => d.day !== i + 1 || d.count === 0))
        throw new AppError(
          'Save a draft first, then configure a complete itinerary before publishing.',
        );
    }
    const params = [
      p.destination_id,
      p.slug,
      p.title,
      p.description,
      p.category,
      p.duration,
      p.min_participants,
      p.max_participants,
      p.meeting_point,
      p.transportation,
      p.accommodation,
      p.meals,
      p.guide,
      JSON.stringify(p.inclusions),
      JSON.stringify(p.exclusions),
      p.policies,
      p.notes,
      p.status,
      p.featured,
      p.demo,
    ];
    if (id) {
      const result = await tx.query(
        'UPDATE packages SET destination_id=$1,slug=$2,title=$3,description=$4,category=$5,duration=$6,min_participants=$7,max_participants=$8,meeting_point=$9,transportation=$10,accommodation=$11,meals=$12,guide=$13,inclusions=$14,exclusions=$15,policies=$16,notes=$17,status=$18,featured=$19,demo=$20,updated_at=now() WHERE id=$21',
        [...params, id],
      );
      if (!result.affectedRows) throw new AppError('Package not found.', 404);
    } else
      id = (
        await tx.insertSQL<{ id: string }>(
          `INSERT INTO packages(destination_id,slug,title,description,category,duration,min_participants,max_participants,meeting_point,transportation,accommodation,meals,guide,inclusions,exclusions,policies,notes,status,featured,demo) VALUES(${params.map((_, i) => '$' + (i + 1)).join(',')})`,
          params,
        )
      ).rows[0].id;
    await tx.query(
      'INSERT INTO package_pricing(package_id,adult_price,child_price,deposit_percent) VALUES($1,$2,$3,$4) ON DUPLICATE KEY UPDATE adult_price=$2,child_price=$3,deposit_percent=$4',
      [id, p.adult_price, p.child_price, p.deposit_percent],
    );
    await tx.query('DELETE FROM package_images WHERE package_id=$1', [id]);
    for (const [position, url] of p.images.entries())
      await tx.query(
        'INSERT INTO package_images(package_id,url,alt,position) VALUES($1,$2,$3,$4)',
        [id, url, p.title, position],
      );
    await audit(tx, user, 'PACKAGE_SAVED', 'package', id!);
    return { id };
  });
}
export async function adminSave(db: DB, section: string, raw: unknown, user: User | null) {
  staff(user);
  return db.transaction(async (tx) => {
    let id = '';
    if (section === 'destinations') {
      const v = z
        .object({
          id: z.string().optional(),
          name: z.string().min(2).max(100),
          country: z.string().min(2).max(100),
          description: z.string().min(10).max(3000),
          image_url: imageSchema,
          featured: z.boolean(),
        })
        .parse(raw);
      id =
        v.id ||
        (
          await tx.insertSQL<{ id: string }>(
            'INSERT INTO destinations(name,country,description,image_url,featured) VALUES($1,$2,$3,$4,$5)',
            [v.name, v.country, v.description, v.image_url, v.featured],
          )
        ).rows[0].id;
      if (v.id)
        await tx.query(
          'UPDATE destinations SET name=$1,country=$2,description=$3,image_url=$4,featured=$5 WHERE id=$6',
          [v.name, v.country, v.description, v.image_url, v.featured, id],
        );
    } else if (section === 'departures') {
      const v = z
        .object({
          id: z.string().optional(),
          package_id: z.string().min(1),
          departure_at: z.iso.datetime({ offset: true }),
          booking_deadline: z.iso.datetime({ offset: true }),
          capacity: z.coerce.number().int().min(1).max(1000),
          price_adjustment: z.coerce.number().int().min(0).max(100000000),
          available: z.boolean(),
        })
        .parse(raw);
      if (new Date(v.departure_at) <= new Date(v.booking_deadline))
        throw new AppError('The booking deadline must be before departure.');
      if (v.id) {
        const old = (
          await tx.query<{ reserved: number; package_id: string; departure_at: string }>(
            'SELECT * FROM departures WHERE id=$1 FOR UPDATE',
            [v.id],
          )
        ).rows[0];
        if (!old) throw new AppError('Departure not found.', 404);
        if (v.capacity < old.reserved)
          throw new AppError('Capacity cannot be lower than the number of reserved seats.');
        const booked = (
          await tx.query('SELECT id FROM bookings WHERE departure_id=$1 LIMIT 1', [v.id])
        ).rows.length;
        if (
          booked &&
          (old.package_id !== v.package_id ||
            new Date(old.departure_at).getTime() !== new Date(v.departure_at).getTime())
        )
          throw new AppError(
            'A departure with bookings cannot change its package or departure time. Create another schedule.',
          );
        await tx.query(
          'UPDATE departures SET package_id=$1,departure_at=$2,booking_deadline=$3,capacity=$4,price_adjustment=$5,available=$6 WHERE id=$7',
          [
            v.package_id,
            v.departure_at,
            v.booking_deadline,
            v.capacity,
            v.price_adjustment,
            v.available,
            v.id,
          ],
        );
        id = v.id;
      } else
        id = (
          await tx.insertSQL<{ id: string }>(
            'INSERT INTO departures(package_id,departure_at,booking_deadline,capacity,price_adjustment,available) VALUES($1,$2,$3,$4,$5,$6)',
            [
              v.package_id,
              v.departure_at,
              v.booking_deadline,
              v.capacity,
              v.price_adjustment,
              v.available,
            ],
          )
        ).rows[0].id;
    } else if (section === 'itineraries') {
      const v = z
        .object({
          package_id: z.string().min(1),
          days: z
            .array(
              z.object({
                day: z.number().int().min(1).max(90),
                title: z.string().min(2).max(200),
                activities: z
                  .array(
                    z.object({
                      time_label: z.string().max(60),
                      title: z.string().min(2).max(200),
                      description: z.string().max(2000),
                      location: z.string().max(200),
                      photo_url: z.union([imageSchema, z.literal(''), z.null()]).optional(),
                      included: z.boolean(),
                    }),
                  )
                  .min(1)
                  .max(30),
              }),
            )
            .min(1)
            .max(90),
        })
        .parse(raw);
      const pkg = (
        await tx.query<{ duration: number }>(
          'SELECT duration FROM packages WHERE id=$1 FOR UPDATE',
          [v.package_id],
        )
      ).rows[0];
      if (!pkg || v.days.length !== pkg.duration || v.days.some((d, i) => d.day !== i + 1))
        throw new AppError(
          'Provide one sequential itinerary day for every day of the package duration.',
        );
      await tx.query('DELETE FROM itinerary_days WHERE package_id=$1', [v.package_id]);
      for (const d of v.days) {
        const day = (
          await tx.insertSQL<{ id: string }>(
            'INSERT INTO itinerary_days(package_id,day,title) VALUES($1,$2,$3)',
            [v.package_id, d.day, d.title],
          )
        ).rows[0];
        for (const [seq, a] of d.activities.entries())
          await tx.query(
            'INSERT INTO itinerary_activities(day_id,sequence,time_label,title,description,location,photo_url,included) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [
              day.id,
              seq,
              a.time_label,
              a.title,
              a.description,
              a.location,
              a.photo_url || null,
              a.included,
            ],
          );
      }
      id = v.package_id;
    } else if (section === 'promotions') {
      const v = z
        .object({
          id: z.string().optional(),
          name: z.string().min(2).max(150),
          code: z.string().regex(/^[A-Z0-9-]{3,40}$/),
          discount_type: z.enum(['PERCENT', 'FIXED']),
          value: z.coerce.number().int().positive().max(100000000),
          starts_at: z.iso.datetime({ offset: true }),
          ends_at: z.iso.datetime({ offset: true }),
          usage_limit: z.coerce.number().int().positive(),
          min_total: z.coerce.number().int().min(0),
          active: z.boolean(),
          package_ids: z.array(z.string()).max(100),
        })
        .parse(raw);
      if (
        new Date(v.ends_at) <= new Date(v.starts_at) ||
        (v.discount_type === 'PERCENT' && v.value > 100)
      )
        throw new AppError('Check promotion dates and discount amount.');
      if (v.id) {
        const p = (
          await tx.query<{ used: number }>('SELECT used FROM promotions WHERE id=$1 FOR UPDATE', [
            v.id,
          ])
        ).rows[0];
        if (!p || v.usage_limit < p.used)
          throw new AppError('The usage limit must cover existing redemptions.');
        await tx.query(
          'UPDATE promotions SET name=$1,code=$2,discount_type=$3,value=$4,starts_at=$5,ends_at=$6,usage_limit=$7,min_total=$8,active=$9 WHERE id=$10',
          [
            v.name,
            v.code,
            v.discount_type,
            v.value,
            v.starts_at,
            v.ends_at,
            v.usage_limit,
            v.min_total,
            v.active,
            v.id,
          ],
        );
        id = v.id;
      } else
        id = (
          await tx.insertSQL<{ id: string }>(
            'INSERT INTO promotions(name,code,discount_type,value,starts_at,ends_at,usage_limit,min_total,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [
              v.name,
              v.code,
              v.discount_type,
              v.value,
              v.starts_at,
              v.ends_at,
              v.usage_limit,
              v.min_total,
              v.active,
            ],
          )
        ).rows[0].id;
      await tx.query('DELETE FROM promotion_packages WHERE promotion_id=$1', [id]);
      for (const p of v.package_ids)
        await tx.query('INSERT INTO promotion_packages(promotion_id,package_id) VALUES($1,$2)', [
          id,
          p,
        ]);
    } else if (section === 'inquiries') {
      const v = z
        .object({
          id: z.string(),
          status: z.enum(['NEW', 'IN_PROGRESS', 'QUOTED', 'CLOSED']),
          amount: z.coerce.number().int().min(0),
          message: z.string().max(5000),
        })
        .parse(raw);
      const inquiry = (
        await tx.query<{ user_id: string | null; email: string }>(
          'SELECT * FROM custom_inquiries WHERE id=$1 FOR UPDATE',
          [v.id],
        )
      ).rows[0];
      if (!inquiry) throw new AppError('Inquiry not found.', 404);
      if (v.status === 'QUOTED' && (v.amount <= 0 || v.message.trim().length < 10))
        throw new AppError('A quotation requires a positive amount and a detailed response.');
      if (v.amount > 0 && v.message.trim().length >= 10)
        await tx.query(
          'INSERT INTO inquiry_quotations(inquiry_id,amount,message,created_by) VALUES($1,$2,$3,$4)',
          [v.id, v.amount, v.message, user.id],
        );
      await tx.query('UPDATE custom_inquiries SET status=$1 WHERE id=$2', [v.status, v.id]);
      await notify(
        tx,
        inquiry.user_id,
        null,
        'Your travel inquiry was updated',
        `Your inquiry is ${v.status.toLowerCase().replaceAll('_', ' ')}. ${v.message}`,
        inquiry.email,
      );
      id = v.id;
    } else if (section === 'reviews') {
      const v = z.object({ id: z.string(), status: z.enum(['APPROVED', 'REJECTED']) }).parse(raw);
      await tx.query('UPDATE reviews SET status=$1 WHERE id=$2', [v.status, v.id]);
      id = v.id;
    } else if (section === 'content') {
      const v = z
        .object({
          key: z.string().regex(/^[a-z0-9-]{2,100}$/),
          title: z.string().min(2).max(200),
          body: z.string().min(10).max(30000),
        })
        .parse(raw);
      await tx.query(
        'INSERT INTO website_content(`key`,title,body) VALUES($1,$2,$3) ON DUPLICATE KEY UPDATE title=$2,body=$3,updated_at=now()',
        [v.key, v.title, v.body],
      );
      id = v.key;
    } else if (section === 'customers') {
      const v = z
        .object({
          id: z.string(),
          name: z.string().min(2).max(120),
          phone: z.string().max(30),
          address: z.string().max(500),
        })
        .parse(raw);
      await tx.query("UPDATE users SET name=$1 WHERE id=$2 AND role='CUSTOMER'", [v.name, v.id]);
      await tx.query(
        'INSERT INTO customer_profiles(user_id,phone,address) VALUES($1,$2,$3) ON DUPLICATE KEY UPDATE phone=$2,address=$3',
        [v.id, v.phone, v.address],
      );
      id = v.id;
    } else if (section === 'settings') {
      if (user.role !== 'SUPER_ADMIN')
        throw new AppError('Only the super administrator can change settings.', 403);
      const url = z.union([
        z.literal(''),
        z.url().refine((v) => v.startsWith('https://'), 'Contact links must use HTTPS.'),
      ]);
      const v = z
        .object({
          brand: z.string().min(2).max(80),
          tagline: z.string().max(100),
          logo_url: imageSchema.optional().or(z.literal('')),
          hero_image: imageSchema.optional().or(z.literal('')),
          email: z.union([z.literal(''), z.email()]),
          phone: z.string().max(40),
          address: z.string().max(500),
          whatsapp: url,
          messenger: url,
          instagram: url,
          facebook: url,
          payment_instructions: z.object({
            GCASH: z.string().min(10).max(2000),
            MAYA: z.string().min(10).max(2000),
            BANK: z.string().min(10).max(2000),
            CASH: z.string().min(10).max(2000),
          }),
        })
        .parse(raw);
      await tx.query(
        "INSERT INTO app_settings(`key`,value) VALUES('business',$1) ON DUPLICATE KEY UPDATE value=$1,updated_at=now()",
        [JSON.stringify(v)],
      );
      id = 'business';
    } else if (section === 'staff') {
      if (user.role !== 'SUPER_ADMIN')
        throw new AppError('Only the super administrator can create staff.', 403);
      const v = z
        .object({
          name: z.string().min(2).max(120),
          email: z.email().transform((v) => v.toLowerCase()),
          password: z.string().min(12).max(128),
        })
        .parse(raw);
      id = (
        await tx.insertSQL<{ id: string }>(
          "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'STAFF')",
          [v.name, v.email, await hashPassword(v.password)],
        )
      ).rows[0].id;
    } else throw new AppError('Unknown management section.', 404);
    await audit(tx, user, 'SAVED', section, id);
    return { id };
  });
}
