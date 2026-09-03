/**
 * Dev server em modo demonstração, sem falar com o banco de verdade.
 *
 * `npm run dev` carrega o `.env.local`, que tem as credenciais reais: uma
 * conta criada "só para conferir a tela" vai parar em produção. Já
 * aconteceu aqui, e o `playwright.config.ts` zera essas variáveis à força
 * justamente por isso — o dev server não zerava.
 *
 * Este script existe para dar ao navegador o mesmo ambiente que a suíte
 * e2e usa: repositório em memória, sem Storage, sem escrever em lugar
 * nenhum que sobreviva ao processo.
 */
import { spawn } from "node:child_process";

const porta = process.env.PORT ?? "3001";

const filho = spawn("npx", ["next", "dev", "--port", porta], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    // Vazio vence o arquivo: variável já presente no ambiente tem
    // precedência sobre `.env.local`, que é o que torna isto confiável.
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    SESSION_SECRET:
      process.env.SESSION_SECRET ??
      "segredo-de-demonstracao-com-mais-de-32-chars",
  },
});

filho.on("exit", (codigo) => process.exit(codigo ?? 0));
