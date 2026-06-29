import type { Context, Env } from "hono";
import { describe, expectTypeOf, it } from "vitest";

import {
  type CombinedInput,
  type JsonInput,
  type ParamInput,
  type QueryInput,
  type ValidatedContext,
} from "../../../src/lib/validated-input.js";

type TestBody = { name: string };
type TestQuery = { page: number };
type TestParam = { id: string };

function extractJson(c: ValidatedContext<JsonInput<TestBody>>) {
  return c.req.valid("json");
}

function extractQuery(c: ValidatedContext<QueryInput<TestQuery>>) {
  return c.req.valid("query");
}

function extractParam(c: ValidatedContext<ParamInput<TestParam>>) {
  return c.req.valid("param");
}

function extractCombined(
  c: ValidatedContext<
    CombinedInput<ParamInput<TestParam>, JsonInput<TestBody>>
  >,
) {
  return {
    param: c.req.valid("param"),
    json: c.req.valid("json"),
  };
}

describe("validated-input types", () => {
  it("ValidatedContext は Hono の Context の部分型である", () => {
    expectTypeOf<
      ValidatedContext<JsonInput<TestBody>>
    >().toMatchTypeOf<Context>();
  });

  it("JsonInput で c.req.valid('json') の戻り値がスキーマ出力型になる", () => {
    expectTypeOf<ReturnType<typeof extractJson>>().toEqualTypeOf<TestBody>();
  });

  it("QueryInput で c.req.valid('query') の戻り値がスキーマ出力型になる", () => {
    expectTypeOf<ReturnType<typeof extractQuery>>().toEqualTypeOf<TestQuery>();
  });

  it("ParamInput で c.req.valid('param') の戻り値がスキーマ出力型になる", () => {
    expectTypeOf<ReturnType<typeof extractParam>>().toEqualTypeOf<TestParam>();
  });

  it("CombinedInput で複数ターゲットを組み合わせられる", () => {
    expectTypeOf<ReturnType<typeof extractCombined>>().toEqualTypeOf<{
      param: TestParam;
      json: TestBody;
    }>();
  });

  it("JsonInput context では c.req.valid('query') が型エラーになる", () => {
    const c = { req: { valid: () => ({}) } } as unknown as ValidatedContext<
      JsonInput<TestBody>
    >;
    // @ts-expect-error query target は JsonInput では宣言されていない
    c.req.valid("query");
  });

  it("QueryInput context では c.req.valid('param') が型エラーになる", () => {
    const c = { req: { valid: () => ({}) } } as unknown as ValidatedContext<
      QueryInput<TestQuery>
    >;
    // @ts-expect-error param target は QueryInput では宣言されていない
    c.req.valid("param");
  });

  it("ParamInput context では c.req.valid('json') が型エラーになる", () => {
    const c = { req: { valid: () => ({}) } } as unknown as ValidatedContext<
      ParamInput<TestParam>
    >;
    // @ts-expect-error json target は ParamInput では宣言されていない
    c.req.valid("json");
  });

  it("CombinedInput で同一 target を組み合わせると never になる", () => {
    type Overlapped = CombinedInput<
      JsonInput<{ a: string }>,
      JsonInput<{ b: number }>
    >;
    expectTypeOf<Overlapped>().toBeNever();
  });

  it("ValidatedContext はルートのパス文字列リテラル型を受け入れられる", () => {
    type WithPath = ValidatedContext<
      ParamInput<TestParam>,
      Env,
      "/organizations/:organizationId/tickets/:ticketId"
    >;
    expectTypeOf<WithPath>().toMatchTypeOf<Context>();
  });
});
