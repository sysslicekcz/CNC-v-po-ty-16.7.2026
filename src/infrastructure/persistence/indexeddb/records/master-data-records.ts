import { LegacyMetadata } from "./legacy-metadata";

export interface AddressRecord {
  ulice?: string;
  mesto: string;
  psc?: string;
  zeme: string;
}

export interface ContactPersonRecord {
  id: string;
  jmeno: string;
  pozice?: string;
  telefon?: string;
  email?: string;
  poznamka?: string;
}

/** Kontaktní osoby jsou vnořené (owned) v rámci Customer agregátu v doméně - stejně
 *  se ukládají vnořené v CustomerRecord.contacts, ne v samostatném store. Store
 *  `tpvContactPersons` z doporučeného seznamu v zadání se proto nevytváří -
 *  duplicitní úložiště pro totéž by porušilo DRY beze zisku (contacts nejsou nikdy
 *  dotazované samostatně mimo svého zákazníka). */
export interface CustomerRecord extends LegacyMetadata {
  id: string;
  nazev: string;
  stav: string;
  ico?: string;
  dic?: string;
  fakturacniAdresa?: AddressRecord;
  dodaciAdresa?: AddressRecord;
  telefon?: string;
  email?: string;
  poznamka?: string;
  contacts: ContactPersonRecord[];
}

export interface OrderRecord extends LegacyMetadata {
  id: string;
  customerId: string;
  cisloZakazky: string;
  nazev: string;
  stav: string;
  termin?: number;
  poznamka?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface QuantityRecord {
  value: number;
  unit: string;
}

export interface PartRecord extends LegacyMetadata {
  id: string;
  orderId: string;
  nazev: string;
  mnozstvi: QuantityRecord;
  cisloVykresu?: string;
  revizeVykresu?: string;
  material?: string;
  polotovar?: string;
  poznamka?: string;
  dokumentaceRef?: string;
}
