import "server-only";

import {
  Document,
  Font,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { createElement as h, type ReactNode } from "react";
import { formatPhone } from "@/lib/format";
import type { Experience } from "@/lib/types";

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
  areaDesejada: string | null;
  resumo: string | null;
  formacao: string | null;
  habilidades: string[];
  experiencias: Experience[];
  disponibilidade: string | null;
}

/**
 * O modelo (#531): uma coluna, nesta ordem, e seção vazia não entra.
 *
 * É o formato que recrutador e sistema de triagem leem sem tropeçar — o
 * que se pede numa vaga daqui é ler de cima para baixo o que a pessoa quer,
 * o que ela já fez e o que sabe. Duas colunas, foto e gráfico de nível de
 * habilidade ficaram de fora pelo mesmo motivo: o sistema de triagem lê a
 * página como texto corrido, e coluna lateral vira frase embaralhada.
 *
 * **A experiência vem antes da formação.** Para quem procura emprego aqui
 * — operador, motorista, vendedor —, o que decide a entrevista é onde a
 * pessoa já trabalhou; a escolaridade raramente é o diferencial.
 */
export type SecaoDoCurriculo =
  | { titulo: string; tipo: "texto"; texto: string }
  | { titulo: string; tipo: "experiencias"; itens: Experience[] }
  | { titulo: string; tipo: "lista"; itens: string[] };

const limpo = (s: string | null | undefined) => s?.trim() || null;

export function secoesDoCurriculo(dados: DadosCurriculo): SecaoDoCurriculo[] {
  const area = limpo(dados.areaDesejada);
  const resumo = limpo(dados.resumo);
  const formacao = limpo(dados.formacao);
  const disponibilidade = limpo(dados.disponibilidade);

  const experiencias = dados.experiencias
    .map((e) => ({
      role: e.role.trim(),
      company: e.company.trim(),
      period: e.period.trim(),
      description: limpo(e.description) ?? undefined,
    }))
    .filter((e) => e.role || e.company);

  const habilidades = dados.habilidades.map((s) => s.trim()).filter(Boolean);

  const secoes: (SecaoDoCurriculo | null)[] = [
    area
      ? {
          titulo: "Objetivo",
          tipo: "texto",
          texto: `Atuar na área de ${area}.`,
        }
      : null,
    resumo
      ? { titulo: "Resumo profissional", tipo: "texto", texto: resumo }
      : null,
    experiencias.length > 0
      ? {
          titulo: "Experiência profissional",
          tipo: "experiencias",
          itens: experiencias,
        }
      : null,
    formacao ? { titulo: "Formação", tipo: "texto", texto: formacao } : null,
    habilidades.length > 0
      ? { titulo: "Habilidades", tipo: "lista", itens: habilidades }
      : null,
    disponibilidade
      ? { titulo: "Disponibilidade", tipo: "texto", texto: disponibilidade }
      : null,
  ];

  return secoes.filter((s): s is SecaoDoCurriculo => s !== null);
}

/*
 * Azul-marinho sobre branco: sóbrio, e continua legível impresso em preto
 * e branco — muita empresa daqui ainda recebe o currículo na mão. As cores
 * são do PDF, não do app: a página não tem tema escuro.
 */
const COR = {
  texto: "#1f2933",
  suave: "#52606d",
  destaque: "#1f4e79",
  linha: "#c5d0db",
};

/*
 * Sem hifenização. O padrão do react-pdf quebra a palavra com hífen no fim
 * da linha ("dis-tribuição"), com regra de inglês; num currículo isso parece
 * erro de digitação, e o sistema de triagem lê a palavra partida em duas.
 */
Font.registerHyphenationCallback((palavra) => [palavra]);

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 50,
    fontSize: 10.5,
    fontFamily: "Helvetica",
    color: COR.texto,
  },
  /*
   * A altura de linha vai em cada texto, e não na `Page`: lá ela faz o
   * react-pdf sumir com o rodapé, e num `View` em volta ela é herdada
   * multiplicada e abre a página inteira. E o `fontSize` vai junto: sem
   * ele, o multiplicador é aplicado ao tamanho padrão do react-pdf, e não
   * ao da página.
   */
  texto: { fontSize: 10.5, lineHeight: 1.45 },
  nome: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: COR.destaque,
    lineHeight: 1.15,
  },
  contato: { fontSize: 9.5, color: COR.suave, marginTop: 6 },
  regua: { height: 2, backgroundColor: COR.destaque, marginTop: 12 },
  secao: { marginTop: 16 },
  tituloSecao: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: COR.destaque,
    textTransform: "uppercase",
    borderBottomWidth: 0.75,
    borderBottomColor: COR.linha,
    paddingBottom: 3,
    marginBottom: 8,
  },
  experiencia: { marginBottom: 8 },
  linhaDoCargo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  cargo: { fontSize: 11, fontFamily: "Helvetica-Bold", flexShrink: 1 },
  periodo: { fontSize: 9.5, color: COR.suave, marginLeft: 12 },
  empresa: {
    fontFamily: "Helvetica-Oblique",
    color: COR.suave,
    fontSize: 10.5,
    lineHeight: 1.45,
  },
  descricao: { marginTop: 3, fontSize: 10.5, lineHeight: 1.45 },
  habilidades: { flexDirection: "row", flexWrap: "wrap" },
  habilidade: {
    width: "50%",
    paddingRight: 10,
    marginBottom: 2,
    fontSize: 10.5,
    lineHeight: 1.45,
  },
  rodape: {
    position: "absolute",
    bottom: 26,
    right: 50,
    fontSize: 8,
    color: COR.suave,
  },
});

function experiencia(e: Experience, i: number) {
  return h(
    View,
    // Uma experiência nunca se parte entre duas páginas: cargo numa folha
    // e descrição na outra se lê como duas coisas diferentes.
    { key: i, style: estilos.experiencia, wrap: false },
    h(
      View,
      { style: estilos.linhaDoCargo },
      h(Text, { style: estilos.cargo }, e.role || e.company),
      e.period ? h(Text, { style: estilos.periodo }, e.period) : null,
    ),
    e.role && e.company ? h(Text, { style: estilos.empresa }, e.company) : null,
    e.description ? h(Text, { style: estilos.descricao }, e.description) : null,
  );
}

function conteudo(secao: SecaoDoCurriculo): ReactNode {
  switch (secao.tipo) {
    case "texto":
      return h(Text, { style: estilos.texto }, secao.texto);
    case "experiencias":
      return secao.itens.map(experiencia);
    case "lista":
      /*
       * Texto com marcador, em duas colunas, e não as caixinhas de antes:
       * caixa desenhada não é texto para o sistema de triagem, e a
       * habilidade que a vaga pede sumia da leitura dele.
       */
      return h(
        View,
        { style: estilos.habilidades },
        secao.itens.map((item) =>
          h(Text, { key: item, style: estilos.habilidade }, `•  ${item}`),
        ),
      );
  }
}

function curriculo(dados: DadosCurriculo) {
  const contato = [
    formatPhone(dados.telefone),
    dados.email,
    dados.cidade,
  ].filter(Boolean);

  return h(
    Document,
    {
      title: `Currículo — ${dados.nomeCompleto}`,
      author: dados.nomeCompleto,
      creator: "Lupa",
    },
    h(
      Page,
      { size: "A4", style: estilos.pagina },
      h(Text, { style: estilos.nome }, dados.nomeCompleto),
      h(Text, { style: estilos.contato }, contato.join("   |   ")),
      h(View, { style: estilos.regua }),
      ...secoesDoCurriculo(dados).map((secao) =>
        h(
          View,
          { key: secao.titulo, style: estilos.secao },
          // O título não fica sozinho no pé da página, longe do conteúdo.
          h(
            Text,
            { style: estilos.tituloSecao, minPresenceAhead: 40 },
            secao.titulo,
          ),
          conteudo(secao),
        ),
      ),
      // Número da página só quando há mais de uma.
      h(Text, {
        style: estilos.rodape,
        fixed: true,
        render: ({
          pageNumber,
          totalPages,
        }: {
          pageNumber: number;
          totalPages: number;
        }) => (totalPages > 1 ? `Página ${pageNumber} de ${totalPages}` : ""),
      }),
    ),
  );
}

export async function gerarCurriculoPdf(
  dados: DadosCurriculo,
): Promise<Buffer> {
  return renderToBuffer(curriculo(dados));
}
