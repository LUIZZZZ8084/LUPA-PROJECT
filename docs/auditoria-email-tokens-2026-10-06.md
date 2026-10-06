# Auditoria adversarial — e-mail e tokens (06/10/2026)

Quinta frente da revisão de segurança: a recuperação de senha (#174) e a
confirmação de e-mail (#227) — geração de token, hash, uso único, prazo,
separação de finalidade, enumeração de contas e timing. Análise sobre o
código, sem tocar produção.

**Resumo: nenhum achado.** O fluxo de tokens é sólido e cada cuidado está no
lugar certo — o consumo é atômico, a finalidade separa os dois usos na mesma
instrução, e a enumeração de contas é fechada por resposta idêntica mais um
piso de tempo. Registro o que foi verificado.

---

## O que resistiu à análise (verificado, sem brecha)

- **Token guardado em hash.** 32 bytes aleatórios (`randomBytes`, base64url),
  gravados como SHA-256 — o valor original só existe no e-mail. Quem lesse a
  tabela `tokens_recuperacao` não trocaria a senha de ninguém. SHA-256 (e não
  Argon2) é correto aqui: o segredo tem 256 bits de entropia, não há o que
  adivinhar.
- **Uso único atômico.** `consumirTokenDeRecuperacao` é um `update ... set
  usado_em = now() where token_hash = $1 and finalidade = $2 and usado_em is
  null and expira_em > $3 returning usuario_id`. As quatro condições moram no
  `WHERE` da própria escrita — dois cliques no mesmo link, ou um link vazado
  usado em paralelo, passam só um pela guarda; o outro recebe zero linhas.
  Nada de ler-decide-grava.
- **Finalidade separa os dois usos, e na instrução que gasta.** Redefinir
  senha exige `finalidade = "recuperacao"`; confirmar e-mail exige
  `"verificacao_email"`. Um token de verificação — mandado com muito mais
  liberdade (no cadastro e a cada "reenviar") — **não redefine senha**, porque
  o `eq("finalidade", ...)` está no mesmo `update`. Fecha o risco de cada
  reenvio virar um link de redefinição circulando.
- **Prazos distintos, com razão.** Recuperação vale 1 hora (o navegador está
  aberto agora; janela curta limita link vazado); verificação vale 24 horas
  (chega junto do cadastro, e é comum abrir a caixa à noite). Ambos conferidos
  no consumo.
- **Trocar a senha revoga as sessões antigas, atomicamente.**
  `atualizarSenhaHash` grava `senha_hash` **e** `sessoes_validas_desde` na
  mesma instrução. Não há janela em que a senha mudou e o token velho ainda
  vale, nem um segundo passo que um terceiro caminho de troca esqueceria
  (a lição da #142).
- **Enumeração de contas fechada por dois meios.** A resposta é sempre
  `{ ok: true }`, exista a conta ou não — e um **piso de tempo**
  (`PISO_DE_RESPOSTA_MS = 1200ms`) iguala a latência entre "gravou token +
  chamou o Resend" e "voltou de uma leitura só", fechando o oráculo de timing
  que a frase idêntica sozinha não fecharia. Falha de envio também responde
  `ok` (só aconteceria para quem tem conta) e vai para o log. Nenhum log
  carrega o endereço.
- **Limite por origem, contando toda tentativa** (`recuperacao:<origem>`,
  `verificacao:<origem>`) — como no cadastro: o que se contém é o envio de
  e-mail em nome da Lupa, e quem abusa troca de e-mail a cada tentativa. A
  resposta "sem provedor de e-mail" fica **fora** do piso de propósito: é
  verdade igual para todos e não conta nada sobre nenhuma conta.
- **E-mail é texto puro, enviado via API JSON do Resend.** Sem HTML, sem
  injeção de cabeçalho SMTP; o destinatário é o e-mail do próprio usuário
  (do banco), o assunto é literal, e só o primeiro nome entra no corpo.

---

## Panorama das frentes

| Frente | Resultado |
|---|---|
| Superfícies gerais | 2 corrigidos (#345, #346) — merged |
| Pagamentos / idempotência | 1 endurecido (#348) — merged |
| Arquivos privados + headers | sem IDOR; **HSTS pendente** 🟠 |
| RBAC / autorização | sem achados |
| E-mail e tokens | sem achados |

A única pendência acionável de toda a auditoria continua sendo o **HSTS**
(`docs/auditoria-arquivos-headers-2026-10-06.md`).
