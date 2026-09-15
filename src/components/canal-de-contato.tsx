import { LifeBuoy, Mail } from "lucide-react";
import {
  EMAIL_CONTATO,
  EMAIL_SUPORTE,
  INSTAGRAM_LUPA,
} from "@/lib/contato-lupa";
import { SocialLink } from "./social-links";

/**
 * Um e-mail com rótulo curto, não o endereço por extenso no botão.
 *
 * "contato@lupapp.com.br" escrito em três botões (Instagram, contato,
 * suporte) deixaria o rodapé mais largo que o card de entrar, num layout
 * que hoje só tem logo e um botão de tema. O endereço completo continua
 * indo para o `href` e para o `title` — só não repete na tela.
 */
function EmailLink({
  rotulo,
  email,
  icone,
}: {
  rotulo: string;
  email: string;
  icone: React.ReactNode;
}) {
  return (
    <a
      href={`mailto:${email}`}
      title={email}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-3 py-1.5 font-medium text-ink text-sm transition-colors hover:border-current"
    >
      {icone}
      {rotulo}
    </a>
  );
}

/**
 * Instagram e e-mail da Lupa, para quem ainda não tem conta (#239).
 *
 * Vive no layout de `(auth)` — a única parte do app que um visitante vê
 * sem sessão, já que fora daí toda rota redireciona para `/entrar`
 * (`src/proxy.ts`, `ABERTAS`). Não há home pública separada onde isto
 * pudesse ir.
 *
 * Os dois e-mails têm propósito diferente, e o rótulo diz qual é qual:
 * `contato@` é assunto comercial, `suporte@` é para quem já usa o app.
 * Confundir os dois faria uma dúvida de uso virar e-mail perdido na
 * caixa errada.
 */
export function CanalDeContato() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <SocialLink rede="instagram" url={INSTAGRAM_LUPA} />
      <EmailLink
        rotulo="Fale com a gente"
        email={EMAIL_CONTATO}
        icone={<Mail size={15} className="flex-none" />}
      />
      <EmailLink
        rotulo="Suporte"
        email={EMAIL_SUPORTE}
        icone={<LifeBuoy size={15} className="flex-none" />}
      />
    </div>
  );
}
