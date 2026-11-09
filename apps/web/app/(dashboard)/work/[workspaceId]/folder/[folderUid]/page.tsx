"use client";

import { useParams } from "next/navigation";
import { OverviewPage } from "../../../_components/OverviewPage";

export default function FolderOverviewRoute() {
  const { workspaceId, folderUid } = useParams<{ workspaceId: string; folderUid: string }>();
  return <OverviewPage kind="folder" uid={folderUid} workspaceId={workspaceId} />;
}
