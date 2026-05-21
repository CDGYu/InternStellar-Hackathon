import Link from "next/link";

import { BackToHomeButton } from "@/components/ui/BackToHomeButton";
import { Card } from "@/components/ui/Card";
import { IconWell } from "@/components/ui/IconWell";
import {
  CheckCircleIcon,
  GearIcon,
  ShieldIcon,
  SparkleIcon,
} from "@/components/ui/icons";
import {
  buildHealthReport,
  ENV_SPEC,
  type BaseProbe,
  type StellarRpcProbe,
  type StellarSignerProbe,
  type StellarContractProbe,
} from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public deployment-status page. No auth required. Anyone who hits the
 * deployed app can open `/status` to see exactly which env vars are
 * configured, which Supabase / Stellar probes pass, and what's missing.
 *
 * It is the page `app/error.tsx` links to when something throws, so it
 * MUST NOT depend on Supabase / Stellar / env vars to render. The
 * `buildHealthReport()` call is the only data dependency and is
 * exception-safe by design.
 */
export default async function StatusPage() {
  const report = await buildHealthReport();

  const envBySupabase = ENV_SPEC.filter((s) => s.group === "supabase");
  const envByStellar = ENV_SPEC.filter((s) => s.group === "stellar");

  const headlineTone: "ok" | "degraded" = report.ok ? "ok" : "degraded";
  const missingEnvCount = Object.values(report.checks.env).filter(
    (s) => s === "missing",
  ).length;

  return (
    <main className="relative min-h-screen px-4 py-12 md:py-16">
      <BackToHomeButton />

      <div className="mx-auto max-w-3xl space-y-8">
        {/* ---- Headline ------------------------------------------------ */}
        <Card className="p-8 md:p-10 text-center">
          <div className="inline-flex">
            <IconWell tone={headlineTone === "ok" ? "teal" : "accent"} size="lg">
              {headlineTone === "ok" ? (
                <CheckCircleIcon className="h-8 w-8" />
              ) : (
                <ShieldIcon className="h-8 w-8" />
              )}
            </IconWell>
          </div>
          <p className="mt-8 text-xs uppercase tracking-[0.22em] text-ink-muted font-medium">
            InternStellar · Deployment status
          </p>
          <h1 className="mt-4 font-display text-3xl md:text-4xl font-extrabold tracking-tight text-ink">
            {headlineTone === "ok"
              ? "Deployment healthy."
              : "Deployment degraded."}
          </h1>
          <p className="mt-4 text-ink-muted leading-relaxed">
            {headlineTone === "ok" ? (
              <>
                All probes are green. Supabase reachable, Stellar testnet RPC
                reachable with matching passphrase, signer parses, contract id
                valid.
              </>
            ) : (
              <>
                {missingEnvCount > 0
                  ? `${missingEnvCount} environment variable${
                      missingEnvCount === 1 ? "" : "s"
                    } missing.`
                  : "One or more probes failed."}{" "}
                See the checklist below and set the missing values in your
                Vercel project (Settings → Environment Variables), then
                redeploy.
              </>
            )}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Pill label="chain" value={report.chain} kind={report.chain === "ok" ? "ok" : "err"} />
            <Pill label="db" value={report.db} kind={report.db === "ok" ? "ok" : "err"} />
            {report.contract_id ? (
              <Pill label="contract" value="set" kind="ok" />
            ) : (
              <Pill label="contract" value="unset" kind="err" />
            )}
          </div>
        </Card>

        {/* ---- Env vars ----------------------------------------------- */}
        <Card className="p-8 md:p-10">
          <SectionHeader
            icon={<GearIcon className="h-5 w-5" />}
            title="Environment variables"
            subtitle="The 9 keys this deploy needs. Values are never echoed — only presence is checked."
          />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <EnvGroup title="Supabase">
              {envBySupabase.map((spec) => (
                <EnvRow
                  key={spec.key}
                  envKey={spec.key}
                  status={report.checks.env[spec.key] ?? "missing"}
                  secret={!spec.public}
                />
              ))}
            </EnvGroup>
            <EnvGroup title="Stellar">
              {envByStellar.map((spec) => (
                <EnvRow
                  key={spec.key}
                  envKey={spec.key}
                  status={report.checks.env[spec.key] ?? "missing"}
                  secret={!spec.public}
                />
              ))}
            </EnvGroup>
          </div>
        </Card>

        {/* ---- Probes ------------------------------------------------- */}
        <Card className="p-8 md:p-10">
          <SectionHeader
            icon={<SparkleIcon className="h-5 w-5" />}
            title="Live probes"
            subtitle="Real network calls. RPC has a 5-second timeout."
          />
          <div className="mt-6 space-y-4">
            <ProbeRow
              name="Supabase (service_role)"
              detail="HEAD select on the `inventory` table"
              probe={report.checks.supabase_admin}
            />
            <StellarRpcRow probe={report.checks.stellar_rpc} />
            <StellarSignerRow probe={report.checks.stellar_signer} />
            <StellarContractRow probe={report.checks.stellar_contract_id} />
          </div>
        </Card>

        {/* ---- Footer ------------------------------------------------- */}
        <Card className="p-6 md:p-8 text-sm text-ink-muted leading-relaxed">
          <p>
            Raw JSON:{" "}
            <Link
              href="/api/health"
              className="text-accent hover:text-accent-light transition-colors font-medium"
            >
              /api/health
            </Link>
            . Documentation for operators:{" "}
            <span className="font-mono text-ink">docs/handoffs/p4-charles.md</span>
            {" "}§ &ldquo;Hosted Deployment&rdquo; (task 5).
          </p>
          <p className="mt-3">
            This page is exception-safe by design — it does not depend on
            Supabase or Stellar to render. If you reached it via the
            &ldquo;Something went wrong&rdquo; page, the checklist above is the
            actionable diagnostic.
          </p>
        </Card>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Local subcomponents (no Supabase / no env deps)                            */
/* -------------------------------------------------------------------------- */

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="h-10 w-10 rounded-2xl bg-surface shadow-neu-inset-sm flex items-center justify-center text-accent shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="font-display text-xl md:text-2xl font-extrabold tracking-tight text-ink">
          {title}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function EnvGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-medium mb-3">
        {title}
      </p>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function EnvRow({
  envKey,
  status,
  secret,
}: {
  envKey: string;
  status: "ok" | "missing";
  secret: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl bg-surface shadow-neu-inset-sm px-4 py-3">
      <div className="min-w-0">
        <p className="font-mono text-sm text-ink truncate" title={envKey}>
          {envKey}
        </p>
        {secret ? (
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-muted mt-1">
            Secret · never echoed
          </p>
        ) : null}
      </div>
      <StatusBadge kind={status === "ok" ? "ok" : "err"}>
        {status === "ok" ? "set" : "missing"}
      </StatusBadge>
    </li>
  );
}

function ProbeRow({
  name,
  detail,
  probe,
  extra,
}: {
  name: string;
  detail: string;
  probe: BaseProbe;
  extra?: React.ReactNode;
}) {
  const kind: BadgeKind =
    probe.status === "ok" ? "ok" : probe.status === "skipped" ? "muted" : "err";
  return (
    <div className="rounded-2xl bg-surface shadow-neu-inset-sm px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{name}</p>
          <p className="text-xs text-ink-muted mt-1">{detail}</p>
        </div>
        <StatusBadge kind={kind}>{probe.status}</StatusBadge>
      </div>
      {probe.reason ? (
        <p className="mt-3 text-xs text-ink-muted font-mono break-words">
          reason: {probe.reason}
        </p>
      ) : null}
      {extra}
    </div>
  );
}

function StellarRpcRow({ probe }: { probe: StellarRpcProbe }) {
  const extra =
    probe.status === "ok" ? (
      <div className="mt-3 space-y-1 text-xs">
        <KeyValue
          label="passphrase"
          value={probe.passphrase ?? "—"}
          mono
        />
        <KeyValue
          label="passphrase matches expected"
          value={probe.passphrase_matches ? "yes" : "no"}
          kind={probe.passphrase_matches ? "ok" : "err"}
        />
        {probe.protocol_version != null ? (
          <KeyValue label="protocol version" value={String(probe.protocol_version)} />
        ) : null}
      </div>
    ) : null;
  return (
    <ProbeRow
      name="Stellar Soroban RPC"
      detail="POST `getNetwork` against STELLAR_RPC_URL"
      probe={probe}
      extra={extra}
    />
  );
}

function StellarSignerRow({ probe }: { probe: StellarSignerProbe }) {
  const extra =
    probe.status === "ok" && probe.public_key ? (
      <div className="mt-3 text-xs">
        <KeyValue label="public key" value={probe.public_key} mono />
      </div>
    ) : null;
  return (
    <ProbeRow
      name="Stellar demo signer"
      detail="Parse STELLAR_DEMO_SECRET_KEY → public key"
      probe={probe}
      extra={extra}
    />
  );
}

function StellarContractRow({ probe }: { probe: StellarContractProbe }) {
  const extra =
    probe.status === "ok" && probe.contract_id ? (
      <div className="mt-3 text-xs">
        <KeyValue label="contract id" value={probe.contract_id} mono />
      </div>
    ) : null;
  return (
    <ProbeRow
      name="Soroban contract id"
      detail="Format check on NEXT_PUBLIC_CONTRACT_ID (C + 55 base32 chars)"
      probe={probe}
      extra={extra}
    />
  );
}

function KeyValue({
  label,
  value,
  mono,
  kind,
}: {
  label: string;
  value: string;
  mono?: boolean;
  kind?: BadgeKind;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-ink-muted">{label}:</span>
      <span
        className={
          mono
            ? "font-mono text-ink break-all"
            : kind === "err"
            ? "text-red-500 font-medium"
            : kind === "ok"
            ? "text-accent-teal font-medium"
            : "text-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}

type BadgeKind = "ok" | "err" | "muted";

function StatusBadge({
  kind,
  children,
}: {
  kind: BadgeKind;
  children: React.ReactNode;
}) {
  const dot =
    kind === "ok" ? "bg-accent-teal" : kind === "err" ? "bg-red-500" : "bg-ink-muted";
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-surface shadow-neu-inset-sm px-3 py-1 text-xs font-medium text-ink shrink-0">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      {children}
    </span>
  );
}

function Pill({
  label,
  value,
  kind,
}: {
  label: string;
  value: string;
  kind: BadgeKind;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-surface shadow-neu-inset-sm px-3 py-1 text-xs">
      <span className="text-ink-muted uppercase tracking-[0.14em]">{label}</span>
      <span
        className={
          kind === "ok"
            ? "text-accent-teal font-medium"
            : kind === "err"
            ? "text-red-500 font-medium"
            : "text-ink"
        }
      >
        {value}
      </span>
    </span>
  );
}
