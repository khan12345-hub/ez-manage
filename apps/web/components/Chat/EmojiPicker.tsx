"use client";

import { useEffect, useRef, useState } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handleOutside), 80);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleOutside);
    };
  }, [onClose]);

  return (
    <div ref={ref}>
      <Picker
        data={data}
        onEmojiSelect={(e: { native: string }) => onSelect(e.native)}
        theme="light"
        previewPosition="none"
        skinTonePosition="none"
        navPosition="top"
        perLine={8}
        maxFrequentRows={2}
        autoFocus
      />
    </div>
  );
}
