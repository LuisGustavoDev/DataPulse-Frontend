import { CreateUserResponse, UserListItem, UserPage, type CreateUserBody, type UpdateUserBody } from "@datapulse/contracts";
import { apiFetch } from "@/lib/api/client";

// §8.2, rotas de admin.

export const usersApi = {
  list: (cursor: string | undefined, signal?: AbortSignal) =>
    apiFetch("/users", { query: { cursor, limit: 100 }, schema: UserPage, signal }),

  create: (body: CreateUserBody) => apiFetch("/users", { method: "POST", body, schema: CreateUserResponse }),

  update: (id: string, body: UpdateUserBody) =>
    apiFetch(`/users/${encodeURIComponent(id)}`, { method: "PATCH", body, schema: UserListItem.partial() }),
};
