"use client";

import Image from "next/image";

interface Props {
  image: string;
}

export function WorkspaceCover({ image }: Props) {
  return (
    <div className="relative h-32 overflow-hidden sm:h-44 md:h-52">
      <Image
        src={image}
        alt="cover-image"
        className="absolute inset-0 h-full w-full object-cover"
        fill
      />

      {/* soft tint for text contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/5" />
      {/* fade into the light page below for a seamless, premium blend */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}