#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1c300f32c854e96a5321a6ed039d07ac7666de481d8a899693df542bc2351a23/contract';
import endContract from '../../snapshots/1c300f32c854e96a5321a6ed039d07ac7666de481d8a899693df542bc2351a23/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/698af4923a03130f81799f0ac03b838974895d0577fe9a4721ac1c42ebe5a778/contract';
import startContract from '../../snapshots/698af4923a03130f81799f0ac03b838974895d0577fe9a4721ac1c42ebe5a778/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addCheckConstraint({
        schema: 'public',
        table: 'product',
        constraint: 'product_stock_non_negative_fd296d5d',
        expression: 'stock >= 0',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
