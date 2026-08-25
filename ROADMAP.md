# Roadmap

Visão geral do que está pronto e do que falta, para quem chega no
projeto sem ter acompanhado a conversa. Mantido por quem mexe no
código — humano ou agente — a cada mudança relevante. Para o
passo a passo de como contribuir, veja o [CONTRIBUTING.md](CONTRIBUTING.md).
Detalhe de arquitetura e o porquê de cada decisão está no
[AGENTS.md](AGENTS.md).

## Concluído

- Autenticação própria (cadastro, login, sessão em JWT, RBAC por papel)
- App fechado por login, com 404 de verdade em vez de 403 onde faz
  sentido
- Perfil por papel (candidato CLT, prestador, empresa) com edição em
  `/perfil/editar`
- Envio de foto de perfil, currículo em PDF e logo de empresa, com
  caminho derivado da sessão
- Busca de vagas e de prestadores, com filtro por cidade, bairro e
  categoria
- Candidatura a vaga
- Publicações no perfil do prestador, com limite de 10 ativas
- Painel administrativo: fila de verificação manual, métricas básicas
- Schema único (`supabase/schema.sql`), executado por teste contra
  Postgres real
- Modo demonstração (roda sem Supabase configurado)
- Contraste WCAG AA em todas as rotas, com teste automático

## Pendente

Painel da empresa:

- [ ] Publicar, editar e encerrar vaga — [#43](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/43)
- [ ] Mover candidatura entre estágios — [#44](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/44)
- [ ] Métricas em série (não só contagem) — [#45](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/45)
- [ ] Cobrança via Mercado Pago (planos trial/mensal) — [#46](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/46)

Depois do V1:

- [ ] Gerador de currículo pago — [#47](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/47)
- [ ] Notificação push por bairro e categoria — [#48](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/48)
- [ ] Segunda cidade-piloto — [#49](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/49)

**Fora do escopo por decisão, não por esquecimento:** banco de talentos
com busca ativa de candidatos, testes e triagem automática, múltiplos
usuários por empresa e chat interno. O porquê de cada um está no
AGENTS.md.
