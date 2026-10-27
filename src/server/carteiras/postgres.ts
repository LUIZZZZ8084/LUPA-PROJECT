import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import type { Carteira, RepositorioCarteiras } from "./tipos";

function paraCarteira(linha: Record<string, unknown>): Carteira {
  return {
    usuarioId: String(linha.usuario_id),
    creditosVaga: Number(linha.creditos_vaga),
    mensalidadeValidaAte:
      (linha.mensalidade_valida_ate as string | null) ?? null,
    planoVagasNoAr:
      linha.plano_vagas_no_ar === null || linha.plano_vagas_no_ar === undefined
        ? null
        : Number(linha.plano_vagas_no_ar),
    primeiraVagaGratisUsadaEm:
      (linha.primeira_vaga_gratis_usada_em as string | null) ?? null,
    criadoEm: String(linha.criado_em),
    atualizadoEm: String(linha.atualizado_em),
  };
}

async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

export class RepositorioCarteirasPostgres implements RepositorioCarteiras {
  async porUsuario(usuarioId: string): Promise<Carteira | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("carteiras_vaga")
      .select("*")
      .eq("usuario_id", usuarioId)
      .maybeSingle();

    if (error) throw erros.indisponivel(error.message);
    return data ? paraCarteira(data) : null;
  }

  /**
   * `creditar_vaga` é uma função do banco, e não um `select` seguido de
   * `update`.
   *
   * Dois pagamentos aprovados quase juntos — o Mercado Pago reenvia
   * webhook — leriam o mesmo saldo pelo caminho ler-somar-gravar e
   * gravariam o mesmo total: a empresa pagaria dois pacotes e receberia
   * um. A soma acontece dentro da instrução, onde essa corrida não
   * existe.
   */
  async creditar(usuarioId: string, quantidade: number): Promise<Carteira> {
    return this.chamar("creditar_vaga", {
      p_usuario: usuarioId,
      p_quantidade: quantidade,
    });
  }

  /**
   * Devolve `null` quando não havia crédito.
   *
   * A guarda (`creditos_vaga > 0`) está dentro do `update`, pelo mesmo
   * motivo: duas publicações simultâneas com um crédito só passariam as
   * duas por uma leitura anterior, e a segunda publicaria de graça.
   */
  async consumirCredito(usuarioId: string): Promise<Carteira | null> {
    const supabase = await cliente();
    const { data, error } = await supabase.rpc("consumir_credito_vaga", {
      p_usuario: usuarioId,
    });

    if (error) throw erros.indisponivel(error.message);
    const linha = primeira(data);
    return linha ? paraCarteira(linha) : null;
  }

  async debitar(usuarioId: string, quantidade: number): Promise<Carteira> {
    return this.chamar("creditar_vaga", {
      p_usuario: usuarioId,
      p_quantidade: -quantidade,
    });
  }

  async estenderMensalidade(
    usuarioId: string,
    dias: number,
    vagasNoAr: number | null,
  ): Promise<Carteira> {
    return this.chamar("estender_mensalidade_vaga", {
      p_usuario: usuarioId,
      p_dias: dias,
      p_limite: vagasNoAr,
    });
  }

  /**
   * `reivindicar_primeira_vaga_gratis` é uma função do banco, e não um
   * `select` seguido de `update`: a condição está dentro da instrução, e
   * duas publicações simultâneas não passam as duas.
   */
  async reivindicarPrimeiraVagaGratis(usuarioId: string): Promise<boolean> {
    const supabase = await cliente();
    const { data, error } = await supabase.rpc(
      "reivindicar_primeira_vaga_gratis",
      { p_usuario: usuarioId },
    );

    if (error) throw erros.indisponivel(error.message);
    return data === true;
  }

  async liberarPrimeiraVagaGratis(usuarioId: string): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase
      .from("carteiras_vaga")
      .update({ primeira_vaga_gratis_usada_em: null })
      .eq("usuario_id", usuarioId);

    if (error) throw erros.indisponivel(error.message);
  }

  async revogarMensalidade(usuarioId: string): Promise<Carteira> {
    return this.chamar("estender_mensalidade_vaga", {
      p_usuario: usuarioId,
      p_dias: null,
      p_limite: null,
    });
  }

  private async chamar(
    funcao: string,
    args: Record<string, unknown>,
  ): Promise<Carteira> {
    const supabase = await cliente();
    const { data, error } = await supabase.rpc(funcao, args);

    if (error) throw erros.indisponivel(error.message);
    const linha = primeira(data);
    if (!linha) throw erros.indisponivel(`${funcao} não devolveu a carteira`);
    return paraCarteira(linha);
  }
}

/** As funções devolvem `setof carteiras_vaga`: zero ou uma linha. */
function primeira(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    return (data[0] as Record<string, unknown> | undefined) ?? null;
  }
  return (data as Record<string, unknown> | null) ?? null;
}
