export type UdtName =
  | 'bool'
  | 'date'
  | 'float4'
  | 'int4'
  | 'int8'
  | 'text'
  | 'timestamp'
  | 'timestamptz'
  | 'varchar'

export interface PostgresColumn {
  columnName: string
  columnDefault: string
  isNullable: 'YES' | 'NO'
  dataType: string
  characterMaximumLength?: number | null
  udtName: UdtName
  isIdentity: 'YES' | 'NO'
  isUpdatable: 'YES' | 'NO'
}

export interface PostgresTable {
  tableName: string
  columns: PostgresColumn[]
}

export interface PostgresForeignKey {
  tableSchema: string
  constraintName: string
  tableName: string
  columnName: string
  foreignTableSchema: string
  foreignTableName: string
  foreignColumnName: string
}

export interface DbColumn {
  /**
   * snake_case
   */
  name: string
  /**
   * snake_case
   */
  alias: string
  type: UdtName
  nullable: boolean
  // unique: boolean
  // lock: boolean
  // maxLength?: number
}

export interface DbRelation {
  /**
   * snake_case
   */
  name: string
  // tableName: string
  keyName: string
  foreignTableName: string
  foreignKeyName: string
}

export interface DbTable {
  name: string
  abbr: string
  className: string
  primaryKey: string
  columns: DbColumn[]
  relations: DbRelation[]
  extra: {
    updatedAt?: string
    columnCamelLookup: {
      [fieldName: string]: DbColumn
    }
    relationCamelLookup: {
      [relName: string]: DbRelation
    }
  }
}

/**
 *  Data that can not (should not) be customized by user:
 *    - Column name (since we rely on postgres.js auto transform snake-to-camel feature)
 *  Therefore, we can fetch some metadata without using decorator:
 *    - ID
 *    - Foreign keys
 *  Other metadata that can be customized are:
 *    - Table's name
 *    - Foreign fields (relation fields)
 */
export class TableCache {
  [tableName: string]: DbTable
}

export class ClassCache {
  [className: string]: DbTable
}
