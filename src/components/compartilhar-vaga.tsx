"use client";

import { Check, Copy, Download, Share2 } from "lucide-react";
import { useState } from "react";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";

/**
 * Divulgar a vaga: WhatsApp, copiar o link e baixar a arte de story (#490).
 *
 * A empresa já tem alcance — o perfil dela no Instagram, o grupo de
 * WhatsApp do bairro —, e é por ali que as vagas da cidade já circulam. O
 * que faltava era um destino para o que ela posta: o link da vaga abre sem
 * login, com prévia própria, e a arte vertical vai direto para o story.
 *
 * O endereço absoluto vem de `window.location.origin` na hora do clique, e
 * não de uma variável: este componente é de cliente, e o link que a pessoa
 * copia precisa ser o do domínio em que ela está, em produção e em preview.
 *
 * **O texto do WhatsApp é editável pela própria conversa**, não por um
 * campo aqui: o `wa.me/?text=` abre o aplicativo com a mensagem pronta e a
 * pessoa escolhe para quem manda e o que muda — um campo a mais seria
 * atrito sem ganho.
 */
interface VagaDivulgada {
  vagaId: string;
  cargo: string;
  cidade: string;
  /** Sem o nome da empresa, a mensagem do WhatsApp o omite. */
  empresa?: string;
}

function linkDaVaga(vagaId: string): string {
  return `${window.location.origin}/vagas/${encodeURIComponent(vagaId)}`;
}

/**
 * Abre o WhatsApp com a mensagem da vaga pronta. Uma regra só para o texto,
 * usada pelo painel de divulgação, pelo atalho da aba Vagas (#567) e pelo
 * compartilhar de quem não é o dono (#572).
 *
 * **Quem manda muda a frase.** O dono diz "Estamos contratando"; quem
 * repassa a vaga para um amigo não está contratando ninguém, e a mesma frase
 * na boca dele faria o amigo achar que a vaga é dele.
 */
function abrirWhatsAppDaVaga(
  { vagaId, cargo, cidade, empresa }: VagaDivulgada,
  quemManda: "dono" | "indicacao" = "dono",
) {
  const link = linkDaVaga(vagaId);
  const quem = empresa ? ` — ${empresa}` : "";
  const mensagem =
    quemManda === "dono"
      ? `Estamos contratando: ${cargo}${quem}, ${cidade}.\n` +
        `Veja a vaga e candidate-se pela Lupa: ${link}`
      : `Vi esta vaga na Lupa e lembrei de você: ${cargo}${quem}, ${cidade}.\n` +
        `Veja e candidate-se: ${link}`;
  window.open(
    `https://wa.me/?text=${encodeURIComponent(mensagem)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

/**
 * O atalho da aba Vagas (#567): só o WhatsApp, que é por onde as vagas da
 * cidade circulam. Copiar o link e baixar a arte continuam na página da
 * vaga — a linha da lista já tem Editar e Encerrar, e mais três botões em
 * cada vaga empurrariam o resto para fora da tela do celular.
 */
export function EnviarVagaNoWhatsApp(props: VagaDivulgada) {
  return (
    <Button
      type="button"
      variant="whatsapp"
      size="sm"
      aria-label={`Enviar a vaga ${props.cargo} no WhatsApp`}
      onClick={() => abrirWhatsAppDaVaga(props)}
    >
      <Share2 size={14} aria-hidden />
      Divulgar
    </Button>
  );
}

/**
 * Copiar o link da vaga, com o aviso de copiado e o plano B: sem permissão
 * para a área de transferência (navegador embutido de rede social, por
 * exemplo), o link aparece na tela para ser copiado à mão.
 */
function useCopiarLink(vagaId: string) {
  const [copiado, setCopiado] = useState(false);
  const [manual, setManual] = useState<string | null>(null);

  async function copiar() {
    setManual(null);
    try {
      await navigator.clipboard.writeText(linkDaVaga(vagaId));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setManual(linkDaVaga(vagaId));
    }
  }

  return { copiado, manual, copiar };
}

function BotaoCopiar({
  copiado,
  copiar,
}: {
  copiado: boolean;
  copiar: () => void;
}) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={copiar}>
      {copiado ? (
        <Check size={14} className="text-vagas" />
      ) : (
        <Copy size={14} />
      )}
      {copiado ? "Link copiado" : "Copiar link"}
    </Button>
  );
}

function LinkManual({ link }: { link: string | null }) {
  if (!link) return null;
  return (
    <p className="mt-2 break-all text-muted text-xs" role="status">
      Copie o link: <span className="select-all text-ink">{link}</span>
    </p>
  );
}

/**
 * Compartilhar a vaga sem ser o dono (#572): candidato, prestador, empresa
 * que não a publicou, e quem abriu o link sem conta.
 *
 * Quem procura emprego é quem mais repassa vaga — para o irmão, para o grupo
 * do bairro —, e até aqui precisava copiar o endereço do navegador à mão.
 * Dois botões só, WhatsApp e copiar: a arte de story é material de quem
 * divulga a própria vaga.
 *
 * **Discreto de propósito (#574):** nesta página o principal é
 * candidatar-se, e um botão verde cheio aqui disputava atenção com ele. Os
 * dois são de contorno, e o título fica no tom secundário.
 */
export function IndicarVaga(props: VagaDivulgada) {
  const { copiado, manual, copiar } = useCopiarLink(props.vagaId);

  return (
    <div className="mt-6 border-line border-t pt-5">
      <h2 className="flex items-center gap-1.5 font-medium text-muted text-sm">
        <Share2 size={14} aria-hidden />
        Conhece alguém para esta vaga?
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => abrirWhatsAppDaVaga(props, "indicacao")}
        >
          <Share2 size={14} aria-hidden />
          Enviar no WhatsApp
        </Button>
        <BotaoCopiar copiado={copiado} copiar={copiar} />
      </div>
      <LinkManual link={manual} />
    </div>
  );
}

export function CompartilharVaga({
  vagaId,
  cargo,
  cidade,
  empresa,
  titulo = "Divulgue esta vaga",
  recolhido = false,
}: {
  vagaId: string;
  cargo: string;
  cidade: string;
  /** Sem o nome da empresa, a mensagem do WhatsApp o omite. */
  empresa?: string;
  titulo?: string;
  /** Sem a moldura de painel, para caber dentro de outra tela. */
  recolhido?: boolean;
}) {
  const { copiado, manual, copiar } = useCopiarLink(vagaId);

  function abrirWhatsApp() {
    abrirWhatsAppDaVaga({ vagaId, cargo, cidade, empresa });
  }

  const corpo = (
    <>
      <div className="flex items-center gap-2">
        <Share2 size={16} className="text-empresas" />
        <h2 className="font-bold text-sm">{titulo}</h2>
      </div>
      <p className="mt-1 text-muted text-sm leading-relaxed">
        O link abre sem login e aparece com o cargo e a cidade na prévia do
        WhatsApp, do Instagram e do Facebook.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="empresas"
          size="sm"
          onClick={abrirWhatsApp}
        >
          <Share2 size={14} />
          Enviar no WhatsApp
        </Button>
        <BotaoCopiar copiado={copiado} copiar={copiar} />
        {/*
          `<a>` comum, e não `Link`: o `Link` pré-busca o destino, e este é um
          endpoint que renderiza uma imagem de 1080 × 1920 a cada chamada.
        */}
        <ButtonAnchor
          href={`/api/vagas/${encodeURIComponent(vagaId)}/arte`}
          variant="outline"
          size="sm"
          download="vaga-lupa.png"
        >
          <Download size={14} />
          Baixar arte para story
        </ButtonAnchor>
      </div>

      <LinkManual link={manual} />
    </>
  );

  return recolhido ? (
    <div>{corpo}</div>
  ) : (
    <Panel className="mb-4">{corpo}</Panel>
  );
}
