/**
 * Rotas do app, usadas pelas varreduras de layout e acessibilidade.
 *
 * O app é fechado por login; a sessão vem do `storageState` criado em
 * `auth.setup.ts`, senão a varredura mediria a tela de entrada dizendo que
 * mede outra coisa.
 *
 * **A lista é dividida por papel, e não por seção.** A varredura precisa da
 * sessão que enxerga a rota: com a sessão errada o que se mede é a página de
 * 404, enquanto o teste diz que mede o painel. Já aconteceu aqui quando
 * `/admin` entrou na varredura.
 *
 * `tests/unit/rotas-varridas.test.ts` compara estas listas com os
 * `page.tsx` que existem em `src/app` e reprova quando aparece rota nova
 * fora delas. Sem esse contrato a lista envelhece em silêncio — foi o que
 * aconteceu com `/candidatos` e `/perfil/candidaturas`, criadas depois e
 * nunca varridas.
 */

export interface RotaVarrida {
  path: string;
  nome: string;
}

/** O que a sessão de candidato alcança. É a maioria do app. */
export const ROTAS: readonly RotaVarrida[] = [
  { path: "/", nome: "Início" },
  { path: "/vagas", nome: "Busca de vagas" },
  { path: "/vagas/job-operador-maquinas", nome: "Detalhe da vaga" },
  { path: "/servicos", nome: "Busca de serviços" },
  { path: "/servicos/prv-joao-silva", nome: "Perfil do prestador" },
  { path: "/cadastro", nome: "Escolha de papel" },
  { path: "/cadastro?tipo=prestador_servico", nome: "Cadastro de prestador" },
  { path: "/cadastro?tipo=empresa", nome: "Cadastro de empresa" },
  { path: "/entrar", nome: "Login" },
  { path: "/perfil", nome: "Perfil" },
  { path: "/perfil/editar", nome: "Editar perfil" },
  { path: "/perfil/candidaturas", nome: "Minhas candidaturas" },
  /*
   * A conta compartilhada é candidata, e é ela quem pode ativar o lado
   * prestador — a tela renderiza o formulário de verdade nesta varredura.
   * Em demonstração não há Storage, então a exigência de foto não entra na
   * frente: o que se mede é o formulário, não o aviso.
   */
  { path: "/perfil/virar-prestador", nome: "Virar prestador" },
] as const;

/**
 * O que só a sessão de empresa alcança.
 *
 * Estas três saíram de `ROTAS` quando `/empresa` e `/empresa/vagas/nova`
 * ganharam portão de papel: até ali qualquer conta autenticada abria o
 * painel, e a varredura passava por acidente.
 */
export const ROTAS_EMPRESA: readonly RotaVarrida[] = [
  { path: "/empresa", nome: "Painel da empresa" },
  { path: "/empresa/vagas/nova", nome: "Publicar vaga" },
  { path: "/candidatos", nome: "Candidatos disponíveis" },
] as const;

/**
 * Rotas de empresa cujo id só existe em tempo de execução.
 *
 * Fixar um id aqui seria fixar um dado de demonstração: no dia em que o
 * seed mudasse, a varredura mediria um 404 e continuaria verde, porque
 * página de erro também não rola para o lado. Os ids são resolvidos
 * navegando o painel, em `rotasProfundasDaEmpresa()` (`helpers.ts`).
 */
export const ROTAS_PROFUNDAS_EMPRESA = [
  {
    nome: "Ficha do candidato",
    seletor: 'a[href^="/empresa/candidaturas/"]',
  },
  {
    nome: "Editar vaga",
    seletor: 'a[href^="/empresa/vagas/"][href$="/editar"]',
  },
] as const;

/**
 * Rotas fora de qualquer varredura de layout, com a razão de cada uma.
 *
 * O contrato em `tests/unit/rotas-varridas.test.ts` lê esta lista: excluir
 * é permitido, excluir em silêncio não.
 */
export const ROTAS_NAO_VARRIDAS: Record<string, string> = {
  "/admin":
    "sem sessão de admin responde 404, e a varredura mediria a página de erro dizendo que mede a fila de verificação. O 404 para anônimo é verificado em fluxos.spec.ts",
  "/admin/painel":
    "mesma razão de /admin: sem sessão de admin a varredura mediria a página de erro. O painel tem cobertura própria em metricas-empresa.spec.ts e no teste de unidade do serviço",
  "/candidatos/[id]":
    "depende de um candidato que tenha ligado 'quero ser encontrado', criado dentro do próprio teste — varrido em visivel-para-empresas.spec.ts",
  "/empresa/candidaturas/[id]": "id resolvido em ROTAS_PROFUNDAS_EMPRESA",
  "/perfil/publicacoes":
    "exige sessão de prestador, e as duas contas compartilhadas da suíte são candidata e empresa. Uma terceira custaria mais um cadastro no limite de 5 por origem em 15 minutos — apertado demais para segurar. A tela tem varredura de acessibilidade própria, dentro de feed-do-prestador.spec.ts, onde a conta já é prestador",
  "/empresa/vagas/[id]/editar": "id resolvido em ROTAS_PROFUNDAS_EMPRESA",
};

/**
 * Larguras que cobrem o parque real de celulares no Brasil, do Android
 * pequeno ao desktop.
 */
export const LARGURAS = [
  { w: 320, h: 640, nome: "320 (Android pequeno)" },
  { w: 360, h: 800, nome: "360 (Android comum)" },
  { w: 390, h: 844, nome: "390 (iPhone)" },
  { w: 414, h: 896, nome: "414 (iPhone Plus)" },
  { w: 768, h: 1024, nome: "768 (tablet)" },
  { w: 1280, h: 800, nome: "1280 (desktop)" },
] as const;
