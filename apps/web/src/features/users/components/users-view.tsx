"use client";

import { CreateUserBody, type CreateUserResponse, type Role, type UpdateUserBody, type UserListItem, type UserStatus } from "@datapulse/contracts";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, fieldErrors, isApiError } from "@/lib/api/errors";
import { qk } from "@/lib/api/query-keys";
import { formatDateTime } from "@/lib/format";
import { formValues, zodFieldErrors } from "@/lib/forms";
import { useAuthenticatedSession } from "@/providers/session-provider";
import { usersApi } from "../api";

const ROLE_LABEL: Record<Role, string> = { admin: "Administrador", analyst: "Analista" };
const STATUS: Record<UserStatus, { label: string; tone: Tone }> = {
  invited: { label: "Convidado", tone: "info" },
  active: { label: "Ativo", tone: "success" },
  disabled: { label: "Desativado", tone: "neutral" },
};

export function UsersView() {
  const { user } = useAuthenticatedSession();

  if (user.role !== "admin") {
    return (
      <>
        <PageHeader title="Usuários" />
        <Alert tone="warning" title="Acesso restrito">
          Só administradores gerenciam os usuários da empresa.
        </Alert>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Usuários" description="Convide pessoas da sua empresa e defina o papel de cada uma." />
      <InviteCard />
      <UserTable currentUserId={user.id} />
    </div>
  );
}

function InviteCard() {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [invite, setInvite] = useState<CreateUserResponse | null>(null);

  const create = useMutation({
    mutationFn: usersApi.create,
    onSuccess: (res) => {
      setInvite(res);
      void queryClient.invalidateQueries({ queryKey: qk.users.all });
    },
    onError: (err) => setErrors(fieldErrors(err)),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const parsed = CreateUserBody.safeParse(formValues(form));
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));
    setErrors({});
    setInvite(null);
    create.mutate(parsed.data, { onSuccess: () => form.reset() });
  };

  const error = isApiError(create.error, "EMAIL_TAKEN") ? "Este e-mail já tem cadastro." : create.error ? errorMessage(create.error) : null;

  return (
    <Card>
      <CardHeader title="Convidar usuário" description="O convite não é enviado por e-mail: copie o link e compartilhe com a pessoa. Ele vale 72 horas." />
      <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-start gap-4">
        <Field label="E-mail" error={errors.email} className="min-w-64 flex-1">
          {(p) => <Input {...p} name="email" type="email" autoComplete="off" required />}
        </Field>
        <Field label="Papel" error={errors.role} className="w-44">
          {(p) => (
            <Select {...p} name="role" defaultValue="analyst">
              <option value="analyst">Analista</option>
              <option value="admin">Administrador</option>
            </Select>
          )}
        </Field>
        <Button type="submit" loading={create.isPending} className="mt-6.5">
          Gerar convite
        </Button>
      </form>
      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      {invite && <InviteLink invite={invite} />}
    </Card>
  );
}

/** O token só aparece nesta resposta (§8.2): some ao recarregar a página. */
function InviteLink({ invite }: { invite: CreateUserResponse }) {
  const link = `${window.location.origin}/invite?token=${encodeURIComponent(invite.invite_token)}`;
  const [copied, setCopied] = useState(false);
  return (
    <Alert
      tone="success"
      title={`Convite criado para ${invite.user.email}`}
      className="mt-4"
      actions={
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(link).then(() => setCopied(true));
          }}
        >
          {copied ? "Copiado!" : "Copiar link"}
        </Button>
      }
    >
      <p>Este link só é mostrado agora. Copie antes de sair da página.</p>
      <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="mt-2 font-mono text-xs" aria-label="Link do convite" />
    </Alert>
  );
}

function UserTable({ currentUserId }: { currentUserId: string }) {
  const query = useInfiniteQuery({
    queryKey: qk.users.all,
    queryFn: ({ pageParam, signal }) => usersApi.list(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const users = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Card className="overflow-hidden p-0">
      <div className="p-5 pb-0">
        <CardHeader title="Pessoas com acesso" />
      </div>
      {query.isPending ? (
        <div className="p-5"><Spinner label="Carregando usuários…" /></div>
      ) : query.isError ? (
        <div className="p-5"><Alert tone="danger">{errorMessage(query.error)}</Alert></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Usuários da empresa</caption>
            <thead className="border-y border-border bg-surface-2 text-left text-xs text-muted uppercase">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">E-mail</th>
                <th scope="col" className="px-5 py-3 font-medium">Papel</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3 font-medium">Último acesso</th>
                <th scope="col" className="px-5 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {query.hasNextPage && (
        <div className="border-t border-border p-3 text-center">
          <Button variant="secondary" size="sm" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
            Carregar mais
          </Button>
        </div>
      )}
    </Card>
  );
}

function UserRow({ user, isSelf }: { user: UserListItem; isSelf: boolean }) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (body: UpdateUserBody) => usersApi.update(user.id, body),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.users.all }),
  });

  const error = isApiError(update.error, "LAST_ADMIN")
    ? "A empresa precisa de pelo menos um administrador ativo."
    : update.error
      ? errorMessage(update.error)
      : null;

  return (
    <tr>
      <td className="px-5 py-3">
        <span className="font-medium">{user.email}</span>
        {isSelf && <span className="ml-2 text-xs text-muted">(você)</span>}
        {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
      </td>
      <td className="px-5 py-3">
        <Select
          aria-label={`Papel de ${user.email}`}
          value={user.role}
          disabled={update.isPending}
          onChange={(e) => update.mutate({ role: e.target.value as Role })}
          className="h-8 w-40"
        >
          {(["analyst", "admin"] as const).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
      </td>
      <td className="px-5 py-3">
        <Badge tone={STATUS[user.status].tone}>{STATUS[user.status].label}</Badge>
      </td>
      <td className="px-5 py-3 whitespace-nowrap text-muted">{formatDateTime(user.last_login_at)}</td>
      <td className="px-5 py-3 text-right">
        {user.status !== "invited" && (
          <Button
            variant="ghost"
            size="sm"
            loading={update.isPending}
            disabled={isSelf}
            title={isSelf ? "Você não pode desativar o próprio acesso" : undefined}
            onClick={() => update.mutate({ status: user.status === "disabled" ? "active" : "disabled" })}
          >
            {user.status === "disabled" ? "Reativar" : "Desativar"}
          </Button>
        )}
      </td>
    </tr>
  );
}
