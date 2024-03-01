import {
  abbrSnakeCase,
  collectFromPartialLoad,
  parseSort,
  parseUrlConnection,
} from './util'

describe('util', () => {
  describe('parseOrder', () => {
    it('should parse undefined correctly', () => {
      expect(parseSort(undefined)).toStrictEqual(null)
      expect(parseSort(null)).toStrictEqual(null)
    })
    it('should parse asc correctly', () => {
      expect(parseSort('name')).toStrictEqual({ column: 'name', order: 'asc' })
      expect(parseSort('+sort')).toStrictEqual({
        column: 'sort',
        order: 'asc',
      })
    })
    it('should parse desc correctly', () => {
      expect(parseSort('-year')).toStrictEqual({
        column: 'year',
        order: 'desc',
      })
      expect(parseSort('-rank')).toStrictEqual({
        column: 'rank',
        order: 'desc',
      })
    })
  })

  describe('parseUrlConnection', () => {
    it('should parse valid connection', () => {
      expect(
        parseUrlConnection(
          'postgresql://postgres:postgres@localhost:5432/tntt?search_path=public',
        ),
      ).toStrictEqual({
        scheme: 'postgresql',
        username: 'postgres',
        password: 'postgres',
        host: 'localhost',
        port: '5432',
        database: 'tntt',
        schema: 'public',
        params: {
          search_path: 'public',
        },
      })

      expect(
        parseUrlConnection(
          'postgresql://postgres:postgres@localhost:5432/tntt',
        ),
      ).toStrictEqual({
        scheme: 'postgresql',
        username: 'postgres',
        password: 'postgres',
        host: 'localhost',
        port: '5432',
        database: 'tntt',
        schema: null,
        params: {},
      })
    })
  })

  describe('collectFromPartialLoad', () => {
    it('should transform props with _ into relational objects', () => {
      expect(
        collectFromPartialLoad({
          propA: 'A',
          propB_name: 'B',
          propC_age: 'age',
          propB_job: 'job',
        }),
      ).toStrictEqual({
        propA: 'A',
        propB: { name: 'B', job: 'job' },
        propC: { age: 'age' },
      })
    })

    it('should not modify object with no _ in keys', () => {
      expect(
        collectFromPartialLoad({ a: 'a', someB: 'b', anotherPropC: 'c' }),
      ).toStrictEqual({ a: 'a', someB: 'b', anotherPropC: 'c' })

      expect(collectFromPartialLoad(undefined)).toBeNull()
      expect(collectFromPartialLoad({})).toStrictEqual({})
    })
  })

  describe('abbrSnakeCase', () => {
    it('should convert snake case to abbreviation', () => {
      expect(abbrSnakeCase('student')).toBe('s')
      expect(abbrSnakeCase('student_registration')).toBe('sr')
      expect(abbrSnakeCase('first_')).toBe('f')
      expect(abbrSnakeCase('first_level_area')).toBe('fla')
    })
  })
})
