# 0010 – Machine přímo, ne obecná abstrakce Resource

## Status
Přijato (revize předchozího rozhodnutí)

## Context
V předchozí iteraci návrhu byla zavedena obecná entita `Resource` (Machine jako jeden z jejích typů), s výhledem na budoucí kooperaci/kontrolní pracoviště/přípravky. Zpětně bylo rozhodnuto tohle zjednodušit.

## Decision
`Operation.machineId` odkazuje přímo na `Machine`, ne na obecný `resourceId`/`Resource`. Důvod: dnes existují jen stroje; kooperace, přípravky a měřidla nejsou implementované. Zavádět pro ně abstrakci předem je spekulace o budoucnosti, ne aktuální potřeba (YAGNI).

## Consequences
- Jednodušší model teď (jedna entita `Machine`, jeden `MachineRepository`, žádná zbytečná vrstva `Resource`/`Machine` detail).
- Až budoucí moduly (kooperace, měřidla, přípravky) skutečně vzniknou, bude potřeba zobecnit `Operation.machineId` na širší koncept – to je vědomě přijaté budoucí riziko menší migrace/přejmenování, výměnou za jednodušší kód teď. Doménová logika výpočtů (Activity/Calculation) na tomhle rozhodnutí nezávisí, takže dopad zobecnění by měl zůstat lokální na `Operation`/`Machine`.
