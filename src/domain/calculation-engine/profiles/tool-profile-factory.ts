import { Tool } from "@/domain/entities/tool";
import { ToolType } from "@/domain/entities/tool-type";
import { ToolProfile } from "./tool-profile";
import { ToolLifeProfile } from "./tool-life-profile";
import { ToolWearCurve } from "./tool-wear-curve";
import { ExternalReferenceSummary } from "../shared/external-reference-summary";
import type { OperationCategory } from "../enums/operation-category";

export interface CreateToolProfileFromToolInput {
  tool: Tool;
  toolType: ToolType;
  siteId?: string;
  toolMaterial?: string;
  geometry?: string;
  suitableMaterialGroupIds?: readonly string[];
  supportedOperationCategories?: readonly OperationCategory[];
  toolLife?: ToolLifeProfile;
  toolChangeTimeSec?: number;
  price?: number;
  currency?: string;
  wearFactorCurve?: ToolWearCurve;
  maxCuttingSpeedMMin?: number;
  externalReferences?: readonly ExternalReferenceSummary[];
  now: string;
}

/** `ToolProfileFactory` (AP-MCE-001 Fáze B §4) - čistá tovární funkce nad
 *  už NAČTENÝM `Tool`/`ToolType` (Application vrstva je dotáhne přes existující
 *  `ToolRepository`/`ToolTypeRepository`). `id === tool.id` (stejná identita,
 *  viz komentář u `ToolProfile`). */
export class ToolProfileFactory {
  static createFromTool(input: CreateToolProfileFromToolInput): ToolProfile {
    return ToolProfile.create({
      id: input.tool.id,
      tenantId: input.tool.tenantId,
      siteId: input.siteId,
      externalReferences: input.externalReferences ?? [],
      manufacturer: input.tool.manufacturer,
      toolTypeId: input.toolType.id,
      toolTypeName: input.toolType.nazev,
      catalogDesignation: input.tool.designation,
      toolMaterial: input.toolMaterial,
      geometry: input.geometry,
      diameterMm: input.tool.radius !== undefined ? input.tool.radius * 2 : undefined,
      suitableMaterialGroupIds: input.suitableMaterialGroupIds ?? [],
      supportedOperationCategories: input.supportedOperationCategories ?? [],
      defaultCuttingParameters: [],
      toolLife: input.toolLife ?? ToolLifeProfile.unknown(),
      toolChangeTimeSec: input.toolChangeTimeSec,
      price: input.price,
      currency: input.currency,
      wearFactorCurve: input.wearFactorCurve ?? ToolWearCurve.flat(),
      maxCuttingSpeedMMin: input.maxCuttingSpeedMMin,
      recordVersion: 1,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }
}
