"use client";

import { PASSWORD_MIN_LENGTH, SignupBody } from "@datapulse/contracts";
import Link from "next/link";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authApi } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { useAuthForm } from "../use-auth-form";

const SignupForm_ = SignupBody.extend({ password_confirm: z.string() }).refine(
  (v) => v.password === v.password_confirm,
  { path: ["password_confirm"], message: "As senhas não conferem" },
);

function signupMessage(err: unknown): string | null {
  if (isApiError(err, "EMAIL_TAKEN")) return "Este e-mail já está cadastrado. Entre com ele ou use outro.";
  if (isApiError(err, "WEAK_PASSWORD")) return "Essa senha aparece em vazamentos conhecidos. Escolha outra.";
  return null;
}

export function SignupForm() {
  const { onSubmit, errors, formError, pending } = useAuthForm(
    SignupForm_,
    ({ company_name, email, password }) => authApi.signup({ company_name, email, password }),
    { messageFor: signupMessage },
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && <Alert tone="danger">{formError}</Alert>}
      <Field label="Nome da empresa" error={errors.company_name}>
        {(p) => <Input {...p} name="company_name" autoComplete="organization" required autoFocus />}
      </Field>
      <Field label="Seu e-mail" error={errors.email} hint="Você será o administrador da empresa.">
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}
      </Field>
      <Field label="Senha" error={errors.password} hint={`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required />}
      </Field>
      <Field label="Confirme a senha" error={errors.password_confirm}>
        {(p) => <Input {...p} name="password_confirm" type="password" autoComplete="new-password" required />}
      </Field>
      <Button type="submit" loading={pending} className="mt-2">
        Criar conta
      </Button>
      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
