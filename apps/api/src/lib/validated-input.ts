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

/**
 * 異なる validation target（例: param + json, param + query）を組み合わせる。
 *
 * 同じ target（例: json + json）を組み合わせると出力型が交差型になり、
 * 意図しない結果になるため、異なる target の組み合わせ専用とする。
 */
export type CombinedInput<A extends Input, B extends Input> = A & B;

/**
 * 検証済み入力を持つ controller 用の context 型。
 *
 * `E` はプロジェクト固有の Hono Env を注入するための拡張ポイント。
 * 現状では route handler との互換性を保つため、デフォルトを Hono の
 * `Env` にしている。
 */
export type ValidatedContext<I extends Input, E extends Env = Env> = Context<
  E,
  string,
  I
>;
