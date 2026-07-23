/**
 * Application-vrstvý re-export barel pro čistě DATOVÉ (bez chování) domain
 * typy, které presentation vrstva legitimně potřebuje pojmenovat (typ pole ve
 * formuláři, typ položky seznamu chyb, ...) - AP-MCE-001 Fáze B §16
 * "Presentation neimportuje nic z domain/calculation-engine přímo, jen přes
 * Application DTO výstupy" je ABSOLUTNÍ pravidlo (na rozdíl od podobně
 * znějících Fáze C-F kontrol, které zakazují jen přímé importy KONKRÉTNÍCH
 * strategických modulů) - i typový (`import type`) re-export z domain modulu
 * počítá jako "import z domain/calculation-engine", pokud by ho udělala
 * přímo presentation. Tenhle soubor je tou jedinou dovolenou mezivrstvou.
 */
export type { CalculationIssue } from "@/domain/calculation-engine/entities/types";
export type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";
export type { CalculationDraftSourceType } from "@/domain/calculation-engine/workflow/calculation-draft";
