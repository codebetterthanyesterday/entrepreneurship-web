#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/01ca04f9fbab679444d309d8fec8b9bc39a0b8962a1e8dfff59c5f13170a687a/contract';
import endContract from '../../snapshots/01ca04f9fbab679444d309d8fec8b9bc39a0b8962a1e8dfff59c5f13170a687a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/816aba2a0a05ed95e7f92ffe1f4985371eb35df343c42ffd7c218b4533c717d9/contract';
import startContract from '../../snapshots/816aba2a0a05ed95e7f92ffe1f4985371eb35df343c42ffd7c218b4533c717d9/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'serviceDay',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('date', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isOpen', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('locations', 'text[]', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'serviceDay_locations_elem_not_null_35aec250',
            'array_position("locations", NULL) IS NULL',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'serviceWindow',
        columns: [
          col('booked', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('dayId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('endMinute', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('quota', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('startMinute', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('service_window_booked_non_negative_d907661a', 'booked >= 0'),
          checkExpression('service_window_booked_within_quota_8c716e51', 'booked <= quota'),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('handoverDetail', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('handoverLocation', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('locationReviewedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('serviceDate', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('serviceWindowId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'storeSetting',
        column: col('orderCutoffMinute', 'int4', {
          notNull: true,
          default: lit(1260),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'order',
        constraint: 'order_handoverLocation_check_12f575fe',
        expression: "\"handoverLocation\" IN ('CAMPUS_B', 'CAMPUS_C', 'MARKET_DAY', 'OTHER')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'serviceDay',
        constraint: 'serviceDay_date_key',
        columns: ['date'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'serviceWindow',
        constraint: 'serviceWindow_dayId_startMinute_key',
        columns: ['dayId', 'startMinute'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'order',
        index: 'order_serviceDate_idx_478ae72f',
        columns: ['serviceDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'order',
        index: 'order_serviceWindowId_idx_4768b9c5',
        columns: ['serviceWindowId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'serviceWindow',
        index: 'serviceWindow_dayId_idx_0ba48a31',
        columns: ['dayId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'serviceWindow',
        foreignKey: {
          name: 'serviceWindow_dayId_fkey',
          columns: ['dayId'],
          references: { schema: 'public', table: 'serviceDay', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'order',
        foreignKey: {
          name: 'order_serviceWindowId_fkey',
          columns: ['serviceWindowId'],
          references: { schema: 'public', table: 'serviceWindow', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
