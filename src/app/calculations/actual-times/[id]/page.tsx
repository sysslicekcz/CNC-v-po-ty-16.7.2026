"use client";

import { useParams } from "next/navigation";
import { ActualTimeDetailPage } from "@/presentation/calculations/actual-time-detail-page";

export default function ActualTimeDetailRoutePage() {
  const params = useParams<{ id: string }>();
  return <ActualTimeDetailPage actualTimeRecordId={decodeURIComponent(params.id)} />;
}
