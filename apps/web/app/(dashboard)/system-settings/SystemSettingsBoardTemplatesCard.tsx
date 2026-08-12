"use client";

import {
  Copy,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { BoardTemplate } from "./SystemSettingsBoardTemplates";

interface BoardTemplateCardProps {
  template: BoardTemplate;
}

export function BoardTemplateCard({
  template,
}: BoardTemplateCardProps) {
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${template.color}`}
        >
          <LayoutTemplate className="h-6 w-6 text-white" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{template.name}</h3>

            <Badge variant="secondary" className="text-xs">
              Template
            </Badge>
          </div>

          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {template.description}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>
              <strong className="font-medium text-foreground">
                {template.groups}
              </strong>{" "}
              groups
            </span>

            <span>
              <strong className="font-medium text-foreground">
                {template.columns}
              </strong>{" "}
              columns
            </span>

            <span>
              <strong className="font-medium text-foreground">
                {template.tasks}
              </strong>{" "}
              sample tasks
            </span>

            <span>{template.updatedAt}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:flex"
          >
            Edit
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Pencil className="mr-2 h-4 w-4" />
                Edit template
              </DropdownMenuItem>

              <DropdownMenuItem>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}