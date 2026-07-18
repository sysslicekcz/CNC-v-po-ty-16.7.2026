"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useRoutingSheetEditor } from "./use-routing-sheet-editor";
import { useFeatureAccessSnapshot } from "./use-feature-access-snapshot";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";
import { FeatureGate } from "@/presentation/components/feature-gate";
import { FeatureUnavailableNotice } from "@/presentation/components/feature-unavailable-notice";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { satisfiesAccess } from "@/domain/licensing/feature-access";
import { RoutingSheetHeader } from "./components/routing-sheet-header";
import { RoutingOperationList } from "./components/operation-list";
import { RoutingOperationEditor } from "./components/operation-editor";
import { RoutingValidationPanel } from "./components/validation-panel";
import { CalculationPanel } from "./components/calculation-panel";
import { ReleaseRoutingSheetDialog, CreateRevisionDialog } from "./components/release-dialogs";
import { RoutingValidationIssueDto } from "@/application/routing-sheets/dto/routing-validation-issue-dto";

export interface RoutingSheetEditorPageProps {
  routingSheetId: string;
}

type SidePanel = "validation" | "info";

export function RoutingSheetEditorPage({ routingSheetId }: RoutingSheetEditorPageProps) {
  const router = useRouter();
  const editor = useRoutingSheetEditor();
  const featureAccessSnapshot = useFeatureAccessSnapshot(editor.deps.getFeatureAccessSnapshotUseCase);

  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [sidePanel, setSidePanel] = useState<SidePanel>("validation");
  const [calculationTarget, setCalculationTarget] = useState<{ positionId: string; activityId: string } | null>(null);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);

  useEffect(() => {
    void editor.load(routingSheetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routingSheetId]);

  useUnsavedChangesGuard(editor.state.dirty);

  // Výchozí výběr (první operace) se dopočítá při renderu, ne přes efekt se
  // setState - vyhne se zbytečnému kaskádovému re-renderu (viz eslint
  // react-hooks/set-state-in-effect).
  const effectiveSelectedOperationId =
    selectedOperationId ?? (editor.state.routingSheet?.operations.length ? editor.state.routingSheet.operations[0].id : null);

  const canEdit = featureAccessSnapshot ? satisfiesAccess(featureAccessSnapshot.access[FeatureCodes.RoutingEdit], "write") : false;
  const canRelease = featureAccessSnapshot ? satisfiesAccess(featureAccessSnapshot.access[FeatureCodes.RoutingRelease], "write") : false;
  const canUseCooperations = featureAccessSnapshot ? satisfiesAccess(featureAccessSnapshot.access[FeatureCodes.CooperationsView], "read") : false;

  const routingSheet = editor.state.routingSheet;
  const isReleasedOrArchived = routingSheet ? routingSheet.status !== "draft" : false;
  const readOnly = isReleasedOrArchived || !canEdit;

  const readOnlyReason = isReleasedOrArchived
    ? "Tato revize je vydaná a nelze ji přímo upravovat."
    : !canEdit
      ? "Vaše licence umožňuje pouze prohlížení technologických postupů."
      : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!readOnly) void editor.save();
      }
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && effectiveSelectedOperationId && !readOnly) {
        e.preventDefault();
        editor.moveOperation(effectiveSelectedOperationId, e.key === "ArrowUp" ? "up" : "down");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, effectiveSelectedOperationId]);

  const selectedOperation = useMemo(
    () => routingSheet?.operations.find((o) => o.id === effectiveSelectedOperationId) ?? null,
    [routingSheet, effectiveSelectedOperationId]
  );

  const calculationActivity = useMemo(() => {
    if (!calculationTarget || !selectedOperation) return null;
    const position = selectedOperation.positions.find((p) => p.id === calculationTarget.positionId);
    return position?.activities.find((a) => a.id === calculationTarget.activityId) ?? null;
  }, [calculationTarget, selectedOperation]);

  const handleNavigateToIssue = (issue: RoutingValidationIssueDto) => {
    if (issue.operationId) setSelectedOperationId(issue.operationId);
  };

  if (editor.state.loadStatus === "loading" || editor.state.loadStatus === "idle") {
    return <div className="p-8 text-sm text-muted">Načítám…</div>;
  }
  if (editor.state.loadStatus === "error" || !routingSheet) {
    return <div className="p-8 text-sm text-danger">{editor.state.loadError ?? "Technologický postup nebyl nalezen."}</div>;
  }

  return (
    <FeatureGate
      snapshot={featureAccessSnapshot}
      feature={FeatureCodes.RoutingView}
      requiredAccess="read"
      loading={<div className="p-8 text-sm text-muted">Načítám oprávnění…</div>}
      fallback={
        <div className="p-8">
          <FeatureUnavailableNotice message="Vaše licence neumožňuje zobrazení technologických postupů." />
        </div>
      }
    >
      <div className="flex h-full min-h-screen flex-col">
        <RoutingSheetHeader
          routingSheet={routingSheet}
          saveStatus={editor.state.saveStatus}
          saveError={editor.state.saveError}
          readOnly={readOnly}
          canRelease={canRelease}
          onBack={() => router.push("/tpv/routing-sheets")}
          onUpdateHeader={editor.updateHeader}
          onSave={() => void editor.save()}
          onRequestRelease={() => setShowReleaseDialog(true)}
          onRequestNewRevision={() => setShowRevisionDialog(true)}
        />

        {readOnlyReason && (
          <div className="border-b border-border bg-surface-raised px-4 py-1.5 text-xs text-muted">{readOnlyReason}</div>
        )}

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-72 shrink-0 overflow-y-auto border-r border-border">
            <RoutingOperationList
              operations={routingSheet.operations}
              selectedOperationId={effectiveSelectedOperationId}
              validationIssues={routingSheet.validationIssues}
              readOnly={readOnly}
              onSelect={setSelectedOperationId}
              onAdd={() => editor.addOperation()}
              onMove={editor.moveOperation}
              onDuplicate={editor.duplicateOperation}
              onRemove={(id) => {
                editor.removeOperation(id);
                if (selectedOperationId === id) setSelectedOperationId(null);
              }}
            />
          </aside>

          <main className="flex-1 overflow-y-auto">
            {selectedOperation ? (
              <RoutingOperationEditor
                operation={selectedOperation}
                machines={editor.state.availableMachines}
                externalResources={editor.state.availableExternalResources}
                operationTypes={editor.state.operationTypes}
                tools={editor.state.tools}
                canUseCooperations={canUseCooperations}
                readOnly={readOnly}
                issues={routingSheet.validationIssues.filter((i) => i.operationId === selectedOperation.id)}
                onUpdate={(input) => editor.updateOperation(selectedOperation.id, input)}
                onAssignResource={(assignment) => editor.assignResourceToOperation(selectedOperation.id, assignment)}
                onAddPosition={() => editor.addPosition(selectedOperation.id)}
                onRenamePosition={(positionId, name) => editor.renamePosition(selectedOperation.id, positionId, name)}
                onMovePosition={(positionId, direction) => editor.movePosition(selectedOperation.id, positionId, direction)}
                onRemovePosition={(positionId) => editor.removePosition(selectedOperation.id, positionId)}
                onAddActivity={(positionId, input) => editor.addActivity(selectedOperation.id, positionId, input)}
                onAssignTool={(positionId, activityId, toolId) => editor.assignToolToActivity(selectedOperation.id, positionId, activityId, toolId)}
                onMoveActivity={(positionId, activityId, direction) => editor.moveActivity(selectedOperation.id, positionId, activityId, direction)}
                onRemoveActivity={(positionId, activityId) => editor.removeActivity(selectedOperation.id, positionId, activityId)}
                onOpenCalculation={(positionId, activityId) => setCalculationTarget({ positionId, activityId })}
              />
            ) : (
              <p className="p-8 text-sm text-muted">Vyberte operaci vlevo, nebo přidejte novou.</p>
            )}
          </main>

          <aside className="w-80 shrink-0 overflow-y-auto border-l border-border">
            <div className="flex border-b border-border text-xs">
              <button
                onClick={() => setSidePanel("validation")}
                className={`flex-1 px-3 py-2 ${sidePanel === "validation" ? "border-b-2 border-accent text-accent" : "text-muted"}`}
              >
                Validace ({routingSheet.validationIssues.length})
              </button>
            </div>
            {sidePanel === "validation" && (
              <RoutingValidationPanel issues={routingSheet.validationIssues} onNavigate={handleNavigateToIssue} />
            )}
          </aside>
        </div>
      </div>

      {calculationTarget && calculationActivity && selectedOperation && (
        <CalculationPanel
          activity={calculationActivity}
          featureAccessSnapshot={featureAccessSnapshot}
          readOnly={readOnly}
          onCalculate={async (calculationType, inputParameters) => {
            await editor.calculateActivity(
              selectedOperation.id,
              calculationTarget.positionId,
              calculationTarget.activityId,
              calculationType,
              inputParameters
            );
          }}
          onClose={() => setCalculationTarget(null)}
        />
      )}

      {showReleaseDialog && (
        <ReleaseRoutingSheetDialog
          routingSheet={routingSheet}
          onConfirm={async () => {
            await editor.release();
            setShowReleaseDialog(false);
          }}
          onCancel={() => setShowReleaseDialog(false)}
        />
      )}

      {showRevisionDialog && (
        <CreateRevisionDialog
          currentRevision={routingSheet.revision}
          onConfirm={async () => {
            const newRoutingSheetId = await editor.createRevision();
            setShowRevisionDialog(false);
            // Adresní řádek musí ukazovat na NOVOU revizi, jinak by reload
            // stránky (F5) znovu načetl starou/archivovanou revizi (zadání
            // bod 30) - `replace`, ne `push`, aby tlačítko zpět nevracelo na
            // needitovatelnou archivovanou revizi.
            if (newRoutingSheetId) router.replace(`/tpv/routing-sheets/${newRoutingSheetId}`);
          }}
          onCancel={() => setShowRevisionDialog(false)}
        />
      )}
    </FeatureGate>
  );
}
