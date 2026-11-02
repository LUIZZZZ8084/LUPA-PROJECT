import Link from "next/link";
import { LupaLogo } from "@/components/brand/logo";
import { CanalDeContato } from "@/components/canal-de-contato";
import { PainelDeBoasVindas } from "@/components/layout/painel-de-boas-vindas";
import { AlternarTema } from "@/components/theme-toggle";

/**
 * Entrar e criar conta, sem o resto do app em volta.
 *
 * Estas telas não têm cabeçalho de navegação nem barra inferior. O motivo
 * é direto: um botão "Entrar" no topo, ao lado do formulário de entrar, é
 * redundante e sugere que o login está em outro lugar. E os links de
 * navegação levariam de volta ao muro, já que sem sessão toda rota
 * redireciona para cá.
 *
 * Sobra a marca, que continua sendo o caminho de volta ao início.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-site items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Lupa — início"
          className="inline-flex h-11 items-center"
        >
          <LupaLogo size={26} />
        </Link>
        <AlternarTema />
      </div>
      {/*
       * No computador (#525) a tela se divide: o painel de boas-vindas à
       * esquerda e o formulário à direita. Abaixo de `lg` o painel não existe
       * e `children` fica sozinho, como sempre foi.
       */}
      <div className="flex-1 lg:mx-auto lg:grid lg:w-full lg:max-w-site lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-10 lg:px-8">
        <PainelDeBoasVindas />
        <div className="lg:self-center">{children}</div>
      </div>

      {/*
        Instagram e e-mail, no rodapé das quatro telas que um visitante vê
        sem sessão (#239). Não é gateado por `CONTROLADOR`: diferente de
        Termos e Privacidade, isto não é documento legal.
      */}
      <div className="mx-auto w-full max-w-site px-4 py-6 sm:px-6 lg:px-8">
        <CanalDeContato />
      </div>
    </div>
  );
}
