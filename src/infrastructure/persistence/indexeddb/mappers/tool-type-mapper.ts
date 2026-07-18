import { ToolType } from "@/domain/entities/tool-type";
import { ToolTypeRecord } from "../records";
import { parseEntityStav } from "./common";

export function toolTypeToRecord(toolType: ToolType): ToolTypeRecord {
  return {
    id: toolType.id,
    kod: toolType.kod,
    nazev: toolType.nazev,
    stav: toolType.stav,
    popis: toolType.popis,
  };
}

export function toolTypeFromRecord(record: ToolTypeRecord): ToolType {
  return ToolType.create({
    id: record.id,
    kod: record.kod,
    nazev: record.nazev,
    stav: parseEntityStav(record.stav, "ToolType"),
    popis: record.popis,
  });
}
