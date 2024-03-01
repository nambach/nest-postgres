import { AppDto } from './helper/type'

export const parseSort = (
  sort: string | undefined | null,
): { column: string; order: 'ASC' | 'DESC' } | null => {
  if (sort == null) {
    return null
  }

  if (sort.startsWith('-')) {
    return { column: sort.substring(1), order: 'DESC' }
  }

  if (sort.startsWith('+')) {
    return { column: sort.substring(1), order: 'ASC' }
  }

  return { column: sort, order: 'ASC' }
}

const urlSchema = {
  scheme: { order: 0, endBy: '://' },
  username: { order: 1, endBy: ':' },
  password: { order: 2, endBy: '@' },
  host: { order: 3, endBy: ':' },
  port: { order: 4, endBy: '/' },
  database: { order: 5, endBy: '?' },
}

const parse = (url: string): Record<keyof typeof urlSchema, string> => {
  const result = {} as Record<keyof typeof urlSchema, string>
  Object.entries(urlSchema)
    .sort((a, b) => a[1].order - b[1].order)
    .forEach(([key, { endBy }]) => {
      const index = url.indexOf(endBy)
      result[key as keyof typeof urlSchema] = url.substring(0, index)
      url = url.substring(index + endBy.length)
    })

  return result
}

const collectParams = (paramStr: string) => {
  const params = {} as Record<string, string>
  new URLSearchParams(paramStr).forEach((value, key) => {
    params[key] = value
  })
  return params
}

// https://github.com/making/database-url-parser
// <scheme>://<username>:<password>@<host>:<port>/<database>(?<options>)
export const parseUrlConnection = (
  url: string,
): Record<keyof typeof urlSchema, string> & {
  schema: string
  params: Record<string, string>
} => {
  try {
    const [connectionStr, paramStr] = url.split('?')
    const paramObj = collectParams(paramStr)
    return {
      ...parse(connectionStr + '?'),
      schema: paramObj['schema'] ?? paramObj['search_path'] ?? null,
      params: paramObj,
    }
  } catch (e) {
    throw new Error('parseUrlConnection: Invalid connection string')
  }
}

/**
 * E.g:
 * { course__id: 1, course__name: "2A" } will be
 * transformed into { course: { id: 1, name: "2A" }}
 *
 * @param raw
 */
export const collectFromPartialLoad = (raw: AppDto) => {
  if (raw == null) {
    return null
  }

  const relationObj: Record<string, any> = {}

  Object.entries(raw).forEach(([key, value]) => {
    if (key.includes('_')) {
      const [relName, prop] = key.split('_')

      if (relationObj[relName] == null) {
        relationObj[relName] = {}
      }

      relationObj[relName][prop] = value

      delete raw[key as keyof typeof raw]
    }
  })

  return { ...raw, ...relationObj }
}

export const abbrSnakeCase = (kebab: string) => {
  return kebab
    .split('_')
    .map((s) => s[0])
    .join('')
}
