"use client";

import { CalculationIssue, OperationCategory } from "@/application/calculation-engine/dto/calculation-engine-ui-types";
import { describeCalculationIssue } from "../calculation-error-messages";

/**
 * Vizualizace `breakdown` (AP-MCE-001 Fáze H §12) - všech šest komponent
 * pracuje NAD `Record<string, unknown>` (`OperationCalculationOutput.
 * breakdown`, viz Application DTO), NIKDY nad doménovými typy jako
 * `TurningCalculationBreakdown` - presentation vrstva je nesmí importovat
 * (AP-MCE-001 Fáze B §16, architektonický test `calculation-engine-layering.
 * test.ts`). Proto je čtení polí níž záměrně "surové" (`as number`/`as
 * Record<string, unknown>[]`), s honestním fallbackem, když pole chybí -
 * radši "není k dispozici" než tichý předpoklad.
 */

const TIME_FIELD_LABELS: Record<string, string> = {
  rawUnitTime: "Základní čas na kus (před korekcemi)",
  setupTime: "Seřízení",
  firstPieceInspectionTime: "Kontrola prvního kusu",
  finalInspectionTime: "Závěrečná kontrola",
  toolChangeTime: "Výměna nástroje (1x)",
  fixtureChangeTime: "Výměna přípravku (1x)",
  handlingTime: "Manipulace",
  inOperationInspectionTime: "Průběžná kontrola",
  measurementTime: "Měření",
  interOperationMoveTime: "Přesun mezi operacemi",
  auxiliaryTime: "Vedlejší čas",
  waitingTime: "Čekání",
};

const TOTAL_FIELD_LABELS: Record<string, string> = {
  unitTimeAdjusted: "Jednotkový čas (po korekcích)",
  batchVariableTime: "Variabilní čas dávky",
  batchFixedTime: "Fixní čas dávky",
  totalOperationTimeRaw: "Celkový čas (bez korekcí)",
  totalOperationTime: "Celkový čas operace",
};

const COEFFICIENT_LABELS: Record<string, string> = {
  operatorSkillCoefficient: "Kvalifikace obsluhy",
  machineCoefficient: "Stroj",
  materialCoefficient: "Materiál",
  complexityCoefficient: "Složitost",
  toolWearCoefficient: "Opotřebení nástroje",
  historicalCalibrationCoefficient: "Historická kalibrace",
};

const DETAIL_KEY_BY_CATEGORY: Partial<Record<OperationCategory, string>> = {
  turning: "turningDetail",
  milling: "millingDetail",
  grinding: "grindingDetail",
  manual: "manualDetail",
  inspection: "inspectionDetail",
};

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getCategoryDetail(breakdown: Record<string, unknown> | undefined, category: OperationCategory | undefined): Record<string, unknown> | undefined {
  if (!breakdown || !category) return undefined;
  const key = DETAIL_KEY_BY_CATEGORY[category];
  if (!key) return undefined;
  const detail = breakdown[key];
  return detail && typeof detail === "object" ? (detail as Record<string, unknown>) : undefined;
}

const panelClass = "rounded border border-border bg-surface p-4";
const emptyClass = "text-sm text-muted";

/** `TimeBreakdownChart` (§12) - vodorovné pruhy Layer 1 časových složek
 *  (bez knihovny na grafy - stejná disciplína jako zbytek UI, ruční
 *  Tailwind pruhy), plus souhrn odvozených celkových časů pod nimi. */
export function TimeBreakdownChart({ breakdown }: { breakdown: Record<string, unknown> | undefined }) {
  if (!breakdown) return <p className={emptyClass}>Rozpad času není k dispozici.</p>;

  const rows = Object.entries(TIME_FIELD_LABELS)
    .map(([key, label]) => ({ key, label, value: num(breakdown[key]) ?? 0 }))
    .filter((r) => r.value > 0);
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className={panelClass}>
      <h3 className="mb-3 text-sm font-medium text-muted">Rozpad času (na kus)</h3>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-xs">
            <span className="w-48 shrink-0 text-muted">{r.label}</span>
            <div className="h-3 flex-1 rounded bg-border/40">
              <div className="h-3 rounded bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right tabular">{r.value.toFixed(2)} min</span>
          </div>
        ))}
        {rows.length === 0 && <p className={emptyClass}>Žádná nenulová složka.</p>}
      </div>
      <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs">
        {Object.entries(TOTAL_FIELD_LABELS).map(([key, label]) => {
          const value = num(breakdown[key]);
          if (value === undefined) return null;
          return (
            <div key={key} className="flex justify-between">
              <span className="text-muted">{label}</span>
              <span className="tabular font-medium">{value.toFixed(2)} min</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** `CoefficientBreakdownTable` (§12) - Layer 2 (multiplikativní) + Layer 3
 *  (aditivní) korekce z `CalculationBreakdown`. */
export function CoefficientBreakdownTable({ breakdown }: { breakdown: Record<string, unknown> | undefined }) {
  if (!breakdown) return <p className={emptyClass}>Koeficienty nejsou k dispozici.</p>;
  const percentageAllowance = num(breakdown.percentageAllowance);
  const fixedAllowance = num(breakdown.fixedAllowance);

  return (
    <div className={panelClass}>
      <h3 className="mb-3 text-sm font-medium text-muted">Koeficienty a přirážky</h3>
      <table className="w-full text-xs">
        <tbody>
          {Object.entries(COEFFICIENT_LABELS).map(([key, label]) => {
            const value = num(breakdown[key]);
            if (value === undefined) return null;
            return (
              <tr key={key} className="border-t border-border first:border-t-0">
                <td className="py-1 text-muted">{label}</td>
                <td className={`py-1 text-right tabular ${value !== 1 ? "font-medium text-accent" : ""}`}>×{value.toFixed(3)}</td>
              </tr>
            );
          })}
          {percentageAllowance !== undefined && (
            <tr className="border-t border-border">
              <td className="py-1 text-muted">Procentní přirážka</td>
              <td className={`py-1 text-right tabular ${percentageAllowance !== 0 ? "font-medium text-accent" : ""}`}>+{percentageAllowance.toFixed(2)} %</td>
            </tr>
          )}
          {fixedAllowance !== undefined && (
            <tr className="border-t border-border">
              <td className="py-1 text-muted">Fixní přirážka</td>
              <td className={`py-1 text-right tabular ${fixedAllowance !== 0 ? "font-medium text-accent" : ""}`}>+{fixedAllowance.toFixed(2)} min</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** `ConfidenceBreakdownPanel` (§12) - čte `confidenceBreakdown` z kategorie-
 *  specifického detailu (§39 Fáze C-F "pojmenované koeficienty confidence").
 *  Bez detailu ukáže jen souhrnné skóre z `OperationCalculationOutput`. */
export function ConfidenceBreakdownPanel({
  breakdown,
  category,
  fallbackConfidenceScore,
}: {
  breakdown: Record<string, unknown> | undefined;
  category: OperationCategory | undefined;
  fallbackConfidenceScore: number | undefined;
}) {
  const detail = getCategoryDetail(breakdown, category);
  const confidenceBreakdown = detail?.confidenceBreakdown as { baseScore?: unknown; finalScore?: unknown; factors?: unknown } | undefined;
  const finalScore = num(confidenceBreakdown?.finalScore) ?? num(detail?.confidenceScore) ?? fallbackConfidenceScore;
  const baseScore = num(confidenceBreakdown?.baseScore);
  const factors = Array.isArray(confidenceBreakdown?.factors) ? (confidenceBreakdown!.factors as { reason?: unknown; impact?: unknown }[]) : [];

  return (
    <div className={panelClass}>
      <h3 className="mb-3 text-sm font-medium text-muted">Confidence</h3>
      {finalScore === undefined ? (
        <p className={emptyClass}>Confidence skóre není k dispozici.</p>
      ) : (
        <>
          <p className="text-2xl font-mono font-semibold">{Math.round(finalScore * 100)} %</p>
          {baseScore !== undefined && <p className="text-xs text-muted">Výchozí skóre: {Math.round(baseScore * 100)} %</p>}
          {factors.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {factors.map((f, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="text-muted">{String(f.reason ?? "")}</span>
                  <span className={`tabular ${num(f.impact) !== undefined && num(f.impact)! < 0 ? "text-danger" : "text-ok"}`}>
                    {num(f.impact) !== undefined ? `${num(f.impact)! > 0 ? "+" : ""}${(num(f.impact)! * 100).toFixed(0)} %` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** `WarningPanel` (§12) - `OperationCalculationOutput.issues` (ne surový
 *  `breakdown`) - stejná data, kterou má `CalculationErrorMessageRegistry`
 *  (§28 "nikdy neztratit původní kód"). */
export function WarningPanel({ issues }: { issues: readonly CalculationIssue[] }) {
  if (issues.length === 0) return <p className={emptyClass}>Žádné nálezy.</p>;
  return (
    <div className={panelClass}>
      <h3 className="mb-3 text-sm font-medium text-muted">Warningy a doporučení</h3>
      <ul className="space-y-1.5">
        {issues.map((issue, i) => (
          <li key={i} className={`rounded border px-2 py-1 text-xs ${issue.severity === "error" ? "border-danger/40 bg-danger/10 text-danger" : issue.severity === "warning" ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted"}`}>
            <span className="mr-2 uppercase">{issue.severity}</span>
            {describeCalculationIssue(issue)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** `FeatureBreakdownTable` (§12) - tabulka za jednotlivé technologické úseky
 *  (`<category>Detail>.features`). Sloupce se odvodí dynamicky ze SKALÁRNÍCH
 *  polí prvního featuru (vnořené objekty typu `sourceGeometry`/`sampleRule`/
 *  `coefficientBreakdown`/`warnings` se přeskočí - na ty je `ParameterSource
 *  Table`/`WarningPanel` zvlášť), protože se liší strategie od strategie a
 *  presentation nesmí znát jejich doménový typ. */
export function FeatureBreakdownTable({ breakdown, category }: { breakdown: Record<string, unknown> | undefined; category: OperationCategory | undefined }) {
  const detail = getCategoryDetail(breakdown, category);
  const features = Array.isArray(detail?.features) ? (detail!.features as Record<string, unknown>[]) : [];
  if (features.length === 0) return <p className={emptyClass}>Rozpad podle technologických úseků není k dispozici.</p>;

  const columns = Object.keys(features[0]).filter((key) => {
    const value = features[0][key];
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
  });

  return (
    <div className={`${panelClass} overflow-x-auto`}>
      <h3 className="mb-3 text-sm font-medium text-muted">Rozpad podle úseků</h3>
      <table className="w-full whitespace-nowrap text-xs">
        <thead className="text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-2 py-1 text-left font-normal">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((f, i) => (
            <tr key={i} className="border-t border-border">
              {columns.map((c) => (
                <td key={c} className="px-2 py-1 tabular">
                  {typeof f[c] === "number" ? (f[c] as number).toFixed(2) : String(f[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** `ParameterSourceTable` (§12/§10 "odkud pochází řezná podmínka") - jen
 *  ruční a kontrolní operace (Fáze F) nesou `sourceOfEachResolvedParameter`
 *  na úrovni featuru; soustružení/frézování/broušení tuhle atribuci zatím
 *  nemají v `OperationCalculationOutput` (jen ve snapshotu profilu na
 *  `CalculationResult`, který se do DTO nekopíruje) - honestní fallback
 *  místo tichého předstírání. */
export function ParameterSourceTable({ breakdown, category }: { breakdown: Record<string, unknown> | undefined; category: OperationCategory | undefined }) {
  const detail = getCategoryDetail(breakdown, category);
  const features = Array.isArray(detail?.features) ? (detail!.features as Record<string, unknown>[]) : [];
  const rows: { feature: string; parameter: string; source: string }[] = [];
  features.forEach((f, i) => {
    const sources = f.sourceOfEachResolvedParameter;
    if (sources && typeof sources === "object") {
      for (const [parameter, source] of Object.entries(sources as Record<string, unknown>)) {
        rows.push({ feature: String(f.featureId ?? `#${i + 1}`), parameter, source: String(source) });
      }
    }
  });

  if (rows.length === 0) {
    return (
      <div className={panelClass}>
        <h3 className="mb-2 text-sm font-medium text-muted">Zdroj parametrů</h3>
        <p className={emptyClass}>Pro tuto kategorii operace zatím není attribuce zdroje jednotlivých parametrů k dispozici.</p>
      </div>
    );
  }

  return (
    <div className={panelClass}>
      <h3 className="mb-3 text-sm font-medium text-muted">Zdroj parametrů</h3>
      <table className="w-full text-xs">
        <thead className="text-muted">
          <tr>
            <th className="px-2 py-1 text-left font-normal">Úsek</th>
            <th className="px-2 py-1 text-left font-normal">Parametr</th>
            <th className="px-2 py-1 text-left font-normal">Zdroj</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-2 py-1">{r.feature}</td>
              <td className="px-2 py-1">{r.parameter}</td>
              <td className="px-2 py-1 text-muted">{r.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** `ExplainCalculationPanel` (§13) - DETERMINISTICKÁ česká šablona (žádné
 *  neřízené generativní AI, §13 "ŽÁDNÉ neřízené generativní AI") sestavená
 *  jen z už dostupných `OperationCalculationOutput` polí. */
export function ExplainCalculationPanel({
  status,
  finalOperationTimeMinutes,
  confidenceScore,
  issues,
}: {
  status: string;
  finalOperationTimeMinutes: number | undefined;
  confidenceScore: number | undefined;
  issues: readonly CalculationIssue[];
}) {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  const sentences: string[] = [];
  sentences.push(`Výpočet má stav "${status}".`);
  if (finalOperationTimeMinutes !== undefined) sentences.push(`Celkový čas operace vyšel na ${finalOperationTimeMinutes.toFixed(2)} minut na kus.`);
  if (confidenceScore !== undefined) {
    sentences.push(
      confidenceScore >= 0.8
        ? `Confidence skóre (${Math.round(confidenceScore * 100)} %) je vysoké - vstupy byly téměř úplné.`
        : confidenceScore >= 0.5
          ? `Confidence skóre (${Math.round(confidenceScore * 100)} %) je střední - část vstupů se dopočítala z výchozích hodnot.`
          : `Confidence skóre (${Math.round(confidenceScore * 100)} %) je NÍZKÉ - výsledek berte jako hrubý odhad, hodně vstupů chybělo.`
    );
  }
  if (errorCount > 0) sentences.push(`Výpočet obsahuje ${errorCount} chybu/chyby, které blokují jeho použití.`);
  if (warningCount > 0) sentences.push(`Výpočet obsahuje ${warningCount} upozornění - zkontrolujte je v panelu Warningy.`);
  if (errorCount === 0 && warningCount === 0) sentences.push("Žádná upozornění ani chyby nebyly nalezeny.");

  return (
    <div className={panelClass}>
      <h3 className="mb-2 text-sm font-medium text-muted">Vysvětlení výsledku</h3>
      <p className="text-sm leading-relaxed">{sentences.join(" ")}</p>
    </div>
  );
}
