"use client";

import { useState } from "react";

import {
  Search,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  automationCategories,
  automationTemplates,
} from "../automation-data";

type Props = {
  onCreateFromScratch: () => void;

  onUseTemplate: (
    templateId: string,
  ) => void;
};

export default function AutomationCreateTab({
  onCreateFromScratch,
  onUseTemplate,
}: Props) {
  const [search, setSearch] =
    useState("");

  const filteredTemplates =
    automationTemplates.filter(
      (template) =>
        template.title
          .toLowerCase()
          .includes(
            search.toLowerCase(),
          ),
    );

  return (
    <div className="flex h-full flex-1">
      {/* Sidebar — hidden on mobile */}
      <aside className="hidden w-[180px] shrink-0 border-r bg-slate-50/80 px-3 py-5 sm:block sm:w-[220px]">
        <div className="mb-3 px-3 text-[15px] font-semibold">
          Categories
        </div>

        <div className="space-y-1">
          {automationCategories.map(
            (category, index) => {
              const Icon = category.icon;

              return (
                <button
                  key={category.label}
                  type="button"
                  className={`
                    flex
                    h-[34px]
                    w-full
                    items-center
                    rounded-md
                    px-3
                    text-left
                    text-[13px]
                    ${
                      index === 0
                        ? "bg-blue-100 text-slate-700"
                        : "text-slate-600 hover:bg-slate-100"
                    }
                  `}
                >
                  <Icon className="mr-2.5 h-[15px] w-[15px]" />

                  <span className="flex-1">
                    {category.label}
                  </span>
                </button>
              );
            },
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1 overflow-auto px-4 py-4 sm:px-[52px] sm:py-[14px]">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search"
              className="
                h-[34px]
                rounded-md
                border-blue-500
                pl-9
                text-[13px]
                shadow-none
                focus-visible:ring-1
                focus-visible:ring-blue-500
              "
            />
          </div>
        </div>

        <section className="mt-7">
          <h2 className="mb-3 text-[20px] font-semibold text-slate-700">
            Start with the basics
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {/* Create from scratch */}
            {/* <button
              type="button"
              onClick={
                onCreateFromScratch
              }
              className="
                group
                flex
                h-[212px]
                flex-col
                items-center
                justify-center
                rounded-md
                border
                bg-white
                transition
                hover:border-blue-400
                hover:shadow-sm
              "
            >
              <div className="mb-3 text-4xl font-light text-slate-700">
                +
              </div>

              <div className="text-[15px] text-slate-600">
                Create from scratch
              </div>

              <div className="mt-3 flex items-center gap-1 text-[12px] text-slate-500">
                <Sparkles className="h-3.5 w-3.5 text-purple-500" />

                or create with AI
              </div>
            </button> */}

            {/* Templates */}
            {filteredTemplates.map(
              (template) => {
                const Icon =
                  template.icon;

                return (
                  <div
                    key={template.id}
                    className="flex h-[160px] flex-col rounded-md border bg-white p-3 sm:h-[212px] sm:p-3.5"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-md border">
                      <Icon className="h-4 w-4 text-slate-600" />
                    </div>

                    <div className="mt-4 flex-1 text-[15px] leading-[20px] text-slate-700">
                      {template.title}
                    </div>

                    <Button
                      variant="outline"
                      className="h-7 w-full text-[12px] font-normal"
                      onClick={() =>
                        onUseTemplate(
                          template.id,
                        )
                      }
                    >
                      Use template
                    </Button>
                  </div>
                );
              },
            )}
          </div>

          {filteredTemplates.length ===
            0 && (
            <div className="py-20 text-center text-sm text-muted-foreground">
              No automation templates
              found.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}