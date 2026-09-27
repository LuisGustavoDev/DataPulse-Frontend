"use client";

import type { AuthSession } from "@datapulse/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { z } from "zod";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { formValues, zodFieldErrors } from "@/lib/forms";
import { useSession } from "@/providers/session-provider";

/** Só aceita caminhos internos em ?next=, para o login não virar open redirect. */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/batches";
}

/**
 * Fluxo comum de login, signup e aceite de convite: valida com o schema do contrato,
 * chama a API, grava a sessão e segue para ?next=.
 */
export function useAuthForm<S extends z.ZodType>(
  schema: S,
  submit: (body: z.infer<S>) => Promise<AuthSession>,
  options: { messageFor?: (err: unknown) => string | null; extra?: () => Record<string, string> } = {},
) {
  const { startSession } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: submit,
    onSuccess: (session) => {
      startSession(session);
      router.replace(safeNext(searchParams.get("next")));
    },
    onError: (err) => setErrors(fieldErrors(err)),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = schema.safeParse({ ...formValues(e.currentTarget), ...options.extra?.() });
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  };

  const formError = mutation.error ? (options.messageFor?.(mutation.error) ?? errorMessage(mutation.error)) : null;
  return { onSubmit, errors, formError, pending: mutation.isPending };
}
