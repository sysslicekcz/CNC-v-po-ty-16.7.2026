import { ActualTimeSegmentRepository } from "@/domain/calculation-engine/repositories/actual-time-segment-repository";
import { ActualTimeSegment } from "@/domain/calculation-engine/calibration/actual-time-segment";
import { ActualTimeSegmentRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { actualTimeSegmentToRecord, actualTimeSegmentFromRecord } from "./calibration-mappers";

/** IndexedDB implementace `ActualTimeSegmentRepository` (AP-MCE-001 Fáze G
 *  §3/§23). */
export class IndexedDbActualTimeSegmentRepository implements ActualTimeSegmentRepository {
  async getById(id: string): Promise<ActualTimeSegment | null> {
    const record = await tpvGet<ActualTimeSegmentRecord>("tpvActualTimeSegments", id);
    return record ? actualTimeSegmentFromRecord(record) : null;
  }

  async listByActualTimeRecord(actualTimeRecordId: string): Promise<ActualTimeSegment[]> {
    const records = await tpvGetAllByIndex<ActualTimeSegmentRecord>("tpvActualTimeSegments", "actualTimeRecordId", actualTimeRecordId);
    return records.map(actualTimeSegmentFromRecord);
  }

  async save(segment: ActualTimeSegment): Promise<void> {
    await tpvPut("tpvActualTimeSegments", actualTimeSegmentToRecord(segment));
  }

  async saveMany(segments: readonly ActualTimeSegment[]): Promise<void> {
    for (const segment of segments) await this.save(segment);
  }
}
