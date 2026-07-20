import { ValidationError } from "@/domain/errors/validation-error";
import { computeContentChecksum } from "./checksum";

/**
 * Sdílený základ pro `MaterialProfileSnapshot`/`MachineProfileSnapshot`/
 * `ToolProfileSnapshot` (AP-MCE-001 Fáze B §10) - tři profily mají strukturálně
 * IDENTICKÝ požadavek na snapshot (všechna použitá data, verze zdrojů,
 * tenant/site, checksum), takže se validace/skládání checksumu píše jednou
 * tady, ne třikrát skoro stejně. Konkrétní pojmenované třídy (požadované
 * zadáním) jsou tenké obálky v `profiles/*-profile-snapshot.ts`.
 *
 * `resolvedData` je VŽDY výstup `XProfile.toPlainObject()` PO overlay
 * rozlišení (systém + korekce) - snapshot nikdy neukládá neresolved systémový
 * profil zvlášť od korekce, protože právě "co se skutečně použilo" je to, co
 * musí zůstat dohledatelné navždy (AP-MCE-001 Fáze B §10: "Starý výsledek
 * nesmí být změněn při změně master dat").
 */
export interface ProfileSnapshotProps {
  profileId: string;
  tenantId: string;
  siteId?: string;
  resolvedData: Readonly<Record<string, unknown>>;
  /** `recordVersion` systémového profilu použitého při sestavení. */
  systemVersion: number;
  /** `recordVersion` korekce, pokud byla použitá - `undefined`, pokud tenant
   *  žádnou korekci nemá. */
  correctionVersion?: number;
  createdAt: string;
  checksum: string;
}

export class ProfileSnapshot {
  protected readonly props: Readonly<ProfileSnapshotProps>;

  protected constructor(props: ProfileSnapshotProps) {
    this.props = Object.freeze({ ...props, resolvedData: Object.freeze({ ...props.resolvedData }) });
  }

  /** Sestaví snapshot a checksum si dopočítá sám z `resolvedData` - volající
   *  nikdy nepředává checksum ručně (jediný zdroj pravdy pro to, jak se
   *  počítá). */
  static capture(input: Omit<ProfileSnapshotProps, "checksum">): ProfileSnapshot {
    if (!input.profileId.trim()) throw new ValidationError("ProfileSnapshot: 'profileId' nesmí být prázdné.");
    if (!input.tenantId.trim()) throw new ValidationError("ProfileSnapshot: 'tenantId' nesmí být prázdné.");
    const checksum = computeContentChecksum(input.resolvedData);
    return new ProfileSnapshot({ ...input, checksum });
  }

  get profileId(): string {
    return this.props.profileId;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get siteId(): string | undefined {
    return this.props.siteId;
  }
  get resolvedData(): Readonly<Record<string, unknown>> {
    return this.props.resolvedData;
  }
  get systemVersion(): number {
    return this.props.systemVersion;
  }
  get correctionVersion(): number | undefined {
    return this.props.correctionVersion;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get checksum(): string {
    return this.props.checksum;
  }

  /** `true`, pokud by nově spočítaný checksum ze stejných dat souhlasil -
   *  použití: testy/integrity kontrola, ne běžný provoz. */
  matchesContent(data: Record<string, unknown>): boolean {
    return this.props.checksum === computeContentChecksum(data);
  }

  toJSON(): ProfileSnapshotProps {
    return { ...this.props };
  }
}
