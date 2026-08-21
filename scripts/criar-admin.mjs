#!/usr/bin/env node
/**
 * Cria a conta de administrador.
 *
 *   ADMIN_EMAIL=voce@exemplo.com ADMIN_TELEFONE=66999110001 \
 *     ADMIN_SENHA='...' node scripts/criar-admin.mjs
 *
 * A senha vem por variável de ambiente e nunca é fixada no código nem
 * gravada em arquivo. Senha de admin versionada no repositório é a forma
 * mais barata de perder a plataforma inteira.
 *
 * Sem `ADMIN_SENHA`, o script gera uma senha forte, imprime uma única vez e
 * não guarda em lugar nenhum — anote antes de fechar o terminal.
 *
 * Precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY: a tabela `usuarios`
 * fica fora do alcance do RLS de propósito, porque guarda hash de senha.
 *
 * Pelo `npm run admin:criar`, o `.env.local` é carregado pelo próprio Node
 * (`--env-file-if-exists`). Chamando `node` direto, não é: aí as variáveis
 * precisam vir do ambiente. A documentação já prometeu que o arquivo era
 * lido quando não era, e o script morria em "Falta a variável SUPABASE_URL"
 * com o arquivo ali do lado, preenchido.
 */

import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { createClient } from "@supabase/supabase-js";

const PARAMETROS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  algorithm: 2,
};

/**
 * Papel embutido na chave do Supabase.
 *
 * Duplica `src/lib/supabase/papel-da-chave.ts` de propósito: este script
 * roda em Node puro, sem o pipeline de TypeScript, e importar o módulo da
 * aplicação faz o Node reprocessar o arquivo e avisar. Seis linhas
 * repetidas custam menos que um script que depende do build para rodar.
 */
function papelDaChave(chave) {
  const limpa = chave.trim();
  if (limpa.startsWith("sb_secret_")) return "service_role";
  if (limpa.startsWith("sb_publishable_")) return "anon";

  const partes = limpa.split(".");
  if (partes.length !== 3) return "desconhecido";

  try {
    const payload = Buffer.from(partes[1], "base64url").toString("utf8");
    return JSON.parse(payload).role ?? "desconhecido";
  } catch {
    return "desconhecido";
  }
}

function gerarSenha() {
  // 24 bytes em base64url: ~192 bits, sem caractere ambíguo de digitar.
  return randomBytes(24).toString("base64url");
}

function exigir(nome) {
  const valor = process.env[nome];
  if (!valor) {
    console.error(`Falta a variável ${nome}.`);
    process.exit(1);
  }
  return valor;
}

async function principal() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? exigir("SUPABASE_URL");
  const chave = exigir("SUPABASE_SERVICE_ROLE_KEY");

  // Sem esta conferência, a chave anônima só falha depois de tudo pronto,
  // como "new row violates row-level security policy" — que manda quem lê
  // procurar defeito no schema em vez de na variável.
  if (papelDaChave(chave) === "anon") {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY contém a chave anônima, não a de serviço.",
    );
    console.error(
      "No Supabase: Project Settings -> API -> service_role (botão Reveal).",
    );
    process.exit(1);
  }
  const email = exigir("ADMIN_EMAIL").toLowerCase().trim();

  const nome = process.env.ADMIN_NOME ?? "Administrador";

  // `usuarios.telefone` é `not null` com check de 10 a 13 dígitos. Sem
  // ADMIN_TELEFONE isto virava string vazia e o insert morria em
  // "violates check constraint telefone_so_digitos" — mensagem que fala da
  // coluna e não da variável que ninguém sabia que precisava definir.
  const telefone = exigir("ADMIN_TELEFONE").replace(/\D/g, "");

  if (!/^[0-9]{10,13}$/.test(telefone)) {
    console.error(
      `ADMIN_TELEFONE precisa ter de 10 a 13 dígitos; veio com ${telefone.length}.`,
    );
    console.error("Com DDD e sem o +55. Ex.: 66999110001");
    process.exit(1);
  }

  const senhaGerada = !process.env.ADMIN_SENHA;
  const senha = process.env.ADMIN_SENHA ?? gerarSenha();

  if (senha.length < 12) {
    console.error("A senha do admin precisa de pelo menos 12 caracteres.");
    process.exit(1);
  }

  const supabase = createClient(url, chave, {
    auth: { persistSession: false },
  });

  const { data: existente } = await supabase
    .from("usuarios")
    .select("id, papel")
    .eq("email", email)
    .maybeSingle();

  const senhaHash = await hash(senha, PARAMETROS);

  if (existente) {
    // Já existe: promove e regrava a senha, em vez de falhar. É o caminho
    // usado para recuperar acesso.
    const { error } = await supabase
      .from("usuarios")
      .update({ papel: "admin", senha_hash: senhaHash })
      .eq("id", existente.id);

    if (error) {
      console.error("Não foi possível promover:", error.message);
      process.exit(1);
    }

    await supabase
      .from("admins")
      .upsert({ profile_id: existente.id }, { onConflict: "profile_id" });

    console.log(`Conta ${email} promovida a admin e senha redefinida.`);
  } else {
    const { data, error } = await supabase
      .from("usuarios")
      .insert({
        email,
        senha_hash: senhaHash,
        papel: "admin",
        nome_completo: nome,
        telefone,
        cidade: "Sinop",
        email_verificado: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Não foi possível criar:", error.message);
      process.exit(1);
    }

    await supabase.from("admins").insert({ profile_id: data.id });
    console.log(`Admin ${email} criado.`);
  }

  if (senhaGerada) {
    console.log("");
    console.log("  Senha gerada (aparece uma vez só):");
    console.log(`  ${senha}`);
    console.log("");
    console.log("  Guarde agora, num gerenciador de senhas.");
  }
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
