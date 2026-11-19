import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { prisma: db } = await import('../src/lib/prisma');
  console.log('Starting seed...');
  await db.connect();

  // 1. StoreSetting
  const setting = await db.orm.public.StoreSetting.where({ id: 1 }).first();
  if (!setting) {
    await db.orm.public.StoreSetting.create({
      id: 1,
      preorderOpen: true,
      boothOpen: true,
      lowStockThreshold: 3,
    });
    console.log('Created default StoreSetting');
  }

  // 2. Categories
  let catMinuman = await db.orm.public.Category.where({ name: 'Minuman' }).first();
  if (!catMinuman) {
    catMinuman = await db.orm.public.Category.create({ name: 'Minuman', sortOrder: 1 });
    console.log('Created Category: Minuman');
  } else {
    await db.orm.public.Category.where({ id: catMinuman.id }).update({ sortOrder: 1 });
  }

  let catMakanan = await db.orm.public.Category.where({ name: 'Makanan' }).first();
  if (!catMakanan) {
    catMakanan = await db.orm.public.Category.create({ name: 'Makanan', sortOrder: 2 });
    console.log('Created Category: Makanan');
  } else {
    await db.orm.public.Category.where({ id: catMakanan.id }).update({ sortOrder: 2 });
  }

  // 3. Users — not here.
  //
  // The crew's accounts live in `prisma/accounts.ts` (`npm run accounts`), which
  // is also what retires the ones that have left. If this file kept creating its
  // own three demo logins, running the seed would quietly bring a retired
  // account back to life. On a fresh database, run both:
  //
  //   npm run seed       # settings and categories
  //   npm run accounts   # the people
  console.log('Users: run `npm run accounts` (kept out of the seed on purpose)');

  // 4. No menu and no paket. The real menu is entered by the admin in
  // Admin → Menu & stok; sample items here would come back next to it every
  // time the seed is run again.

  console.log('Seed completed.');
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
