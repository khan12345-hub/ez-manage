"use client";

import { useParams } from "next/navigation";
import { OverviewPage } from "../../../_components/OverviewPage";

export default function SpaceOverviewRoute() {
  const { workspaceId, spaceUid } = useParams<{ workspaceId: string; spaceUid: string }>();
  return <OverviewPage kind="space" uid={spaceUid} workspaceId={workspaceId} />;
}
