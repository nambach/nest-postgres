import { fromCamel, Helper, PendingQuery, Row, Sql, toCamel } from 'postgres'
import { Type } from '../util/common.type'
import { chunk } from '../util/collection'
import { DB_METADATA } from '../inspector'
import { DbColumn, DbTable, UdtName } from '../inspector/type'
import { parseSort } from '../util'
import { Timestamp, isInstanceOfToSql } from './comparator'
import { AppDto, DbFilter, FullLoad, Load, Order, PartialLoad } from './type'

// https://www.typescriptlang.org/docs/handbook/2/mapped-types.html#key-remapping-via-as
type Sqlized<Type> = {
  [Property in keyof Type]: Type[Property] extends string
    ? Helper<string, []>
    : Type[Property]
}

export const createHelper = (sql: Sql) => {
  const udtTypeMapping: Record<UdtName, PendingQuery<Row[]>> = {
    bool: sql`::bool`,
    date: sql`::date`,
    float4: sql`::float4`,
    int4: sql`::int4`,
    int8: sql`::int8`,
    timestamp: sql`::timestamp`,
    timestamptz: sql`::timestamptz`,
    text: sql``,
    varchar: sql``,
  }

  const sqlize = <T extends object, K extends keyof T>(
    object: T,
    ...keys: K[]
  ): Sqlized<T> => {
    const result = {} as Sqlized<T>
    Object.entries(object).forEach(([key, value]) => {
      if (keys.length && !keys.includes(key as K)) {
        return
      }
      if (value != null && typeof value === 'string') {
        result[key as keyof T] = sql(value) as any
      }
    })
    return result
  }

  const join = (
    arr: (PendingQuery<Row[]> | null)[],
    delimiter: PendingQuery<Row[]>,
  ) => {
    const filtered = arr.filter((o) => o != null)
    if (filtered.length === 0) {
      return sql``
    }

    return filtered.reduce((acc, x) => sql`${acc}${delimiter}${x}`) ?? sql``
  }

  // https://github.com/porsager/postgres/discussions/529#discussioncomment-4334691
  const and = (arr: PendingQuery<Row[]>[], wrap?: boolean) =>
    wrap ? sql`(${join(arr, sql` AND `)})` : join(arr, sql` AND `)
  const or = (arr: PendingQuery<Row[]>[], wrap?: boolean) =>
    wrap ? sql`(${join(arr, sql` OR `)})` : join(arr, sql` OR `)

  // Postgres document: https://www.postgresql.org/docs/current/queries-limit.html
  const buildLimitOffset = ({
    take,
    skip,
  }: {
    skip?: number
    take?: number
  }) => {
    const limit = take != null ? sql`LIMIT ${take}` : sql``
    const offset = skip != null ? sql`OFFSET ${skip}` : sql``
    return join([limit, offset], skip != null && take != null ? sql` ` : sql``)
  }

  const buildSelectOneTable = (
    table: DbTable,
    cols: string[],
    relationName?: string,
  ) => {
    const isMainTable = relationName == null
    const {
      abbr,
      extra: { columnCamelLookup },
    } = table
    const { findColumn } = DB_METADATA.helper(table)

    // main table
    if (isMainTable) {
      if (cols == null || cols.length === 0) {
        // No cols provided means SELECT *
        cols = Object.keys(columnCamelLookup)
      }
    }

    // SELECT tbl.col1 AS ..., tbl.col2 AS ...
    return join(
      cols.map((col) => {
        const colData = findColumn(col)
        if (colData == null) {
          return null
        }

        const { name, alias } = colData
        let asAlias = sql``
        if (isMainTable && name !== alias) {
          asAlias = sql` AS ${sql(alias)}`
        } else if (!isMainTable) {
          // Sub-column join:   "c"."name" as "course__name"  =>  { course: { name: '' } }
          asAlias = sql` AS ${sql(fromCamel(relationName) + '__' + alias)}`
        }

        return sql`${sql(abbr)}.${sql(name)}${asAlias}`
      }),
      sql`, `,
    )
  }

  const hasLoadRelations = <T extends AppDto>(load?: Load<T>) => {
    if (load == null) {
      return false
    }
    if (Array.isArray(load) && load.length) {
      return true
    }
    return Object.values(load).some(
      (o) => o === true || (Array.isArray(o) && o.length),
    )
  }

  const buildSelectFullLoad = <T extends AppDto>(
    table: DbTable,
    load: FullLoad<T>[],
  ) => {
    const { findRelation } = DB_METADATA.helper(table)

    // to_json(rel1) as rel_1, to_json(rel2) as rel_2
    return load?.length
      ? join(
          load.map((relName) => {
            const rel = findRelation(relName as string)
            if (rel == null) {
              return null
            }

            const { name, foreignTableAbbr } = rel
            return sql`to_json(${sql(foreignTableAbbr)}) AS ${sql(name)}`
          }),
          sql`, `,
        )
      : sql``
  }

  const buildSelectPartialLoad = <T extends AppDto>(
    table: DbTable,
    load: PartialLoad<T>,
  ) => {
    const { findRelation } = DB_METADATA.helper(table)

    const queries = Object.entries(load).map(([relName, value]) => {
      const rel = findRelation(relName)
      if (rel == null) {
        return null
      }

      const { name, foreignTableAbbr, foreignTableName } = rel
      if (typeof value === 'boolean' && value) {
        return sql`to_json(${sql(foreignTableAbbr)}) AS ${sql(name)}`
      }

      if (Array.isArray(value) && value.length) {
        return buildSelectOneTable(
          DB_METADATA.byName(foreignTableName),
          value as string[],
          relName,
        )
      }

      return null
    })

    return join(queries, sql`, `)
  }

  const buildSelect = <T extends AppDto>(
    type: Type<T>,
    cols?: string[],
    load?: Load<T>,
  ) => {
    const table = DB_METADATA.byType(type)

    // SELECT tbl.col1 AS ..., tbl.col2 AS ...
    const mainCols = buildSelectOneTable(table, cols || [])
    const subCols =
      load == null
        ? sql``
        : Array.isArray(load)
          ? buildSelectFullLoad(table, load)
          : buildSelectPartialLoad(table, load)
    const comma = hasLoadRelations(load) ? sql`, ` : sql``

    return sql`SELECT ${mainCols}${comma}${subCols}`
  }

  const buildFromFullLoad = <T extends AppDto>(
    table: DbTable,
    load: FullLoad<T>[],
  ) => {
    const abbr = sql(table.abbr)
    const { findRelation } = DB_METADATA.helper(table)

    return load.length
      ? join(
          load.map((relName) => {
            const rel = findRelation(relName as string)
            if (rel == null) {
              return null
            }

            const {
              foreignTableAbbr: fAbbr,
              foreignTableName: fTable,
              keyName: fKey,
              foreignKeyName: fTableKey,
            } = sqlize(rel)

            return sql`JOIN ${fTable} ${fAbbr} ON ${fAbbr}.${fTableKey} = ${abbr}.${fKey}`
          }),
          sql` `,
        )
      : sql``
  }

  const buildFromPartialLoad = <T extends AppDto>(
    table: DbTable,
    load: PartialLoad<T>,
  ) => {
    const abbr = sql(table.abbr)
    const { findRelation } = DB_METADATA.helper(table)

    const queries = Object.entries(load).map(([relName, value]) => {
      const rel = findRelation(relName)
      if (rel == null) {
        return null
      }

      const {
        foreignTableAbbr: fAbbr,
        foreignTableName: fTable,
        keyName: fKey,
        foreignKeyName: fTableKey,
      } = sqlize(rel)

      const isAFullLoad = typeof value === 'boolean' && value
      const isAPartialLoad =
        Array.isArray(value) && typeof value[0] === 'string'
      if (isAFullLoad || isAPartialLoad) {
        return sql`JOIN ${fTable} ${fAbbr} ON ${fAbbr}.${fTableKey} = ${abbr}.${fKey}`
      }

      return null
    })

    return join(queries, sql` `)
  }

  const buildFrom = <T extends AppDto>(type: Type<T>, load?: Load<T>) => {
    const table = DB_METADATA.byType(type)
    const { abbr, name: tableName } = sqlize(table, 'abbr', 'name')

    const joins =
      load == null
        ? sql``
        : Array.isArray(load)
          ? buildFromFullLoad(table, load)
          : buildFromPartialLoad(table, load)

    return sql`FROM ${tableName} ${abbr} ${joins}`
  }

  const preprocessData = <T extends AppDto>(
    type: Type<T>,
    data: Partial<T>,
  ) => {
    const table = DB_METADATA.byType(type)
    const updatedAt = table.extra.updatedAt
    if (updatedAt != null) {
      data[updatedAt] = Timestamp.now()
    }
  }

  const pairing = <T extends AppDto>({
    type,
    fieldName,
    value,
    omitAlias,
    mode,
  }: {
    fieldName: string
    value: any
    type: Type<T>
    omitAlias?: boolean
    mode: 'update' | 'condition'
  }) => {
    const table = DB_METADATA.byType(type)
    const abbr = sql(table.abbr)
    const col = table.extra.columnCamelLookup[fieldName]

    if (col == null) {
      throw new Error(
        `Unknown field: cannot find corresponding column name for ${type.name}.${fieldName}`,
      )
    }

    const columnName = sql(col.name)

    const prefix = omitAlias ? sql`` : sql`${abbr}.`

    if (value == null) {
      if (mode === 'update') {
        return sql`${prefix}${columnName} = NULL`
      }
      return sql`${prefix}${columnName} IS NULL`
    }

    if (isInstanceOfToSql(value)) {
      return value.toSql({ sql, type, column: col.name, omitPrefix: omitAlias })
    }

    if (typeof value === 'object' && !(value instanceof Date)) {
      throw new Error('DbService: Invalid object token')
    }

    return sql`${prefix}${columnName} = ${value}`
  }

  const buildOrderSingle = <T extends AppDto>(
    orderBy: Order<T>,
    table: DbTable,
  ) => {
    const abbr = sql(table.abbr)
    const sort = parseSort(orderBy as string)
    if (sort == null) {
      return null
    }

    return sql`${abbr}.${sql(sort.column)} ${
      sort.order === 'ASC' ? sql`ASC` : sql`DESC`
    }`
  }

  const buildOrder = <T extends AppDto>(
    type: Type<T>,
    orderBy: Order<T> | Order<T>[] | undefined,
  ) => {
    if (orderBy == null) {
      return sql``
    }

    const table = DB_METADATA.byType(type)

    if (typeof orderBy === 'string') {
      return sql`ORDER BY ${buildOrderSingle(orderBy, table)}`
    }

    if (Array.isArray(orderBy)) {
      return sql`ORDER BY ${join(
        orderBy.map((value) => buildOrderSingle(value, table)),
        sql`, `,
      )}`
    }

    return sql``
  }

  const buildWhereLoop = <T extends AppDto>(
    type: Type<T>,
    filter: DbFilter<T> | undefined,
    level: number,
    parentOR?: boolean,
  ): PendingQuery<Row[]> => {
    if (filter == null) {
      return sql``
    }

    const entries = Object.entries(filter)
    if (entries.length === 0) {
      if (parentOR) {
        return sql`FALSE`
      }

      return sql``
    }

    return and(
      entries.map(([key, value]) => {
        if ((key === 'AND' || key === 'OR') && value.length <= 1) {
          if (value.length === 0) {
            return sql`TRUE`
          }

          return buildWhereLoop(type, value[0], level + 1)
        }

        if (key === 'AND') {
          return and(
            value.map((o) => buildWhereLoop(type, o, level + 1)),
            true,
          )
        }

        if (key === 'OR') {
          return or(
            value.map((o) => buildWhereLoop(type, o, level + 1, true)),
            true,
          )
        }

        return pairing({ fieldName: key, value, type, mode: 'condition' })
      }),
      level !== 0 && entries.length > 1,
    )
  }

  const buildWhere = <T extends AppDto>(
    type: Type<T>,
    filter: DbFilter<T> | undefined,
  ): PendingQuery<Row[]> => {
    if (filter == null) {
      return sql``
    }

    const entries = Object.entries(filter)
    if (entries.length === 0) {
      return sql``
    }

    return sql`WHERE ${buildWhereLoop(type, filter, 0)}`
  }

  const buildData = <T extends AppDto>(
    type: Type<T>,
    data: Partial<T>,
  ): object => {
    const {
      extra: { columnCamelLookup },
    } = DB_METADATA.byType(type)
    return Object.entries(data).reduce((acc, [fieldName, value]) => {
      const col = columnCamelLookup[fieldName]
      if (col == null) {
        return acc
      }

      return { ...acc, [col.name]: value ?? null }
    }, {})
  }

  const buildUpdate = <T extends AppDto>(
    type: Type<T>,
  ): PendingQuery<Row[]> => {
    const { abbr, name } = sqlize(DB_METADATA.byType(type), 'abbr', 'name')
    return sql`UPDATE ${name} ${abbr}`
  }

  const buildUpdateSet = <T extends AppDto>(
    type: Type<T>,
    data: Partial<T>,
  ): PendingQuery<Row[]> => {
    preprocessData(type, data)

    const entries = Object.entries(data)
    if (entries.length === 0) {
      throw new Error('DbService: Update empty data')
    }

    const pairs = join(
      entries.map(([key, value]) =>
        pairing({
          fieldName: key,
          value,
          type,
          omitAlias: true,
          mode: 'update',
        }),
      ),
      sql`, `,
    )

    return sql`SET ${pairs}`
  }

  const buildBatchInsert = <T extends AppDto>({
    type,
    data,
    batchSize,
  }: {
    type: Type<T>
    data: Partial<T>[]
    batchSize?: number
  }) => {
    const { name: tableName } = DB_METADATA.byType(type)
    const { keys, values } = readBatch(data)
    const insert = sql`INSERT INTO ${sql(tableName)} (${sql(keys)})`

    // NO BATCH
    if (batchSize == null) {
      return sql<T[]>`${insert} VALUES ${sql(values)}`
    }

    // BATCHES
    const chunks = chunk(values, batchSize).map(
      (chunkedValues) => sql`VALUES ${sql(chunkedValues)}`,
    )
    return chunks.map((chunkedValues) => sql<T[]>`${insert} ${chunkedValues}`)
  }

  /**
   * Cast column when updating, since postgres.js serialize all values as string
   */
  const getTypeCast = (fieldName: string, columns: DbColumn[]) => {
    const col = columns.find((o) => toCamel(o.alias) === fieldName)

    if (col == null) {
      return sql``
    }

    return udtTypeMapping[col.type]
  }

  /**
   * References
   * Update multiple row using same query: https://stackoverflow.com/a/18799497/11869677
   * VALUES keyword: https://www.postgresql.org/docs/current/queries-values.html
   */
  const buildBatchUpdate = <T extends AppDto>({
    type,
    data,
    batchSize,
  }: {
    type: Type<T>
    data: Partial<T>[]
    batchSize?: number
  }) => {
    const { name: tableName, primaryKey, columns } = DB_METADATA.byType(type)
    const idKey = toCamel(primaryKey)

    const { keys, values } = readBatch(data, idKey)

    const update = sql`UPDATE ${sql(tableName)} t`
    const setPairs = join(
      keys
        .filter((o) => o !== idKey)
        .map(
          (key) => sql`${sql(key)} = d.${sql(key)}${getTypeCast(key, columns)}`,
        ),
      sql`, `,
    )
    const where = sql`WHERE t.${sql(idKey)} = d.${sql(idKey)}${getTypeCast(
      idKey,
      columns,
    )}`

    // NO BATCH
    if (batchSize == null) {
      const from = sql`FROM (VALUES ${sql(values)}) AS d(${sql(keys)})`

      return sql<T[]>`${update} SET ${setPairs} ${from} ${where}`
    }

    // BATCHES
    const froms = chunk(values, batchSize).map(
      (chunkedValues) =>
        sql`FROM (VALUES ${sql(chunkedValues)}) AS d(${sql(keys)})`,
    )
    return froms.map(
      (from) => sql<T[]>`${update} SET ${setPairs} ${from} ${where}`,
    )
  }

  const buildReturningAll = <T extends AppDto>(
    type: Type<T>,
    includeAbbr?: boolean,
  ) => {
    const { abbr, columns } = DB_METADATA.byType(type)
    const prefix = includeAbbr ? sql`${sql(abbr)}.` : sql``
    const returning = join(
      columns.map(
        ({ name, alias }) =>
          sql`${prefix}${sql(name)}${
            alias === name ? sql`` : sql` AS ${sql(alias)}`
          }`,
      ),
      sql`, `,
    )

    return sql`RETURNING ${returning}`
  }

  return {
    hasLoadRelations,
    buildLimitOffset,
    buildSelect,
    buildFrom,
    buildWhere,
    buildWhereLoop,
    buildOrder,
    buildData,
    buildUpdate,
    buildUpdateSet,
    buildBatchInsert,
    buildBatchUpdate,
    buildReturningAll,
  }
}

const readBatch = <T extends AppDto>(
  batch: Partial<T>[],
  idKey?: string,
): { keys: string[]; values: any[][] } => {
  const keys = Object.keys(batch[0])

  if (idKey && !keys.includes(idKey)) {
    throw new Error('DbService: Id not found in batch update')
  }

  const values: any[][] = []
  batch.forEach((item) => {
    values.push(
      keys.map((key) => {
        const value = item[key as keyof T]

        if (idKey && key === idKey && value == null) {
          throw new Error('DbService: Id cannot be null in batch update')
        }

        return value
      }),
    )
  })
  return { keys, values }
}
