import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AcceptInviteForm } from "@/features/auth/components/accept-invite-form";

export const metadata: Metadata = { title: "Aceitar convite", referrer: "no-referrer" };

export default function InvitePage() {
  return (
    <AuthCard title="Aceitar convite" description="Defina sua senha para entrar na conta da empresa.">
      <Suspense>
        <AcceptInviteForm />
      </Suspense>
    </AuthCard>
  );
}
