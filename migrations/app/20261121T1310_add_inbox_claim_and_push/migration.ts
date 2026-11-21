#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4841e92899260c39310a5a7bae6aca5bfacbeeabdcba56dde70ba74391d76a19/contract';
import startContract from '../../snapshots/4841e92899260c39310a5a7bae6aca5bfacbeeabdcba56dde70ba74391d76a19/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ebafa8a09a06d3e08d2061d70f167c6f5126577514854834f3dd197a4fd7ec4f/contract';
import endContract from '../../snapshots/ebafa8a09a06d3e08d2061d70f167c6f5126577514854834f3dd197a4fd7ec4f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'inboxClaim',
        columns: [
          col('claimedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('itemKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['itemKey'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'pushSubscription',
        columns: [
          col('auth', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('endpoint', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('p256dh', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'pushSubscription',
        constraint: 'pushSubscription_endpoint_key',
        columns: ['endpoint'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inboxClaim',
        index: 'inboxClaim_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'pushSubscription',
        index: 'pushSubscription_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inboxClaim',
        foreignKey: {
          name: 'inboxClaim_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'pushSubscription',
        foreignKey: {
          name: 'pushSubscription_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
