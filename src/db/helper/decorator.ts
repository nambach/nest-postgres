interface DeferredTableData {
  tableName: string
  className: string
  columns: { fieldName: string; columnName: string }[]
  updatedAt?: string
  relations: { relationName: string; keyName: string }[]
}

// DEFER CACHE
export const deferredCache: Record<string, DeferredTableData> = {} // [className]: data
const setCache = <K extends keyof DeferredTableData>(
  className: string,
  path: K,
  value:
    | DeferredTableData[K]
    | ((value: DeferredTableData[K]) => DeferredTableData[K]),
) => {
  if (deferredCache[className] == null) {
    deferredCache[className] = {
      className,
      tableName: '',
      columns: [],
      relations: [],
    }
  }

  if (typeof value === 'string') {
    deferredCache[className][path] = value
  } else if (typeof value === 'function') {
    value(deferredCache[className][path])
  }
}
const findCache = (className: string) => deferredCache[className]

export const Table =
  (tableName: string): ClassDecorator =>
  (target) => {
    const className = target.name
    setCache(className, 'tableName', tableName)

    const parentClass = Object.getPrototypeOf(target)
    if (parentClass != null) {
      const data = findCache(parentClass.name)
      if (data != null) {
        setCache(className, 'updatedAt', data['updatedAt'])
      }
    }
  }

export const Column =
  (columnName: string): PropertyDecorator =>
  (target, propertyKey: string) => {
    setCache(target.constructor.name, 'columns', (cols) => {
      cols.push({ fieldName: propertyKey, columnName })
      return cols
    })
  }

export const UpdatedAt: PropertyDecorator = (target, propertyKey: string) => {
  setCache(target.constructor.name, 'updatedAt', propertyKey)
}

export const ManyToOne = (fKey: string): PropertyDecorator => {
  return (target, key: string) => {
    const className = target.constructor.name
    setCache(className, 'relations', (rels) => {
      rels.push({ relationName: key, keyName: fKey })
      return rels
    })
  }
}
