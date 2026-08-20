import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { SignInForm } from "./form";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta na Lupa.",
};

export default function EntrarPage() {
  return (
    <PageShell width="narrow" className="max-w-md pt-12">
      <SignInForm />
    </PageShell>
  );
}
