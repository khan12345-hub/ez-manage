"use client";

import { useState } from "react";
import { LayoutTemplate, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBoardTemplates } from "./board-template/useBoardTemplate";
import { CreateBoardTemplateDialog } from "./board-template/CreateBoardTemplateModal";
import { BoardTemplate } from "./board-template/template.types";
import { BoardTemplateCard } from "./SystemSettingsBoardTemplatesCard";
import { SettingsStatCard } from "./SettingsStatsCard";
import { useDeleteBoardTemplateMutation } from "./board-template/useBoardTemplateMutations";

export function BoardTemplates() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [selectedTemplate, setSelectedTemplate] =
    useState<BoardTemplate | null>(null);

  const [search, setSearch] = useState("");

  const { data: templates = [], isLoading } = useBoardTemplates();

  const deleteTemplateMutation = useDeleteBoardTemplateMutation();

  const handleDeleteTemplate = (templateId: number) => {
    deleteTemplateMutation.mutate(templateId);
  };

  function handleCreateTemplate() {
    setSelectedTemplate(null);
    setCreateDialogOpen(true);
  }

  function handleEditTemplate(template: BoardTemplate) {
    setSelectedTemplate(template);
    setCreateDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    setCreateDialogOpen(open);

    if (!open) {
      setSelectedTemplate(null);
    }
  }

  const filteredTemplates = templates.filter(
    (template: BoardTemplate) =>
      template.name.toLowerCase().includes(search.toLowerCase()) ||
      template.description?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalGroups = templates.reduce(
    (total: number, template: BoardTemplate) =>
      total + (template.groups?.length ?? 0),
    0,
  );

  if (isLoading) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading board templates...
        </p>
      </div>
    );
  }

  return (
    <>
      <div>
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-primary" />

              <h2 className="text-xl font-semibold">Board Templates</h2>
            </div>

            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Create reusable board structures that your team can use to quickly
              start new projects.
            </p>
          </div>

          <Button onClick={handleCreateTemplate} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Create Template
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsStatCard
            label="Total Templates"
            value={templates.length}
            description="Available board templates"
          />

          <SettingsStatCard
            label="Board Groups"
            value={totalGroups}
            description="Groups across all templates"
          />
        </div>

        {/* Search */}
        {/* {templates.length > 0 && (
          <div className="mt-8">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search templates..."
                className="pl-9"
              />
            </div>
          </div>
        )} */}

        {/* Empty State */}
        {templates.length === 0 && (
          <div className="mt-6 flex min-h-60 items-center justify-center rounded-xl border border-dashed">
            <div className="text-center">
              <LayoutTemplate className="mx-auto h-8 w-8 text-muted-foreground" />

              <h3 className="mt-3 font-medium">No templates yet</h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Create your first board template.
              </p>

              <Button className="mt-4" onClick={handleCreateTemplate}>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </div>
          </div>
        )}

        {/* Search Empty State */}
        {templates.length > 0 && filteredTemplates.length === 0 && (
          <div className="mt-4 flex min-h-48 items-center justify-center rounded-xl border border-dashed">
            <div className="text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground" />

              <p className="mt-3 text-sm font-medium">No templates found</p>

              <p className="mt-1 text-xs text-muted-foreground">
                Try a different search term.
              </p>
            </div>
          </div>
        )}

        {/* Templates */}
        {filteredTemplates.length > 0 && (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((template: BoardTemplate) => (
              <BoardTemplateCard
                key={template.id}
                template={template}
                onEdit={handleEditTemplate}
                onDelete={handleDeleteTemplate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <CreateBoardTemplateDialog
        open={createDialogOpen}
        onOpenChange={handleDialogOpenChange}
        template={selectedTemplate}
      />
    </>
  );
}
