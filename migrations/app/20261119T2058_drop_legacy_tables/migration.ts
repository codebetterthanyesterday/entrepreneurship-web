#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4841e92899260c39310a5a7bae6aca5bfacbeeabdcba56dde70ba74391d76a19/contract';
import endContract from '../../snapshots/4841e92899260c39310a5a7bae6aca5bfacbeeabdcba56dde70ba74391d76a19/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f468f23b87be644d6874c11c34a121befb41238f5ddcd72ed2bcfd0cb2e2e830/contract';
import startContract from '../../snapshots/f468f23b87be644d6874c11c34a121befb41238f5ddcd72ed2bcfd0cb2e2e830/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropTable({ schema: 'public', table: 'externalCharge' }),
      this.dropTable({ schema: 'public', table: 'pickupSlot' }),
      this.dropTable({ schema: 'public', table: 'siteListItem' }),
      this.dropTable({ schema: 'public', table: 'siteText' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
