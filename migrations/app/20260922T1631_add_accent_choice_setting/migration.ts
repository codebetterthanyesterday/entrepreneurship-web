#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/40f8bba6ee2a9ff06cfabcc921a2d30fc0f72eb343f74597c53fd668d602c732/contract';
import startContract from '../../snapshots/40f8bba6ee2a9ff06cfabcc921a2d30fc0f72eb343f74597c53fd668d602c732/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ff967b24ec21753de250bf25465bc1677cffd2fbbc3327859c321abb53cdc575/contract';
import endContract from '../../snapshots/ff967b24ec21753de250bf25465bc1677cffd2fbbc3327859c321abb53cdc575/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'storeSetting',
        column: col('accentChoiceEnabled', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
