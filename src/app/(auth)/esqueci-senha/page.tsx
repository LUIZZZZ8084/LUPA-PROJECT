import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { EsqueciSenhaForm } from "./form";

export const metadata: Metadata = {
  title: "Esqueci minha senha",
  description: "Receba um link para criar uma senha nova na Lupa.",
};

export default function EsqueciSenhaPage() {
  return (
    <PageShell width="narrow" className="max-w-md pt-12">
      <EsqueciSenhaForm />
    </PageShell>
  );
}
