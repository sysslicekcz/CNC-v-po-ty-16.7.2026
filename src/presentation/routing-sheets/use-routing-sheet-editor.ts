"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { OperationResourceAssignment } from "@/domain/aggregates/routing-sheet/operation";
import { CalculationInputRow } from "@/domain/aggregates/routing-sheet/types";
import { Machine } from "@/domain/entities/machine";
import { ExternalOperationResource } from "@/domain/entities/external-operation-resource";
import { OperationType } from "@/domain/entities/operation-type";
import { Tool } from "@/domain/entities/tool";
import { Part } from "@/domain/entities/part";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { RoutingSheetEditorDto } from "@/application/routing-sheets/dto/routing-sheet-editor-dto";
import { RoutingSheetEditorLookups, toRoutingSheetEditorDto } from "@/application/routing-sheets/routing-sheet-editor-mapper";
import { createRoutingSheetEditorDependencies, RoutingSheetEditorDependencies } from "./routing-sheet-editor-dependencies";
import { describeRoutingSheetError } from "./routing-sheet-error-messages";

export type SaveStatus = "idle" | "saving" | "saved" | "unsaved" | "error";

export interface RoutingSheetEditorState {
  routingSheet: RoutingSheetEditorDto | null;
  loadStatus: "idle" | "loading" | "ready" | "error";
  loadError?: string;
  saveStatus: SaveStatus;
  saveError?: string;
  lastSavedAt?: string;
  dirty: boolean;
  availableMachines: Machine[];
  availableExternalResources: ExternalOperationResource[];
  operationTypes: OperationType[];
  /** Jen AKTIVNÍ nástroje (Krok 5, zadání bod 59-60, stejný princip jako
   *  `availableMachines`/`availableExternalResources`) - neaktivní nástroj se
   *  nenabízí pro NOVÉ přiřazení k činnosti. Nemá vliv na už přiřazené
   *  nástroje - jejich název se zobrazuje z `activity.toolName` (DTO pole),
   *  ne z tohohle seznamu. */
  availableTools: Tool[];
}

const AUTOSAVE_DEBOUNCE_MS = 1500;

/**
 * Jediný zdroj pravdy pro rozpracovaný editor (Krok 4, zadání bod 14) - vlastní
 * `useReducer`-like `useState` + `useRef` controller, ne Zustand (v projektu
 * není zavedený, viz docs/audits/step-4-audit.md). Drží ŽIVÝ doménový agregát
 * (`routingSheetRef`) a číselníkové mapy (`lookupsRef`) v refu - mutace volají
 * přímo metody `RoutingSheet` (in-memory, synchronní), tenhle hook jen po každé
 * mutaci přepočítá `RoutingSheetEditorDto` (čistý mapper) a naplánuje debounced
 * autosave. Repository NIKDY nevolá přímo komponenta - jen tenhle hook, přes
 * use casy (`SaveRoutingSheetDraftUseCase` atd.).
 */
export function useRoutingSheetEditor() {
  const deps = useMemo<RoutingSheetEditorDependencies>(() => createRoutingSheetEditorDependencies(), []);

  const routingSheetRef = useRef<RoutingSheet | null>(null);
  const partRef = useRef<Part | null>(null);
  const lookupsRef = useRef<RoutingSheetEditorLookups | null>(null);
  const lastLoadedUpdatedAtRef = useRef<string | undefined>(undefined);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const [state, setState] = useState<RoutingSheetEditorState>({
    routingSheet: null,
    loadStatus: "idle",
    saveStatus: "idle",
    dirty: false,
    availableMachines: [],
    availableExternalResources: [],
    operationTypes: [],
    availableTools: [],
  });

  const recomputeDto = useCallback((markDirty: boolean) => {
    const routingSheet = routingSheetRef.current;
    const part = partRef.current;
    const lookups = lookupsRef.current;
    if (!routingSheet || !part || !lookups) return;

    const issues = deps.validateRoutingSheetUseCase.execute({
      routingSheet,
      machinesById: lookups.machinesById,
      externalResourcesById: lookups.externalResourcesById,
      operationTypesById: lookups.operationTypesById,
    });
    const dto = toRoutingSheetEditorDto(routingSheet, part, lookups, issues);
    setState((prev) => ({
      ...prev,
      routingSheet: { ...dto, dirty: markDirty || prev.dirty },
      dirty: markDirty || prev.dirty,
      saveStatus: markDirty ? "unsaved" : prev.saveStatus,
    }));
  }, [deps]);

  const fetchLookups = useCallback(async (): Promise<RoutingSheetEditorLookups> => {
    const tenantId = deps.tenantContext.requireCurrentTenantId();
    const [machines, externalResources, operationTypes, tools] = await Promise.all([
      deps.machineRepository.list(tenantId),
      deps.externalResourceRepository.list(tenantId),
      deps.operationTypeRepository.list(tenantId),
      deps.toolRepository.list(tenantId),
    ]);
    return {
      machinesById: new Map(machines.map((m) => [m.id, m])),
      externalResourcesById: new Map(externalResources.map((r) => [r.id, r])),
      operationTypesById: new Map(operationTypes.map((t) => [t.id, t])),
      toolsById: new Map(tools.map((t) => [t.id, t])),
    };
  }, [deps]);

  const applyLoadedState = useCallback(
    (routingSheet: RoutingSheet, part: Part, lookups: RoutingSheetEditorLookups) => {
      routingSheetRef.current = routingSheet;
      partRef.current = part;
      lookupsRef.current = lookups;
      lastLoadedUpdatedAtRef.current = routingSheet.updatedAt ? new Date(routingSheet.updatedAt).toISOString() : undefined;

      const issues = deps.validateRoutingSheetUseCase.execute({
        routingSheet,
        machinesById: lookups.machinesById,
        externalResourcesById: lookups.externalResourcesById,
        operationTypesById: lookups.operationTypesById,
      });
      const dto = toRoutingSheetEditorDto(routingSheet, part, lookups, issues);

      setState({
        routingSheet: dto,
        loadStatus: "ready",
        saveStatus: "idle",
        dirty: false,
        lastSavedAt: dto.updatedAt,
        availableMachines: [...lookups.machinesById.values()].filter((m) => m.status === "active"),
        availableExternalResources: [...lookups.externalResourcesById.values()].filter((r) => r.status === "active"),
        operationTypes: [...lookups.operationTypesById.values()],
        availableTools: [...lookups.toolsById.values()].filter((t) => t.stav === "aktivni"),
      });
    },
    [deps]
  );

  const load = useCallback(
    async (id: string) => {
      setState((prev) => ({ ...prev, loadStatus: "loading", loadError: undefined }));
      try {
        const tenantId = deps.tenantContext.requireCurrentTenantId();
        const routingSheet = await deps.routingSheetRepository.findById(id, tenantId);
        if (!routingSheet) throw new NotFoundError("RoutingSheet", id);
        const part = await deps.partRepository.findById(routingSheet.partId);
        if (!part) throw new NotFoundError("Part", routingSheet.partId);
        const lookups = await fetchLookups();
        applyLoadedState(routingSheet, part, lookups);
      } catch (error) {
        console.error("[RoutingSheetEditor] load selhalo:", error);
        setState((prev) => ({ ...prev, loadStatus: "error", loadError: describeRoutingSheetError(error) }));
      }
    },
    [deps, fetchLookups, applyLoadedState]
  );

  const create = useCallback(
    async (partId: string, input?: { name?: string; description?: string }) => {
      setState((prev) => ({ ...prev, loadStatus: "loading", loadError: undefined }));
      try {
        const routingSheet = await deps.createRoutingSheetUseCase.execute({
          partId,
          name: input?.name,
          description: input?.description,
        });
        const part = await deps.partRepository.findById(partId);
        if (!part) throw new NotFoundError("Part", partId);
        const lookups = await fetchLookups();
        applyLoadedState(routingSheet, part, lookups);
      } catch (error) {
        console.error("[RoutingSheetEditor] create selhalo:", error);
        setState((prev) => ({ ...prev, loadStatus: "error", loadError: describeRoutingSheetError(error) }));
      }
    },
    [deps, fetchLookups, applyLoadedState]
  );

  // --- Autosave (jen pro draft, debounced, viz zadání bod 15) ---

  const save = useCallback(async () => {
    const routingSheet = routingSheetRef.current;
    if (!routingSheet || routingSheet.stav !== "draft" || savingRef.current) return;

    savingRef.current = true;
    setState((prev) => ({ ...prev, saveStatus: "saving", saveError: undefined }));
    try {
      const saved = await deps.saveRoutingSheetDraftUseCase.execute({
        routingSheet,
        expectedUpdatedAt: lastLoadedUpdatedAtRef.current,
      });
      lastLoadedUpdatedAtRef.current = saved.updatedAt ? new Date(saved.updatedAt).toISOString() : undefined;
      setState((prev) => ({
        ...prev,
        saveStatus: "saved",
        saveError: undefined,
        dirty: false,
        lastSavedAt: lastLoadedUpdatedAtRef.current,
        routingSheet: prev.routingSheet ? { ...prev.routingSheet, dirty: false, updatedAt: lastLoadedUpdatedAtRef.current } : prev.routingSheet,
      }));
    } catch (error) {
      console.error("[RoutingSheetEditor] uložení selhalo:", error);
      setState((prev) => ({ ...prev, saveStatus: "error", saveError: describeRoutingSheetError(error) }));
    } finally {
      savingRef.current = false;
    }
  }, [deps]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      void save();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [save]);

  useEffect(
    () => () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    },
    []
  );

  const mutate = useCallback(
    (fn: (routingSheet: RoutingSheet) => void) => {
      const routingSheet = routingSheetRef.current;
      if (!routingSheet || routingSheet.stav !== "draft") return;
      try {
        fn(routingSheet);
      } catch (error) {
        console.error("[RoutingSheetEditor] mutace selhala:", error);
        setState((prev) => ({ ...prev, saveError: describeRoutingSheetError(error), saveStatus: "error" }));
        return;
      }
      recomputeDto(true);
      scheduleAutosave();
    },
    [recomputeDto, scheduleAutosave]
  );

  // --- Hlavička ---

  const updateHeader = useCallback(
    (input: { name?: string; description?: string }) => {
      mutate((rs) => rs.updateHeader({ nazev: input.name, popis: input.description }));
    },
    [mutate]
  );

  // --- Operace ---

  const addOperation = useCallback(
    (input: { name: string; afterOperationId?: string | null } = { name: "Nová operace" }) => {
      mutate((rs) => {
        const operation = rs.addOperation({ id: crypto.randomUUID(), nazev: input.name });
        if (input.afterOperationId !== undefined) {
          rs.reorderOperations(operation.id, input.afterOperationId);
        }
      });
    },
    [mutate]
  );

  const updateOperation = useCallback(
    (
      operationId: string,
      input: { name?: string; note?: string; setupTimeMinutes?: number; unitTimeMinutes?: number; transferBatchSize?: number }
    ) => {
      mutate((rs) =>
        rs.updateOperation(operationId, {
          nazev: input.name,
          technologickaPoznamka: input.note,
          setupTimeMinutes: input.setupTimeMinutes,
          unitTimeMinutes: input.unitTimeMinutes,
          transferBatchSize: input.transferBatchSize,
        })
      );
    },
    [mutate]
  );

  const assignResourceToOperation = useCallback(
    (operationId: string, assignment: OperationResourceAssignment) => {
      mutate((rs) => rs.assignResourceToOperation(operationId, assignment));
    },
    [mutate]
  );

  const removeOperation = useCallback(
    (operationId: string) => {
      mutate((rs) => rs.removeOperation(operationId));
    },
    [mutate]
  );

  const moveOperation = useCallback(
    (operationId: string, direction: "up" | "down") => {
      mutate((rs) => {
        const ordered = rs.operationList;
        const index = ordered.findIndex((o) => o.id === operationId);
        if (index === -1) return;
        const swapWith = direction === "up" ? index - 1 : index + 1;
        if (swapWith < 0 || swapWith >= ordered.length) return;
        const afterId = direction === "up" ? (swapWith === 0 ? null : ordered[swapWith - 1].id) : ordered[swapWith].id;
        rs.reorderOperations(operationId, afterId);
        rs.renumberOperations();
      });
    },
    [mutate]
  );

  const duplicateOperation = useCallback(
    (operationId: string) => {
      mutate((rs) => {
        const source = rs.getOperation(operationId);
        const newOperationId = crypto.randomUUID();
        rs.addOperationAfter(
          {
            id: newOperationId,
            nazev: `${source.nazev} (kopie)`,
            machineId: source.machineId,
            externalResourceId: source.externalResourceId,
            technologickaPoznamka: source.technologickaPoznamka,
          },
          operationId
        );
        if (source.setupTimeMinutes !== undefined || source.unitTimeMinutes !== undefined || source.transferBatchSize !== undefined) {
          rs.updateOperation(newOperationId, {
            setupTimeMinutes: source.setupTimeMinutes,
            unitTimeMinutes: source.unitTimeMinutes,
            transferBatchSize: source.transferBatchSize,
          });
        }
        for (const position of source.positionList) {
          const newPositionId = crypto.randomUUID();
          rs.addPosition(newOperationId, { id: newPositionId, nazev: position.nazev });
          for (const activity of position.activityList) {
            rs.addActivity(newOperationId, newPositionId, {
              id: crypto.randomUUID(),
              operationTypeId: activity.operationTypeId,
              calculationType: activity.calculationType,
              kind: activity.kind,
              toolId: activity.toolId,
              technologickaPoznamka: activity.technologickaPoznamka,
            });
            // Kalkulační snapshot se u duplikace NEKOPÍRUJE (na rozdíl od
            // revize/kopie celého postupu) - nová operace často mění vstupy
            // (jiná kontura/rozměr), takže by starý výsledek skoro jistě
            // neodpovídal - viz docs/step-4/calculations.md, rozhodnutí u
            // DuplicateRoutingOperationUseCase (zadání bod 37).
          }
        }
        rs.renumberOperations();
      });
    },
    [mutate]
  );

  // --- Upnutí ---

  const addPosition = useCallback(
    (operationId: string, name: string = "Nové upnutí") => {
      mutate((rs) => rs.addPosition(operationId, { id: crypto.randomUUID(), nazev: name }));
    },
    [mutate]
  );

  const renamePosition = useCallback(
    (operationId: string, positionId: string, name: string) => {
      mutate((rs) => rs.renamePosition(operationId, positionId, name));
    },
    [mutate]
  );

  const removePosition = useCallback(
    (operationId: string, positionId: string) => {
      mutate((rs) => rs.removePosition(operationId, positionId));
    },
    [mutate]
  );

  const movePosition = useCallback(
    (operationId: string, positionId: string, direction: "up" | "down") => {
      mutate((rs) => {
        const operation = rs.getOperation(operationId);
        const ordered = operation.positionList;
        const index = ordered.findIndex((p) => p.id === positionId);
        if (index === -1) return;
        const swapWith = direction === "up" ? index - 1 : index + 1;
        if (swapWith < 0 || swapWith >= ordered.length) return;
        const afterId = direction === "up" ? (swapWith === 0 ? null : ordered[swapWith - 1].id) : ordered[swapWith].id;
        rs.movePosition(operationId, positionId, afterId);
      });
    },
    [mutate]
  );

  // --- Technologické činnosti ---

  const addActivity = useCallback(
    (
      operationId: string,
      positionId: string,
      input: { operationTypeId: string; calculationType: string; toolId?: string; note?: string }
    ) => {
      mutate((rs) =>
        rs.addActivity(operationId, positionId, {
          id: crypto.randomUUID(),
          operationTypeId: input.operationTypeId,
          calculationType: input.calculationType,
          toolId: input.toolId,
          technologickaPoznamka: input.note,
        })
      );
    },
    [mutate]
  );

  const assignToolToActivity = useCallback(
    (operationId: string, positionId: string, activityId: string, toolId: string | undefined) => {
      mutate((rs) => rs.assignToolToActivity(operationId, positionId, activityId, toolId));
    },
    [mutate]
  );

  const applyManualCorrection = useCallback(
    (operationId: string, positionId: string, activityId: string, minutes: number | undefined) => {
      mutate((rs) => rs.applyManualCorrection(operationId, positionId, activityId, minutes));
    },
    [mutate]
  );

  const removeActivity = useCallback(
    (operationId: string, positionId: string, activityId: string) => {
      mutate((rs) => rs.removeActivity(operationId, positionId, activityId));
    },
    [mutate]
  );

  const moveActivity = useCallback(
    (operationId: string, positionId: string, activityId: string, direction: "up" | "down") => {
      mutate((rs) => {
        const ordered = rs.getOperation(operationId).getPosition(positionId).activityList;
        const index = ordered.findIndex((a) => a.id === activityId);
        if (index === -1) return;
        const swapWith = direction === "up" ? index - 1 : index + 1;
        if (swapWith < 0 || swapWith >= ordered.length) return;
        const afterId = direction === "up" ? (swapWith === 0 ? null : ordered[swapWith - 1].id) : ordered[swapWith].id;
        rs.moveActivity(operationId, positionId, activityId, afterId);
      });
    },
    [mutate]
  );

  const calculateActivity = useCallback(
    async (
      operationId: string,
      positionId: string,
      activityId: string,
      calculationType: string,
      inputParameters: CalculationInputRow[]
    ) => {
      const routingSheet = routingSheetRef.current;
      if (!routingSheet) return;
      try {
        await deps.calculateOperationUseCase.execute({
          routingSheet,
          operationId,
          positionId,
          activityId,
          calculationType,
          inputParameters,
        });
      } catch (error) {
        console.error("[RoutingSheetEditor] kalkulace selhala:", error);
        setState((prev) => ({ ...prev, saveError: describeRoutingSheetError(error), saveStatus: "error" }));
        return;
      }
      recomputeDto(true);
      scheduleAutosave();
    },
    [deps, recomputeDto, scheduleAutosave]
  );

  // --- Release / revize ---

  const release = useCallback(
    async (releasedBy?: string) => {
      const routingSheet = routingSheetRef.current;
      if (!routingSheet) return;
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      if (state.dirty) {
        await save();
      }
      setState((prev) => ({ ...prev, saveStatus: "saving" }));
      try {
        await deps.releaseRoutingSheetUseCase.execute({ routingSheetId: routingSheet.id, releasedBy });
        await load(routingSheet.id);
      } catch (error) {
        console.error("[RoutingSheetEditor] release selhal:", error);
        setState((prev) => ({ ...prev, saveStatus: "error", saveError: describeRoutingSheetError(error) }));
        throw error;
      }
    },
    [deps, load, save, state.dirty]
  );

  /** Vrací ID nově vytvořené revize (zadání bod 30 - po založení revize je
   *  potřeba přenavigovat URL na nové ID, jinak by adresní řádek ukazoval na
   *  starou/archivovanou revizi - viz volání v routing-sheet-editor-page.tsx). */
  const createRevision = useCallback(async (): Promise<string | undefined> => {
    const routingSheet = routingSheetRef.current;
    if (!routingSheet) return undefined;
    try {
      const revision = await deps.createRoutingSheetRevisionUseCase.execute({ sourceRoutingSheetId: routingSheet.id });
      await load(revision.id);
      return revision.id;
    } catch (error) {
      console.error("[RoutingSheetEditor] vytvoření revize selhalo:", error);
      setState((prev) => ({ ...prev, saveStatus: "error", saveError: describeRoutingSheetError(error) }));
      throw error;
    }
  }, [deps, load]);

  return {
    state,
    deps,
    load,
    create,
    save,
    updateHeader,
    addOperation,
    updateOperation,
    assignResourceToOperation,
    removeOperation,
    moveOperation,
    duplicateOperation,
    addPosition,
    renamePosition,
    removePosition,
    movePosition,
    addActivity,
    assignToolToActivity,
    applyManualCorrection,
    removeActivity,
    moveActivity,
    calculateActivity,
    release,
    createRevision,
  };
}
