#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0457b81c730e6f5e20904bb74e9110340be84611bc8eab86d1bb1a668fd006ce/contract';
import endContract from '../../snapshots/0457b81c730e6f5e20904bb74e9110340be84611bc8eab86d1bb1a668fd006ce/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/4e5c776254ae065fe1d3dfa8eaccf6be792d93ddd754bb2f92e1a61b30454fc2/contract';
import startContract from '../../snapshots/4e5c776254ae065fe1d3dfa8eaccf6be792d93ddd754bb2f92e1a61b30454fc2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'storedImage',
        constraint: 'storedImage_kind_check_f11fda7f',
      }),
      this.createTable({
        schema: 'public',
        table: 'productImage',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('imageId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sortOrder', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'productImage',
        constraint: 'productImage_imageId_key',
        columns: ['imageId'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'storedImage',
        constraint: 'storedImage_kind_check_c23614b6',
        expression: "\"kind\" IN ('QRIS', 'PAYMENT_PROOF', 'PRODUCT')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'productImage',
        index: 'productImage_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'productImage',
        foreignKey: {
          name: 'productImage_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'product', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'productImage',
        foreignKey: {
          name: 'productImage_imageId_fkey',
          columns: ['imageId'],
          references: { schema: 'public', table: 'storedImage', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
