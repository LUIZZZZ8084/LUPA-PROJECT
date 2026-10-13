import "server-only";

import { getJobById } from "@/lib/data";
import { TETO_ADMIN } from "@/lib/limites-de-lista";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { clienteDeServico } from "@/lib/supabase/service";
import { apagarFotoDeTrabalho } from "../arquivos/servico";
import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioPublicacoes } from "../publicacoes";
import type { Publicacao } from "../publicacoes/tipos";
import { repositorioUsuarios } from "../repositories";
import { repositorioVagas } from "../vagas";

/**
 * Denúncia de vaga, de avaliação e de foto de trabalho, e a decisão do
 * admin (#435, #452).
 *
 * Decisão do Luiz em 13/10/2026: quem usa o app denuncia, e só o admin
 * decide. **Nada sai do ar sozinho** — ocultar depois de N denúncias seria
 * mais rápido contra golpe, e daria a um concorrente o botão de derrubar o
 * anúncio de outro.
 *
 * O denunciante nunca aparece para o denunciado: a tabela é fechada para
 * as chaves anônima e autenticada, e nenhuma tela além do painel do admin
 * a lê.
 */

export type AlvoDenuncia = "vaga" | "avaliacao" | "publicacao";
export type MotivoDenuncia = "golpe" | "falsa" | "ofensiva" | "outro";

/** O texto de cada motivo, num lugar só: a tela e o painel leem daqui. */
export const MOTIVOS_DE_DENUNCIA: Record<MotivoDenuncia, string> = {
  golpe: "Golpe ou cobrança de taxa",
  falsa: "Falsa ou enganosa",
  ofensiva: "Ofensiva ou discriminatória",
  outro: "Outro motivo",
};

export interface NovaDenuncia {
  alvo: AlvoDenuncia;
  alvoId: string;
  /**
   * Para a avaliação: de quem é o perfil onde ela aparece. Na foto, quem
   * diz é a própria publicação, e o que vier aqui é ignorado.
   */
  prestadorId?: string | null;
  motivo: MotivoDenuncia;
  detalhe?: string | null;
}

interface Denuncia {
  alvo: AlvoDenuncia;
  alvoId: string;
  prestadorId: string | null;
  denuncianteId: string;
  motivo: MotivoDenuncia;
  detalhe: string | null;
  status: "aberta" | "procedente" | "descartada";
  criadaEm: string;
}

/*
 * Demonstração: sem banco, as denúncias vivem no processo. Em `globalThis`
 * pela razão de `carteiras` e `pagamentos`: quem denuncia é uma action, e
 * quem lê é a página do admin — bundles diferentes no build de produção,
 * cada um com a própria cópia de uma variável de módulo.
 */
const CHAVE = Symbol.for("lupa.denuncias.memoria");

function memoria(): Denuncia[] {
  const g = globalThis as typeof globalThis & { [CHAVE]?: Denuncia[] };
  g[CHAVE] ??= [];
  return g[CHAVE];
}

function jaDenunciada() {
  return erros.conflito(
    "Você já denunciou isto, e a denúncia está em análise.",
    "denúncia repetida",
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A foto, se existir e estiver no ar. Arquivada não recebe denúncia. */
async function fotoNoAr(id: string): Promise<Publicacao | null> {
  // Id sem forma de UUID nem vai ao banco, que responderia com erro.
  if (isSupabaseConfigured && !UUID.test(id)) return null;
  const foto = await repositorioPublicacoes().porId(id);
  return foto?.status === "ativa" ? foto : null;
}

export async function denunciar(
  sessao: Autenticado | null,
  dados: NovaDenuncia,
): Promise<void> {
  const quem = exigirCapacidade(sessao, "denuncia:criar");
  const detalhe = dados.detalhe?.trim() || null;
  let prestadorId = dados.prestadorId || null;

  if (dados.alvo === "vaga") {
    const vaga = await getJobById(dados.alvoId);
    if (!vaga) throw erros.naoEncontrado("Vaga");
    // O dono encerra a própria vaga; denunciá-la não faz sentido.
    if (vaga.company_id === quem.usuarioId) {
      throw erros.semPermissao("denúncia da própria vaga");
    }
  } else if (dados.alvo === "publicacao") {
    const foto = await fotoNoAr(dados.alvoId);
    if (!foto) throw erros.naoEncontrado("Foto");
    // O dono tira a própria foto do perfil, ou a apaga.
    if (foto.autorId === quem.usuarioId) {
      throw erros.semPermissao("denúncia da própria foto");
    }
    // De quem é o perfil vem da publicação, nunca do formulário.
    prestadorId = foto.autorId;
  } else if (!prestadorId) {
    throw erros.naoEncontrado("Avaliação");
  }

  if (!isSupabaseConfigured) {
    const repetida = memoria().some(
      (d) =>
        d.status === "aberta" &&
        d.alvo === dados.alvo &&
        d.alvoId === dados.alvoId &&
        d.denuncianteId === quem.usuarioId,
    );
    if (repetida) throw jaDenunciada();

    memoria().push({
      alvo: dados.alvo,
      alvoId: dados.alvoId,
      prestadorId,
      denuncianteId: quem.usuarioId,
      motivo: dados.motivo,
      detalhe,
      status: "aberta",
      criadaEm: new Date().toISOString(),
    });
    log.info("denúncia recebida", {
      acao: "denuncia.criar",
      alvo: dados.alvo,
      motivo: dados.motivo,
    });
    return;
  }

  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("denúncia sem chave de serviço");

  if (dados.alvo === "avaliacao") {
    // A avaliação existe e é do perfil de onde a denúncia veio. Id sem
    // forma de UUID volta erro do banco, e a resposta é a mesma.
    const { data, error } = await supabase
      .from("avaliacoes")
      .select("id")
      .eq("id", dados.alvoId)
      .eq("prestador_id", prestadorId ?? "")
      .maybeSingle();
    if (error || !data) throw erros.naoEncontrado("Avaliação");
  }

  const { error } = await supabase.from("denuncias").insert({
    alvo: dados.alvo,
    alvo_id: dados.alvoId,
    prestador_id: prestadorId,
    denunciante_id: quem.usuarioId,
    motivo: dados.motivo,
    detalhe,
  });

  if (error) {
    // O índice único parcial é quem garante uma aberta por pessoa e alvo:
    // dois cliques simultâneos passariam por uma checagem antes.
    if (error.code === "23505") throw jaDenunciada();
    throw erros.indisponivel(`denúncia: ${error.message}`);
  }

  log.info("denúncia recebida", {
    acao: "denuncia.criar",
    alvo: dados.alvo,
    motivo: dados.motivo,
  });
}

const TITULO_PADRAO: Record<AlvoDenuncia, string> = {
  vaga: "Vaga",
  avaliacao: "Avaliação",
  publicacao: "Foto de trabalho",
};

/** As denúncias abertas de um mesmo alvo, para o painel decidir de uma vez. */
export interface DenunciaAgrupada {
  alvo: AlvoDenuncia;
  alvoId: string;
  /** Onde o admin abre o alvo para ver o contexto. */
  caminho: string;
  titulo: string;
  /** Só na foto: a miniatura, para decidir sem abrir o perfil. */
  imagemUrl?: string | null;
  total: number;
  motivos: Partial<Record<MotivoDenuncia, number>>;
  detalhes: string[];
  primeiraEm: string;
}

interface Linha {
  alvo: AlvoDenuncia;
  alvoId: string;
  prestadorId: string | null;
  motivo: MotivoDenuncia;
  detalhe: string | null;
  criadaEm: string;
}

async function linhasAbertas(): Promise<Linha[]> {
  if (!isSupabaseConfigured) {
    return memoria()
      .filter((d) => d.status === "aberta")
      .slice(0, TETO_ADMIN)
      .map(({ alvo, alvoId, prestadorId, motivo, detalhe, criadaEm }) => ({
        alvo,
        alvoId,
        prestadorId,
        motivo,
        detalhe,
        criadaEm,
      }));
  }

  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("denúncias sem chave de serviço");

  const { data, error } = await supabase
    .from("denuncias")
    .select("alvo, alvo_id, prestador_id, motivo, detalhe, criada_em")
    .eq("status", "aberta")
    .order("criada_em", { ascending: true })
    .limit(TETO_ADMIN);
  if (error) throw erros.indisponivel(`denúncias: ${error.message}`);

  return (data ?? []).map((l) => ({
    alvo: l.alvo as AlvoDenuncia,
    alvoId: String(l.alvo_id),
    prestadorId: (l.prestador_id as string | null) ?? null,
    motivo: l.motivo as MotivoDenuncia,
    detalhe: (l.detalhe as string | null) ?? null,
    criadaEm: String(l.criada_em),
  }));
}

/** O que a avaliação diz, para o admin decidir sem abrir o perfil. */
async function comentariosDasAvaliacoes(
  ids: string[],
): Promise<Map<string, string>> {
  if (!isSupabaseConfigured || ids.length === 0) return new Map();
  const supabase = clienteDeServico();
  if (!supabase) return new Map();

  const { data } = await supabase
    .from("avaliacoes")
    .select("id, nota, comentario")
    .in("id", ids)
    .limit(TETO_ADMIN);
  return new Map(
    (data ?? []).map((a) => [
      String(a.id),
      `${a.nota} estrela${Number(a.nota) === 1 ? "" : "s"}${
        a.comentario ? `: ${String(a.comentario)}` : ", sem comentário"
      }`,
    ]),
  );
}

export async function denunciasAbertas(
  sessao: Autenticado | null,
): Promise<DenunciaAgrupada[]> {
  exigirCapacidade(sessao, "admin:moderar");

  const linhas = await linhasAbertas();
  const grupos = new Map<string, DenunciaAgrupada>();

  for (const l of linhas) {
    const chave = `${l.alvo}:${l.alvoId}`;
    let g = grupos.get(chave);
    if (!g) {
      g = {
        alvo: l.alvo,
        alvoId: l.alvoId,
        caminho:
          l.alvo === "vaga"
            ? `/vagas/${l.alvoId}`
            : `/servicos/${l.prestadorId ?? ""}`,
        titulo: TITULO_PADRAO[l.alvo],
        total: 0,
        motivos: {},
        detalhes: [],
        primeiraEm: l.criadaEm,
      };
      grupos.set(chave, g);
    }
    g.total += 1;
    g.motivos[l.motivo] = (g.motivos[l.motivo] ?? 0) + 1;
    if (l.detalhe) g.detalhes.push(l.detalhe);
  }

  const lista = [...grupos.values()];
  const comentarios = await comentariosDasAvaliacoes(
    lista.filter((g) => g.alvo === "avaliacao").map((g) => g.alvoId),
  );
  for (const g of lista) {
    if (g.alvo === "vaga") {
      const vaga = await getJobById(g.alvoId);
      g.titulo = vaga
        ? `${vaga.title} — ${vaga.company.company_name}`
        : "Vaga já fora da busca";
    } else if (g.alvo === "avaliacao") {
      g.titulo = comentarios.get(g.alvoId) ?? "Avaliação";
    } else {
      const foto = await repositorioPublicacoes()
        .porId(g.alvoId)
        .catch(() => null);
      g.titulo = foto?.titulo ?? "Foto já apagada";
      g.imagemUrl = foto?.imagemUrl ?? null;
      // Candidato não tem vitrine: o perfil dele mora em /candidatos.
      if (foto) {
        const autor = await repositorioUsuarios()
          .porId(foto.autorId)
          .catch(() => null);
        g.caminho =
          autor?.papel === "candidato_clt"
            ? `/candidatos/${foto.autorId}`
            : `/servicos/${foto.autorId}`;
      }
    }
  }

  // Mais denunciado primeiro; no empate, o que espera há mais tempo.
  return lista.sort(
    (a, b) => b.total - a.total || a.primeiraEm.localeCompare(b.primeiraEm),
  );
}

/**
 * Tira do ar ou descarta, e fecha as denúncias daquele alvo (#435).
 *
 * Tirar do ar **encerra** a vaga — o mesmo estado de quando o dono a
 * encerra, que a tira da busca —, **apaga** a avaliação, cuja nota sai da
 * média pelo trigger de sempre, e **apaga** a foto de trabalho (#452): a
 * publicação no banco e o arquivo no Storage, nessa ordem. Arquivada, a
 * foto seguiria no ar pelo endereço. Devolve quantas denúncias fechou.
 */
export async function decidirDenuncia(
  sessao: Autenticado | null,
  dados: { alvo: AlvoDenuncia; alvoId: string; tirarDoAr: boolean },
): Promise<number> {
  exigirCapacidade(sessao, "admin:moderar");

  let fechadas = 0;

  // O endereço da foto se lê antes: depois da decisão a linha não existe.
  const foto =
    dados.tirarDoAr && dados.alvo === "publicacao"
      ? await repositorioPublicacoes()
          .porId(dados.alvoId)
          .catch(() => null)
      : null;

  if (!isSupabaseConfigured) {
    // Na demonstração, só a vaga publicada nesta sessão está no
    // repositório; a de exemplo é estática e continua na vitrine.
    if (dados.tirarDoAr && dados.alvo === "vaga") {
      await repositorioVagas()
        .encerrar(dados.alvoId)
        .catch(() => undefined);
    }
    if (foto) await repositorioPublicacoes().apagar(foto.id);
    for (const d of memoria()) {
      if (
        d.status === "aberta" &&
        d.alvo === dados.alvo &&
        d.alvoId === dados.alvoId
      ) {
        d.status = dados.tirarDoAr ? "procedente" : "descartada";
        fechadas += 1;
      }
    }
  } else {
    const supabase = clienteDeServico();
    if (!supabase) throw erros.indisponivel("decisão sem chave de serviço");
    const { data, error } = await supabase.rpc("decidir_denuncia", {
      p_alvo: dados.alvo,
      p_alvo_id: dados.alvoId,
      p_tirar_do_ar: dados.tirarDoAr,
    });
    if (error)
      throw erros.indisponivel(`decisão de denúncia: ${error.message}`);
    fechadas = Number(data ?? 0);
  }

  // Foto tirada do ar que fica no bucket público segue acessível pelo
  // endereço: a falha vai ao Sentry, para alguém apagar à mão.
  if (foto && !(await apagarFotoDeTrabalho(foto.autorId, foto.imagemUrl))) {
    log.erro(erros.indisponivel("foto tirada do ar ficou no Storage"), {
      acao: "denuncia.decidir",
      publicacaoId: foto.id,
    });
  }

  log.info("denúncia decidida", {
    acao: "denuncia.decidir",
    alvo: dados.alvo,
    tirarDoAr: dados.tirarDoAr,
    fechadas,
  });
  return fechadas;
}

/** Só para teste: começa cada caso sem denúncia da sessão anterior. */
export function limparDenunciasEmMemoria(): void {
  memoria().length = 0;
}
