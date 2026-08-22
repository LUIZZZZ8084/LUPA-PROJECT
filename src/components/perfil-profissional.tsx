import {
  Award,
  Briefcase,
  Building2,
  MapPin,
  Star,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { SERVICE_CATEGORIES } from "@/lib/constants";
import { formatStartingPrice } from "@/lib/format";
import type { CltProfile, Company, ProviderListing } from "@/lib/types";

/**
 * A parte profissional do perfil — o que a pessoa faz, oferece ou procura.
 *
 * O perfil mostrava só os campos da conta: nome, e-mail, telefone. Isso
 * responde "quem é você no sistema", não "quem é você para quem contrata".
 * Um prestador precisa ver o próprio anúncio como ele aparece na busca; um
 * candidato precisa ver o que uma empresa veria; uma empresa precisa ver o
 * cartão que a candidata lê antes de se candidatar.
 *
 * Cada papel tem um bloco diferente porque cada um tem uma identidade
 * profissional diferente. Um formulário único com campos ocultos por papel
 * mostraria a todos o vocabulário de um.
 */

function Vazio({
  titulo,
  descricao,
  acao,
  href,
}: {
  titulo: string;
  descricao: string;
  acao: string;
  href: string;
}) {
  return (
    <Panel className="mb-5">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{descricao}</p>
      <div className="mt-4">
        <ButtonLink href={href} variant="outline" size="sm">
          {acao}
        </ButtonLink>
      </div>
    </Panel>
  );
}

function Secao({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <Panel className="mb-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {icone}
        {titulo}
      </h2>
      <div className="mt-3">{children}</div>
    </Panel>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex gap-2 py-1 text-sm">
      <span className="w-36 flex-none text-muted">{rotulo}</span>
      <span className="min-w-0 flex-1">{valor}</span>
    </div>
  );
}

/** Candidato: o que uma empresa veria ao abrir a candidatura. */
export function PerfilCandidato({ perfil }: { perfil: CltProfile | null }) {
  if (!perfil) {
    return (
      <Vazio
        titulo="Seu currículo ainda está vazio"
        descricao="Empresas veem esta parte ao receber sua candidatura. Área desejada, formação e habilidades são o que fazem alguém ler até o fim."
        acao="Completar currículo"
        href="/perfil/editar"
      />
    );
  }

  return (
    <Secao
      icone={<Briefcase size={16} className="text-vagas" />}
      titulo="Currículo"
    >
      {perfil.desired_area && (
        <Linha rotulo="Área desejada" valor={perfil.desired_area} />
      )}
      {perfil.education && <Linha rotulo="Formação" valor={perfil.education} />}
      {perfil.availability && (
        <Linha rotulo="Disponibilidade" valor={perfil.availability} />
      )}

      {perfil.skills.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted">Habilidades</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {perfil.skills.map((h) => (
              <Badge key={h} tone="vagas">
                {h}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-faint">
        Currículo e área desejada não aparecem em busca pública. Nem todo mundo
        quer que o patrão atual descubra que está procurando emprego.
      </p>
    </Secao>
  );
}

/** Prestador: o próprio anúncio, como ele sai na busca. */
export function PerfilPrestador({
  perfil,
}: {
  perfil: ProviderListing | null;
}) {
  if (!perfil) {
    return (
      <Vazio
        titulo="Seu anúncio ainda não está no ar"
        descricao="Sem categoria e descrição você não aparece na busca — e quem procura conclui que não há profissional disponível na região."
        acao="Criar meu anúncio"
        href="/perfil/editar"
      />
    );
  }

  const categoria = SERVICE_CATEGORIES.find((c) => c.id === perfil.category_id);

  return (
    <Secao
      icone={<Wrench size={16} className="text-servicos" />}
      titulo="Como você aparece na busca"
    >
      <div className="flex flex-wrap items-center gap-3">
        {categoria && <Badge tone="servicos">{categoria.name}</Badge>}
        <span className="inline-flex items-center gap-1 text-sm">
          <Star size={14} className="text-warn" />
          <strong>{perfil.avg_rating.toFixed(1).replace(".", ",")}</strong>
          <span className="text-muted">({perfil.review_count})</span>
        </span>
        {perfil.starting_price !== null && (
          <span className="text-sm text-muted">
            {formatStartingPrice(perfil.starting_price)}
          </span>
        )}
      </div>

      {perfil.description && (
        <p className="mt-3 text-sm leading-relaxed">{perfil.description}</p>
      )}

      {perfil.years_experience !== null && (
        <div className="mt-3">
          <Linha
            rotulo="Experiência"
            valor={`${perfil.years_experience} anos`}
          />
        </div>
      )}

      {perfil.service_area.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <MapPin size={13} />
            Bairros atendidos
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {perfil.service_area.map((b) => (
              <Badge key={b} tone="neutral">
                {b}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <ButtonLink
          href={`/servicos/${perfil.profile_id}`}
          variant="outline"
          size="sm"
        >
          Ver como o cliente vê
        </ButtonLink>
      </div>
    </Secao>
  );
}

/** Empresa: o cartão que a candidata lê antes de se candidatar. */
export function PerfilEmpresa({ empresa }: { empresa: Company | null }) {
  if (!empresa) {
    return (
      <Vazio
        titulo="Nenhuma empresa vinculada"
        descricao="Cadastre os dados da empresa para publicar vagas. O CNPJ é o que separa uma vaga real de um anúncio falso, e é o que faz alguém confiar o suficiente para se candidatar."
        acao="Cadastrar empresa"
        href="/cadastro?tipo=empresa"
      />
    );
  }

  return (
    <Secao
      icone={<Building2 size={16} className="text-empresas" />}
      titulo="Sua empresa"
    >
      <Linha rotulo="Razão social" valor={empresa.company_name} />
      {empresa.cnpj && <Linha rotulo="CNPJ" valor={empresa.cnpj} />}
      <div className="mt-3 flex items-center gap-2">
        <Award size={14} className="text-empresas" />
        <Badge tone={empresa.plan === "mensal" ? "empresas" : "neutral"}>
          {empresa.plan === "mensal" ? "Plano mensal" : "Período de teste"}
        </Badge>
      </div>

      <div className="mt-4">
        <ButtonLink href="/empresa" variant="outline" size="sm">
          Ir para o painel
        </ButtonLink>
      </div>
    </Secao>
  );
}
