import { PendingQuery, Row, Sql } from 'postgres'
import { Type } from '../util/common.type'
import { DB_METADATA } from '../inspector'

type ToSqlParams<T extends object | undefined> = {
  sql: Sql
  type: Type<T>
  column: string
  omitPrefix?: boolean
}

const buildCol = <T extends object | undefined>({
  omitPrefix,
  sql,
  type,
  column,
}: ToSqlParams<T>) => {
  if (omitPrefix) {
    return sql`${sql(column)}`
  }
  const { abbr } = DB_METADATA.byType(type)
  return sql`${sql(abbr)}.${sql(column)}`
}

interface ToSql {
  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]>
}

// STRING

export class StringContain implements ToSql {
  value: string

  constructor(value: string) {
    this.value = value
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params

    // Omit unnecessary comparison
    if (this.value == null || this.value === '') {
      return sql`TRUE`
    }

    const col = buildCol(params)
    return sql`${col} ILIKE ${'%' + this.value + '%'}`
  }
}

export class StringStartWith implements ToSql {
  value: string

  constructor(value: string) {
    this.value = value
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} ILIKE ${this.value + '%'}`
  }
}

export class StringEndWith implements ToSql {
  value: string

  constructor(value: string) {
    this.value = value
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} ILIKE ${'%' + this.value}`
  }
}

export class StringEqualIgnoreCase implements ToSql {
  value: string

  constructor(value: string) {
    this.value = value
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} ILIKE ${this.value}`
  }
}

export class StringIn implements ToSql {
  values: string[]

  constructor(values: string[]) {
    this.values = values
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} IN ${sql(this.values)}`
  }
}

export class StringNotEqual implements ToSql {
  value: string

  constructor(value: string) {
    this.value = value
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} <> ${this.value}`
  }
}

export const String = {
  eqIgnoreCase(value: string) {
    return new StringEqualIgnoreCase(value)
  },

  contains(value: string) {
    return new StringContain(value)
  },

  startsWith(value: string) {
    return new StringStartWith(value)
  },

  endsWith(value: string) {
    return new StringEndWith(value)
  },

  in(values: string[]) {
    return new StringIn(values)
  },

  notEq(value: string) {
    return new StringNotEqual(value)
  },
}

// NUMBER

export class NumberIn implements ToSql {
  values: number[]

  constructor(values: number[]) {
    this.values = values
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} IN ${sql(this.values)}`
  }
}

export class NumberGreaterThan implements ToSql {
  value: number

  constructor(value: number) {
    this.value = value
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} > ${this.value}`
  }
}

export class NumberGreaterThanEqual implements ToSql {
  value: number

  constructor(value: number) {
    this.value = value
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} >= ${this.value}`
  }
}

export class NumberLessThan implements ToSql {
  value: number

  constructor(value: number) {
    this.value = value
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} < ${this.value}`
  }
}

export class NumberLessThanEqual implements ToSql {
  value: number

  constructor(value: number) {
    this.value = value
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} <= ${this.value}`
  }
}

export const Number = {
  gt(value: number) {
    return new NumberGreaterThan(value)
  },
  gte(value: number) {
    return new NumberGreaterThanEqual(value)
  },
  lt(value: number) {
    return new NumberLessThan(value)
  },
  lte(value: number) {
    return new NumberLessThanEqual(value)
  },
  in(values: number[]) {
    return new NumberIn(values)
  },
}

// BOOLEAN

export class BoolIsNot implements ToSql {
  value: boolean

  constructor(value: boolean) {
    this.value = value
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} IS NOT ${this.value ? sql`TRUE` : sql`FALSE`}`
  }
}

export const Bool = {
  not(value: boolean) {
    return new BoolIsNot(value)
  },
}

// VALUES

export class ValueIsNull implements ToSql {
  constructor() {}

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} IS NULL`
  }
}

export class ValueIsNotNull implements ToSql {
  constructor() {}

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} IS NOT NULL`
  }
}

export class ValueInArray implements ToSql {
  values: (string | number)[]

  constructor(values: (string | number)[]) {
    this.values = values
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} IN ${sql(this.values)}`
  }
}

export const Value = {
  null() {
    return new ValueIsNull()
  },
  notNull() {
    return new ValueIsNotNull()
  },
  in(values: (string | number)[]) {
    return new ValueInArray(values)
  },
}

// DATE TIME

const castDate = (value: Date | string) => {
  if (value instanceof Date) {
    return value
  }
  return new Date(value)
}

export class DateEqual implements ToSql {
  value: Date

  constructor(value: Date) {
    this.value = value
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`DATE(${col}) = DATE(${this.value})`
  }
}

export class DateLessThanEqual implements ToSql {
  value: Date

  constructor(value: Date) {
    this.value = value
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`DATE(${col}) <= DATE(${this.value})`
  }
}

export class DateGreaterThanEqual implements ToSql {
  value: Date

  constructor(value: Date) {
    this.value = value
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`DATE(${col}) >= DATE(${this.value})`
  }
}

export class TimestampNow implements ToSql {
  constructor() {}

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} = NOW()`
  }
}

export class TimestampLessThan implements ToSql {
  value: Date

  constructor(value: Date) {
    this.value = value
  }

  toSql<T extends object | undefined>(
    params: ToSqlParams<T>,
  ): PendingQuery<Row[]> {
    const { sql } = params
    const col = buildCol(params)
    return sql`${col} < ${this.value}`
  }
}

export const Timestamp = {
  date: {
    eq(value: Date | string) {
      return new DateEqual(castDate(value))
    },
    lte(value: Date | string) {
      return new DateLessThanEqual(castDate(value))
    },
    gte(value: Date | string) {
      return new DateGreaterThanEqual(castDate(value))
    },
  },
  lt(value: Date | string) {
    return new TimestampLessThan(castDate(value))
  },
  now() {
    return new TimestampNow()
  },
}

// https://stackoverflow.com/questions/14425568/interface-type-check-with-typescript
export const isInstanceOfToSql = (object: any): object is ToSql => {
  if (typeof object === 'object') {
    return 'toSql' in object
  }
  return false
}
