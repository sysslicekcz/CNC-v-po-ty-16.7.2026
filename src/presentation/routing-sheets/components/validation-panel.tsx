"use client";

import { RoutingValidationIssueDto } from "@/application/routing-sheets/dto/routing-validation-issue-dto";

export interface RoutingValidationPanelProps {
  issues: RoutingValidationIssueDto[];
  onNavigate: (issue: RoutingValidationIssueDto) => void;
}

const SEVERITY_LABEL: Record<string, string> = { error: "Chyba", warning: "Upozornění", info: "Info" };
const SEVERITY_CLASS: Record<string, string> = {
  error: "border-l-danger text-danger",
  warning: "border-l-accent text-accent",
  info: "border-l-muted text-muted",
};

/** Kliknutí na chybu naviguje na příslušnou operaci (zadání bod 25) - `onNavigate`
 *  dostane celý issue, volající (stránka editoru) vybere odpovídající operaci. */
export function RoutingValidationPanel({ issues, onNavigate }: RoutingValidationPanelProps) {
  if (issues.length === 0) {
    return <p className="p-3 text-sm text-ok">Žádné validační nálezy.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {issues.map((issue) => (
        <li key={issue.id}>
          <button
            onClick={() => onNavigate(issue)}
            className={`block w-full border-l-2 px-3 py-2 text-left text-sm hover:bg-surface-raised ${SEVERITY_CLASS[issue.severity]}`}
          >
            <span className="mr-2 text-xs uppercase tracking-wide">{SEVERITY_LABEL[issue.severity]}</span>
            {issue.message}
          </button>
        </li>
      ))}
    </ul>
  );
}
