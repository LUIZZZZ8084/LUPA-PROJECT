import { getJobs, getProviders } from "@/lib/data";
import type { Papel } from "../auth/rbac";
import type { RepositorioMemoria } from "../repositories/memoria";
import type {
  CadastrosPorDia,
  DistribuicaoLocal,
  RepositorioMetricas,
  Totais,
} from "./tipos";

/**
 * Métricas no modo demonstração.
 *
 * Soma o que existe em memória (contas criadas na sessão) com o que a camada
 * de dados devolve. Sem isso o painel abriria zerado e não mostraria nada do
 * que ele serve para mostrar.
 *
 * Os dados de exemplo vêm por `src/lib/data.ts`, nunca de `mock-data.ts`
 * direto: essa é a fronteira que o contrato de arquitetura protege, para que
 * ligar o Supabase não deixe nenhuma tela presa nos dados falsos.
 */
export class RepositorioMetricasMemoria implements RepositorioMetricas {
  constructor(private readonly usuarios: RepositorioMemoria) {}

  async totais(): Promise<Totais> {
    const [vagas, prestadores] = await Promise.all([getJobs(), getProviders()]);

    const cadastrados = this.usuarios.todos();
    const contar = (papel: Papel) =>
      cadastrados.filter((u) => u.papel === papel).length;

    return {
      usuarios: cadastrados.length + prestadores.length,
      candidatos: contar("candidato_clt"),
      prestadores: contar("prestador_servico") + prestadores.length,
      empresas: contar("empresa"),
      vagasAbertas: vagas.length,
    };
  }

  async cadastrosPorDia(dias: number): Promise<CadastrosPorDia[]> {
    const porDia = new Map<string, CadastrosPorDia>();

    // Série contínua: dia sem cadastro precisa aparecer como zero, senão o
    // gráfico mente sobre a constância.
    for (let i = dias - 1; i >= 0; i--) {
      const data = new Date();
      data.setUTCDate(data.getUTCDate() - i);
      const dia = data.toISOString().slice(0, 10);
      porDia.set(dia, { dia, total: 0, porPapel: papeisZerados() });
    }

    for (const usuario of this.usuarios.todos()) {
      const registro = porDia.get(usuario.criadoEm.slice(0, 10));
      if (!registro) continue;
      registro.total += 1;
      registro.porPapel[usuario.papel] += 1;
    }

    return [...porDia.values()];
  }

  async distribuicaoPorLocal(limite: number): Promise<DistribuicaoLocal[]> {
    const contagem = new Map<string, DistribuicaoLocal>();

    const somar = (cidade: string, bairro: string | null) => {
      const chave = `${cidade}|${bairro ?? ""}`;
      const atual = contagem.get(chave);
      if (atual) atual.total += 1;
      else contagem.set(chave, { cidade, bairro, total: 1 });
    };

    for (const u of this.usuarios.todos()) somar(u.cidade, u.bairro);
    for (const p of await getProviders()) somar(p.city, p.neighborhood);

    return [...contagem.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, limite);
  }

  async planosDeEmpresa(): Promise<{ mensal: number; trial: number }> {
    const empresas = this.usuarios.todos().filter((u) => u.papel === "empresa");

    // No modo demonstração toda empresa nova entra em teste.
    return { mensal: 0, trial: empresas.length };
  }
}

function papeisZerados(): Record<Papel, number> {
  return {
    candidato_clt: 0,
    prestador_servico: 0,
    empresa: 0,
    admin: 0,
  };
}
