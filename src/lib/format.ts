/** Formatação em pt-BR usada em toda a interface. */

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const brlComCentavos = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Valor em reais, sem centavos. Usado no painel administrativo. */
export function formatMoneyBRL(valor: number): string {
  return brl.format(valor);
}

/**
 * "R$ 24,90" — preço de cobrança, sempre com centavos.
 *
 * `formatMoneyBRL` arredonda de propósito para métrica aproximada de
 * painel; um preço de verdade não pode virar "R$ 25" quando o que se
 * cobra é R$ 24,90.
 */
export function formatPrecoBRL(valor: number): string {
  return brlComCentavos.format(valor);
}

/** "R$ 3.200 – R$ 4.200", "A partir de R$ 1.800" ou "A combinar". */
export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (min && max) return `${brl.format(min)} – ${brl.format(max)}`;
  if (min) return `A partir de ${brl.format(min)}`;
  if (max) return `Até ${brl.format(max)}`;
  return "A combinar";
}

export function formatStartingPrice(value: number | null | undefined): string {
  if (!value) return "Preço a combinar";
  return `A partir de ${brl.format(value)}`;
}

/** Nota com vírgula decimal, como "4,8". */
export function formatRating(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

/** "há 2h", "há 3d", "há 2 sem" — o mesmo padrão dos cards do esboço. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `há ${weeks} sem`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  return `há ${Math.floor(days / 365)}a`;
}

/** ISO de daqui a N dias — prazo de vaga, mensalidade de prestador etc. */
export function daquiA(dias: number): string {
  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Se uma data-limite já passou — vaga expirada, mensalidade vencida,
 * qualquer prazo do mesmo formato.
 *
 * O estado "vencido" nunca é guardado — é sempre calculado daqui, a
 * partir da própria data. Guardar como um valor à parte exigiria um job
 * agendado para o estado ficar certo; calculando na hora, a correção
 * mora na própria consulta, e nunca atrasa.
 */
export function passouDoPrazo(dataIso: string): boolean {
  return new Date(dataIso).getTime() <= Date.now();
}

/** Se `expiraEm` já passou. Alias de `passouDoPrazo`, para vaga. */
export function vagaExpirada(expiraEm: string): boolean {
  return passouDoPrazo(expiraEm);
}

/**
 * "Expira em 12 dias", "Expira hoje" ou "Expirou há 3 dias".
 *
 * Arredonda para o dia mais próximo, não para baixo: 20 horas para o
 * prazo lê "hoje", não "amanhã" — o que importa aqui é a urgência que a
 * pessoa sente, não a contagem exata de horas.
 */
export function prazoDaVaga(expiraEm: string): string {
  const dias = Math.round(
    (new Date(expiraEm).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (dias >= 2) return `Expira em ${dias} dias`;
  if (dias === 1) return "Expira amanhã";
  if (dias === 0) return "Expira hoje";
  const passados = Math.abs(dias);
  return `Expirou há ${passados} ${passados === 1 ? "dia" : "dias"}`;
}

/** Só os dígitos — o que o wa.me espera. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** "(66) 99999-1234" a partir de qualquer entrada. */
export function formatPhone(value: string): string {
  const d = onlyDigits(value).replace(/^55/, "");
  if (d.length === 11)
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value;
}

export function formatCnpj(value: string): string {
  const d = onlyDigits(value);
  if (d.length !== 14) return value;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Deep link do WhatsApp com mensagem pré-preenchida.
 * Assume DDI 55 quando o número vem sem código de país.
 */
export function whatsappLink(phone: string, message: string): string {
  let digits = onlyDigits(phone);
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
