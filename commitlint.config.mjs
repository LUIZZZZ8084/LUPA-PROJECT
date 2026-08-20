/**
 * Convenção de mensagem de commit.
 *
 * O assunto fica em português, como o resto do projeto, mas o tipo continua
 * em inglês porque é o vocabulário do Conventional Commits — o que permite
 * gerar changelog e versionar automaticamente depois.
 */
const configuracao = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // funcionalidade nova
        "fix", // correção de bug
        "docs", // documentação
        "style", // formatação, sem mudança de comportamento
        "refactor", // reestruturação sem mudar comportamento
        "perf", // desempenho
        "test", // testes
        "build", // build, dependências
        "ci", // integração contínua
        "chore", // manutenção
        "revert", // reverter commit
      ],
    ],
    // O assunto é em português: não force minúscula (nomes próprios) nem
    // proíba ponto final em frase completa.
    "subject-case": [0],
    "subject-full-stop": [0],
    "header-max-length": [2, "always", 72],
    "body-max-line-length": [2, "always", 100],
  },
};

export default configuracao;
