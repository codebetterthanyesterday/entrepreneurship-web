#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/9f4bc8a2f2b784d3defb272ce2341adc442f0f2d094ba90dfc9c762022a73d7b/contract';
import endContract from '../../snapshots/9f4bc8a2f2b784d3defb272ce2341adc442f0f2d094ba90dfc9c762022a73d7b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ee6b8629c2406e2e191adf8dcbbe1905f3c502020b7c34a622f78b052da71a3f/contract';
import startContract from '../../snapshots/ee6b8629c2406e2e191adf8dcbbe1905f3c502020b7c34a622f78b052da71a3f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'siteListItem',
        columns: [
          col('body', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('icon', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('imageUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('section', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sortOrder', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'siteText',
        columns: [
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('value', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['key'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'siteListItem',
        index: 'siteListItem_section_sortOrder_idx_c9c27fde',
        columns: ['section', 'sortOrder'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
