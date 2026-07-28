"use client";
import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteTask } from "@/services/tasks.api";
import { toast } from "sonner";
import { useInviteModalStore } from "@/store/invite-modal";
interface Props {
  task: any;
}
export function TaskActions({ task }: Props) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { boardId } = useInviteModalStore();
  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id, boardId!),
    onSuccess: () => {
      toast.success("Task deleted");
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
    onError: () => {
      toast.error("Failed to delete task");
    },
  });
  const handleDelete = () => {
    deleteTaskMutation.mutate(task.id);
  };
  return (
    <>
      
      <DropdownMenu>
        
        <DropdownMenuTrigger asChild>
          
          <button className=" invisible flex h-7 w-7 items-center justify-center rounded hover:bg-accent group-hover:visible ">
            
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setDeleteDialogOpen(true)}
          >
            
            <Trash2 className="mr-2 h-4 w-4" /> Delete task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        
        <AlertDialogContent>
          
          <AlertDialogHeader>
            
            <AlertDialogTitle> Delete this task? </AlertDialogTitle>
            <AlertDialogDescription>
              
              This action cannot be undone. Deleting this task will permanently
              remove the task and all of its related data.
            </AlertDialogDescription>
            <div className="rounded-md border bg-muted/50 p-4 text-sm w-full">
              
              <ul className="list-disc space-y-1 pl-5">
                
                <li>All subtasks</li> <li>All files</li>
                <li>All comments and replies</li>
                <li>All activity logs</li>
              </ul>
            </div>
            <AlertDialogDescription>
              
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            
            <Button
              type="button"
              variant="outline"
              disabled={deleteTaskMutation.isPending}
              onClick={() => setDeleteDialogOpen(false)}
            >
              
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteTaskMutation.isPending}
              onClick={handleDelete}
            >
              
              {deleteTaskMutation.isPending
                ? "Deleting..."
                : "Delete task"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
