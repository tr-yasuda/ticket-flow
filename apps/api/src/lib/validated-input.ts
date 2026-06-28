import type { Context, Env, Input } from "hono";

/**
 * Hono validator の出力型を controller context に近接させるための helper 型。
 *
 * `sValidator` / `zValidator` は `Context` の第 3 型引数 `I extends Input`
 * に検証済みデータの型を書き込む。
 * ここではその `out` 部分を組み立て、controller 側で `c.req.valid("...")`
 * を型安全に呼び出せるようにする。
 */

export type JsonInput<T> = {
  out: { json: T };
};

export type QueryInput<T> = {
  out: { query: T };
};

export type ParamInput<T> = {
  out: { param: T };
};

type OverlappingOutKeys<A extends Input, B extends Input> = keyof A["out"] &
  keyof B["out"];

/**
 * 異なる validation target（例: param + json, param + query）を組み合わせる。
 *
 * 同じ target（例: json + json）を組み合わせると `out` のキーが重複し、
 * 意図しない交差型になるため、型レベルで `never` にして誤用を防ぐ。
 */
export type CombinedInput<A extends Input, B extends Input> = [
  OverlappingOutKeys<A, B>,
] extends [never]
  ? A & B
  : never;

/**
 * 検証済み入力を持つ controller 用の context 型。
 *
 * `E` はプロジェクト固有の Hono Env、`P` はルートのパス文字列リテラル型を
 * 注入するための拡張ポイント。現状では route handler との互換性を保つため、
 * デフォルトを `Env` / `string` にしている。
 */
export type ValidatedContext<
  I extends Input,
  E extends Env = Env,
  P extends string = string,
> = Context<E, P, I>;
