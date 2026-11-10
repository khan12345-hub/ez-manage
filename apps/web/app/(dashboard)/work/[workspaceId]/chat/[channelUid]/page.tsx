"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { ChannelView } from "../../../_components/chat/ChannelView";

export default function ChannelPage() {
  const { channelUid } = useParams<{ channelUid: string }>();
  return (
    <div className="h-[calc(100dvh-3.5rem)] w-full">
      <Suspense fallback={null}>
        <ChannelView key={channelUid} uid={channelUid} />
      </Suspense>
    </div>
  );
}
