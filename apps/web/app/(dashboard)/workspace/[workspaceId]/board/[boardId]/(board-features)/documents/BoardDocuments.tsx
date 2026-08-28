"use client";

import { useState } from "react";

import {
  FileText,
  Files,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { DocumentEditor } from "./DocumentEditor";

export interface BoardDocument {
  id: number;
  title: string;
  content: any;
  createdAt: Date;
  updatedAt: Date;
}

const createEmptyContent = () => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
});

export function BoardDocuments() {
  const [documents, setDocuments] = useState<
    BoardDocument[]
  >([]);

  const [selectedDocumentId, setSelectedDocumentId] =
    useState<number | null>(null);

  const createDocument = () => {
    const now = new Date();

    const document: BoardDocument = {
      id: Date.now(),
      title: "Untitled document",
      content: createEmptyContent(),
      createdAt: now,
      updatedAt: now,
    };

    setDocuments((current) => [
      ...current,
      document,
    ]);

    setSelectedDocumentId(document.id);
  };

  const updateDocument = (
    documentId: number,
    updates: Partial<BoardDocument>,
  ) => {
    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId
          ? {
              ...document,
              ...updates,
              updatedAt: new Date(),
            }
          : document,
      ),
    );
  };

  const deleteDocument = (
    documentId: number,
  ) => {
    setDocuments((current) =>
      current.filter(
        (document) => document.id !== documentId,
      ),
    );

    if (selectedDocumentId === documentId) {
      const remaining = documents.filter(
        (document) => document.id !== documentId,
      );

      setSelectedDocumentId(
        remaining[0]?.id ?? null,
      );
    }
  };

  const selectedDocument =
    documents.find(
      (document) =>
        document.id === selectedDocumentId,
    ) ?? null;

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[600px] overflow-hidden rounded-xl border bg-background">
      {/* Documents sidebar */}
      <aside className="flex w-[260px] shrink-0 flex-col border-r bg-muted/20">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">
              Documents
            </h2>

            <p className="text-xs text-muted-foreground">
              {documents.length}{" "}
              {documents.length === 1
                ? "document"
                : "documents"}
            </p>
          </div>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={createDocument}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto p-2">
          {documents.length === 0 ? (
            <EmptyDocuments
              onCreate={createDocument}
            />
          ) : (
            <div className="space-y-1">
              {documents.map((document) => {
                const isActive =
                  document.id ===
                  selectedDocumentId;

                return (
                  <div
                    key={document.id}
                    className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 transition-colors ${
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    }`}
                    onClick={() =>
                      setSelectedDocumentId(
                        document.id,
                      )
                    }
                  >
                    <FileText
                      className={`h-4 w-4 shrink-0 ${
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    />

                    <span className="min-w-0 flex-1 truncate text-sm">
                      {document.title ||
                        "Untitled document"}
                    </span>

                    <button
                      type="button"
                      className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:flex"
                      onClick={(event) => {
                        event.stopPropagation();

                        deleteDocument(
                          document.id,
                        );
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* New document footer */}
        {documents.length > 0 && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={createDocument}
            >
              <Plus className="mr-2 h-4 w-4" />
              New document
            </Button>
          </div>
        )}
      </aside>

      {/* Editor */}
      <main className="min-w-0 flex-1">
        {selectedDocument ? (
          <DocumentEditor
            key={selectedDocument.id}
            document={selectedDocument}
            onUpdate={(updates) =>
              updateDocument(
                selectedDocument.id,
                updates,
              )
            }
          />
        ) : (
          <EmptyEditor
            onCreate={createDocument}
          />
        )}
      </main>
    </div>
  );
}

function EmptyDocuments({
  onCreate,
}: {
  onCreate: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-5 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Files className="h-5 w-5 text-muted-foreground" />
      </div>

      <p className="text-sm font-medium">
        No documents
      </p>

      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Create a document to start writing.
      </p>

      <Button
        type="button"
        size="sm"
        className="mt-4"
        onClick={onCreate}
      >
        <Plus className="mr-2 h-4 w-4" />
        New document
      </Button>
    </div>
  );
}

function EmptyEditor({
  onCreate,
}: {
  onCreate: () => void;
}) {
  return (
    <div className="flex h-full min-h-[600px] flex-col items-center justify-center">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>

        <h3 className="text-sm font-semibold">
          Create your first document
        </h3>

        <p className="mt-1 text-sm text-muted-foreground">
          Write project notes, requirements,
          meeting notes, and other board
          documentation.
        </p>

        <Button
          type="button"
          className="mt-5"
          onClick={onCreate}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create document
        </Button>
      </div>
    </div>
  );
}

