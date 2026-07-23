"use client";

import { useParams } from "next/navigation";
import { CalibrationProposalDetailPage } from "@/presentation/calculations/calibration-proposal-detail-page";

export default function CalibrationProposalRoutePage() {
  const params = useParams<{ id: string }>();
  return <CalibrationProposalDetailPage proposalId={decodeURIComponent(params.id)} />;
}
