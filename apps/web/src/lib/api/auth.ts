import {
  AuthSession,
  Me,
  type AcceptInviteBody,
  type LoginBody,
  type SignupBody,
} from "@datapulse/contracts";
import { apiFetch } from "./client";

// §8.2. O refresh fica no token-store, porque não passa pelo apiFetch.

export const authApi = {
  login: (body: LoginBody) => apiFetch("/auth/login", { method: "POST", body, schema: AuthSession, auth: false }),
  signup: (body: SignupBody) => apiFetch("/auth/signup", { method: "POST", body, schema: AuthSession, auth: false }),
  acceptInvite: (body: AcceptInviteBody) =>
    apiFetch("/auth/accept-invite", { method: "POST", body, schema: AuthSession, auth: false }),
  logout: () => apiFetch("/auth/logout", { method: "POST", auth: false }),
  me: () => apiFetch("/me", { schema: Me }),
};
