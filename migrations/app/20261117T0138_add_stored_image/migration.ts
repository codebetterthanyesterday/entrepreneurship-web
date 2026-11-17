#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8a0b0b891be08cd97981339b4303ce1fae155468bf2595390f82511dc1e91bd9/contract';
import endContract from '../../snapshots/8a0b0b891be08cd97981339b4303ce1fae155468bf2595390f82511dc1e91bd9/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fda68e9b77942f2d636305e0efcfc8f0ddbeaad862d45febab3e6e625dac6e1b/contract';
import startContract from '../../snapshots/fda68e9b77942f2d636305e0efcfc8f0ddbeaad862d45febab3e6e625dac6e1b/contract.json' with { type: 'json' };
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
        table: 'storedImage',
        columns: [
          col('byteSize', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('data', 'bytea', { notNull: true, codecRef: { codecId: 'pg/bytea@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('mimeType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'storedImage_kind_check_f11fda7f',
            "\"kind\" IN ('QRIS', 'PAYMENT_PROOF')",
          ),
          checkExpression(
            'stored_image_size_limit_0abf31e1',
            'octet_length(data) BETWEEN 1 AND 3145728',
          ),
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
