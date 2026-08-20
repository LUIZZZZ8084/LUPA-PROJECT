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
  ]),
]);

export default eslintConfig;
