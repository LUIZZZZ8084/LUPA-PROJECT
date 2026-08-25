"use client";

import { Building2, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { sairDaConta } from "@/app/conta/actions";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface UsuarioDoMenu {
  nome: string;
  papel: string;
  avatarUrl: string | null;
  cidade: string;
}

/** Atalhos que só fazem sentido para alguns papéis. */
function atalhosDoPapel(papel: string) {
  if (papel === "empresa") {
    return [{ href: "/empresa", label: "Painel da empresa", Icon: Building2 }];
  }
  if (papel === "admin") {
    return [
      {
        href: "/admin/painel",
        label: "Painel do admin",
        Icon: LayoutDashboard,
      },
    ];
  }
  return [];
}

/**
 * Foto no lugar do botão "Entrar", com o menu da conta atrás dela.
 *
 * Quem já entrou não pode ver "Entrar": o botão sugere que a sessão não
 * pegou, e a pessoa clica achando que precisa entrar de novo.
 *
 * O menu lista só destinos que existem. Atalho que leva a 404 é pior do
 * que atalho ausente — a pessoa conclui que o app está quebrado, não que
 * a função ainda não foi feita.
 */
export function MenuDoUsuario({ usuario }: { usuario: UsuarioDoMenu }) {
  const [aberto, setAberto] = useState(false);
  const [saindo, iniciarSaida] = useTransition();
  const router = useRouter();
  const caixa = useRef<HTMLDivElement>(null);
  const idMenu = useId();

  /*
   * Fecha ao clicar fora e no Escape. Sem isso o menu fica preso aberto no
   * celular, onde não existe "clicar em outro lugar" tão óbvio quanto no
   * desktop.
   */
  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(e: MouseEvent) {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const papelLegivel =
    usuario.papel === "admin"
      ? "Administrador"
      : (ROLE_LABELS[usuario.papel as keyof typeof ROLE_LABELS] ??
        usuario.papel);

  return (
    <div className="relative" ref={caixa}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={idMenu}
        /*
         * O nome fica oculto no celular, e o avatar sozinho não dá nome ao
         * botão — o leitor de tela anunciaria só "botão".
         */
        aria-label={`Conta de ${usuario.nome}`}
        className={cn(
          "flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors",
          aberto ? "bg-panel-2" : "hover:bg-panel-2",
        )}
      >
        <Avatar src={usuario.avatarUrl} name={usuario.nome} size="sm" />
      </button>

      {aberto && (
        <div
          id={idMenu}
          role="menu"
          aria-label="Conta"
          className={cn(
            "absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-[var(--radius-card)]",
            "border border-line bg-panel shadow-xl",
          )}
        >
          <div className="border-line border-b px-4 py-3">
            <p className="truncate font-semibold text-sm">{usuario.nome}</p>
            <p className="mt-0.5 truncate text-muted text-xs">{papelLegivel}</p>
          </div>

          <nav className="p-1.5">
            <Link
              href="/perfil"
              role="menuitem"
              onClick={() => setAberto(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-panel-2"
            >
              <UserRound size={16} className="text-muted" />
              Ver perfil
            </Link>

            {atalhosDoPapel(usuario.papel).map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={() => setAberto(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-panel-2"
              >
                <Icon size={16} className="text-muted" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="border-line border-t p-1.5">
            <button
              type="button"
              role="menuitem"
              disabled={saindo}
              onClick={() =>
                iniciarSaida(async () => {
                  await sairDaConta({});
                  setAberto(false);
                  // O layout inteiro depende da sessão; `refresh` o remonta.
                  router.refresh();
                })
              }
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-panel-2 disabled:text-muted"
            >
              <LogOut size={16} className="text-muted" />
              {saindo ? "Saindo…" : "Sair da conta"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
