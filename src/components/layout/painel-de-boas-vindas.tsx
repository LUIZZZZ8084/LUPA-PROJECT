import { BadgeCheck, MapPin, ShieldCheck } from "lucide-react";
import Image from "next/image";

const PONTOS = [
  {
    icon: BadgeCheck,
    titulo: "Empresas de verdade",
    texto: "Conferimos o CNPJ na Receita: a empresa existe e está ativa.",
  },
  {
    icon: ShieldCheck,
    titulo: "Uma conta por pessoa",
    texto: "Cada CPF vale uma conta só, e ele precisa ser válido.",
  },
  {
    icon: MapPin,
    titulo: "Gente daqui",
    texto: "O que está mais perto de você aparece primeiro.",
  },
] as const;

/**
 * O painel ao lado de entrar e criar conta, só no computador (#525).
 *
 * Num monitor, o formulário sozinho ficava como uma coluna de celular no meio
 * de uma tela vazia. O painel ocupa a metade que sobrava com o que a Lupa
 * promete, nas mesmas palavras do bloco de confiança da home, e com a mesma
 * foto e as mesmas cores do banner: quem vem da home reconhece o lugar.
 *
 * **Abaixo de `lg` ele não existe** (`hidden`): a foto tem carregamento
 * preguiçoso e não é baixada onde a caixa não aparece, então o celular não
 * paga por ela.
 */
export function PainelDeBoasVindas() {
  return (
    <aside
      aria-label="Por que a Lupa"
      className="relative hidden overflow-hidden rounded-[var(--radius-panel)] border border-[color:var(--banner-borda)] bg-[linear-gradient(to_bottom_right,var(--banner-de),var(--banner-ate))] lg:sticky lg:top-6 lg:flex lg:flex-col"
    >
      <div className="relative z-10 max-w-sm p-10">
        <p className="font-semibold text-sm text-vagas">
          Vagas e serviços em todo o Brasil
        </p>
        <h2 className="mt-3 text-balance font-bold text-3xl leading-tight tracking-tight">
          Gente de confiança, perto de você
        </h2>

        <ul className="mt-8 space-y-5">
          {PONTOS.map(({ icon: Icon, titulo, texto }) => (
            <li key={titulo} className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-panel/70 text-vagas">
                <Icon size={20} aria-hidden />
              </span>
              <span>
                <span className="block font-semibold text-sm">{titulo}</span>
                <span className="mt-0.5 block text-muted text-sm leading-snug">
                  {texto}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Image
        src="/banner/trabalhador-recortado-v2.webp"
        alt=""
        width={435}
        height={476}
        sizes="320px"
        className="pointer-events-none mt-auto h-auto w-72 max-w-[70%] self-end"
      />
    </aside>
  );
}
