#!/usr/bin/env node
/**
 * Cria a conta de administrador.
 *
 *   ADMIN_EMAIL=voce@exemplo.com ADMIN_SENHA='...' node scripts/criar-admin.mjs
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
  const email = exigir("ADMIN_EMAIL").toLowerCase().trim();

  const nome = process.env.ADMIN_NOME ?? "Administrador";
  const telefone = (process.env.ADMIN_TELEFONE ?? "").replace(/\D/g, "");

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
