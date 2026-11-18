#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/cc0da9368a576129a29db0e62d43e5f658a7ea6f66c89b6c8d1250c8a0ddf296/contract';
import startContract from '../../snapshots/cc0da9368a576129a29db0e62d43e5f658a7ea6f66c89b6c8d1250c8a0ddf296/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e48754ecd891730f8133d637ee75515bf9b6a9017b5c83a22868fc31925a5afc/contract';
import endContract from '../../snapshots/e48754ecd891730f8133d637ee75515bf9b6a9017b5c83a22868fc31925a5afc/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('locationNotifiedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
