import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";

export interface CloneRoutingSheetParams {
  newId: string;
  tenantId: string;
  revision: number;
  createdAt: number;
  name?: string;
  /** Nekopíruje se automaticky ze zdroje (Krok 4 - dřívější bug: zdroj i
   *  klon by jinak byly OBA "výchozí" současně, viz post-validation.ts
   *  "exactly-one-default-routing-sheet-per-part"). Volající use case
   *  rozhoduje explicitně: `CreateRoutingSheetRevisionUseCase` předá `true`
   *  (a zdroji zavolá `clearDefault()`), `DuplicateRoutingSheetUseCase`
   *  parametr nepředává - výchozí `false`, protože duplikace není formální
   *  revize a zdroj zůstává výchozí beze změny. */
  isDefault?: boolean;
}

/**
 * Zkopíruje CELÝ strom (Operation -> Position -> Activity -> Calculation) do
 * nové RoutingSheet s ČERSTVÝMI interními id na každé úrovni (Krok 4, zadání
 * body 4/36/37) - žádná mutable child entita se nesdílí se zdrojovým postupem.
 * Používá veřejné agregátní metody (`addOperation`/`addPosition`/`addActivity`/
 * `recordCalculation`), takže pořadí (sortKey/operationNumber) vznikne přirozeně
 * ve stejném pořadí, v jakém se prochází zdrojový strom - žádné ruční kopírování
 * SortKey zvenčí.
 *
 * Rozhodnutí o CalculationSnapshot (zadání bod 36/37 - "zdokumentuj"): snapshoty
 * SE KOPÍRUJÍ beze změny jako výchozí historická hodnota nové revize/operace -
 * nová revize je typicky malá úprava fungujícího postupu, takže zahazovat
 * spočítané časy by nutilo technologa počítat všechno znovu od nuly. Protože
 * `machineId`/`toolId` se kopírují spolu se zbytkem operace/činnosti, snapshot
 * hned po zkopírování NENÍ označen jako zastaralý (nic se ještě nezměnilo) -
 * viz docs/adr/released-routing-sheet-snapshot.md a docs/step-4/calculations.md.
 * Externí reference (Krok 3.5 dodatek) se automaticky NEKOPÍRUJÍ - nová
 * RoutingSheet/Operation/Position/Activity nemají žádnou implicitní vazbu na
 * cizí systém, dokud ji někdo výslovně nezaloží (zadání bod 36).
 */
export function cloneRoutingSheetAsNewDraft(source: RoutingSheet, params: CloneRoutingSheetParams): RoutingSheet {
  const clone = RoutingSheet.create({
    id: params.newId,
    tenantId: params.tenantId,
    partId: source.partId,
    nazev: params.name?.trim() || source.nazev,
    popis: source.popis,
    verze: String(params.revision),
    stav: "draft",
    isDefault: params.isDefault ?? false,
    previousVersionId: source.id,
    createdAt: params.createdAt,
  });

  for (const operation of source.operationList) {
    const newOperationId = crypto.randomUUID();
    clone.addOperation({
      id: newOperationId,
      nazev: operation.nazev,
      machineId: operation.machineId,
      externalResourceId: operation.externalResourceId,
      technologickaPoznamka: operation.technologickaPoznamka,
    });
    if (
      operation.setupTimeMinutes !== undefined ||
      operation.unitTimeMinutes !== undefined ||
      operation.transferBatchSize !== undefined
    ) {
      clone.updateOperation(newOperationId, {
        setupTimeMinutes: operation.setupTimeMinutes,
        unitTimeMinutes: operation.unitTimeMinutes,
        transferBatchSize: operation.transferBatchSize,
      });
    }

    for (const position of operation.positionList) {
      const newPositionId = crypto.randomUUID();
      clone.addPosition(newOperationId, { id: newPositionId, nazev: position.nazev });

      for (const activity of position.activityList) {
        const newActivityId = crypto.randomUUID();
        clone.addActivity(newOperationId, newPositionId, {
          id: newActivityId,
          operationTypeId: activity.operationTypeId,
          calculationType: activity.calculationType,
          kind: activity.kind,
          toolId: activity.toolId,
          technologickaPoznamka: activity.technologickaPoznamka,
        });

        if (activity.calculation) {
          clone.recordCalculation(newOperationId, newPositionId, newActivityId, {
            id: crypto.randomUUID(),
            inputParameters: [...activity.calculation.inputParameters],
            result: activity.calculation.result,
            algorithmVersion: activity.calculation.algorithmVersion,
            snapshot: activity.calculation.snapshot,
            calculatedAt: activity.calculation.calculatedAt,
          });
          if (activity.calculation.manualCorrection !== undefined) {
            clone.applyManualCorrection(newOperationId, newPositionId, newActivityId, activity.calculation.manualCorrection);
          }
        }
      }
    }
  }

  return clone;
}
