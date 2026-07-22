import { ActualTimeSegment } from "../calibration/actual-time-segment";

/** Port pro `ActualTimeSegment` (AP-MCE-001 Fáze G §3/§23) - segmenty se
 *  vždy čtou/ukládají PO CELKU (`listByActualTimeRecord`), nikdy
 *  jednotlivě z UI (`TimeOverlapResolver` potřebuje celou sadu najednou). */
export interface ActualTimeSegmentRepository {
  getById(id: string): Promise<ActualTimeSegment | null>;
  listByActualTimeRecord(actualTimeRecordId: string): Promise<ActualTimeSegment[]>;
  save(segment: ActualTimeSegment): Promise<void>;
  saveMany(segments: readonly ActualTimeSegment[]): Promise<void>;
}
