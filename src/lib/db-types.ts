import { prisma as db } from "@/lib/prisma";

/**
 * The context `db.transaction(...)` hands its callback. Services accept it so a
 * caller that is already inside a transaction can pass its own context down
 * instead of opening a nested one.
 */
export type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
