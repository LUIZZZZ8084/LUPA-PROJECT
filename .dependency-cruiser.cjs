/**
 * Contratos de arquitetura do Lupa.
 *
 * As camadas são três, e a dependência só desce:
 *
 *   src/app          rotas e telas
 *      ↓
 *   src/components   interface reutilizável
 *      ↓
 *   src/lib          domínio, dados e formatação
 *
 * Quebrar isso é o que transforma um projeto de dois meses num projeto que
 * ninguém consegue mexer. As regras abaixo falham o build antes disso.
 */
module.exports = {
  forbidden: [
    {
      name: "sem-ciclos",
      comment:
        "Dependência circular. Extraia o pedaço compartilhado para um módulo próprio.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "lib-nao-conhece-ui",
      comment:
        "src/lib é a camada de domínio: não pode depender de componente nem de rota. " +
        "Se precisa de algo da UI, o dado está modelado no lugar errado.",
      severity: "error",
      from: { path: "^src/lib" },
      to: { path: "^src/(components|app)" },
    },
    {
      name: "componentes-nao-conhecem-rotas",
      comment:
        "src/components deve ser reutilizável. Depender de src/app amarra o " +
        "componente a uma tela específica. A exceção são as server actions, " +
        "que vivem ao lado da rota que as usa.",
      severity: "error",
      from: { path: "^src/components" },
      to: {
        path: "^src/app",
        pathNot: "^src/app/.+/actions\\.ts$",
      },
    },
    {
      name: "dados-de-demonstracao-so-na-camada-de-dados",
      comment:
        "src/lib/mock-data.ts é o fallback do modo demonstração e só deve ser " +
        "lido por src/lib/data.ts. Importar direto de uma tela faria a tela " +
        "mostrar dados falsos mesmo com o Supabase ligado.",
      severity: "error",
      from: { pathNot: "^(src/lib/(data|mock-data)\\.ts|tests/)" },
      to: { path: "^src/lib/mock-data\\.ts$" },
    },
    {
      name: "sem-orfaos",
      comment:
        "Módulo que ninguém importa. Ou está faltando ligar, ou é código morto.",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: [
          "\\.d\\.ts$",
          "(^|/)(next\\.config|postcss\\.config|eslint\\.config)\\.",
          // Convenções do App Router: o Next carrega por nome de arquivo.
          "^src/(proxy|instrumentation)\\.ts$",
          "^src/app/.*(page|layout|not-found|loading|error|manifest|icon|apple-icon|template|global-error)\\.tsx?$",
        ],
      },
      to: {},
    },
    {
      name: "sem-dependencia-nao-declarada",
      comment:
        "Pacote usado sem estar no package.json. Funciona na sua máquina e " +
        "quebra no build de produção.",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "sem-devdep-em-producao",
      comment: "Código de produção importando uma devDependency.",
      severity: "error",
      from: { path: "^src", pathNot: "\\.(test|spec)\\.tsx?$" },
      to: { dependencyTypes: ["npm-dev"] },
    },
  ],

  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)\\.next/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".js", ".jsx", ".ts", ".tsx"],
    },
    reporterOptions: {
      dot: { collapsePattern: "^src/(app|components|lib)/[^/]+" },
      text: { highlightFocused: true },
    },
  },
};
