"use client";

import { CreateBoardModal } from "@/components/CreateBoardModal";
import { Plus } from "lucide-react";
import { useState } from "react";

interface AddBoardCardProps {
  workspaceId: number;
  onClick?: () => void;
}

export function AddBoardCard({ workspaceId, onClick }: AddBoardCardProps) {
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col items-start my-6">
        {/* <p className="mb-6 text-xl font-semibold text-gray-800">
          Nothing to show here, Please create a board to get started.
        </p> */}

        <button
          onClick={() => setIsCreateBoardOpen(true)}
          className="group flex h-36 w-36 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white transition-all duration-200 hover:border-sky-400 hover:bg-sky-50 cursor-pointer"
        >
          <Plus className="h-14 w-14 text-sky-200 transition-colors group-hover:text-sky-500" />
        </button>

        <p className="mt-4 text-sm font-medium text-gray-700 text-center">Add new board</p>
      </div>
      <CreateBoardModal
        isOpen={isCreateBoardOpen}
        onClose={() => setIsCreateBoardOpen(false)}
        workspaceId={workspaceId}
      />
    </>
  );
}
