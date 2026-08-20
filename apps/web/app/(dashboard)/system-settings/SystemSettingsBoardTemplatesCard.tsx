"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { BoardTemplate } from "./board-template/template.types";

interface BoardTemplateCardProps {
  template: BoardTemplate;
  onEdit: (template: BoardTemplate) => void;
  onDelete: (templateId: number) => void;
}

export function BoardTemplateCard({
  template,
  onEdit,
  onDelete,
}: BoardTemplateCardProps) {
  const firstGroupColor = template.groups?.[0]?.color || "#06b6d4";

  return (
    <Card className="group relative overflow-hidden border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-80"
        style={{
          background: `linear-gradient(
            135deg,
            ${firstGroupColor}45 0%,
            ${firstGroupColor}20 35%,
            transparent 80%
          )`,
        }}
      />

      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl opacity-20 transition-opacity duration-300 group-hover:opacity-35"
        style={{
          backgroundColor: firstGroupColor,
        }}
      />

      <CardHeader className="relative mb-1">
        <div className="mb-2 flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full ring-4 ring-white/60 dark:ring-zinc-950/60"
            style={{
              backgroundColor: firstGroupColor,
            }}
          />

          <span className="text-xs font-medium text-muted-foreground">
            Board Template
          </span>
        </div>

        <CardTitle className="text-base">{template.name}</CardTitle>

        {template.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {template.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="relative ">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{template.groups?.length ?? 0} groups</span>

          {template.groups?.length ? (
            <div className="flex items-center gap-1">
              {template.groups.slice(0, 4).map((group) => (
                <span
                  key={group.id}
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: group.color,
                  }}
                />
              ))}

              {template.groups.length > 4 && (
                <span className="ml-1 text-xs">
                  +{template.groups.length - 4}
                </span>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            className="bg-background/70 backdrop-blur-sm"
            onClick={() => onEdit(template)}
          >
            <Pencil className="mr-1 h-4 w-4" />
            Edit
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="bg-background/70 backdrop-blur-sm"
            onClick={() => onDelete(template.id)}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
