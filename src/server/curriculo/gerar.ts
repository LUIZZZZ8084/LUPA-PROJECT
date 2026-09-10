import "server-only";

import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { createElement as h, type ReactNode } from "react";
import { formatPhone } from "@/lib/format";

/**
 * Monta o currículo em PDF a partir do que está salvo no perfil.
 *
 * Função pura de propósito — recebe dados já lidos, não sessão nem
 * repositório. Quem decide se a pessoa pode gerar e busca os dados é
 * `src/server/curriculo/servico.ts`; aqui só existe a regra de como o PDF
 * fica, testável sem banco e sem sessão.
 *
 * Nada é guardado: o PDF é remontado a cada download, a partir do perfil
 * como ele está naquele momento. Editar o perfil depois da compra não
 * exige comprar de novo.
 *
 * `createElement` em vez de JSX: `src/server/**` só é instrumentado como
 * `.ts` na cobertura de teste (`vitest.config.mts`), e o resto do domínio
 * do servidor não usa marcação — introduzir o único `.tsx` desta pasta
 * tiraria o arquivo da métrica em vez de somar a ela.
 */

export interface DadosCurriculo {
  nomeCompleto: string;
  email: string;
  telefone: string;
  cidade: string;
  bairro: string | null;
  areaDesejada: string | null;
  resumo: string | null;
  formacao: string | null;
  habilidades: string[];
  disponibilidade: string | null;
}

const estilos = StyleSheet.create({
  pagina: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  nome: { fontSize: 22, fontFamily: "Helvetica-Bold" },
  area: { fontSize: 13, color: "#3a3a3a", marginTop: 2 },
  contato: { fontSize: 9.5, color: "#555555", marginTop: 8 },
  secao: { marginTop: 20 },
  tituloSecao: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    paddingBottom: 4,
    marginBottom: 8,
  },
  paragrafo: { lineHeight: 1.5 },
  habilidades: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  habilidade: {
    fontSize: 9.5,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
});

function secao(titulo: string, conteudo: ReactNode) {
  return h(
    View,
    { style: estilos.secao },
    h(Text, { style: estilos.tituloSecao }, titulo),
    conteudo,
  );
}

function curriculo(dados: DadosCurriculo) {
  const localizacao = dados.bairro
    ? `${dados.bairro}, ${dados.cidade}`
    : dados.cidade;

  const secoes = [
    dados.resumo &&
      secao("Resumo", h(Text, { style: estilos.paragrafo }, dados.resumo)),
    dados.habilidades.length > 0 &&
      secao(
        "Habilidades",
        h(
          View,
          { style: estilos.habilidades },
          dados.habilidades.map((hab) =>
            h(Text, { key: hab, style: estilos.habilidade }, hab),
          ),
        ),
      ),
    dados.formacao &&
      secao("Formação", h(Text, { style: estilos.paragrafo }, dados.formacao)),
    dados.disponibilidade &&
      secao(
        "Disponibilidade",
        h(Text, { style: estilos.paragrafo }, dados.disponibilidade),
      ),
  ].filter(Boolean);

  return h(
    Document,
    {
      title: `Currículo — ${dados.nomeCompleto}`,
      author: "Lupa",
      creator: "Lupa",
    },
    h(
      Page,
      { size: "A4", style: estilos.pagina },
      h(Text, { style: estilos.nome }, dados.nomeCompleto),
      dados.areaDesejada &&
        h(Text, { style: estilos.area }, dados.areaDesejada),
      h(
        Text,
        { style: estilos.contato },
        [formatPhone(dados.telefone), dados.email, localizacao].join("  ·  "),
      ),
      ...secoes,
    ),
  );
}

export async function gerarCurriculoPdf(
  dados: DadosCurriculo,
): Promise<Buffer> {
  return renderToBuffer(curriculo(dados));
}
