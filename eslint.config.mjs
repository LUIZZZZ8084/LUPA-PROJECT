import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /*
       * `const { senhaHash, ...resto } = usuario` é a forma idiomática de
       * omitir um campo. `ignoreRestSiblings` reconhece o padrão em vez de
       * acusar o campo omitido como variável não usada.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Padrão do eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Saídas de ferramenta: código gerado, não código nosso.
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "reports/**",
    ".stryker-tmp/**",
    /*
     * `dist/` e `.design-sync/` são saída da ferramenta de sincronização de
     * design: declarações geradas e CSS compilado. Sem ignorá-los, o
     * `npm run verify` local reprova com vinte e dois erros que não são do
     * projeto — e na CI passa, porque lá os diretórios não existem. Vermelho
     * que só aparece na máquina de quem desenvolve é o que ensina a rodar o
     * verify com `--no-verify`.
     */
    "dist/**",
    ".design-sync/**",
    ".ds-sync/**",
    "ds-bundle/**",
  ]),
]);

export default eslintConfig;
