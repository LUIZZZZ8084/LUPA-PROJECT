-- =============================================================================
-- LUPA — Mais trinta e três profissões de prestador (#457)
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- PARA QUE SERVE
-- ──────────────
-- Com o app aberto ao Brasil inteiro, quem é marceneiro, soldador, babá ou
-- tratorista não achava a própria profissão na lista de dezessete.
--
-- OS IDS SÃO FIXOS, DE PROPÓSITO
-- ───────────────────────────────
-- `categorias_servico.id` é a chave que `perfis_prestador.categoria_id`
-- referencia. Os ids de 18 a 50 aqui precisam bater exatamente com os de
-- `src/lib/constants.ts` — não vêm da sequência, para os dois lados nunca
-- divergirem, e há teste que compara as duas listas.
--
-- Aditivo e repetível: `on conflict do nothing` deixa rodar de novo sem
-- duplicar linha. Não mexe em categoria existente, não remove nenhuma.
--
-- Antes ou depois do deploy, tanto faz: a profissão nova só aparece na tela
-- quando o código novo está no ar, e profissão no banco sem tela não faz mal
-- a ninguém. **Mas rode antes de alguém escolher uma delas**, ou escolher
-- falha por chave estrangeira.
-- =============================================================================

begin;

insert into categorias_servico (id, slug, nome) values
  (18, 'marceneiro', 'Marceneiro(a)'),
  (19, 'serralheiro', 'Serralheiro(a)'),
  (20, 'soldador', 'Soldador(a)'),
  (21, 'gesseiro', 'Gesseiro(a)'),
  (22, 'vidraceiro', 'Vidraceiro(a)'),
  (23, 'azulejista', 'Azulejista'),
  (24, 'tecnico-ar-condicionado', 'Técnico(a) de Ar-condicionado'),
  (25, 'tecnico-informatica', 'Técnico(a) de Informática'),
  (26, 'tecnico-celular', 'Técnico(a) de Celular'),
  (27, 'chaveiro', 'Chaveiro(a)'),
  (28, 'montador-moveis', 'Montador(a) de Móveis'),
  (29, 'instalador-energia-solar', 'Instalador(a) de Energia Solar'),
  (30, 'instalador-cameras', 'Instalador(a) de Câmeras e Alarmes'),
  (31, 'dedetizador', 'Dedetizador(a)'),
  (32, 'piscineiro', 'Piscineiro(a)'),
  (33, 'motoboy', 'Motoboy / Entregador(a)'),
  (34, 'motorista-particular', 'Motorista Particular'),
  (35, 'baba', 'Babá'),
  (36, 'passadeira', 'Passadeira'),
  (37, 'costureira', 'Costureira(o)'),
  (38, 'cozinheiro', 'Cozinheiro(a)'),
  (39, 'confeiteiro', 'Confeiteiro(a) / Padeiro(a)'),
  (40, 'churrasqueiro', 'Churrasqueiro(a)'),
  (41, 'garcom', 'Garçom / Garçonete'),
  (42, 'barbeiro', 'Barbeiro(a)'),
  (43, 'maquiador', 'Maquiador(a)'),
  (44, 'massoterapeuta', 'Massoterapeuta'),
  (45, 'esteticista', 'Esteticista'),
  (46, 'contador', 'Contador(a)'),
  (47, 'professor-particular', 'Professor(a) Particular'),
  (48, 'veterinario', 'Veterinário(a)'),
  (49, 'tosador', 'Banho e Tosa'),
  (50, 'tratorista', 'Tratorista / Operador(a) de Máquinas')
on conflict (id) do nothing;

select setval(
  'categorias_servico_id_seq',
  (select max(id) from categorias_servico)
);

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- Deve vir 50. Se vier menos, alguma linha não entrou — confira o log de
-- erro acima por conflito de `slug` ou `nome` com uma categoria já
-- existente sob outro id.

select count(*) as total_categorias from categorias_servico;
