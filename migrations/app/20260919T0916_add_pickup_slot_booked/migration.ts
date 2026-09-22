#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1c300f32c854e96a5321a6ed039d07ac7666de481d8a899693df542bc2351a23/contract';
import startContract from '../../snapshots/1c300f32c854e96a5321a6ed039d07ac7666de481d8a899693df542bc2351a23/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ee6b8629c2406e2e191adf8dcbbe1905f3c502020b7c34a622f78b052da71a3f/contract';
import endContract from '../../snapshots/ee6b8629c2406e2e191adf8dcbbe1905f3c502020b7c34a622f78b052da71a3f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'pickupSlot',
        column: col('booked', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'pickupSlot',
        constraint: 'pickup_slot_booked_non_negative_d907661a',
        expression: 'booked >= 0',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'pickupSlot',
        constraint: 'pickup_slot_booked_within_quota_8c716e51',
        expression: 'booked <= quota',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
