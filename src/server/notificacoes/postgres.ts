import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import type {
  InscricaoPush,
  PreferenciaNotificacao,
  RepositorioNotificacoes,
} from "./tipos";

/*
 * Tudo aqui passa pela chave de serviço.
 *
 * `preferencias_notificacao` e `inscricoes_push` não têm grant nenhum para
 * `anon` nem para `authenticated` — o teste de schema trava isso. Saber
 * quem está de olho em vaga de motorista é a mesma classe de informação que
 * o currículo, e as chaves de push permitem mandar notificação em nome da
 * Lupa para aquele aparelho.
 */
async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

function paraInscricao(linha: Record<string, unknown>): InscricaoPush {
  return {
    usuarioId: String(linha.usuario_id),
    endpoint: String(linha.endpoint),
    p256dh: String(linha.p256dh),
    auth: String(linha.auth),
  };
}

export class RepositorioNotificacoesPostgres
  implements RepositorioNotificacoes
{
  async preferencia(usuarioId: string): Promise<PreferenciaNotificacao | null> {
    const supabase = await cliente();
    const { data } = await supabase
      .from("preferencias_notificacao")
      .select("usuario_id, cidade, categoria")
      .eq("usuario_id", usuarioId)
      .maybeSingle();

    if (!data) return null;
    return {
      usuarioId: String(data.usuario_id),
      cidade: String(data.cidade),
      categoria: (data.categoria as string | null) ?? null,
    };
  }

  async salvarPreferencia(pref: PreferenciaNotificacao): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase.from("preferencias_notificacao").upsert(
      {
        usuario_id: pref.usuarioId,
        cidade: pref.cidade,
        categoria: pref.categoria,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "usuario_id" },
    );
    if (error) throw erros.indisponivel(error.message);
  }

  async removerPreferencia(usuarioId: string): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase
      .from("preferencias_notificacao")
      .delete()
      .eq("usuario_id", usuarioId);
    if (error) throw erros.indisponivel(error.message);
  }

  /**
   * Três consultas, nenhum filtro montado por concatenação.
   *
   * O caminho natural seria um `or("categoria.is.null,categoria.eq.X")`,
   * e é justamente o que este projeto proíbe: `or()` recebe uma string
   * numa linguagem onde a vírgula separa condições, e interpolar valor ali
   * é injeção num dialeto diferente do SQL. Já vazou a base inteira uma
   * vez, por um termo de busca.
   *
   * A categoria vem de um enum validado, então na prática não passaria
   * nada estranho — mas "na prática é seguro" é como a regra morre. `eq` e
   * `is` recebem o valor por parâmetro; duas consultas indexadas custam
   * menos que uma regra frouxa, e isto roda em `after()`, depois da
   * resposta ao usuário.
   */
  async inscricoesInteressadas(
    cidade: string,
    categoria: string | null,
  ): Promise<InscricaoPush[]> {
    const supabase = await cliente();

    const [todaCidade, daCategoria] = await Promise.all([
      // Quem não escolheu categoria recebe tudo o que sai na cidade dela.
      supabase
        .from("preferencias_notificacao")
        .select("usuario_id")
        .eq("cidade", cidade)
        .is("categoria", null),
      // Vaga sem categoria só alcança quem pediu tudo: sem o campo, não há
      // como saber se ela interessa a quem escolheu uma área.
      categoria === null
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("preferencias_notificacao")
            .select("usuario_id")
            .eq("cidade", cidade)
            .eq("categoria", categoria),
    ]);

    const erroPrefs = todaCidade.error ?? daCategoria.error;
    if (erroPrefs) throw erros.indisponivel(erroPrefs.message);

    const prefs = [...(todaCidade.data ?? []), ...(daCategoria.data ?? [])];
    if (!prefs.length) return [];

    const { data, error } = await supabase
      .from("inscricoes_push")
      .select("usuario_id, endpoint, p256dh, auth")
      // `Set` porque as duas consultas acima podem trazer a mesma pessoa
      // se ela tiver preferência com e sem categoria em algum momento.
      .in("usuario_id", [...new Set(prefs.map((p) => String(p.usuario_id)))]);

    if (error) throw erros.indisponivel(error.message);
    return (data ?? []).map(paraInscricao);
  }

  async salvarInscricao(inscricao: InscricaoPush): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase.from("inscricoes_push").upsert(
      {
        usuario_id: inscricao.usuarioId,
        endpoint: inscricao.endpoint,
        p256dh: inscricao.p256dh,
        auth: inscricao.auth,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw erros.indisponivel(error.message);
  }

  async removerInscricao(endpoint: string): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase
      .from("inscricoes_push")
      .delete()
      .eq("endpoint", endpoint);
    if (error) throw erros.indisponivel(error.message);
  }

  async inscricoesDe(usuarioId: string): Promise<InscricaoPush[]> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("inscricoes_push")
      .select("usuario_id, endpoint, p256dh, auth")
      .eq("usuario_id", usuarioId);

    if (error) throw erros.indisponivel(error.message);
    return (data ?? []).map(paraInscricao);
  }
}
