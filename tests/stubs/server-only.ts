/**
 * Substituto de `server-only` nos testes.
 *
 * O pacote real lança em qualquer ambiente que não seja um Server Component,
 * o que impediria testar `src/lib/data.ts` diretamente. A proteção continua
 * valendo em produção — o alias existe só no vitest.config.ts.
 */
export {};
