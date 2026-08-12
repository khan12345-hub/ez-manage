"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TemplateBasicInfoProps {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export function TemplateBasicInfo({
  name,
  description,
  onNameChange,
  onDescriptionChange,
}: TemplateBasicInfoProps) {
  return (
    <div className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="template-name">
          Template name
        </Label>

        <Input
          id="template-name"
          value={name}
          onChange={(event) =>
            onNameChange(event.target.value)
          }
          placeholder="e.g. Software Development"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-description">
          Description
        </Label>

        <Input
          id="template-description"
          value={description}
          onChange={(event) =>
            onDescriptionChange(event.target.value)
          }
          placeholder="Describe this template"
        />
      </div>
    </div>
  );
}