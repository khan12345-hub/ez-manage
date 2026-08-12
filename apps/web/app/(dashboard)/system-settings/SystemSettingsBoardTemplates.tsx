"use client";

import { useState } from "react";
import { LayoutTemplate, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { BoardTemplateCard } from "./SystemSettingsBoardTemplatesCard";
import { SettingsStatCard } from "./SettingsStatsCard";

export interface BoardTemplate {
  id: number;
  name: string;
  description: string;
  groups: number;
  columns: number;
  tasks: number;
  color: string;
  updatedAt: string;
}

const templates: BoardTemplate[] = [
  {
    id: 1,
    name: "Project Management",
    description:
      "A complete project management board for planning, tracking and delivering work.",
    groups: 4,
    columns: 8,
    tasks: 12,
    color: "bg-blue-500",
    updatedAt: "Updated 2 days ago",
  },
  {
    id: 2,
    name: "Marketing Campaign",
    description:
      "Organize marketing campaigns, content, owners, deadlines and campaign status.",
    groups: 3,
    columns: 7,
    tasks: 10,
    color: "bg-purple-500",
    updatedAt: "Updated 5 days ago",
  },
  {
    id: 3,
    name: "Employee Onboarding",
    description:
      "Track onboarding activities and make sure every new employee has a smooth start.",
    groups: 2,
    columns: 6,
    tasks: 8,
    color: "bg-emerald-500",
    updatedAt: "Updated 1 week ago",
  },
];

export function BoardTemplates() {
  const [search, setSearch] = useState("");

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-primary" />

            <h2 className="text-xl font-semibold">
              Board Templates
            </h2>
          </div>

          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Create reusable board structures that your team can use
            to quickly start new projects.
          </p>
        </div>

        <Button className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SettingsStatCard
          label="Total Templates"
          value={templates.length}
          description="Available system templates"
        />

        <SettingsStatCard
          label="Board Structures"
          value="18"
          description="Groups and columns configured"
        />

        <SettingsStatCard
          label="Used Boards"
          value="42"
          description="Boards created from templates"
        />
      </div>

      <div className="mt-8">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search templates..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {filteredTemplates.map((template) => (
          <BoardTemplateCard
            key={template.id}
            template={template}
          />
        ))}

        {!filteredTemplates.length && (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
            <div className="text-center">
              <LayoutTemplate className="mx-auto h-8 w-8 text-muted-foreground" />

              <p className="mt-3 text-sm font-medium">
                No templates found
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Try a different search term.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}