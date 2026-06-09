import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export class InvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRequestError";
  }
}

export async function parseBody<T extends z.ZodType>(request: NextRequest, schema: T): Promise<z.infer<T>> {
  const contentType = request.headers.get("content-type") ?? "";
  const raw = await parseRawBody(request, contentType);

  return schema.parse(coerceFormValues(raw));
}

export function jsonError(error: unknown, fallback = "Request failed") {
  if (error instanceof Response) {
    return error;
  }
  if (isInvalidRequestError(error)) {
    return NextResponse.json({ error: "Invalid request", issues: [{ message: error.message, path: [] }] }, { status: 400 });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid request", issues: error.issues }, { status: 400 });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status: 400 });
}

export function isInvalidRequestError(error: unknown): error is InvalidRequestError {
  return error instanceof InvalidRequestError;
}

async function parseRawBody(request: NextRequest, contentType: string) {
  try {
    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      return Object.fromEntries(await request.formData());
    }
    return await request.json();
  } catch {
    throw new InvalidRequestError(contentType.includes("multipart/form-data") ? "Invalid form data" : "Invalid JSON request body");
  }
}

function coerceFormValues(input: unknown) {
  if (!input || typeof input !== "object") return input;
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (typeof value !== "string") return [key, value];
      if (value === "true") return [key, true];
      if (value === "false") return [key, false];
      if (/^-?\d+$/.test(value)) return [key, Number(value)];
      return [key, value];
    }),
  );
}
