import { chunk, diffArr, exclude, groupBy, groupBySingle } from './collection'

describe('collection', () => {
  describe('groupBySingle', () => {
    it('should group array into single record', () => {
      expect(
        groupBySingle(
          [
            { a: 1, b: 2 },
            { a: 3, b: 4 },
          ],
          (o) => o.a,
        ),
      ).toStrictEqual({
        1: { a: 1, b: 2 },
        3: { a: 3, b: 4 },
      })

      expect(
        groupBySingle(
          [
            { a: 1, b: 2 },
            { a: 3, b: 4 },
            { a: 1, b: 4 },
          ],
          (o) => o.a,
        ),
      ).toStrictEqual({
        1: { a: 1, b: 4 },
        3: { a: 3, b: 4 },
      })
    })
  })

  describe('groupBy', () => {
    it('should group array by key string', () => {
      expect(
        groupBy(
          [
            { a: 1, b: 2 },
            { a: 3, b: 4 },
            { a: 1, b: 4 },
          ],
          (o) => o.a + '',
        ),
      ).toStrictEqual({
        '1': [
          { a: 1, b: 2 },
          { a: 1, b: 4 },
        ],
        '3': [{ a: 3, b: 4 }],
      })
      expect(
        groupBy(
          [
            { a: 1, b: 2 },
            { a: 3, b: 4 },
            { a: 1, b: 4 },
          ],
          (o) => o.a,
        ),
      ).toStrictEqual({
        1: [
          { a: 1, b: 2 },
          { a: 1, b: 4 },
        ],
        3: [{ a: 3, b: 4 }],
      })
      expect(groupBy([], (o) => o.a)).toStrictEqual({})
    })
  })

  describe('exclude', () => {
    it('should exclude array of primitive values correctly', () => {
      expect(exclude([1, 2, 3, 4, 5], [2, 4])).toStrictEqual([1, 3, 5])
      expect(exclude(['aaa', 'bb', 'ccc'], ['a', 'bb'])).toStrictEqual([
        'aaa',
        'ccc',
      ])
      expect(exclude([true, false, true, false], [true])).toStrictEqual([
        false,
        false,
      ])
    })

    it('should exclude array of objects correctly', () => {
      expect(
        exclude<{ a: number; b?: number }>(
          [
            { a: 1, b: 2 },
            { a: 11, b: 22 },
            { a: 23, b: 23 },
          ],
          [{ a: 1 }, { a: 0, b: 22 }],
          (o) => o.a,
        ),
      ).toStrictEqual([
        { a: 11, b: 22 },
        { a: 23, b: 23 },
      ])
    })
  })

  describe('diffArr', () => {
    it('should calculate empty array', () => {
      expect(diffArr([1, 2, 3], [])).toStrictEqual({
        added: [],
        removed: [1, 2, 3],
      })

      expect(diffArr([], [1, 2, 3])).toStrictEqual({
        added: [1, 2, 3],
        removed: [],
      })

      expect(diffArr([], [])).toStrictEqual({
        added: [],
        removed: [],
      })
    })

    it('should calculate non-empty array', () => {
      expect(diffArr([1, 2, 3], [1, 2, 3])).toStrictEqual({
        added: [],
        removed: [],
      })
      expect(diffArr([1, 2, 3], [1, 2])).toStrictEqual({
        added: [],
        removed: [3],
      })
      expect(diffArr([1, 2, 3], [1, 2, 3, 5])).toStrictEqual({
        added: [5],
        removed: [],
      })
      expect(diffArr([1, 2, 3], [1, 2, 5])).toStrictEqual({
        added: [5],
        removed: [3],
      })
      expect(diffArr([1, 2, 3, 9], [1, 7, 8, 9])).toStrictEqual({
        added: [7, 8],
        removed: [2, 3],
      })
      expect(diffArr([1, 2, 3], [7, 8, 9])).toStrictEqual({
        added: [7, 8, 9],
        removed: [1, 2, 3],
      })
    })
  })

  describe('chunk', () => {
    it('should return empty array if chunk size is 0', () => {
      expect(chunk([1, 2, 3, 4, 5], 0)).toStrictEqual([])
    })

    it('should chunk array correctly with chunk size less than or equal total length', () => {
      expect(chunk([1, 2, 3, 4, 5], 1)).toStrictEqual([[1], [2], [3], [4], [5]])
      expect(chunk([1, 2, 3, 4, 5], 2)).toStrictEqual([[1, 2], [3, 4], [5]])
      expect(chunk([1, 2, 3, 4, 5], 3)).toStrictEqual([
        [1, 2, 3],
        [4, 5],
      ])
      expect(chunk([1, 2, 3, 4, 5], 4)).toStrictEqual([[1, 2, 3, 4], [5]])
      expect(chunk([1, 2, 3, 4, 5], 5)).toStrictEqual([[1, 2, 3, 4, 5]])
    })

    it('should return the whole array if chunk size is greater than total length', () => {
      expect(chunk([1, 2, 3, 4, 5], 6)).toStrictEqual([[1, 2, 3, 4, 5]])
      expect(chunk([1, 2, 3, 4, 5], 100)).toStrictEqual([[1, 2, 3, 4, 5]])
    })
  })
})
