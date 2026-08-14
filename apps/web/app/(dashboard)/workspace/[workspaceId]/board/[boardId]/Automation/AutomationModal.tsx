"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";


import type { AutomationStep } from "./automation.types";
import AutomationGallery from "./AutomationGallery";
import AutomationBuilder from "./AutomationBuilder";

type AutomationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardName?: string;
};

export default function AutomationModal({
  open,
  onOpenChange,
  boardName = "Testing board 2",
}: AutomationModalProps) {
  const [view, setView] = useState<"templates" | "builder">("templates");

  const [steps, setSteps] = useState<AutomationStep[]>([
    {
      id: "trigger-1",
      type: "trigger",
      field: "",
      value: "",
    },
    {
      id: "action-1",
      type: "action",
      field: "",
      value: "",
    },
  ]);

  const reset = () => {
    setView("templates");

    setSteps([
      {
        id: "trigger-1",
        type: "trigger",
        field: "",
        value: "",
      },
      {
        id: "action-1",
        type: "action",
        field: "",
        value: "",
      },
    ]);
  };

  const handleClose = () => {
    onOpenChange(false);

    setTimeout(() => {
      reset();
    }, 200);
  };

  const updateStep = (id: string, key: keyof AutomationStep, value: string) => {
    setSteps((current) =>
      current.map((step) =>
        step.id === id
          ? {
              ...step,
              [key]: value,
            }
          : step,
      ),
    );
  };

  const removeStep = (id: string) => {
    setSteps((current) => current.filter((step) => step.id !== id));
  };

  const addTrigger = () => {
    setSteps((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: "trigger",
        field: "",
        value: "",
      },
    ]);
  };

  const addAction = () => {
    setSteps((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: "action",
        field: "",
        value: "",
      },
    ]);
  };

  const createFromScratch = () => {
    setSteps([
      {
        id: crypto.randomUUID(),
        type: "trigger",
        field: "",
        value: "",
      },
      {
        id: crypto.randomUUID(),
        type: "action",
        field: "",
        value: "",
      },
    ]);

    setView("builder");
  };

  const useTemplate = (templateId: string) => {
    switch (templateId) {
      case "status-notify":
        setSteps([
          {
            id: crypto.randomUUID(),
            type: "trigger",
            field: "status",
            value: "something",
          },
          {
            id: crypto.randomUUID(),
            type: "action",
            field: "notify",
            value: "",
          },
        ]);
        break;

      case "assign-creator":
        setSteps([
          {
            id: crypto.randomUUID(),
            type: "trigger",
            field: "item-created",
            value: "",
          },
          {
            id: crypto.randomUUID(),
            type: "action",
            field: "assign-creator",
            value: "",
          },
        ]);
        break;

      case "date-notify":
        setSteps([
          {
            id: crypto.randomUUID(),
            type: "trigger",
            field: "date",
            value: "arrives",
          },
          {
            id: crypto.randomUUID(),
            type: "action",
            field: "notify",
            value: "",
          },
        ]);
        break;
    }

    setView("builder");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          handleClose();
        } else {
          onOpenChange(value);
        }
      }}
    >
      <DialogContent
        className="
          max-w-[calc(100vw-48px)]!
          h-[calc(100vh-24px)]
          p-0
          gap-0
          overflow-hidden
          rounded-lg
          border
          bg-white
        "
      >
        <DialogTitle className="sr-only">Board automations</DialogTitle>

        {view === "templates" ? (
          <AutomationGallery
            boardName={boardName}
            onClose={handleClose}
            onCreateFromScratch={createFromScratch}
            onUseTemplate={useTemplate}
          />
        ) : (
          <AutomationBuilder
            boardName={boardName}
            steps={steps}
            onBack={() => setView("templates")}
            onClose={handleClose}
            onUpdateStep={updateStep}
            onRemoveStep={removeStep}
            onAddTrigger={addTrigger}
            onAddAction={addAction}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
