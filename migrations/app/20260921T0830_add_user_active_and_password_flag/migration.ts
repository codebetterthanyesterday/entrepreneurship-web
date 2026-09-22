#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/40f8bba6ee2a9ff06cfabcc921a2d30fc0f72eb343f74597c53fd668d602c732/contract';
import endContract from '../../snapshots/40f8bba6ee2a9ff06cfabcc921a2d30fc0f72eb343f74597c53fd668d602c732/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9f4bc8a2f2b784d3defb272ce2341adc442f0f2d094ba90dfc9c762022a73d7b/contract';
import startContract from '../../snapshots/9f4bc8a2f2b784d3defb272ce2341adc442f0f2d094ba90dfc9c762022a73d7b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('isActive', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('mustChangePassword', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
