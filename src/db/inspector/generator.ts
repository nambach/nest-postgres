import { toCamel } from 'postgres'
import { Column, ManyToOne, Table } from '../helper/decorator'
import { PrimitiveType } from '../helper'
import { DbTable, TableCache, UdtName } from './type'

const udtTypescriptMapping: Record<
  UdtName,
  `${Exclude<PrimitiveType, Date>}` | 'Date'
> = {
  bool: 'boolean',
  int4: 'number',
  int8: 'bigint',
  text: 'string',
  varchar: 'string',
  float4: 'number',
  timestamp: 'Date',
  timestamptz: 'Date',
  date: 'Date',
}

interface ParentClass {
  className: string
  fields: { name: string; type: (typeof udtTypescriptMapping)[UdtName] }[]
}

const checkParentMatch = (
  childTable: DbTable,
  parent: ParentClass,
): boolean => {
  let counter = 0
  parent.fields.forEach((field) => {
    const tableCol = childTable.columns.find(
      (col) =>
        toCamel(col.alias) === field.name &&
        udtTypescriptMapping[col.type] === field.type,
    )
    if (tableCol != null) {
      counter++
    }
  })
  return counter === parent.fields.length
}

interface GeneratorOptions {
  cache: TableCache
  omitNull?: boolean
  includeDecorator?: ('table' | 'column' | 'relation')[]
  parentClass?: ParentClass
}

class StringBuilder {
  private value = ''

  constructor() {}

  append(value: string) {
    this.value += value
    return this
  }

  newLine() {
    this.value += '\n'
    return this
  }

  toString() {
    return this.value
  }
}

const createColumnComparator =
  (primaryKey: string) => (alias1: string, alias2: string) => {
    return alias1 === primaryKey
      ? -Infinity
      : alias2 === primaryKey
        ? +Infinity
        : alias1.localeCompare(alias2)
  }

export const generateJsClass = (
  table: DbTable,
  { omitNull, includeDecorator = [], cache, parentClass }: GeneratorOptions,
) => {
  const appendNull = (nullable: boolean) =>
    nullable && !omitNull ? ' | null' : ''
  const aliaComparator = createColumnComparator(table.primaryKey)

  const indentation = '  '
  const builder = new StringBuilder()

  const inheritParent =
    parentClass != null && checkParentMatch(table, parentClass)
  const parentFieldNames = parentClass
    ? parentClass.fields.map((o) => o.name)
    : []

  if (includeDecorator.includes('table')) {
    builder.append(`@${Table.name}('${table.name}')`).newLine()
  }
  builder
    .append(`export class ${table.className} `)
    .append(inheritParent ? `extends ${parentClass?.className} {` : '{')
    .newLine()

  // collect columns
  table.columns
    .sort((a, b) => aliaComparator(a.alias, b.alias))
    .forEach(({ alias, type, nullable, name }) => {
      const fieldName = toCamel(alias)

      if (inheritParent && parentFieldNames.includes(fieldName)) {
        return
      }

      if (includeDecorator.includes('column')) {
        builder
          .append(indentation)
          .append(`@${Column.name}('${name}')`)
          .newLine()
      }
      builder
        .append(indentation)
        .append(fieldName)
        .append(': ')
        .append(udtTypescriptMapping[type])
        .append(appendNull(nullable))
        .newLine()
    })

  // collect relations
  table.relations
    .sort((a, b) => aliaComparator(a.name, b.name))
    .forEach(({ name, foreignTableName, keyName }) => {
      if (includeDecorator.includes('relation')) {
        builder
          .append(indentation)
          .append(`@${ManyToOne.name}('${keyName}')`)
          .newLine()
      }

      const foreignClassName = cache[foreignTableName].className
      builder
        .append(indentation)
        .append(toCamel(name))
        .append(': ')
        .append(foreignClassName)
        .newLine()
    })

  builder.append('}').newLine()

  return builder.toString()
}

const checkCircular = (a: DbTable, b: DbTable) =>
  a.relations.some((r) => r.foreignTableName === b.name)

const sortPreventCircular = (tables: DbTable[]) => {
  const result: DbTable[] = []
  let other: DbTable[] = []
  const names: string[] = []

  tables.forEach((table) => {
    if (table.relations.length === 0) {
      result.push(table)
    } else {
      other.push(table)
    }
  })
  names.push(...result.map((o) => o.name))

  while (other.length > 0) {
    const collect: DbTable[] = []
    other.forEach((table) => {
      if (
        table.relations.every((rel) => names.includes(rel.foreignTableName))
      ) {
        collect.push(table)
      }
    })

    if (collect.length === 0) {
      const pairs: string[][] = []
      for (let i = 0; i < other.length; i++) {
        for (let j = i + 1; j < other.length; j++) {
          const aOnB = checkCircular(other[i], other[j])
          const bOnA = checkCircular(other[j], other[i])
          if (aOnB && bOnA) {
            pairs.push([other[i].className, other[j].className])
          }
        }
      }

      throw new Error(
        'Circular dependency: ' +
          pairs.map((o) => `[${o[0]}, ${o[1]}]`).join(', '),
      )
    }

    result.push(...collect)
    names.push(...collect.map((o) => o.name))
    other = other.filter((o) => !names.includes(o.name))
  }

  return result
}

export const generateAllJsClass = (
  cache: TableCache,
  options: Omit<GeneratorOptions, 'cache'>,
) => {
  const builder = new StringBuilder()

  sortPreventCircular(
    Object.values(cache).sort((a, b) => a.className.localeCompare(b.className)),
  ).forEach((table) => {
    builder
      .append(generateJsClass(table, { ...options, cache }))
      .newLine()
      .newLine()
  })

  return builder.toString()
}
