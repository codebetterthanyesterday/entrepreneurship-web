import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import bcrypt from 'bcryptjs';

/**
 * The Market Day crew's accounts.
 *
 * Separate from `seed.ts` on purpose. The seed also creates seven demo products
 * and a set of pickup slots, so running it against a real database to get the
 * accounts in would drag that demo catalogue along with them. This script only
 * ever touches the `user` table.
 *
 * Safe to run more than once. It creates what is missing, corrects a name or a
 * role that has drifted, and — importantly — **never touches the password of an
 * account that already exists**. Somebody who has chosen their own password does
 * not lose it because this ran again.
 *
 *   npm run accounts
 */

/** Login e-mails are short because they get typed on a phone at a booth. */
const DOMAIN = 'md.test';

const CREW = [
  { name: 'Fathin', role: 'ADMIN' as const },
  { name: 'Fatihul', role: 'ADMIN' as const },
  { name: 'Komang', role: 'ADMIN' as const },
  { name: 'Keisha', role: 'DAPUR' as const },
  { name: 'Cahya', role: 'DAPUR' as const },
  { name: 'Tegar', role: 'DAPUR' as const },
  { name: 'Nabilah', role: 'DAPUR' as const },
  { name: 'Farel', role: 'KASIR' as const },
];

/**
 * An account that already exists under an older address and belongs to somebody
 * still on the crew. Its row is carried over rather than replaced, so the orders
 * and stock movements already attributed to it stay attached to the same person.
 */
const RENAMED = [{ from: 'admin@ngemildulu.test', toName: 'Fathin' }];

/**
 * Accounts that are leaving. Deleted where nothing references them, retired where
 * something does — a row whose name appears on a past order cannot be removed
 * without either breaking the foreign key or losing who handled it.
 */
const RETIRED = ['kasir@ngemildulu.test', 'dapur@ngemildulu.test'];

function emailFor(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@${DOMAIN}`;
}

async function main() {
  const { prisma: db } = await import('../src/lib/prisma');
  const { initialPasswordFor } = await import('../src/lib/initial-password');

  await db.connect();

  // --- carry over anybody who already has a row under an older address ------
  for (const { from, toName } of RENAMED) {
    const existing = await db.orm.public.User.where({ email: from }).first();
    if (!existing) continue;

    const target = emailFor(toName);
    if (await db.orm.public.User.where({ email: target }).first()) {
      console.log(`! ${from} kept as-is: ${target} already exists separately`);
      continue;
    }

    await db.orm.public.User.where({ id: existing.id }).update({
      email: target,
      name: toName,
      // The old address carried `admin123`, which is no better than the initial
      // password everybody else gets. Reset it and flag it like the rest.
      password: await bcrypt.hash(initialPasswordFor(toName), 10),
      mustChangePassword: true,
      isActive: true,
    });

    console.log(`~ ${from} → ${target} (history kept)`);
  }

  // --- the crew -------------------------------------------------------------
  for (const member of CREW) {
    const email = emailFor(member.name);
    const existing = await db.orm.public.User.where({ email }).first();

    if (!existing) {
      await db.orm.public.User.create({
        email,
        name: member.name,
        role: member.role,
        password: await bcrypt.hash(initialPasswordFor(member.name), 10),
        mustChangePassword: true,
        isActive: true,
      });

      console.log(`+ ${email.padEnd(20)} ${member.role.padEnd(6)} ${initialPasswordFor(member.name)}`);
      continue;
    }

    const drifted =
      existing.name !== member.name || existing.role !== member.role || !existing.isActive;

    if (drifted) {
      // Name, role and active status are corrected; the password is deliberately left
      // exactly as the person set it.
      await db.orm.public.User.where({ id: existing.id }).update({
        name: member.name,
        role: member.role,
        isActive: true,
      });
      console.log(`~ ${email.padEnd(20)} ${member.role.padEnd(6)} updated (password untouched)`);
    } else {
      console.log(`= ${email.padEnd(20)} ${member.role.padEnd(6)} already correct`);
    }
  }

  // --- the ones leaving -----------------------------------------------------
  for (const email of RETIRED) {
    const user = await db.orm.public.User.where({ email }).first();
    if (!user) continue;

    const orders = await db.orm.public.Order.where({ handledById: user.id }).aggregate((a) => ({
      total: a.count(),
    }));
    const movements = await db.orm.public.StockMovement.where({ actorId: user.id }).aggregate(
      (a) => ({ total: a.count() }),
    );

    const referenced = orders.total > 0 || movements.total > 0;

    if (referenced) {
      await db.orm.public.User.where({ id: user.id }).update({ isActive: false });
      console.log(
        `x ${email.padEnd(20)} deactivated — ${orders.total} pesanan, ${movements.total} stok still point at it`,
      );
    } else {
      await db.orm.public.User.where({ id: user.id }).delete();
      console.log(`- ${email.padEnd(20)} deleted — nothing referenced it`);
    }
  }

  // --- what the team ends up with -------------------------------------------
  const all = await db.orm.public.User.orderBy((u) => u.role.asc()).all();
  console.log('\nAkun sekarang:');
  for (const u of all) {
    const flags = [u.isActive ? 'aktif' : 'NONAKTIF', u.mustChangePassword ? 'password awal' : 'password sendiri'];
    console.log(`  ${u.role.padEnd(6)} ${u.name.padEnd(9)} ${u.email.padEnd(24)} ${flags.join(' · ')}`);
  }

  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
