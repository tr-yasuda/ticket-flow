import { describe, expect, it } from "vitest";

import { ApiError, handleApiErrorResponse } from "@/lib/api-error";

const dummyRequest = null as unknown as Request;
const dummyOptions = {} as unknown as Parameters<
  typeof handleApiErrorResponse
>[1];
const dummyState = { retryCount: 0 };

describe("ApiError", () => {
  it("message, status, details を保持する", () => {
    const details = [{ field: "email", message: "無効です" }];
    const error = new ApiError("bad request", 400, details);

    expect(error.message).toBe("bad request");
    expect(error.status).toBe(400);
    expect(error.details).toEqual(details);
    expect(error.name).toBe("ApiError");
  });
});

describe("handleApiErrorResponse", () => {
  it("成功応答はそのまま返す", async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
    });
    const result = await handleApiErrorResponse(
      dummyRequest,
      dummyOptions,
      response,
      dummyState,
    );
    expect(result).toBe(response);
  });

  it("共通エラー形式を ApiError に変換する", async () => {
    const details = [{ field: "email", message: "無効です" }];
    const response = new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "入力内容を確認してください",
          details,
        },
      }),
      { status: 400 },
    );

    await expect(
      handleApiErrorResponse(dummyRequest, dummyOptions, response, dummyState),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      handleApiErrorResponse(
        dummyRequest,
        dummyOptions,
        response.clone(),
        dummyState,
      ),
    ).rejects.toMatchObject({
      message: "入力内容を確認してください",
      status: 400,
      details,
    });
  });

  it("レガシー形式を ApiError に変換する", async () => {
    const response = new Response(
      JSON.stringify({ error: "bad request", details: [] }),
      { status: 400 },
    );

    await expect(
      handleApiErrorResponse(dummyRequest, dummyOptions, response, dummyState),
    ).rejects.toMatchObject({
      message: "bad request",
      status: 400,
    });
  });

  it("JSON でないボディは Request failed として扱う", async () => {
    const response = new Response("not json", { status: 500 });

    await expect(
      handleApiErrorResponse(dummyRequest, dummyOptions, response, dummyState),
    ).rejects.toMatchObject({
      message: "Request failed",
      status: 500,
    });
  });

  it("エラー情報を持たないボディも Request failed として扱う", async () => {
    const response = new Response(JSON.stringify({ foo: "bar" }), {
      status: 500,
    });

    await expect(
      handleApiErrorResponse(dummyRequest, dummyOptions, response, dummyState),
    ).rejects.toMatchObject({
      message: "Request failed",
      status: 500,
    });
  });
});
