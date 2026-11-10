import {
  type EventoDoPerfil,
  inicioDaJanela,
  type RepositorioContagensPrestador,
  type TotaisDoPerfil,
} from "./tipos";

/**
 * Contagens em memória, para a demonstração.
 *
 * **O estado mora em `globalThis`**: a visita é contada pela página e o
 * clique, pela rota do WhatsApp, e no build de produção cada uma recebe a
 * própria cópia deste módulo. Um `Map` de módulo daria dois contadores, e o
 * perfil mostraria zero chamadas para sempre — a mesma armadilha da
 * cobrança na demonstração (#164).
 */
type PorDia = Map<string, TotaisDoPerfil>;

const CHAVE = Symbol.for("lupa.contagensPrestador");
const global = globalThis as unknown as Record<symbol, Map<string, PorDia>>;

function contagens(): Map<string, PorDia> {
  global[CHAVE] ??= new Map();
  return global[CHAVE];
}

export class RepositorioContagensPrestadorMemoria
  implements RepositorioContagensPrestador
{
  async registrar(prestadorId: string, evento: EventoDoPerfil): Promise<void> {
    const dia = new Date().toISOString().slice(0, 10);
    const porDia = contagens().get(prestadorId) ?? new Map();
    const atual = porDia.get(dia) ?? { visitas: 0, contatos: 0 };
    porDia.set(dia, {
      visitas: atual.visitas + (evento === "visita" ? 1 : 0),
      contatos: atual.contatos + (evento === "contato" ? 1 : 0),
    });
    contagens().set(prestadorId, porDia);
  }

  async totais(prestadorId: string, dias: number): Promise<TotaisDoPerfil> {
    const desde = inicioDaJanela(new Date(), dias);
    let visitas = 0;
    let contatos = 0;
    for (const [dia, t] of contagens().get(prestadorId) ?? []) {
      if (dia < desde) continue;
      visitas += t.visitas;
      contatos += t.contatos;
    }
    return { visitas, contatos };
  }

  /** Só para teste. */
  limpar(): void {
    contagens().clear();
  }
}
