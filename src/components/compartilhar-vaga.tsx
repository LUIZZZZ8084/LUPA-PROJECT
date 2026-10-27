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
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const caminho = `/vagas/${encodeURIComponent(vagaId)}`;

  function link() {
    return `${window.location.origin}${caminho}`;
  }

  function abrirWhatsApp() {
    const quem = empresa ? ` — ${empresa}` : "";
    const mensagem =
      `Estamos contratando: ${cargo}${quem}, ${cidade}.\n` +
      `Veja a vaga e candidate-se pela Lupa: ${link()}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(mensagem)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function copiar() {
    setErro(null);
    try {
      await navigator.clipboard.writeText(link());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão para a área de transferência (navegador embutido de
      // rede social, por exemplo): o link aparece para ser copiado à mão.
      setErro(link());
    }
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
        <Button type="button" variant="outline" size="sm" onClick={copiar}>
          {copiado ? (
            <Check size={14} className="text-vagas" />
          ) : (
            <Copy size={14} />
          )}
          {copiado ? "Link copiado" : "Copiar link"}
        </Button>
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

      {erro && (
        <p className="mt-2 break-all text-muted text-xs" role="status">
          Copie o link: <span className="select-all text-ink">{erro}</span>
        </p>
      )}
    </>
  );

  return recolhido ? (
    <div>{corpo}</div>
  ) : (
    <Panel className="mb-4">{corpo}</Panel>
  );
}
