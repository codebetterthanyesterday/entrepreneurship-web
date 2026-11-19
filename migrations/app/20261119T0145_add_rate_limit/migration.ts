#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4e5c776254ae065fe1d3dfa8eaccf6be792d93ddd754bb2f92e1a61b30454fc2/contract';
import endContract from '../../snapshots/4e5c776254ae065fe1d3dfa8eaccf6be792d93ddd754bb2f92e1a61b30454fc2/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e48754ecd891730f8133d637ee75515bf9b6a9017b5c83a22868fc31925a5afc/contract';
import startContract from '../../snapshots/e48754ecd891730f8133d637ee75515bf9b6a9017b5c83a22868fc31925a5afc/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'rateLimit',
        columns: [
          col('count', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('windowStart', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['key'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
