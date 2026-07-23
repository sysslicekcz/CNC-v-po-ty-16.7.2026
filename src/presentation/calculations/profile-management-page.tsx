"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createCalculationEngineDependencies } from "./calculation-engine-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { CalculationsNav } from "./components/calculations-nav";
import { describeCalculationError } from "./calculation-error-messages";
import { ProfileOption } from "./components/profile-selector";

type Tab = "materials" | "machines" | "tools";

/**
 * `ProfileManagementPage` (AP-MCE-001 Fáze H §23) - konsoliduje 8 admin
 * stránek zadání na 3 s vlastní routou (Material/Machine/Tool - nav položka
 * "Profily" už na `/calculations/profiles/materials` odkazuje) - Cutting
 * Conditions/ManualTimeStandards/VarianceToleranceProfiles/Calibration
 * Profiles nemají v Application vrstvě "create z prázdna" use case (jen
 * `SaveCuttingConditionUseCase`/korekce), zůstávají mimo tenhle rozsah,
 * zdokumentováno ve finálním souhrnu. Založení profilu vyžaduje JIŽ
 * EXISTUJÍCÍ master-data záznam (Material/Machine/Tool) - `Create*Profile
 * UseCase` (Fáze B) z něj profil jen odvodí, nevytváří master-data záznam
 * sám (§23 "Systémové profily nejsou přímo editovatelné" - tenhle formulář
 * vytváří TENANTNÍ profil, ne systémový).
 */
export function ProfileManagementPage({ initialTab = "materials" }: { initialTab?: Tab }) {
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [materials, setMaterials] = useState<ProfileOption[]>([]);
  const [machines, setMachines] = useState<ProfileOption[]>([]);
  const [tools, setTools] = useState<ProfileOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    return ensureAppBootstrapped()
      .then(() => Promise.all([deps.listMaterialProfilesUseCase.execute(), deps.listMachineProfilesUseCase.execute(), deps.listToolProfilesUseCase.execute()]))
      .then(([m, ma, t]) => {
        setMaterials(m);
        setMachines(ma);
        setTools(t);
      })
      .catch((err) => setError(describeCalculationError(err)));
  }, [deps]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <CalculationsNav snapshot={snapshot} />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 border-b border-border pb-6">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Výpočty výroby
          </div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Profily</h1>
        </header>

        {error && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <nav className="mb-6 flex gap-1 border-b border-border text-sm">
          {(["materials", "machines", "tools"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 ${tab === t ? "border-b-2 border-accent text-accent" : "text-muted"}`}>
              {t === "materials" ? "Materiály" : t === "machines" ? "Stroje" : "Nástroje"}
            </button>
          ))}
        </nav>

        {tab === "materials" && <ProfileList options={materials} />}
        {tab === "machines" && <ProfileList options={machines} />}
        {tab === "tools" && <ProfileList options={tools} />}

        <div className="mt-8">
          {tab === "materials" && <CreateMaterialForm deps={deps} busy={busy} setBusy={setBusy} setError={setError} onCreated={load} />}
          {tab === "machines" && <CreateMachineForm deps={deps} busy={busy} setBusy={setBusy} setError={setError} onCreated={load} />}
          {tab === "tools" && <CreateToolForm deps={deps} busy={busy} setBusy={setBusy} setError={setError} onCreated={load} />}
        </div>
      </div>
    </div>
  );
}

function ProfileList({ options }: { options: ProfileOption[] }) {
  if (options.length === 0) return <p className="text-sm text-muted">Zatím žádné profily.</p>;
  return (
    <ul className="divide-y divide-border rounded border border-border">
      {options.map((o) => (
        <li key={o.id} className="flex items-center justify-between px-3 py-2 text-sm">
          <span>{o.label}</span>
          {o.isArchived && <span className="text-xs text-muted">archivováno</span>}
        </li>
      ))}
    </ul>
  );
}

type Deps = ReturnType<typeof createCalculationEngineDependencies>;
interface FormProps {
  deps: Deps;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
  onCreated: () => void;
}

function CreateMaterialForm({ deps, busy, setBusy, setError, onCreated }: FormProps) {
  const [materialId, setMaterialId] = useState("");
  const [sourceType, setSourceType] = useState<"system" | "tenant" | "imported">("tenant");
  const [dataSource, setDataSource] = useState("");

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await deps.createMaterialProfileUseCase.execute({ materialId, sourceType, dataSource });
      setMaterialId("");
      setDataSource("");
      onCreated();
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-medium text-muted">Založit materiálový profil z existujícího materiálu (master-data)</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <input className="rounded border border-border bg-surface px-2 py-1 text-sm" placeholder="Id materiálu (master-data)" value={materialId} onChange={(e) => setMaterialId(e.target.value)} />
        <select className="rounded border border-border bg-surface px-2 py-1 text-sm" value={sourceType} onChange={(e) => setSourceType(e.target.value as typeof sourceType)}>
          <option value="tenant">Tenant</option>
          <option value="imported">Import</option>
          <option value="system">Systém</option>
        </select>
        <input className="rounded border border-border bg-surface px-2 py-1 text-sm" placeholder="Zdroj dat" value={dataSource} onChange={(e) => setDataSource(e.target.value)} />
      </div>
      <button onClick={create} disabled={busy || !materialId.trim() || !dataSource.trim()} className="mt-3 rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-30">
        Založit
      </button>
    </div>
  );
}

function CreateMachineForm({ deps, busy, setBusy, setError, onCreated }: FormProps) {
  const [machineId, setMachineId] = useState("");

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await deps.createMachineProfileUseCase.execute({ machineId });
      setMachineId("");
      onCreated();
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-medium text-muted">Založit strojní profil z existujícího stroje (master-data)</h3>
      <p className="mb-2 text-xs text-muted">Pokročilá pole (pracovní obálka, dostupné funkce, koeficienty) se doplní až korekcí - tenhle formulář zakládá jen základní profil.</p>
      <div className="flex gap-2">
        <input className="flex-1 rounded border border-border bg-surface px-2 py-1 text-sm" placeholder="Id stroje (master-data)" value={machineId} onChange={(e) => setMachineId(e.target.value)} />
        <button onClick={create} disabled={busy || !machineId.trim()} className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-30">
          Založit
        </button>
      </div>
    </div>
  );
}

function CreateToolForm({ deps, busy, setBusy, setError, onCreated }: FormProps) {
  const [toolId, setToolId] = useState("");

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await deps.createToolProfileUseCase.execute({ toolId });
      setToolId("");
      onCreated();
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-medium text-muted">Založit nástrojový profil z existujícího nástroje (master-data)</h3>
      <p className="mb-2 text-xs text-muted">Pokročilá pole (trvanlivost, křivka opotřebení, cena) se doplní až korekcí - tenhle formulář zakládá jen základní profil.</p>
      <div className="flex gap-2">
        <input className="flex-1 rounded border border-border bg-surface px-2 py-1 text-sm" placeholder="Id nástroje (master-data)" value={toolId} onChange={(e) => setToolId(e.target.value)} />
        <button onClick={create} disabled={busy || !toolId.trim()} className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-30">
          Založit
        </button>
      </div>
    </div>
  );
}
