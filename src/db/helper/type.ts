import { KeyOfNotType, KeyOfType, LooseString, Type } from '../util/common.type'

export type AppDto = object | undefined

export type PrimitiveType =
  | string
  | number
  | boolean
  | bigint
  | null
  | undefined
  | Date

export type PrimitiveKeys<T extends AppDto> = KeyOfType<T, PrimitiveType>
export type Select<T extends AppDto> = PrimitiveKeys<T>[]

export type FullLoad<T extends AppDto> = KeyOfNotType<T, PrimitiveType>
export type PartialLoad<
  T extends AppDto,
  K extends FullLoad<T> = FullLoad<T>,
> = {
  [key in K]?: boolean | (keyof T[key])[]
}
export type Load<T extends AppDto> = FullLoad<T>[] | PartialLoad<T>

type OrderItem<T extends string> = LooseString<`+${T}` | `-${T}` | T>
export type Order<T extends AppDto> = OrderItem<PrimitiveKeys<T> & string>

export type CountResult = { total: number }

export type BatchUpdate<T extends AppDto> = Partial<T>[]

export type DbFilter<T extends AppDto> = Partial<
  // Only allow search on primitive fields
  Record<PrimitiveKeys<T>, any>
> & {
  AND?: DbFilter<T>[]
  OR?: DbFilter<T>[]
}

export interface FindAllOptions<T extends AppDto> {
  type: Type<T>
  select?: Select<T>
  orderBy?: Order<T> | Order<T>[]
}

export interface FindManyOptions<T extends AppDto> {
  type: Type<T>
  where: DbFilter<T>
  select?: Select<T>
  orderBy?: Order<T> | Order<T>[]
  take?: number
  skip?: number
}

export interface CountOptions<T extends AppDto> {
  type: Type<T>
  where: DbFilter<T>
}

export interface FindAndCountOptions<T extends AppDto> {
  type: Type<T>
  where: DbFilter<T>
  select?: Select<T>
  orderBy?: Order<T> | Order<T>[]
  take?: number
  skip?: number
}

export interface FindFirstOptions<T extends AppDto> {
  type: Type<T>
  where?: DbFilter<T>
  select?: Select<T>
  load?: Load<T>
  orderBy?: Order<T> | Order<T>[]
}

export interface DeleteOneOptions<T extends AppDto> {
  type: Type<T>
  where: DbFilter<T>
}

export interface DeleteManyOptions<T extends AppDto> {
  type: Type<T>
  where: DbFilter<T>
}

export interface InsertOneOptions<T extends AppDto> {
  type: Type<T>
  data: Partial<T>
}

export interface InsertBatchOptions<T extends AppDto> {
  type: Type<T>
  data: Partial<T>[]
  batch?: number
}

export interface UpdateOneOptions<T extends AppDto> {
  type: Type<T>
  data: Partial<T>
  where?: DbFilter<T>
}

export interface UpdateManyOptions<T extends AppDto> {
  type: Type<T>
  data: Partial<T>
  where: DbFilter<T>
}

export interface UpdateBatchOptions<T extends AppDto> {
  type: Type<T>
  data: Partial<T>[]
  batch?: number
}

export interface SaveOneOptions<T extends AppDto> {
  type: Type<T>
  data: Partial<T>
}
