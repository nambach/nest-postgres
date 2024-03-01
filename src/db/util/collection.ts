export const groupBySingle = <T, R extends string | number | symbol>(
  array: T[],
  extractor: (arg: T) => R,
) => {
  const map: Record<R, T> = {} as Record<R, T>
  for (let i = 0; i < array.length; i++) {
    const item = array[i]
    map[extractor(item)] = item
  }
  return map
}

export const groupBy = <T>(array: T[], extractor: (arg: T) => any) => {
  const map: { [key: string]: T[] } = {}

  for (let i = 0; i < array.length; i++) {
    const item = array[i]
    const key = extractor(item)

    if (map[key] == null) {
      map[key] = []
    }

    map[key].push(item)
  }
  return map
}

export const exclude = <T>(
  arr: T[],
  toExclude: T[],
  compareBy?: (arg: T) => any,
) => {
  return arr.filter((o) =>
    compareBy
      ? !toExclude.some((e) => compareBy(e) === compareBy(o))
      : !toExclude.includes(o),
  )
}

export const diffArr = <T>(
  before: T[],
  after: T[],
): { added: T[]; removed: T[] } => {
  const added = exclude(after, before)
  const removed = exclude(before, after)

  return { added, removed }
}

export const chunk = <T>(arr: T[], size: number) => {
  if (size === 0) {
    return []
  }

  const result: T[][] = []
  let current: T[]
  let counter = 0
  arr.forEach((item) => {
    if (counter === 0) {
      current = []
      result.push(current)
    }
    current.push(item)
    counter++

    if (counter === size) {
      counter = 0
    }
  })

  return result
}
