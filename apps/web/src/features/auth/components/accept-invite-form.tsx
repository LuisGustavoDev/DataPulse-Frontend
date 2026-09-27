"use client";

import { AcceptInviteBody, PASSWORD_MIN_LENGTH } from "@datapulse/contracts";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authApi } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { useAuthForm } from "../use-auth-form";

const InviteForm = AcceptInviteBody.extend({ password_confirm: z.string() }).refine(
  (v) => v.password === v.password_confirm,
  { path: ["password_confirm"], message: "As senhas não conferem" },
);

function inviteMessage(err: unknown): string | null {
  if (isApiError(err, "INVITE_EXPIRED")) return "Este convite expirou (vale 72 horas). Peça um novo ao administrador.";
  if (isApiError(err, "WEAK_PASSWORD")) return "Essa senha aparece em vazamentos conhecidos. Escolha outra.";
  if (isApiError(err) && (err.status === 404 || err.status === 401)) return "Convite inválido ou já utilizado.";
  return null;
}

export function AcceptInviteForm() {
  const token = useSearchParams().get("token") ?? "";
  const { onSubmit, errors, formError, pending } = useAuthForm(
    InviteForm,
    ({ invite_token, password }) => authApi.acceptInvite({ invite_token, password }),
    { messageFor: inviteMessage, extra: () => ({ invite_token: token }) },
  );

  if (!token) {
    return (
      <Alert tone="warning" title="Link de convite incompleto">
        Abra o link exatamente como o administrador enviou.{" "}
        <Link href="/login" className="font-medium underline">
          Ir para o login
        </Link>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && <Alert tone="danger">{formError}</Alert>}
      <Field label="Crie sua senha" error={errors.password} hint={`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required autoFocus />}
      </Field>
      <Field label="Confirme a senha" error={errors.password_confirm}>
        {(p) => <Input {...p} name="password_confirm" type="password" autoComplete="new-password" required />}
      </Field>
      <Button type="submit" loading={pending} className="mt-2">
        Aceitar convite
      </Button>
    </form>
  );
}
