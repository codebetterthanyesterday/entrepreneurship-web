#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0457b81c730e6f5e20904bb74e9110340be84611bc8eab86d1bb1a668fd006ce/contract';
import startContract from '../../snapshots/0457b81c730e6f5e20904bb74e9110340be84611bc8eab86d1bb1a668fd006ce/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ecca80cd6e4633f781d3e09cb0f555825ed7b69da19c9beafda48db8bfd5f166/contract';
import endContract from '../../snapshots/ecca80cd6e4633f781d3e09cb0f555825ed7b69da19c9beafda48db8bfd5f166/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('sessionVersion', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
