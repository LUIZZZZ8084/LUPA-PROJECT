# Como contribuir

Duas pessoas trabalham neste projeto — Luiz e Paulinho — e às vezes uma
está fora enquanto a outra segue trabalhando. Este documento é o resumo
rápido; a versão completa, com o porquê de cada regra, está no
[AGENTS.md](AGENTS.md#fluxo-de-trabalho-obrigatório).

## O ciclo

1. **Abra uma Issue antes de começar.** Descreva o problema e o critério
   de aceite — como saber que está pronto. Sem Issue não se começa, mesmo
   para uma correção pequena. Motivo: daqui a seis meses, "por que isto
   está assim?" precisa ter resposta.
2. **Veja o [ROADMAP.md](ROADMAP.md)** para saber o que está em aberto e
   o que já foi feito, sem precisar perguntar.
3. **Crie uma branch**, nunca trabalhe direto na `main`. Nome:
   `feat/`, `fix/`, `docs/` ou `refactor/` seguido de um descritor curto
   em português com hífens. Ex.: `fix/candidatura-nao-envia`.
4. **Commits pequenos**, no padrão do Commitlint: tipo em inglês (`feat`,
   `fix`, `docs`, `refactor`, `test`, `chore`), assunto em português,
   cabeçalho até 72 caracteres. O Husky recusa o que não bater.
5. **Rode `npm run verify`** antes de abrir o PR — é o mesmo conjunto que
   roda na CI (tipos, lint, código morto, arquitetura, cobertura).
6. **Atualize o [ROADMAP.md](ROADMAP.md) no mesmo PR**, movendo o item de
   "Pendente" para "Concluído" com o link do PR. Não no próximo, não
   depois: o roadmap já ficou errado uma vez, listando como pendentes três
   coisas entregues, e documento que erra uma vez deixa de ser consultado.
   `npm run roadmap` confere, e a CI reprova.
7. **Abra o PR referenciando a Issue** com `Closes #N` no corpo, para ela
   fechar sozinha no merge. Todo merge na `main` publica na Vercel.

## Onde perguntar

Se não tiver certeza de uma decisão de produto ou arquitetura, procure
primeiro em [`AGENTS.md`](AGENTS.md) — a maioria das decisões já
documentadas explica o motivo, não só o quê. Se não estiver lá, pergunte
antes de assumir.
