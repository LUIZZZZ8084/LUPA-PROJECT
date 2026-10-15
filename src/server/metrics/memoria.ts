import { getJobs, getProviders } from "@/lib/data";
import { janelasVivas } from "../auth/rate-limit";
import type { Papel } from "../auth/rbac";
import { candidaturasEmMemoria } from "../candidaturas";
import { assinaturasEmMemoria, pagamentosEmMemoria } from "../pagamentos";
import type { RepositorioMemoria } from "../repositories/memoria";
import type { Usuario } from "../repositories/tipos";
import { vagasEmMemoria } from "../vagas";
import {
  agregarContasPorLugar,
  agregarPressao,
  type CadastrosPorDia,
  type Caixa,
  type ContasPorLugar,
  type Funil,
  montarFunil,
  type PressaoNoTeto,
  type RepositorioMetricas,
  type Totais,
} from "./tipos";

/** A marca da conta excluída (#423), a mesma que as views conferem. */
const SENHA_DE_CONTA_EXCLUIDA = "!conta-excluida";

const excluida = (u: Usuario) => u.senhaHash === SENHA_DE_CONTA_EXCLUIDA;

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

    // Como na view: conta excluída (#423) não é gente.
    const cadastrados = this.usuarios.todos().filter((u) => !excluida(u));
    const contar = (papel: Papel) =>
      cadastrados.filter((u) => u.papel === papel).length;

    return {
      usuarios: cadastrados.length + prestadores.itens.length,
      candidatos: contar("candidato_clt"),
      prestadores: contar("prestador_servico") + prestadores.itens.length,
      empresas: contar("empresa"),
      vagasAbertas: vagas.itens.length,
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

  /*
   * Os prestadores de exemplo entram como contas, como em `totais()`: são
   * eles que enchem a vitrine da demonstração, e um painel que os contasse
   * num bloco e não no outro mostraria dois números para a mesma pergunta.
   */
  async contasPorLugar(limiteDeCidades: number): Promise<ContasPorLugar> {
    const exemplos = (await getProviders()).itens;
    return agregarContasPorLugar(
      [
        ...this.usuarios.todos().map((u) => ({
          papel: u.papel,
          cidade: u.cidade,
          excluida: excluida(u),
        })),
        ...exemplos.map((p) => ({
          papel: "prestador_servico" as const,
          cidade: p.city,
          excluida: false,
        })),
      ],
      limiteDeCidades,
    );
  }

  async funil(): Promise<Funil> {
    const exemplos = (await getProviders()).itens;
    return montarFunil({
      contas: [
        ...this.usuarios.todos().map((u) => ({
          id: u.id,
          papel: u.papel,
          docVerificado: u.docVerificado,
          excluida: excluida(u),
        })),
        ...exemplos.map((p) => ({
          id: p.profile_id,
          papel: "prestador_servico" as const,
          docVerificado: p.doc_verified,
          excluida: false,
        })),
      ],
      perfisDeCandidato: this.usuarios.perfisDeCandidato(),
      perfisDePrestador: [
        ...this.usuarios.perfisDePrestador(),
        ...exemplos.map((p) => ({
          usuarioId: p.profile_id,
          mensalidadeValidaAte: p.subscription_valid_until,
        })),
      ],
      candidaturas: candidaturasEmMemoria(),
      vagas: vagasEmMemoria(),
      assinaturas: assinaturasEmMemoria(),
      pagamentos: pagamentosEmMemoria(),
      agora: new Date(),
    });
  }

  /**
   * O caixa em demonstração, somado a partir das cobranças em memória.
   *
   * Sem Mercado Pago configurado toda compra é aprovada na hora, então o
   * painel mostra dinheiro de mentira — e é o certo: quem demonstra o
   * produto precisa ver o bloco preenchido, e o aviso na tela já diz que
   * o ambiente é de demonstração.
   */
  async caixa(): Promise<Caixa> {
    const somar = (filtro: (p: { status: string }) => boolean) =>
      pagamentosEmMemoria()
        .filter(filtro)
        .reduce((total, p) => total + p.valorCentavos, 0);

    const entrouCentavos = somar((p) => p.status === "aprovado");
    const estornadoCentavos = somar((p) => p.status === "estornado");
    const contestadoCentavos = somar((p) => p.status === "contestado");

    return {
      entrouCentavos,
      estornadoCentavos,
      contestadoCentavos,
      recorrenteCentavos: pagamentosEmMemoria()
        .filter(
          (p) =>
            p.status === "aprovado" &&
            (p.tipo === "prestador_mensalidade" || p.tipo === "empresa_mensal"),
        )
        .reduce((total, p) => total + p.valorCentavos, 0),
      liquidoCentavos: entrouCentavos - estornadoCentavos - contestadoCentavos,
      cobrancas: pagamentosEmMemoria().filter((p) => p.status === "aprovado")
        .length,
      contestacoes: pagamentosEmMemoria().filter(
        (p) => p.status === "contestado",
      ).length,
    };
  }

  /**
   * A pressão em demonstração sai do `Map` do limite em memória.
   *
   * É a mesma agregação da view — literalmente a mesma função — rodando
   * sobre a outra implementação do contador. Em produção este `Map` fica
   * vazio, porque lá quem conta é o Postgres; aqui ele é o único que
   * existe.
   */
  async pressaoNosTetos(limite: number): Promise<PressaoNoTeto[]> {
    return agregarPressao(janelasVivas(), new Date()).slice(0, limite);
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
