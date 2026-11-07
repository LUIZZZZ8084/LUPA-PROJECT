/**
 * Visitas a uma página, contadas por dia (#568).
 *
 * A mesma forma das visualizações de vaga e das buscas sem resultado: uma
 * linha por página por dia, incrementada, e **nada que diga quem visitou**.
 * O que se usa é o agregado — quantas pessoas abriram a página para
 * empresas numa semana, contra quantas contas ela trouxe.
 *
 * O preço, o mesmo das visualizações: recarregar soma de novo, e robô de
 * busca soma também. É tendência, não audiência, e o painel diz isso.
 */

/** As páginas contadas. Página nova entra aqui e no `check` do banco. */
export type PaginaContada = "para_empresas";

export interface VisitasNoDia {
  /** AAAA-MM-DD, em UTC — o `current_date` do banco. */
  dia: string;
  total: number;
}

export interface RepositorioVisitas {
  registrar(pagina: PaginaContada): Promise<void>;
  /** Os dias com visita a partir de `desde` (AAAA-MM-DD), inclusive. */
  porDia(pagina: PaginaContada, desde: string): Promise<VisitasNoDia[]>;
}
