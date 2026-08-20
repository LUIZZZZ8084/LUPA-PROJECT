import { MapPin } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { VerifiedMark } from "@/components/verified-badge";
import { formatSalaryRange, timeAgo } from "@/lib/format";
import type { JobListing } from "@/lib/types";
import { cn } from "@/lib/utils";

const NEW_WINDOW_HOURS = 24;

function isNew(createdAt: string) {
  return (
    Date.now() - new Date(createdAt).getTime() < NEW_WINDOW_HOURS * 3_600_000
  );
}

export function JobCard({
  job,
  className,
}: {
  job: JobListing;
  className?: string;
}) {
  return (
    <Link
      href={`/vagas/${job.id}`}
      className={cn(
        "group flex min-w-0 gap-3.5 rounded-[var(--radius-card)] border border-line bg-panel p-4",
        "transition-[background-color,border-color,transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] hover:border-vagas/40 hover:bg-panel-2 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 active:translate-y-0 active:scale-[0.995] motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <Avatar
        name={job.company.company_name}
        src={job.company.logo_url}
        square
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-[15px] leading-snug font-semibold text-ink group-hover:text-vagas">
            {job.title}
          </h3>
          {isNew(job.created_at) && <Badge tone="vagas">Novo</Badge>}
        </div>

        {/* O truncate precisa ficar no texto, não no contêiner flex: em flex
            o ellipsis não se aplica e o nowrap trava a largura do card. */}
        <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted">
          <span className="truncate">{job.company.company_name}</span>
          {job.company.doc_verified && <VerifiedMark size={13} />}
        </p>

        <p className="mt-2 text-sm font-semibold text-vagas">
          {formatSalaryRange(job.salary_min, job.salary_max)}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />
            {job.neighborhood ? `${job.neighborhood}, ` : ""}
            {job.city}
          </span>
          {job.contract_type && <span>{job.contract_type}</span>}
          <span>{timeAgo(job.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}
