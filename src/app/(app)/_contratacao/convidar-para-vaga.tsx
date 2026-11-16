"use client";

import { Send } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { whatsappLink } from "@/lib/format";

/**
 * Convidar um talento para uma vaga nova (#620).
 *
 * **É um convite, não uma candidatura.** O botão abre o WhatsApp da empresa
 * com a mensagem e o link da vaga, e a pessoa se candidata se quiser. Criar a
 * candidatura em nome dela seria usar o dado que ela deixou numa vaga para
 * outra coisa que ela não pediu.
 *
 * O link da vaga é montado na hora do clique, com o domínio em que a empresa
 * está, como no "Divulgar" da vaga.
 */
export function mensagemDeConvite({
  nome,
  empresa,
  cargo,
  cidade,
  link,
}: {
  nome: string;
  empresa: string;
  cargo: string;
  cidade: string;
  link: string;
}): string {
  const primeiro = nome.trim().split(/\s+/)[0];
  return (
    `Olá, ${primeiro}! Aqui é da ${empresa}. Você se candidatou a uma vaga ` +
    `nossa e lembramos de você: abrimos a vaga de ${cargo} em ${cidade}. ` +
    `Se tiver interesse, veja e candidate-se pela Lupa: ${link}`
  );
}

export function ConvidarParaVaga({
  nome,
  telefone,
  empresa,
  vagas,
}: {
  nome: string;
  telefone: string;
  empresa: string;
  vagas: { id: string; titulo: string; cidade: string }[];
}) {
  const [vagaId, setVagaId] = useState(vagas[0]?.id ?? "");
  const idDoSeletor = useId();
  const vaga = vagas.find((v) => v.id === vagaId);

  function convidar() {
    if (!vaga) return;
    const link = `${window.location.origin}/vagas/${encodeURIComponent(vaga.id)}`;
    window.open(
      whatsappLink(
        telefone,
        mensagemDeConvite({
          nome,
          empresa,
          cargo: vaga.titulo,
          cidade: vaga.cidade,
          link,
        }),
      ),
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-line border-t px-4 py-3">
      <label htmlFor={idDoSeletor} className="sr-only">
        Vaga para convidar {nome}
      </label>
      <Select
        id={idDoSeletor}
        value={vagaId}
        onChange={(e) => setVagaId(e.target.value)}
        className="h-11 min-w-0 flex-1 py-0 pl-3 text-xs"
      >
        {vagas.map((v) => (
          <option key={v.id} value={v.id}>
            {v.titulo}
          </option>
        ))}
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={convidar}
        aria-label={`Convidar ${nome} no WhatsApp`}
      >
        <Send size={14} aria-hidden />
        Convidar
      </Button>
    </div>
  );
}
