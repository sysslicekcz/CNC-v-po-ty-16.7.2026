# CNC Časovač

Webová aplikace pro výpočet strojních časů CNC obrábění — port původního Excel doplňku
(`Výpočet_času_CNC.xlsm` + VBA add-in `Výpočet_času_CNC_ver__1.xlam`) do Next.js.

## Pokryté operace

- Podélné soustružení (vnější / vnitřní)
- Příčné soustružení
- Vrtání
- Soustružení zápichu
- Frézování pero drážek
- Broušení na kulato
- Čelní zápichy
- Přípravné časy

## Opravy oproti původnímu VBA

Při portování byly opraveny tři chyby nalezené v původním add-inu:

1. **Příčné soustružení** — původní kód počítal délku kroku jako natvrdo zapsanou
   konstantu `π` místo skutečné radiální vzdálenosti. Nahrazeno výpočtem na
   průměrném průměru, stejným principem jako u podélného soustružení.
2. **Broušení na kulato** — sloupec „Otáčky obrobku (No)“ se nyní bere jako přímé
   zadání otáček [ot/min], jak název sloupce napovídá (dřív se z něj chybně
   odvozovala řezná rychlost).
3. **Přípravné časy** — řádek bez vyplněného počtu úkonů se dřív tiše vynechal ze
   součtu bez varování. Teď se zobrazí jako viditelné varování.

## Vývoj

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run start
```

## Struktura

Data se organizují do hierarchie **Zákazník → Poptávka → Díl**. Každý díl má
vlastní sadu výše uvedených operací a výstupů.

Stroje se spravují v samostatné sekci **Stroje** — každý stroj má vlastní
detail se záložkami **Parametry stroje** (název, maximální otáčky, volitelná
hodinová sazba, podporované operace — typ stroje se z nich sám odvodí),
**Nástroje** (katalog nástrojů toho stroje: název, typ, radius špičky, řezné
podmínky) a **Seřízení** (šablony přípravných časů). U dílu/polohy se vybere
stroj, čímž se nabídka operací i katalog nástrojů zúží jen na to, co ten
stroj umí — u kontury se pak vybere nástroj a příslušná pole se předvyplní
(hodnoty jde ručně přepsat, aniž by se změnil uložený nástroj).

## Data

Vše se ukládá do `IndexedDB` v prohlížeči (žádný backend/databáze) — jen
na tomto počítači. Starší data z `localStorage` se při prvním spuštění
této verze automaticky přesunou do dílu „Nezařazeno / Migrovaná data / Díl 1“.
