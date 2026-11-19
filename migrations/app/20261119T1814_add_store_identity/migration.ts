#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/bc55a22041ca999ebbd127cec65345dcae12fc4223a65e03254c6bca6645131f/contract';
import endContract from '../../snapshots/bc55a22041ca999ebbd127cec65345dcae12fc4223a65e03254c6bca6645131f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ecca80cd6e4633f781d3e09cb0f555825ed7b69da19c9beafda48db8bfd5f166/contract';
import startContract from '../../snapshots/ecca80cd6e4633f781d3e09cb0f555825ed7b69da19c9beafda48db8bfd5f166/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'storeSetting',
        column: col('brandName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'storeSetting',
        column: col('instagram', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'storeSetting',
        column: col('tagline', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
