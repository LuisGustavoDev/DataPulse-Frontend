import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <AuthCard title="Entrar" description="Acesse os lotes e dashboards da sua empresa." redirectIfAuthenticated>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
