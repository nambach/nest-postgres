import { fromCamel, toCamel } from 'postgres'
import { Type } from '../util/common.type'
import { groupBySingle } from '../util/collection'
import { deferredCache } from '../helper/decorator'
import { ClassCache, DbColumn, DbRelation, DbTable, TableCache } from './type'

interface TableHelper {
  /**
   * @param relName camelCase
   */
  findRelation: (
    relName: string,
  ) => (DbRelation & { foreignTableAbbr: string }) | undefined

  /**
   * @param relName camelCase
   */
  findColumn: (fieldName: string) => DbColumn | undefined
}

export class DbMetadata {
  private readonly tableCache: TableCache = {}
  private readonly classCache: ClassCache = {}

  constructor() {}

  setTableCache(tableCache: TableCache) {
    Object.assign(this.tableCache, tableCache)
    this.combineDeferredCache()
    this.generateClassCache()
  }

  getTables() {
    return this.tableCache
  }

  getClasses() {
    return this.classCache
  }

  byType<T>(type: Type<T>) {
    return this.classCache[type.name]
  }

  byName(tableName: string) {
    return this.tableCache[tableName]
  }

  helper(table: DbTable): TableHelper {
    return {
      findRelation: (relName) => {
        const data = table.extra.relationCamelLookup[relName]
        if (data) {
          return {
            ...data,
            foreignTableAbbr: this.findAbbr(data.foreignTableName, 'tableName'),
          }
        }
      },
      findColumn: (fieldName) => table.extra.columnCamelLookup[fieldName],
    }
  }

  findAbbr(value: string, mode: 'tableName' | 'typeClass') {
    if (mode === 'tableName') {
      return this.tableCache[value].abbr
    }
    return this.classCache[value].abbr
  }

  private combineDeferredCache() {
    Object.values(deferredCache).forEach((newTable) => {
      const { tableName } = newTable

      const table = this.tableCache[tableName]

      if (table == null) {
        return
      }

      // update primitive data
      table.className = newTable.className
      table.extra.updatedAt = newTable.updatedAt

      // update columns
      newTable.columns.forEach((newCol) => {
        const entry = table.columns.find((o) => o.name === newCol.columnName)
        if (entry != null) {
          entry.alias = fromCamel(newCol.fieldName)
        }
      })

      // update relations
      newTable.relations.forEach((newRel) => {
        const entry = table.relations.find((o) => o.keyName === newRel.keyName)
        if (entry != null) {
          entry.name = fromCamel(newRel.relationName)
        }
      })

      // generate columnNames_camel
      table.extra.columnCamelLookup = groupBySingle(table.columns, (col) =>
        toCamel(col.alias),
      )
      table.extra.relationCamelLookup = groupBySingle(table.relations, (rel) =>
        toCamel(rel.name),
      )
    })
  }

  private generateClassCache() {
    Object.values(this.tableCache).forEach((table) => {
      this.classCache[table.className] = table
    })
  }
}

export const DB_METADATA = new DbMetadata()
