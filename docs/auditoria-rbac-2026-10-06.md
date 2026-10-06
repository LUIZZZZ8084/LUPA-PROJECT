# Auditoria adversarial — RBAC e autorização (06/10/2026)

Quarta frente da revisão de segurança: a matriz de capacidades, os guardas
(`exigirCapacidade`/`exigirDono`) e a varredura por **IDOR** — ações que
tocam um registro específico e poderiam deixar passar o id de outra pessoa.
Análise sobre o código, sem tocar produção.

**Resumo: nenhum achado.** A camada de autorização é sólida e consistente —
o padrão de duas perguntas (pode este papel? é deste dono?) está aplicado em
todas as ações que mexem em registro com dono, e o id de ator/dono vem
sempre da sessão, nunca do formulário. Registro o que foi verificado para a
próxima auditoria não refazer o caminho.

---

## O que resistiu à análise (verificado, sem brecha)

- **Matriz declarativa** (`src/server/auth/rbac.ts`): capacidades nomeadas por
  recurso e verbo, uma linha por papel, numa tela. O admin **enxerga tudo mas
  não escreve no lugar de ninguém** — publicar vaga, candidatar-se e mover
  candidatura ficam fora do papel admin, de propósito (ação com dono não pode
  vir de um acesso que não deixa rastro de autor).
- **`exigirDono` devolve 404, não 403**, e o admin o bypassa. 403 confirmaria
  que o registro existe — informação de graça para quem sonda ids.
- **Mover candidatura** (`candidaturas/servico.ts`): `exigirCapacidade
  (candidatura:mover_estagio)` + busca a candidatura → a vaga → `exigirDono`
  comparando `empresaDoPainel(sessão)` contra `vaga.empresaId`. Uma empresa
  movendo a candidatura de outra → donos divergem → 404. O dono vem da
  sessão; o id da vaga, do banco. Sem IDOR.
- **Encerrar / reativar vaga** (`vagas/servico.ts`): `vagaDaEmpresa` busca a
  vaga por id e `exigirDono(idDaEmpresa(sessão), vaga.empresaId)`. Id de vaga
  de outra empresa → 404. Reativar ainda exige vaga expirada (não encerrada à
  mão) e cobra um crédito, como publicar.
- **Publicações** (`publicacoes/servico.ts`): editar e arquivar chamam
  `exigirCapacidade(publicacao:editar/arquivar_propria)` + `exigirDono
  (atual.autorId)`. Dono comparado com o autor gravado. Sem IDOR.
- **Editar perfil** (`perfil/editar/actions.ts`): `quemEsta()` devolve o
  `usuarioId`/`papel` **da sessão**, e os serviços recebem esse id — nunca um
  id vindo do formulário. Os schemas Zod não conhecem `usuarioId` nem `papel`,
  então um campo forjado é descartado. É a regra "o papel vem da sessão, nunca
  do formulário" valendo na prática.
- **Avaliar prestador** (`avaliacoes/servico.ts`): `exigirCapacidade
  (avaliacao:escrever)`, auto-avaliação barrada (`autenticado.usuarioId ===
  prestadorId`), uma por pessoa (`jaAvaliou`), e `avaliadorId` gravado a
  partir da sessão. O banco repete as duas travas (check + índice único
  parcial) como segunda camada — a aplicação só dá mensagem decente antes.
- **Gerar currículo / assinatura / métricas / verificação / busca de
  candidatos / notificações**: cada serviço abre com `exigirCapacidade` da
  capacidade certa; a compra do gerador é checada à parte (capacidade diz
  quem chega à tela, pagamento diz se já pagou).

O id de quem é dono ou autor é sempre derivado da sessão assinada
(`empresaDoPainel`, `idDaEmpresa`, `autenticado.usuarioId`), e o id do
registro vem do banco. Não há caminho em que um id do cliente decida sobre o
registro de outra pessoa.

---

## Pendência aberta (de outra frente)

O único item acionável ainda em aberto da auditoria é o **HSTS** — ver
`docs/auditoria-arquivos-headers-2026-10-06.md`. Esta frente de RBAC não
gerou nenhum.
