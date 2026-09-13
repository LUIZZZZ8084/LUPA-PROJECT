import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import type { Orcamento } from "../limites";
import { log } from "../logger";
import { CONFIG_LIMITE, type RepositorioLimite } from "./rate-limit-tipos";

/**
 * Limite de tentativas com contador no banco.
 *
 * O que muda em relação à versão em memória não é a regra — é ela
 * sobreviver ao deploy e valer para todas as instâncias ao mesmo tempo.
 * Serverless escala horizontalmente: com contador local, quem cai noutra
 * instância começa do zero.
 */
export class RepositorioLimitePostgres implements RepositorioLimite {
  private async cliente() {
    const supabase = clienteDeServico();
    if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
    return supabase;
  }

  async bloqueadoAte(chave: string): Promise<Date | null> {
    const supabase = await this.cliente();
    const { data, error } = await supabase
      .from("tentativas_de_acesso")
      .select("bloqueado_ate")
      .eq("chave", chave)
      .maybeSingle();

    if (error) throw erros.indisponivel(`limite: ${error.message}`);
    if (!data?.bloqueado_ate) return null;

    const ate = new Date(String(data.bloqueado_ate));
    return ate > new Date() ? ate : null;
  }

  async registrarFalha(chave: string): Promise<void> {
    const supabase = await this.cliente();

    const { data, error } = await supabase.rpc("registrar_falha_de_acesso", {
      p_chave: chave,
      p_janela_segundos: CONFIG_LIMITE.JANELA_MS / 1000,
      p_max_tentativas: CONFIG_LIMITE.MAX_TENTATIVAS,
      p_bloqueio_segundos: CONFIG_LIMITE.BLOQUEIO_MS / 1000,
    });

    if (error) throw erros.indisponivel(`limite: ${error.message}`);

    if (data) {
      log.warn("limite de tentativas atingido", {
        acao: "auth.rateLimit",
        bloqueadoAte: String(data),
      });
    }

    /*
     * A limpeza vai junto com o registro, e não por rotina agendada: sem
     * cron, a tabela cresceria com toda chave vista uma vez e nunca mais.
     * Falhar aqui não pode derrubar o login — o limite já foi aplicado.
     */
    const limpeza = await supabase.rpc("limpar_tentativas_vencidas", {
      p_janela_segundos: CONFIG_LIMITE.JANELA_MS / 1000,
    });
    if (limpeza.error) {
      log.warn("não foi possível limpar tentativas vencidas", {
        acao: "auth.rateLimit",
        erro: limpeza.error.message,
      });
    }
  }

  async registrarUso(
    chave: string,
    orcamento: Orcamento,
  ): Promise<Date | null> {
    const supabase = await this.cliente();

    /*
     * A mesma função SQL do limite de acesso, com outro orçamento.
     *
     * Ela já recebe janela, teto e bloqueio por parâmetro, então não houve
     * migração para escrever: o que muda é quem chama e com que números. E
     * o que importa continua sendo o motivo de ela existir — somar numa
     * instrução só. Pelo caminho ler-somar-gravar, duas chamadas
     * simultâneas leem o mesmo número e escrevem o mesmo número, e o teto
     * vira sugestão exatamente sob a carga que ele existe para conter.
     */
    const { data, error } = await supabase.rpc("registrar_falha_de_acesso", {
      p_chave: chave,
      p_janela_segundos: orcamento.janelaSegundos,
      /*
       * `+ 1` porque a função bloqueia em `>= max`, e `chamadas` aqui quer
       * dizer **quantas passam**. Sem isto, um orçamento de 15 deixaria
       * passar 14 — diferença que ninguém nota lendo a tabela e que
       * aparece como "o limite é menor do que está escrito".
       */
      p_max_tentativas: orcamento.chamadas + 1,
      p_bloqueio_segundos: orcamento.janelaSegundos,
    });

    if (error) throw erros.indisponivel(`limite: ${error.message}`);
    return data ? new Date(String(data)) : null;
  }
  async registrarSucesso(chave: string): Promise<void> {
    const supabase = await this.cliente();
    const { error } = await supabase
      .from("tentativas_de_acesso")
      .delete()
      .eq("chave", chave);

    if (error) throw erros.indisponivel(`limite: ${error.message}`);
  }
}
