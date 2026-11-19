#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/bc55a22041ca999ebbd127cec65345dcae12fc4223a65e03254c6bca6645131f/contract';
import startContract from '../../snapshots/bc55a22041ca999ebbd127cec65345dcae12fc4223a65e03254c6bca6645131f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f468f23b87be644d6874c11c34a121befb41238f5ddcd72ed2bcfd0cb2e2e830/contract';
import endContract from '../../snapshots/f468f23b87be644d6874c11c34a121befb41238f5ddcd72ed2bcfd0cb2e2e830/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'storedImage',
        constraint: 'storedImage_kind_check_c23614b6',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'storedImage',
        constraint: 'storedImage_kind_check_9201d158',
        expression: "\"kind\" IN ('QRIS', 'PAYMENT_PROOF', 'PRODUCT', 'BUNDLE')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
