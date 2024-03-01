import { Injectable } from '@nestjs/common'
import * as postgres from 'postgres'
import { PendingQuery, toCamel } from 'postgres'
import { Type } from '../util/common.type'
import { exclude } from '../util/collection'
import { DB_METADATA } from '../inspector'
import { collectFromPartialLoad } from '../util'
import { Value } from './comparator'
import { createHelper } from './helper'
import {
  AppDto,
  CountOptions,
  CountResult,
  DeleteManyOptions,
  DeleteOneOptions,
  FindAllOptions,
  FindAndCountOptions,
  FindFirstOptions,
  FindManyOptions,
  InsertBatchOptions,
  InsertOneOptions,
  PrimitiveKeys,
  PrimitiveType,
  SaveOneOptions,
  UpdateBatchOptions,
  UpdateManyOptions,
  UpdateOneOptions,
} from './type'
import { validate } from './validator'

@Injectable()
export class DbService {
  constructor() {}

  sql = postgres(process.env.DATABASE_URL ?? '', {
    transform: postgres.toCamel,
    debug: (connection, query, parameters) => console.log(query, parameters),
  })

  helper = createHelper(this.sql)

  private getId<T extends AppDto>(type: Type<T>) {
    return toCamel(DB_METADATA.byType(type).primaryKey) as keyof T
  }

  transaction<T extends AppDto>(queries: PendingQuery<T[]>[]) {
    return this.sql.begin((tSql) => queries.map((query) => tSql<T[]>`${query}`))
  }

  findAll<T extends AppDto>({ type, ...options }: FindAllOptions<T>) {
    const sql = this.sql
    const { buildSelect, buildFrom, buildOrder } = this.helper
    const { select, orderBy } = validate(type, options)
    return sql<T[]>`
${buildSelect(type, select)}
${buildFrom(type)}
${buildOrder(type, orderBy)}`
  }

  findMany<T extends AppDto>({
    type,
    where,
    take,
    skip,
    ...options
  }: FindManyOptions<T>) {
    const sql = this.sql
    const { buildSelect, buildFrom, buildWhere, buildOrder, buildLimitOffset } =
      this.helper
    const { select, orderBy } = validate(type, options)
    return sql<T[]>`
${buildSelect(type, select)}
${buildFrom(type)}
${buildWhere(type, where)}
${buildOrder(type, orderBy)} ${buildLimitOffset({ take, skip })}`
  }

  async count<T extends AppDto>({ type, where: filter }: CountOptions<T>) {
    const sql = this.sql
    const { buildFrom, buildWhere } = this.helper
    const [{ total }] = await sql<CountResult[]>`
SELECT COUNT(*) as "total"
${buildFrom(type)}
${buildWhere(type, filter)}`
    return total
  }

  async findAndCount<T extends AppDto>({
    type,
    where: filter,
    take,
    skip,
    ...options
  }: FindAndCountOptions<T>) {
    const sql = this.sql
    const { buildSelect, buildFrom, buildWhere, buildOrder, buildLimitOffset } =
      this.helper

    const { select: cols, orderBy: sort } = validate(type, options)

    const select = buildSelect(type, cols)
    const count = sql`SELECT COUNT(*) as "total"`
    const from = buildFrom(type)
    const where = buildWhere(type, filter)
    const order = buildOrder(type, sort)
    const limitOffset = buildLimitOffset({ take, skip })
    const [data, [{ total }]] = await sql.begin((tSql) => [
      tSql<T[]>`${select} ${from} ${where} ${order} ${limitOffset}`,
      tSql<CountResult[]>`${count} ${from} ${where}`,
    ])
    return { data, total }
  }

  async findFirst<T extends AppDto>({
    type,
    where,
    ...options
  }: FindFirstOptions<T>): Promise<T | undefined> {
    const sql = this.sql
    const { hasLoadRelations, buildSelect, buildFrom, buildWhere, buildOrder } =
      this.helper

    const { select, orderBy, load } = validate(type, options)

    const result = await sql<T[]>`
${buildSelect(type, select, load)}
${buildFrom(type, load)}
${buildWhere(type, where)}
${buildOrder(type, orderBy)} LIMIT 1`

    if (hasLoadRelations(load)) {
      // create relations from partial loads
      return collectFromPartialLoad(result[0]) as T
    }

    return result[0]
  }

  async delete<T extends AppDto>({ type, where: filter }: DeleteOneOptions<T>) {
    const sql = this.sql
    const { buildFrom, buildWhere, buildReturningAll } = this.helper
    const result = await sql<T[]>`
DELETE ${buildFrom(type)}
${buildWhere(type, filter)}
${buildReturningAll(type)}`
    return result[0]
  }

  async deleteMany<T extends AppDto>({
    type,
    where: filter,
  }: DeleteManyOptions<T>): Promise<number> {
    const sql = this.sql
    const { buildFrom, buildWhere } = this.helper
    const result = await sql<T[]>`
DELETE ${buildFrom(type)}
${buildWhere(type, filter)}`
    return result.count
  }

  async insert<T extends AppDto>({ type, data }: InsertOneOptions<T>) {
    const sql = this.sql
    const { buildData, buildReturningAll } = this.helper
    const { name: tableName } = DB_METADATA.byType(type)
    const values = sql(buildData(type, data))
    console.log(values)
    const result = await sql<T[]>`
INSERT INTO ${sql(tableName)}
${values}
${buildReturningAll(type)}`
    return result[0]
  }

  async insertBatch<T extends AppDto>({
    type,
    data,
    batch,
  }: InsertBatchOptions<T>): Promise<number> {
    const { buildBatchInsert } = this.helper
    const query = buildBatchInsert({
      type,
      data,
      batchSize: batch,
    })

    if (Array.isArray(query)) {
      const result = await this.transaction(query)
      return result.reduce((acc, curr) => acc + curr.count, 0)
    }

    const [result] = await this.transaction([query])
    return result.count
  }

  async update<T extends AppDto>({
    type,
    data,
    where: filter,
  }: UpdateOneOptions<T>) {
    const sql = this.sql
    const { buildUpdate, buildUpdateSet, buildWhere, buildReturningAll } =
      this.helper
    const idKey = this.getId(type)
    const update = buildUpdate(type)

    // NORMAL UPDATED
    if (filter != null) {
      const result = await sql<T[]>`
${update}
${buildUpdateSet(type, data)}
${buildWhere(type, filter)}
${buildReturningAll(type)}`
      return result[0]
    }

    // Update by id
    if (data[idKey] == null) {
      throw new Error(
        'DbService: Id not found in single update (without WHERE)',
      )
    }

    const idFilter: any = { [idKey]: data[idKey] }
    delete data[idKey as keyof T]

    const result = await sql<T[]>`
${update}
${buildUpdateSet(type, data)}
${buildWhere(type, idFilter)}
${buildReturningAll(type)}`
    return result[0]
  }

  async updateMany<T extends AppDto>({
    type,
    data,
    where: filter,
  }: UpdateManyOptions<T>): Promise<number> {
    const sql = this.sql
    const { buildUpdate, buildUpdateSet, buildWhere } = this.helper
    const result = await sql<T[]>`
${buildUpdate(type)}
${buildUpdateSet(type, data)}
${buildWhere(type, filter)}`
    return result.count
  }

  async updateBatch<T extends AppDto>({
    type,
    data,
    batch,
  }: UpdateBatchOptions<T>): Promise<number> {
    const { buildBatchUpdate } = this.helper
    const query = buildBatchUpdate({
      type,
      data,
      batchSize: batch,
    })

    if (Array.isArray(query)) {
      const result = await this.transaction(query)
      return result.reduce((acc, curr) => acc + curr.count, 0)
    }

    const [result] = await this.transaction([query])
    return result.count
  }

  /**
   * CreateOrUpdate
   * @param type
   * @param data
   */
  async save<T extends AppDto>({ type, data }: SaveOneOptions<T>) {
    const idKey = this.getId(type)
    if (data[idKey] == null) {
      delete data[idKey]
      return this.insert({ type, data })
    }
    return this.update({ type, data })
  }

  /**
   * E.g: Program <-> Textbook is a many-to-many relation.
   * Given that program ID(1) has 5 textbooks ID(1,2,3,4,5). When we update the textbooks ID as (1,3,7)
   * it will need to perform one insert (program: 1, textbook: 7) and three delete (program: 1, textbook: 2),
   * (program: 1, textbook: 4), (program: 1, textbook: 5) into the table ProgramTextbook.
   *
   * That how this function behaves.
   * @param type
   * @param data
   */
  async updateManyToManyRelation<T extends AppDto>({
    type,
    data,
  }: {
    type: Type<T>
    data: ManyToManyRelation<T>
  }): Promise<{ added: number; deleted: number }> {
    const result = { added: 0, deleted: 0 }

    const mainKey = pickMainKey(data)
    const foreignKeys = pickForeignKeys(data)
    const currentData = await this.findMany({
      type,
      select: [mainKey.key, foreignKeys.key] as any,
      where: { [mainKey.key]: mainKey.value } as any,
    })

    const currentForeignKeys = currentData.map(
      (value) => value![foreignKeys.key as keyof T],
    )

    const toAdd = exclude(foreignKeys.value, currentForeignKeys)
    if (toAdd.length) {
      result.added = await this.insertBatch({
        type,
        data: toAdd.map((foreignKey) => ({
          [foreignKeys.key]: foreignKey,
          [mainKey.key]: mainKey.value,
        })) as any[],
      })
    }

    const toDelete = exclude(currentForeignKeys, foreignKeys.value)
    if (toDelete.length) {
      result.deleted = await this.deleteMany({
        type,
        where: {
          [mainKey.key]: mainKey.value,
          [foreignKeys.key]: Value.in(toDelete),
        } as any,
      })
    }

    return result
  }
}

type ManyToManyRelation<T extends AppDto> = Partial<{
  [key in PrimitiveKeys<T>]: PrimitiveType | PrimitiveType[]
}>

const pickMainKey = <T extends AppDto>(data: ManyToManyRelation<T>) => {
  const mainKey = Object.entries(data).find(
    ([, value]) => !Array.isArray(value),
  )

  if (mainKey == null) {
    throw new Error('Invalid ManyToManyRelation data: main key not found')
  }

  return { key: mainKey[0], value: mainKey[1] }
}

const pickForeignKeys = <T extends AppDto>(data: ManyToManyRelation<T>) => {
  const foreignKeys = Object.entries(data).find(([, value]) =>
    Array.isArray(value),
  )

  if (foreignKeys == null) {
    throw new Error('Invalid ManyToManyRelation data: foreign keys not found')
  }

  return { key: foreignKeys[0], value: foreignKeys[1] as any[] }
}
