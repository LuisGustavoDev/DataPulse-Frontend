import { Logo } from "@/components/logo";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <Logo className="text-lg" />
      {children}
    </main>
  );
}
