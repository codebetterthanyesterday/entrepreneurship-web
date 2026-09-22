import { Temporal, Intl as TemporalIntl, toTemporalInstant } from '@js-temporal/polyfill';

// The polyfill's `Intl` only carries DateTimeFormat. Assigning it to the global
// wholesale would wipe out Intl.NumberFormat and break currency formatting, and
// the native Intl's own properties are read-only — so the global gets a new
// object that shadows DateTimeFormat and inherits everything else.
const PatchedIntl = Object.create(globalThis.Intl) as typeof globalThis.Intl;
for (const [key, value] of Object.entries(TemporalIntl)) {
  // defineProperty, not assignment: the inherited native property is read-only.
  Object.defineProperty(PatchedIntl, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}
Object.assign(globalThis, { Temporal, toTemporalInstant, Intl: PatchedIntl });
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../../prisma/schema.d';
import contractJson from '../../prisma/schema.json' with { type: 'json' };

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof postgres<Contract>> | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  postgres<Contract>({
    contractJson,
    url: process.env.DATABASE_URL!,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
