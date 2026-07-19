# Přiřazení zdroje operaci: stroj, kooperace, nebo nic

## Status
Přijato (Krok 4 - Editor technologického postupu)

## Context
`Operation` už z Kroku 3.5 měla `machineId?`/`externalResourceId?` jako dvě nezávislá volitelná pole. Nic v doméně nebránilo mít vyplněná OBĚ současně (stroj i kooperace zároveň), což nedává obchodní smysl - operace se dělá buď na stroji, nebo v kooperaci, nikdy oboje. Editor UI navíc potřebuje jeden jednoznačný "co je teď přiřazené" stav pro resource selector (radio-like chování: vybrat stroj vybírá pryč kooperaci a naopak).

## Decision
Nový computed getter `Operation.resourceAssignment` vrací discriminated union:

```ts
type OperationResourceAssignment =
  | { type: "machine"; machineId: string }
  | { type: "external"; externalResourceId: string }
  | { type: "unassigned" };
```

Hodnota se NIKDE neukládá přímo - vždy se odvozuje z `machineId`/`externalResourceId` při čtení. Zápis jde JEN přes jedinou atomickou metodu `Operation.assignResourceToOperation()` (respektive `RoutingSheet.assignResourceToOperation(operationId, assignment)` na úrovni agregátu), která při nastavení stroje explicitně vynuluje `externalResourceId` a naopak - je to JEDINÉ místo v kódu, které smí měnit oboje pole najednou, takže nekonzistentní stav (obě pole vyplněná) nemůže vzniknout.

Starší metody `assignMachine()`/`assignExternalResource()` zůstávají zachované (zpětná kompatibilita s Krokem 3.5), ale byly upraveny tak, aby taky vzájemně vynulovávaly druhé pole - nejde tedy o dvě necoordinated cesty k mutaci, obě garantují stejný invariant.

## Consequences
- Nemožnost nekonzistentního stavu (stroj + kooperace současně) je vynucená typem i implementací, ne jen konvencí v UI.
- `ResourceSelector` komponenta (UI) může jednoduše volat `onChange(assignment: OperationResourceAssignment)` a nemusí sama řešit "vynuluj to druhé pole" - o to se stará doména.
- Validace (`operation-missing-resource`) testuje jen `assignment.type === "unassigned"`, ne dvě samostatná pole - jednodušší a bezpečnější pravidlo.
