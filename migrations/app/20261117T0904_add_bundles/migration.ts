#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/816aba2a0a05ed95e7f92ffe1f4985371eb35df343c42ffd7c218b4533c717d9/contract';
import endContract from '../../snapshots/816aba2a0a05ed95e7f92ffe1f4985371eb35df343c42ffd7c218b4533c717d9/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8a0b0b891be08cd97981339b4303ce1fae155468bf2595390f82511dc1e91bd9/contract';
import startContract from '../../snapshots/8a0b0b891be08cd97981339b4303ce1fae155468bf2595390f82511dc1e91bd9/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'bundle',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('imageUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('price', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('bundle_price_non_negative_faabb23d', 'price >= 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'bundleItem',
        columns: [
          col('bundleId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('quantity', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('bundle_item_quantity_positive_4402679f', 'quantity > 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'orderBundle',
        columns: [
          col('bundleId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('orderId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('priceAtOrder', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('quantity', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('subtotal', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'orderItem',
        column: col('orderBundleId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'bundleItem',
        constraint: 'bundleItem_bundleId_productId_key',
        columns: ['bundleId', 'productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bundle',
        index: 'bundle_isActive_idx_77fe3ba1',
        columns: ['isActive'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bundleItem',
        index: 'bundleItem_bundleId_idx_ca20b7d2',
        columns: ['bundleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bundleItem',
        index: 'bundleItem_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orderBundle',
        index: 'orderBundle_bundleId_idx_ca20b7d2',
        columns: ['bundleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orderBundle',
        index: 'orderBundle_orderId_idx_d284871b',
        columns: ['orderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orderItem',
        index: 'orderItem_orderBundleId_idx_f85f2d99',
        columns: ['orderBundleId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bundleItem',
        foreignKey: {
          name: 'bundleItem_bundleId_fkey',
          columns: ['bundleId'],
          references: { schema: 'public', table: 'bundle', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bundleItem',
        foreignKey: {
          name: 'bundleItem_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'product', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'orderBundle',
        foreignKey: {
          name: 'orderBundle_orderId_fkey',
          columns: ['orderId'],
          references: { schema: 'public', table: 'order', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'orderBundle',
        foreignKey: {
          name: 'orderBundle_bundleId_fkey',
          columns: ['bundleId'],
          references: { schema: 'public', table: 'bundle', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'orderItem',
        foreignKey: {
          name: 'orderItem_orderBundleId_fkey',
          columns: ['orderBundleId'],
          references: { schema: 'public', table: 'orderBundle', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
