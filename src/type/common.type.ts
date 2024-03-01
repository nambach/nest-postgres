export type Type<T> = new () => T

// https://youtu.be/a_m7jxrTlaw?si=OmkLGODR5dUfJh6k
export type LooseString<T extends string> = T | Omit<string, T>

// https://stackoverflow.com/a/51419293/11869677
export type KeyOfType<T, V> = keyof {
  [P in keyof T as T[P] extends V ? P : never]: any
}
// Reversed version
export type KeyOfNotType<T, V> = keyof {
  [P in keyof T as T[P] extends V ? never : P]: any
}
