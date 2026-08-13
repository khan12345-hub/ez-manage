"use client";

import {
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { BoardTemplate } from "./board-template/template.types";

interface BoardTemplateCardProps {
  template: BoardTemplate;
  onEdit: (template: BoardTemplate) => void;
}

export function BoardTemplateCard({
  template,
  onEdit,
}: BoardTemplateCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">
          {template.name}
        </CardTitle>

        {template.description && (
          <p className="text-sm text-muted-foreground">
            {template.description}
          </p>
        )}
      </CardHeader>

      <CardContent>
        <div className="text-sm text-muted-foreground">
          {template.groups?.length ?? 0} groups
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(template)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>

          <Button
            variant="outline"
            size="sm"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}