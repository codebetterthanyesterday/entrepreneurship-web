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

  // 3. Pickup Slots
  const slots = [
    { label: '09.00 - 10.00', quota: 20, sortOrder: 1 },
    { label: '10.00 - 11.00', quota: 20, sortOrder: 2 },
    { label: '11.00 - 12.00', quota: 20, sortOrder: 3 },
    { label: '12.00 - 13.00', quota: 20, sortOrder: 4 },
  ];

  for (const s of slots) {
    const slot = await db.orm.public.PickupSlot.where({ label: s.label }).first();
    if (!slot) {
      await db.orm.public.PickupSlot.create(s);
      console.log(`Created PickupSlot: ${s.label}`);
    } else {
      await db.orm.public.PickupSlot.where({ id: slot.id }).update({ quota: s.quota, sortOrder: s.sortOrder });
    }
  }

  // 4. Users — not here.
  //
  // The crew's accounts live in `prisma/accounts.ts` (`npm run accounts`), which
  // is also what retires the ones that have left. If this file kept creating its
  // own three demo logins, running the seed would quietly bring a retired
  // account back to life. On a fresh database, run both:
  //
  //   npm run seed       # catalogue, categories, pickup slots
  //   npm run accounts   # the people
  console.log('Users: run `npm run accounts` (kept out of the seed on purpose)');

  // 5 & 6. Products & StockMovements
  const products = [
    { name: 'Strawberry Matcha Latte', price: 22000, stock: 12, prepType: 'NEEDS_PREP' as const, categoryId: catMinuman.id },
    { name: 'Es Kopi Susu Gula Aren', price: 18000, stock: 20, prepType: 'NEEDS_PREP' as const, categoryId: catMinuman.id },
    { name: 'Lemonade Butterfly Pea', price: 19000, stock: 10, prepType: 'NEEDS_PREP' as const, categoryId: catMinuman.id },
    { name: 'Croffle Butter Sugar', price: 20000, stock: 3, prepType: 'NEEDS_PREP' as const, categoryId: catMakanan.id },
    { name: 'Dubai Chocolate Bar', price: 35000, stock: 8, prepType: 'READY_TO_SERVE' as const, categoryId: catMakanan.id },
    { name: 'Cookies Lumer Cokelat', price: 15000, stock: 0, prepType: 'READY_TO_SERVE' as const, categoryId: catMakanan.id },
    { name: 'Puding Susu Cup', price: 12000, stock: 16, prepType: 'READY_TO_SERVE' as const, categoryId: catMakanan.id },
  ];

  for (const p of products) {
    let product = await db.orm.public.Product.where({ name: p.name }).first();
    if (!product) {
      product = await db.orm.public.Product.create(p);
      console.log(`Created Product: ${p.name}`);

      if (p.stock > 0) {
        // Initial Stock Movement
        await db.orm.public.StockMovement.create({
          productId: product.id,
          quantity: p.stock,
          reason: 'INITIAL_STOCK',
        });
      }
    } else {
      await db.orm.public.Product.where({ id: product.id }).update({
        price: p.price,
        prepType: p.prepType,
        categoryId: p.categoryId,
        // we don't forcefully update stock here to avoid overwriting real data later on
      });
    }
  }

  // 5. Company profile — starting "keunggulan".
  //
  // Only the lists are seeded. Text blocks fall back to the defaults in
  // src/lib/site-content.ts, so they need no rows at all, while an empty list
  // has to stay a state the admin can reach — which is why this only fills it
  // when it has never been filled, and never re-adds items that were deleted.
  const advantages = await db.orm.public.SiteListItem.where({
    section: 'advantage',
  }).all();

  if (advantages.length === 0) {
    const starters = [
      {
        icon: 'leaf',
        title: 'Selalu fresh',
        body: 'Dibikin pagi hari, jadi pas kamu ambil masih enak.',
      },
      {
        icon: 'tag',
        title: 'Harga pelajar',
        body: 'Dihitung supaya masih masuk buat uang jajan.',
      },
      {
        icon: 'clock',
        title: 'Bisa preorder',
        body: 'Pesan dari rumah, tinggal ambil tanpa ngantre.',
      },
      {
        icon: 'pin',
        title: 'Ambil di booth',
        body: 'Tunjukin nomor pesanan, langsung dibungkus.',
      },
    ];

    for (const [index, starter] of starters.entries()) {
      await db.orm.public.SiteListItem.create({
        section: 'advantage',
        icon: starter.icon,
        title: starter.title,
        body: starter.body,
        sortOrder: index + 1,
      });
    }

    console.log(`Created ${starters.length} starting advantages`);
  }

  console.log('Seed completed.');
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
