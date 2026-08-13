"use client";

import { useParams } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useBoardTemplates } from "./useBoardTemplate";

import { CreateBoardTemplateDialog } from "./CreateBoardTemplateModal";
import { BoardTemplate } from "./template.types";

export default function BoardTemplatesPage() {

  const [createDialogOpen, setCreateDialogOpen] =
    useState(false);
  const [
    selectedTemplate,
    setSelectedTemplate,
  ] = useState<BoardTemplate | null>(null);

  const {
    data: templates = [],
    isLoading,
  } = useBoardTemplates();

  function handleCreateTemplate() {
    setSelectedTemplate(null);
    setCreateDialogOpen(true);
  }

  function handleEditTemplate(
    template: BoardTemplate,
  ) {
    setSelectedTemplate(template);
    setCreateDialogOpen(true);
  }

  function handleDialogOpenChange(
    value: boolean,
  ) {
    setCreateDialogOpen(value);

    if (!value) {
      setSelectedTemplate(null);
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Loading board templates...
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-6xl p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Board Templates
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Create reusable board structures for your workspace.
            </p>
          </div>

          <Button
            onClick={handleCreateTemplate}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create template
          </Button>
        </div>

        {templates.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-60 items-center justify-center">
              <div className="text-center">
                <h3 className="font-medium">
                  No templates yet
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first board template.
                </p>

                <Button
                  className="mt-4"
                  onClick={() =>
                    handleCreateTemplate()
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create template
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template: BoardTemplate) => (
              <Card key={template.id}>
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
                      onClick={() =>
                        handleEditTemplate(template)
                      }
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
            ))}
          </div>
        )}
      </div>

      <CreateBoardTemplateDialog
        open={createDialogOpen}
        onOpenChange={handleDialogOpenChange}
        template={selectedTemplate}
      />
    </>
  );
}
