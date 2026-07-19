# Krok 5 – připravenost na Krok 6 (integrační platforma pro ERP + první produkční konektor)

Krok 5 dokončil kmenová data, na kterých bude Krok 6 (integrace s reálným ERP) stavět. Shrnutí toho, co je připravené a co bude Krok 6 muset ještě udělat.

## Co je hotové a použitelné beze změny

- **Stabilní interní identita oddělená od podnikového kódu** pro VŠECHNY kmenové entity (`docs/step-5/master-data-principles.md`, bod 1) - ERP konektor bude párovat podle `code`/`kod`, ne podle `id`, přesně jak to Krok 3.5 připravilo pro `Machine` a Krok 5 rozšířilo na zbytek.
- **`ExternalReference`/`ExternalSystem` vrstva z Kroku 3.5 dodatku** je entitně nezávislá na tom, KTERÉ kmenové entity Krok 5 přidal - nový typ entity (např. `Tool`) může dostat externí referenci beze změny téhle vrstvy.
- **Tenant scope na všech entitách** - konektor bude vždy pracovat v kontextu jednoho tenanta, žádná další migrace izolace není potřeba.
- **Licenční feature kódy pro každou spravovanou oblast** - `integration.erp.import`/`integration.erp.export` (Krok 3.5) mohou nezávisle řídit, které kmenové entity smí konektor synchronizovat.
- **Generický CSV import/export vzor** (`docs/step-5/import-export.md`) - postup "parse → preview → per-řádek use case → souhrn" je přenositelný na formát, který ERP konektor skutečně použije (CSV, nebo strukturovaný JSON/XML z API) - Krok 6 nemusí vymýšlet nový vzor, jen napojit jiný zdroj dat.

## Co Krok 6 bude muset udělat navíc

1. **Napojit `ResolveCuttingConditionUseCase` do kalkulačního panelu** (Krok 5 bod 1 v `known-limitations.md`) - pokud to bude v rozsahu Kroku 6, jinak zůstává otevřené pro pozdější krok.
2. **Rozhodnout o filtrování strojů podle `OperationTypeCapabilityRequirement`** v editoru (Krok 5 bod 2) - vazby existují, algoritmus výběru ne.
3. **Napsat konkrétní `ErpConnector` implementaci** (`FakeErpConnector` z Kroku 3.5 dodatku je jen referenční kostra) - musí umět mapovat VŠECHNY kmenové entity Kroku 5 (ne jen `Machine`, jak bylo možné před tímto krokem), přes `ExternalEntityResolver`.
4. **Zvážit sjednocení `EntityStav`/`MasterDataStatus`**, pokud by to konektor zjednodušilo (dnes zůstává vědomě nesjednoceno, viz bod 3 v `known-limitations.md`) - není to blokující, ale stojí za přehodnocení, pokud bude Krok 6 psát univerzální status-mapping vrstvu pro ERP.
5. **Batch-transakční import**, pokud objem dat z reálného ERP bude vyžadovat atomické "vše nebo nic" chování (dnešní per-řádek aplikace je dostatečná pro ruční CSV import v malém objemu, ne nutně pro plnou synchronizaci tisíců záznamů).

## Co Krok 6 NEMUSÍ dělat znovu

- Znovu řešit "co je interní id, co je kód" - hotovo pro všechny entity.
- Znovu řešit deaktivaci vs. mazání - vzor (`MasterDataInUseError`, preferovaná deaktivace) je hotový a rozšiřitelný na nové entity beze změny principu.
- Znovu řešit licenční brány na úrovni use casů - vzor `require()`/`assertWithinLimit()` je jednotný napříč celou appkou od Kroku 3.5.
