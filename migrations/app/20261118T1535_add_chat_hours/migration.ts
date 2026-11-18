#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/01ca04f9fbab679444d309d8fec8b9bc39a0b8962a1e8dfff59c5f13170a687a/contract';
import startContract from '../../snapshots/01ca04f9fbab679444d309d8fec8b9bc39a0b8962a1e8dfff59c5f13170a687a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/cc0da9368a576129a29db0e62d43e5f658a7ea6f66c89b6c8d1250c8a0ddf296/contract';
import endContract from '../../snapshots/cc0da9368a576129a29db0e62d43e5f658a7ea6f66c89b6c8d1250c8a0ddf296/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'storeSetting',
        column: col('chatCloseMinute', 'int4', {
          notNull: true,
          default: lit(1260),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'storeSetting',
        column: col('chatOpenMinute', 'int4', {
          notNull: true,
          default: lit(480),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
