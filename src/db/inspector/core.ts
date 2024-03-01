import { Sql, toPascal } from 'postgres'
import { groupBy, groupBySingle } from '../../utils/collection'
import { abbrSnakeCase } from '../util'
import { PostgresForeignKey, PostgresTable, TableCache } from './type'

/**
 * 1. Generate entity type
 * 2. Collect database struct
 *    a. All column names with column types
 *    b. Primary key
 *    c. Foreign keys
 */

export const getAllTableNames = async (
  sql: Sql,
  { schema }: { schema: string },
) => {
  const tables = await sql<PostgresTable[]>`
SELECT table_name
FROM information_schema.tables
WHERE table_schema=${schema} AND table_type='BASE TABLE'
ORDER BY table_name ASC;
`

  return tables.map((o) => o.tableName)
}

export const inspectTableColumns = async (
  sql: Sql,
  { schema }: { schema: string },
) => {
  return sql<PostgresTable[]>`
SELECT table_name, json_agg((json_build_object(
'column_name', column_name,
'column_default', column_default,
'is_nullable', is_nullable,
'data_type', data_type,
'character_maximum_length', character_maximum_length,
'udt_name', udt_name,
'is_identity', is_identity,
'is_updatable', is_updatable))) AS columns
FROM information_schema.columns
WHERE table_schema = ${schema}
GROUP BY table_name ORDER BY table_name ASC;
`
}

// https://dba.stackexchange.com/a/28151
export const inspectTablePrimaryKeys = async (
  sql: Sql,
  { schema }: { schema: string },
) => {
  return sql<{ tableName: string; columnName: string }[]>`
SELECT tc.table_name, kc.column_name
FROM
    information_schema.table_constraints tc,
    information_schema.key_column_usage kc
WHERE
    tc.constraint_type = 'PRIMARY KEY' 
    and kc.table_name = tc.table_name and kc.table_schema = tc.table_schema
    and kc.constraint_name = tc.constraint_name
    and tc.table_schema = ${schema}
ORDER BY 1, 2;
`
}

// https://dba.stackexchange.com/a/28151
export const inspectTableForeignKeys = async (
  sql: Sql,
  { schema }: { schema: string },
) => {
  return sql<PostgresForeignKey[]>`
SELECT
    tc.table_schema, 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = ${schema};
`
}

export const fetchDatabaseMetadata = async (
  sql: Sql,
  { schema }: { schema: string },
): Promise<TableCache> => {
  const primaryKeys = groupBySingle(
    await inspectTablePrimaryKeys(sql, { schema }),
    (o) => o.tableName,
  )
  const foreignKeys = groupBy(
    await inspectTableForeignKeys(sql, { schema }),
    (o) => o.tableName,
  )
  const columns = groupBySingle(
    await inspectTableColumns(sql, { schema }),
    (o) => o.tableName,
  )

  /**
   * return snake_case
   */
  const buildRelationName = (keyName: string, foreignTableName: string) => {
    try {
      return keyName.endsWith('_code')
        ? keyName.substring(0, keyName.length - 5)
        : keyName.endsWith('_id')
          ? keyName.substring(0, keyName.length - 3)
          : keyName + '_' + foreignTableName
    } catch (e) {
      return keyName + '_' + foreignTableName
    }
  }

  let abbrCounter = 1
  const abbrCache: Record<string, string> = {} // [abbr]: tableName
  const computeAbbr = (tableName: string) => {
    let abbr = abbrSnakeCase(tableName)

    // abbr collided
    if (abbrCache[abbr] != null && abbrCache[abbr] !== tableName) {
      abbr = abbr + abbrCounter++
    }

    abbrCache[abbr] = tableName

    return abbr
  }

  const tableNames = Object.keys(primaryKeys)
  const metadata: TableCache = {}

  tableNames.forEach((tableName) => {
    if (primaryKeys[tableName] == null) {
      return
    }
    metadata[tableName] = {
      name: tableName,
      abbr: computeAbbr(tableName),
      className: toPascal(tableName),
      primaryKey: primaryKeys[tableName].columnName,
      columns: columns[tableName].columns.map((c) => ({
        name: c.columnName,
        alias: c.columnName,
        type: c.udtName,
        nullable: c.isNullable === 'YES',
        // lock: c.isUpdatable === 'NO',
        // maxLength: c.characterMaximumLength ?? undefined,
        // unique: c.isIdentity === 'YES',
      })),
      relations: (foreignKeys[tableName] || []).map((c) => ({
        name: buildRelationName(c.columnName, c.foreignTableName),
        // tableName: c.tableName,
        keyName: c.columnName,
        foreignTableName: c.foreignTableName,
        foreignKeyName: c.foreignColumnName,
      })),
      extra: {
        columnCamelLookup: {},
        relationCamelLookup: {},
      },
    }
  })

  return metadata
}
