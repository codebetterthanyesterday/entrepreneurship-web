import type { Models } from "../../prisma/schema";

/**
 * Domain unions read straight off the emitted contract, so a change in
 * `prisma/schema.prisma` shows up here as a type error rather than as a
 * hand-written union quietly drifting out of date.
 */
export type OrderChannel = Models.public_Order["channel"];
export type OrderStatus = Models.public_Order["status"];
export type PaymentMethod = Models.public_Order["paymentMethod"];
export type PaymentStatus = Models.public_Order["paymentStatus"];
export type UserRole = Models.public_User["role"];
export type StockReason = Models.public_StockMovement["reason"];
export type ProductPrepType = Models.public_Product["prepType"];
