"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { sairDaConta } from "@/app/conta/actions";
import { Button } from "@/components/ui/button";

export function SairButton() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          await sairDaConta({});
          // refresh em vez de push: o layout inteiro depende da sessão.
          router.refresh();
        })
      }
    >
      <LogOut size={15} />
      Sair da conta
    </Button>
  );
}
