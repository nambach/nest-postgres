import { Injectable } from '@nestjs/common'
import { Sql } from 'postgres'
import { DbService } from '../helper/service'
import { parseUrlConnection } from '../util'
import { DbMetadata } from './cache'
import {
  fetchDatabaseMetadata,
  getAllTableNames,
  inspectTableColumns,
  inspectTableForeignKeys,
  inspectTablePrimaryKeys,
} from './core'
import { TableCache } from './type'

@Injectable()
export class InspectorService {
  private readonly schema: string
  private readonly sql: Sql

  constructor(private db: DbService) {
    this.sql = db.sql
    this.schema =
      parseUrlConnection(process.env.DATABASE_URL ?? '').schema ?? 'public'
  }

  getAllTableNames() {
    return getAllTableNames(this.sql, { schema: this.schema })
  }

  async inspectTableColumns() {
    return inspectTableColumns(this.sql, { schema: this.schema })
  }

  async inspectTablePrimaryKeys() {
    return inspectTablePrimaryKeys(this.sql, { schema: this.schema })
  }

  async inspectTableForeignKeys() {
    return inspectTableForeignKeys(this.sql, { schema: this.schema })
  }

  async fetchDatabaseMetadata(): Promise<TableCache> {
    return fetchDatabaseMetadata(this.sql, { schema: this.schema })
  }

  async initMetadataCache() {
    const tableCache = await this.fetchDatabaseMetadata()
    const metadataCache = new DbMetadata()
    metadataCache.setTableCache(tableCache)

    return metadataCache
  }
}
