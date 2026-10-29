import type { ApiError } from "@multi-lang/contracts";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await res.json()) as { data?: T } | ApiError;
  if (!res.ok) {
    const err = body as ApiError;
    throw new Error(err.error?.message ?? `请求失败 (${res.status})`);
  }
  return (body as { data: T }).data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
};
