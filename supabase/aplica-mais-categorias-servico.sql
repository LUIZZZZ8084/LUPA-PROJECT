-- =============================================================================
-- LUPA — Mais dez categorias de serviço
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- PARA QUE SERVE
-- ──────────────
-- As sete categorias originais eram todas de mão de obra manual —
-- eletricista, diarista, pintor, encanador, pedreiro, jardineiro,
-- cuidador. Pedido do Luiz em 03/09/2026: o prestador não é só quem
-- trabalha com as mãos, e faltava espaço para programador, designer e a
-- área de saúde autônoma.
--
-- OS IDS SÃO FIXOS, DE PROPÓSITO
-- ───────────────────────────────
-- `categorias_servico.id` é a chave que `perfis_prestador.categoria_id`
-- referencia. Os ids de 8 a 17 aqui precisam bater exatamente com os que
-- `src/lib/constants.ts` já usa — não são gerados pela sequência, para
-- que os dois lados nunca divirjam.
--
-- Aditivo e repetível: `on conflict do nothing` deixa rodar de novo sem
-- duplicar linha nem falhar por causa da constraint de unicidade em
-- `slug`/`nome`. Não mexe em categoria existente, não remove nenhuma.
-- =============================================================================

begin;

insert into categorias_servico (id, slug, nome) values
  (8,  'programador',        'Programador(a)'),
  (9,  'designer',           'Designer Gráfico(a)'),
  (10, 'tecnico-enfermagem', 'Técnico(a) de Enfermagem'),
  (11, 'farmaceutico',       'Farmacêutico(a)'),
  (12, 'fisioterapeuta',     'Fisioterapeuta'),
  (13, 'cabeleireiro',       'Cabeleireiro(a)'),
  (14, 'manicure',           'Manicure'),
  (15, 'fotografo',          'Fotógrafo(a)'),
  (16, 'personal-trainer',   'Personal Trainer'),
  (17, 'mecanico',           'Mecânico(a)')
on conflict (id) do nothing;

select setval(
  'categorias_servico_id_seq',
  (select max(id) from categorias_servico)
);

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- Deve vir 17. Se vier menos, alguma linha não entrou — confira o log de
-- erro acima por conflito de `slug` ou `nome` com uma categoria já
-- existente sob outro id.

select count(*) as total_categorias from categorias_servico;
