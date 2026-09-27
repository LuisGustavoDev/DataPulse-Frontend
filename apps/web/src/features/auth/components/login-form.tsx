"use client";

import { LoginBody } from "@datapulse/contracts";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authApi } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { useAuthForm } from "../use-auth-form";

function loginMessage(err: unknown): string | null {
  // Mensagem genérica de propósito: não revela se o e-mail existe (§8.2).
  if (isApiError(err, "INVALID_CREDENTIALS")) return "E-mail ou senha incorretos.";
  if (isApiError(err, "USER_DISABLED")) return "Seu acesso foi desativado. Fale com o administrador da empresa.";
  if (isApiError(err) && err.status === 429) return "Muitas tentativas de login. Aguarde um minuto e tente de novo.";
  return null;
}

export function LoginForm() {
  const { onSubmit, errors, formError, pending } = useAuthForm(LoginBody, authApi.login, { messageFor: loginMessage });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && <Alert tone="danger">{formError}</Alert>}
      <Field label="E-mail" error={errors.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required autoFocus />}
      </Field>
      <Field label="Senha" error={errors.password}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <Button type="submit" loading={pending} className="mt-2">
        Entrar
      </Button>
      <p className="text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Cadastre sua empresa
        </Link>
      </p>
    </form>
  );
}
