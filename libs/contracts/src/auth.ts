import { z } from "zod";
import { IsoDateTime, Uuid, page } from "./common";

// §8.2 Auth e usuários

export const Role = z.enum(["admin", "analyst"]);
export type Role = z.infer<typeof Role>;

export const UserStatus = z.enum(["invited", "active", "disabled"]);
export type UserStatus = z.infer<typeof UserStatus>;

export const SessionUser = z.object({
  id: Uuid,
  email: z.string(),
  role: Role,
});
export type SessionUser = z.infer<typeof SessionUser>;

export const Tenant = z.object({
  id: Uuid,
  name: z.string(),
});
export type Tenant = z.infer<typeof Tenant>;

export const PASSWORD_MIN_LENGTH = 12;

export const SignupBody = z.object({
  company_name: z.string().trim().min(2, "Informe o nome da empresa").max(120),
  email: z.email("E-mail inválido").max(254),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres`)
    .max(128),
});
export type SignupBody = z.infer<typeof SignupBody>;

export const LoginBody = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha").max(128),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const AcceptInviteBody = z.object({
  invite_token: z.string().min(1),
  password: SignupBody.shape.password,
});
export type AcceptInviteBody = z.infer<typeof AcceptInviteBody>;

/** Corpo de signup, login e accept-invite. O refresh token vai no cookie dp_rt. */
export const AuthSession = z.object({
  user: SessionUser,
  tenant: Tenant,
  access_token: z.string(),
  expires_in: z.number().int().positive(),
});
export type AuthSession = z.infer<typeof AuthSession>;

export const RefreshResponse = z.object({
  access_token: z.string(),
  expires_in: z.number().int().positive(),
});
export type RefreshResponse = z.infer<typeof RefreshResponse>;

export const Me = z.object({
  user: SessionUser,
  tenant: Tenant,
});
export type Me = z.infer<typeof Me>;

export const UserListItem = z.object({
  id: Uuid,
  email: z.string(),
  role: Role,
  status: UserStatus,
  created_at: IsoDateTime.optional(),
  last_login_at: IsoDateTime.nullish(),
});
export type UserListItem = z.infer<typeof UserListItem>;

export const UserPage = page(UserListItem);
export type UserPage = z.infer<typeof UserPage>;

export const CreateUserBody = z.object({
  email: z.email("E-mail inválido").max(254),
  role: Role,
});
export type CreateUserBody = z.infer<typeof CreateUserBody>;

/** O invite_token vale 72 h e só é mostrado nesta resposta. */
export const CreateUserResponse = z.object({
  user: UserListItem,
  invite_token: z.string(),
});
export type CreateUserResponse = z.infer<typeof CreateUserResponse>;

export const UpdateUserBody = z.object({
  role: Role.optional(),
  status: z.enum(["active", "disabled"]).optional(),
});
export type UpdateUserBody = z.infer<typeof UpdateUserBody>;
