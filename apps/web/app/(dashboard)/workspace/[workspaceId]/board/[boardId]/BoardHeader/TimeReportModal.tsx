"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getBoardMembers } from "@/services/boards.api";
import { downloadTimeReport } from "@/services/time-tracking.api";

interface Props {
  open: boolean;
  onClose: () => void;
  boardId: number;
  boardName: string;
}

export function TimeReportModal({ open, onClose, boardId, boardName }: Props) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [userId, setUserId] = useState<number | undefined>();
  const [downloading, setDownloading] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["board-members", boardId],
    queryFn: () => getBoardMembers(boardId),
    enabled: open,
  });

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadTimeReport(boardId, boardName, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        userId,
      });
      onClose();
    } catch {
      // error is surfaced via toast elsewhere
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Export Time Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tr-start" className="text-xs">From</Label>
              <Input
                id="tr-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-end" className="text-xs">To</Label>
              <Input
                id="tr-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tr-user" className="text-xs">Member (optional)</Label>
            <select
              id="tr-user"
              value={userId ?? ""}
              onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All members</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Exports completed time entries as a CSV file. Leave dates empty to include all time.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={downloading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            Download CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
