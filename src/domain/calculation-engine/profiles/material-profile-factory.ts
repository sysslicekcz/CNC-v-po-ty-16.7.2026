import { Material } from "@/domain/entities/material";
import { MaterialGroup } from "@/domain/entities/material-group";
import { MaterialProfile, MaterialProfileSourceType } from "./material-profile";
import { ExternalReferenceSummary } from "../shared/external-reference-summary";

export interface CreateMaterialProfileFromMaterialInput {
  material: Material;
  materialGroup: MaterialGroup;
  sourceType: MaterialProfileSourceType;
  dataSource: string;
  materialCoefficient?: number;
  externalReferences?: readonly ExternalReferenceSummary[];
  siteId?: string;
  now: string;
}

/**
 * `MaterialProfileFactory` (AP-MCE-001 Fáze B §2) - ČISTÁ tovární funkce,
 * žádné I/O: dostane už NAČTENÝ `Material`/`MaterialGroup` (Application
 * vrstva je načte přes existující `MaterialRepository`/`MaterialGroupRepository`)
 * a poskládá z nich nový `MaterialProfile` s `id === material.id`
 * (AP-MCE-001 Fáze B - profil je kalkulační PROJEKCE materiálu, ne druhý
 * nezávislý katalog, viz komentář u `MaterialProfile`).
 *
 * Pole, která `Material` nemá (`machinabilityIndex`, doporučené řezné
 * podmínky, `suitableToolTypeIds`, ...), zůstávají prázdná/výchozí - tenant
 * je doplní později přes `MaterialCorrection` nebo je editor profilu (mimo
 * rozsah Fáze B - Presentation) rovnou nastaví při vytvoření.
 */
export class MaterialProfileFactory {
  static createFromMaterial(input: CreateMaterialProfileFromMaterialInput): MaterialProfile {
    return MaterialProfile.create({
      id: input.material.id,
      tenantId: input.material.tenantId,
      siteId: input.siteId,
      sourceType: input.sourceType,
      name: input.material.name,
      standard: input.material.standard,
      designation: input.material.designation,
      materialGroupId: input.materialGroup.id,
      materialGroupName: input.materialGroup.name,
      hardness: input.material.hardness,
      densityKgM3: input.material.densityKgPerM3,
      materialCoefficient: input.materialCoefficient ?? 1,
      recommendedCuttingSpeeds: [],
      recommendedFeeds: [],
      suitableToolTypeIds: [],
      dataSource: input.dataSource,
      externalReferences: input.externalReferences ?? [],
      recordVersion: 1,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }
}
