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
import type { ProviderListing } from "@/lib/types";
import type {
  PerfilCandidato as DadosCandidato,
  PerfilEmpresa as PerfilEmpresaDados,
  PerfilPrestador as PerfilPrestadorDados,
} from "@/server/repositories/tipos";

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

/**
 * Site, Instagram e Facebook — sempre os mesmos três, sempre nesta ordem.
 * Cada um só aparece se preenchido, e a linha inteira some se nenhum
 * estiver: o que não foi informado não deixa buraco na tela.
 */
function LinksSociais({
  site,
  instagram,
  facebook,
}: {
  site: string | null;
  instagram: string | null;
  facebook: string | null;
}) {
  if (!site && !instagram && !facebook) return null;

  const links = [
    { url: site, rotulo: "Site" },
    { url: instagram, rotulo: "Instagram" },
    { url: facebook, rotulo: "Facebook" },
  ].filter((l) => l.url);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      {links.map(({ url, rotulo }) => (
        <a
          key={rotulo}
          href={url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
        >
          {rotulo}
        </a>
      ))}
    </div>
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
export function PerfilCandidato({ perfil }: { perfil: DadosCandidato | null }) {
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
      {perfil.areaDesejada && (
        <Linha rotulo="Área desejada" valor={perfil.areaDesejada} />
      )}
      {perfil.formacao && <Linha rotulo="Formação" valor={perfil.formacao} />}
      {perfil.disponibilidade && (
        <Linha rotulo="Disponibilidade" valor={perfil.disponibilidade} />
      )}

      {perfil.habilidades.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted">Habilidades</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {perfil.habilidades.map((h) => (
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
  listagem,
  docVerificado,
}: {
  perfil: PerfilPrestadorDados | null;
  /**
   * A listagem pública, só para nota e número de avaliações. Elas vivem na
   * view `provider_listings`, calculadas por trigger — não são campo do
   * perfil, e mostrar como se fossem sugeriria que dá para editar.
   */
  listagem: ProviderListing | null;
  /** Sem documento aprovado, o perfil não entra na busca (#114). */
  docVerificado: boolean;
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

  const categoria = SERVICE_CATEGORIES.find((c) => c.id === perfil.categoriaId);

  return (
    <Secao
      icone={<Wrench size={16} className="text-servicos" />}
      titulo="Como você aparece na busca"
    >
      <div className="flex flex-wrap items-center gap-3">
        {categoria && <Badge tone="servicos">{categoria.name}</Badge>}
        {/*
         * Sem listagem não há nota: quem acabou de criar o anúncio ainda
         * não foi avaliado, e mostrar "0,0" faria parecer nota ruim em vez
         * de ausência de nota.
         */}
        {listagem && (
          <span className="inline-flex items-center gap-1 text-sm">
            <Star size={14} className="text-warn" />
            <strong>{listagem.avg_rating.toFixed(1).replace(".", ",")}</strong>
            <span className="text-muted">({listagem.review_count})</span>
          </span>
        )}
        {perfil.precoInicial !== null && (
          <span className="text-sm text-muted">
            {formatStartingPrice(perfil.precoInicial)}
          </span>
        )}
      </div>

      {perfil.descricao && (
        <p className="mt-3 text-sm leading-relaxed">{perfil.descricao}</p>
      )}

      {perfil.anosExperiencia !== null && (
        <div className="mt-3">
          <Linha
            rotulo="Experiência"
            valor={`${perfil.anosExperiencia} anos`}
          />
        </div>
      )}

      {perfil.bairrosAtendidos.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <MapPin size={13} />
            Bairros atendidos
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {perfil.bairrosAtendidos.map((b) => (
              <Badge key={b} tone="neutral">
                {b}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <LinksSociais
        site={null}
        instagram={perfil.instagram}
        facebook={perfil.facebook}
      />

      {/*
       * Se ainda não foi verificado, é aqui que ele descobre.
       *
       * A busca só mostra quem teve o documento aprovado (#114) — e isso
       * funcionando em silêncio é indistinguível de defeito: a pessoa
       * completa o perfil, se procura em `/servicos`, não se acha, e
       * conclui que o app quebrou. O perfil público já avisa quem abre por
       * link direto; faltava avisar quem procura, no lugar onde ela olha.
       */}
      {!docVerificado && (
        <div className="mt-4 rounded-xl border border-warn/30 bg-warn/8 p-4">
          <p className="font-medium text-sm">
            Seu perfil ainda não aparece na busca
          </p>
          <p className="mt-1 text-muted text-sm leading-relaxed">
            Falta conferirmos seu documento. Envie documento e selfie em Editar
            perfil — quem procura um profissional para entrar em casa precisa
            saber que alguém conferiu quem ele é.
          </p>
          <ButtonLink
            href="/perfil/editar"
            variant="servicos"
            size="sm"
            className="mt-3"
          >
            Enviar documento
          </ButtonLink>
        </div>
      )}

      {listagem && (
        <div className="mt-4">
          <ButtonLink
            href={`/servicos/${perfil.usuarioId}`}
            variant="outline"
            size="sm"
          >
            Ver como o cliente vê
          </ButtonLink>
        </div>
      )}
    </Secao>
  );
}

/** Empresa: o cartão que a candidata lê antes de se candidatar. */
export function PerfilEmpresa({
  empresa,
}: {
  empresa: PerfilEmpresaDados | null;
}) {
  if (!empresa) {
    return (
      <Vazio
        titulo="Nenhuma empresa vinculada"
        descricao="Cadastre os dados da empresa para publicar vagas. O CNPJ é o que separa uma vaga real de um anúncio falso, e é o que faz alguém confiar o suficiente para se candidatar."
        acao="Cadastrar empresa"
        href="/perfil/editar"
      />
    );
  }

  return (
    <Secao
      icone={<Building2 size={16} className="text-empresas" />}
      titulo="Sua empresa"
    >
      <Linha rotulo="Razão social" valor={empresa.razaoSocial} />
      {empresa.cnpj && <Linha rotulo="CNPJ" valor={empresa.cnpj} />}
      <div className="mt-3 flex items-center gap-2">
        <Award size={14} className="text-empresas" />
        <Badge tone={empresa.plano === "mensal" ? "empresas" : "neutral"}>
          {empresa.plano === "mensal" ? "Plano mensal" : "Período de teste"}
        </Badge>
      </div>

      <LinksSociais
        site={empresa.site}
        instagram={empresa.instagram}
        facebook={empresa.facebook}
      />

      <div className="mt-4">
        <ButtonLink href="/empresa" variant="outline" size="sm">
          Ir para o painel
        </ButtonLink>
      </div>
    </Secao>
  );
}
