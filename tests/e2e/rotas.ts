/** Rotas públicas do V0, usadas pelas varreduras de layout e acessibilidade. */
export const ROTAS = [
  { path: "/", nome: "Início" },
  { path: "/vagas", nome: "Busca de vagas" },
  { path: "/vagas/job-operador-maquinas", nome: "Detalhe da vaga" },
  { path: "/servicos", nome: "Busca de serviços" },
  { path: "/servicos/prv-joao-silva", nome: "Perfil do prestador" },
  { path: "/empresa", nome: "Painel da empresa" },
  { path: "/empresa/vagas/nova", nome: "Publicar vaga" },
  { path: "/cadastro", nome: "Escolha de papel" },
  { path: "/cadastro?tipo=prestador_servico", nome: "Cadastro de prestador" },
  { path: "/cadastro?tipo=empresa", nome: "Cadastro de empresa" },
  { path: "/entrar", nome: "Login" },
  { path: "/perfil", nome: "Perfil" },
  { path: "/admin", nome: "Verificações" },
] as const;

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
