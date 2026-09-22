#!/usr/bin/env -S node
import type {
  Contract as End,
  Contract as Start,
} from '../../snapshots/1c300f32c854e96a5321a6ed039d07ac7666de481d8a899693df542bc2351a23/contract';
import endContract from '../../snapshots/1c300f32c854e96a5321a6ed039d07ac7666de481d8a899693df542bc2351a23/contract.json' with { type: 'json' };
import startContract from '../../snapshots/1c300f32c854e96a5321a6ed039d07ac7666de481d8a899693df542bc2351a23/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

const SEQUENCE_EXISTS = `SELECT EXISTS (
  SELECT 1
  FROM "pg_class" AS "c"
  INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."relnamespace"
  WHERE "c"."relkind" = 'S' AND "c"."relname" = $1 AND "n"."nspname" = $2
) AS "result"`;

const SEQUENCE_ABSENT = SEQUENCE_EXISTS.replace('SELECT EXISTS', 'SELECT NOT EXISTS');

/**
 * Order numbers come from PostgreSQL sequences, not from counting existing
 * rows: nextval() is atomic even across parallel transactions, and it does not
 * roll back, so two concurrent orders can never be handed the same number.
 */
function createOrderSequence(sequence: string) {
  return rawSql({
    id: `sequence.public.${sequence}`,
    // A sequence is not part of the data contract, so this migration is a
    // self-edge: start and end contract hash are the same. A self-edge is only
    // accepted when it carries a 'data'-class operation, and the invariantId is
    // what the marker records so a later run knows this work is already done.
    invariantId: `ngd:${sequence}`,
    label: `Create sequence "${sequence}"`,
    operationClass: 'data',
    target: {
      id: 'postgres',
      // 'dependency' is the planner's object class for database objects that
      // live outside the contract's tables — a sequence is one of those.
      details: { schema: 'public', objectType: 'dependency', name: sequence },
    },
    precheck: [
      {
        description: `ensure sequence "${sequence}" does not exist`,
        sql: SEQUENCE_ABSENT,
        params: [sequence, 'public'],
      },
    ],
    execute: [
      {
        description: `create sequence "${sequence}"`,
        sql: `CREATE SEQUENCE "public"."${sequence}" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1`,
      },
    ],
    postcheck: [
      {
        description: `verify sequence "${sequence}" exists`,
        sql: SEQUENCE_EXISTS,
        params: [sequence, 'public'],
      },
    ],
  });
}

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      createOrderSequence('order_seq_preorder'),
      createOrderSequence('order_seq_onsite'),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
