#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/fda68e9b77942f2d636305e0efcfc8f0ddbeaad862d45febab3e6e625dac6e1b/contract';
import endContract from '../../snapshots/fda68e9b77942f2d636305e0efcfc8f0ddbeaad862d45febab3e6e625dac6e1b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ff967b24ec21753de250bf25465bc1677cffd2fbbc3327859c321abb53cdc575/contract';
import startContract from '../../snapshots/ff967b24ec21753de250bf25465bc1677cffd2fbbc3327859c321abb53cdc575/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'externalCharge',
        columns: [
          col('amount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('externalId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('orderId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paidAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('voidedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('externalCharge_source_check_2aad0134', '"source" IN (\'PHOTOBOOTH\')'),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'externalCharge',
        constraint: 'externalCharge_externalId_key',
        columns: ['externalId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'externalCharge',
        index: 'externalCharge_orderId_idx_d284871b',
        columns: ['orderId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'externalCharge',
        foreignKey: {
          name: 'externalCharge_orderId_fkey',
          columns: ['orderId'],
          references: { schema: 'public', table: 'order', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
