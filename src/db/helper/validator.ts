import { Type } from '../../type/common.type'
import { DB_METADATA } from '../inspector'
import { AppDto, Load, Order, PartialLoad, Select } from './type'

const SelectValidator = <T extends AppDto>(
  type: Type<T>,
  select: Select<T> | undefined,
): string[] | undefined => {
  if (select == null) {
    return undefined
  }

  const {
    extra: { columnCamelLookup },
  } = DB_METADATA.byType(type)

  return select.filter((o) => columnCamelLookup[o as string]) as string[]
}

const stripPrefix = <T extends AppDto>(orderBy: Order<T>) => {
  if (
    (orderBy as string).startsWith('+') ||
    (orderBy as string).startsWith('-')
  ) {
    return (orderBy as string).substring(1)
  }

  return orderBy as string
}

const SortValidator = <T extends AppDto>(
  type: Type<T>,
  orderBy: Order<T> | Order<T>[] | undefined,
): typeof orderBy => {
  if (orderBy == null) {
    return undefined
  }

  const {
    extra: { columnCamelLookup },
  } = DB_METADATA.byType(type)

  if (Array.isArray(orderBy)) {
    return orderBy.filter((o) => columnCamelLookup[stripPrefix(o)] != null)
  }

  return columnCamelLookup[stripPrefix(orderBy)] ? orderBy : undefined
}

const LoadValidator = <T extends AppDto>(
  type: Type<T>,
  load: Load<T> | undefined,
): typeof load => {
  if (load == null) {
    return undefined
  }

  const table = DB_METADATA.byType(type)
  const {
    extra: { relationCamelLookup },
  } = table

  if (Array.isArray(load)) {
    return load.filter((o) => relationCamelLookup[o as string] != null)
  }

  const { findRelation } = DB_METADATA.helper(table)

  return Object.entries(load).reduce(
    // Offload relation's columns validation to helper
    (acc, [key, value]) => {
      const relation = findRelation(key)
      if (relation == null) {
        return { ...acc }
      }

      if (value === true) {
        return { ...acc, [key]: value }
      }

      if (Array.isArray(value)) {
        const {
          extra: { columnCamelLookup: subCols },
        } = DB_METADATA.byName(relation.foreignTableName)

        const filtered = value.filter((o) => subCols[o] != null)
        if (filtered.length > 0) {
          return { ...acc, [key]: filtered }
        }
      }

      return { ...acc }
    },
    {} as PartialLoad<T>,
  )
}

export const validate = <T extends AppDto>(
  type: Type<T>,
  {
    select,
    orderBy,
    load,
  }: {
    select?: Select<T>
    orderBy?: Order<T> | Order<T>[]
    load?: Load<T>
  },
) => ({
  select: SelectValidator(type, select),
  orderBy: SortValidator(type, orderBy),
  load: LoadValidator(type, load),
})
