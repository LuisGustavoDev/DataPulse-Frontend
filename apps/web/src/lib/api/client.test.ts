import { describe, expect, it } from "vitest";
import { toApiError, toQueryString } from "./client";
import { z } from "zod";
import { ApiError, fieldErrors, shouldRetry } from "./errors";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

describe("toApiError", () => {
  it("lê RFC 7807 com code, detail, trace_id e errors (§8.1)", async () => {
    const err = await toApiError(
      json(422, {
        title: "Cabeçalho do CSV não confere com o esperado",
        status: 422,
        code: "SCHEMA_MISMATCH",
        detail: "Faltando: produto_id.",
        trace_id: "abc",
        errors: { missing: ["produto_id"] },
      }),
    );
    expect(err).toMatchObject({ status: 422, code: "SCHEMA_MISMATCH", message: "Faltando: produto_id.", traceId: "abc" });
    expect(err.errors).toEqual({ missing: ["produto_id"] });
  });

  it("lê o formato atual da API ({ code, message })", async () => {
    const err = await toApiError(json(401, { code: "INVALID_CREDENTIALS", message: "E-mail ou senha incorretos" }));
    expect(err).toMatchObject({ code: "INVALID_CREDENTIALS", message: "E-mail ou senha incorretos" });
  });

  it("lê o padrão do NestJS com message em lista", async () => {
    const err = await toApiError(json(400, { statusCode: 400, message: ["a", "b"], error: "Bad Request" }));
    expect(err).toMatchObject({ code: "HTTP_400", message: "a; b" });
  });

  it("aguenta corpo que não é JSON e usa o X-Trace-Id do header", async () => {
    const err = await toApiError(new Response("<html>502</html>", { status: 502, headers: { "X-Trace-Id": "t1" } }));
    expect(err).toMatchObject({ status: 502, code: "HTTP_502", traceId: "t1" });
    expect(err.message).toMatch(/servidor/);
  });
});

describe("fieldErrors", () => {
  it("entende a lista do ZodValidationPipe e o objeto do RFC 7807", async () => {
    const list = await toApiError(json(400, { code: "VALIDATION_ERROR", message: "x", errors: [{ field: "email", message: "E-mail inválido" }] }));
    expect(fieldErrors(list)).toEqual({ email: "E-mail inválido" });
    const obj = await toApiError(json(400, { code: "VALIDATION_ERROR", errors: { password: ["Curta demais"] } }));
    expect(fieldErrors(obj)).toEqual({ password: "Curta demais" });
  });
});

describe("toQueryString", () => {
  it("ignora vazios e junta listas com vírgula (§8.5)", () => {
    expect(toQueryString({ status: ["aprovada", "pendente"], from: "", to: undefined, limit: 20 })).toBe(
      "?status=aprovada%2Cpendente&limit=20",
    );
    expect(toQueryString({ status: [] })).toBe("");
  });
});

describe("shouldRetry", () => {
  it("repete rede e 5xx até 2 vezes", () => {
    expect(shouldRetry(0, new ApiError(0, "NETWORK_ERROR", "x"))).toBe(true);
    expect(shouldRetry(1, new ApiError(503, "HTTP_503", "x"))).toBe(true);
    expect(shouldRetry(2, new ApiError(503, "HTTP_503", "x"))).toBe(false);
  });

  it("não repete 4xx, resposta fora do contrato nem erro desconhecido", () => {
    expect(shouldRetry(0, new ApiError(404, "NOT_FOUND", "x"))).toBe(false);
    expect(shouldRetry(0, new ApiError(429, "RATE_LIMITED", "x"))).toBe(false);
    expect(shouldRetry(0, z.string().safeParse(1).error)).toBe(false);
    expect(shouldRetry(0, new SyntaxError("JSON"))).toBe(false);
  });
});
