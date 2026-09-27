import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { SignupForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <AuthCard title="Cadastre sua empresa" description="Crie a conta da empresa e o seu usuário administrador." redirectIfAuthenticated>
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthCard>
  );
}
