import { LicenseRepository } from "@/domain/repositories/license-repository";
import { License } from "@/domain/licensing/license";
import { LicenseRecord } from "../records";
import { licenseToRecord, licenseFromRecord } from "../mappers/license-mapper";
import { tpvGetAllByIndex, tpvPut } from "../tpv-db";

/** Čistě persistence (docs/adr/0021) - `tpvLicenses.tenantId` je unikátní
 *  index (jedna aktivní licence na tenanta v lokální/offline verzi). */
export class IndexedDbLicenseRepository implements LicenseRepository {
  async findByTenantId(tenantId: string): Promise<License | null> {
    const records = await tpvGetAllByIndex<LicenseRecord>("tpvLicenses", "tenantId", tenantId);
    return records.length > 0 ? licenseFromRecord(records[0]) : null;
  }

  async save(license: License): Promise<void> {
    await tpvPut("tpvLicenses", licenseToRecord(license));
  }
}
