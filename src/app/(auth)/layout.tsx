import Link from "next/link";
import { LupaLogo } from "@/components/brand/logo";

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
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <Link href="/" aria-label="Lupa — início" className="inline-flex">
          <LupaLogo size={26} />
        </Link>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
