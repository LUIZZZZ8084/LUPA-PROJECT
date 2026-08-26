import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
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

  async registrarSucesso(chave: string): Promise<void> {
    const supabase = await this.cliente();
    const { error } = await supabase
      .from("tentativas_de_acesso")
      .delete()
      .eq("chave", chave);

    if (error) throw erros.indisponivel(`limite: ${error.message}`);
  }
}
