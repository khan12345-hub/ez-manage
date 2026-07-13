"use client";

import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import Image from "next/image";

interface Props {
  image: string;
}

export function WorkspaceCover({ image }: Props) {
  return (
    <div className="relative h-72 overflow-hidden">
      <Image
        src={image}
        alt="cover-image"
        className="absolute inset-0 h-full w-full object-cover"
        fill
      />

      <div className="absolute inset-0 bg-black/15" />

      <div className="absolute right-8 top-6">
        <Button variant="secondary">
          <Pencil className="mr-2 h-4 w-4" />
          Change Cover
        </Button>
      </div>
    </div>
  );
}