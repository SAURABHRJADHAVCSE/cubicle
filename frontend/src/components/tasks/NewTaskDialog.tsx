"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAgents } from "@/hooks/useAgents";
import { useCreateTask, useExecuteTask } from "@/hooks/useTasks";

const NO_ORCHESTRATOR = "__none__";

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTaskDialog({ open, onOpenChange }: NewTaskDialogProps) {
  const { data: agents } = useAgents();
  const createTask = useCreateTask();
  const executeTask = useExecuteTask();

  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [assignedAgents, setAssignedAgents] = useState<string[]>([]);
  const [orchestratorId, setOrchestratorId] = useState(NO_ORCHESTRATOR);

  const isRouted = orchestratorId !== NO_ORCHESTRATOR;
  const orchestrator = agents?.find((a) => a.id === orchestratorId);

  function reset() {
    setTitle("");
    setBrief("");
    setAssignedAgents([]);
    setOrchestratorId(NO_ORCHESTRATOR);
  }

  function close() {
    onOpenChange(false);
    reset();
  }

  function toggleAgent(id: string) {
    setAssignedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  }

  async function handleStart() {
    try {
      const task = await createTask.mutateAsync({
        title: title.trim(),
        brief: brief.trim(),
        // Routed via a boss agent: assigned_agents is a required non-null
        // placeholder (the backend's `route_task` dynamically reassigns
        // each subtask to whichever teammate the boss picks) rather than
        // the user's own checkbox selection.
        assigned_agents: isRouted ? [orchestratorId] : assignedAgents,
        orchestrator_agent_id: isRouted ? orchestratorId : null,
      });
      await executeTask.mutateAsync(task.id);
      toast.success(isRouted ? "Task routed" : "Task started");
      close();
    } catch {
      toast.error("Couldn't start the task — check the console/API logs");
    }
  }

  const canStart = title.trim() && brief.trim() && (isRouted || assignedAgents.length > 0);
  const isSubmitting = createTask.isPending || executeTask.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Describe the job and pick who works on it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              placeholder="Screen these resumes"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-brief">Brief</Label>
            <Textarea
              id="task-brief"
              rows={4}
              placeholder="Find the top 5 Python developers from the attached resumes"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Route via boss agent (optional)</Label>
            <Select value={orchestratorId} onValueChange={(v) => v && setOrchestratorId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ORCHESTRATOR}>No boss — assign directly</SelectItem>
                {agents?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name} &middot; {agent.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isRouted && (
              <p className="text-xs text-muted-foreground">
                {orchestrator?.name ?? "This agent"} will break the brief into subtasks and
                assign each to the best-fit teammate.
              </p>
            )}
          </div>

          {!isRouted && (
            <div className="flex flex-col gap-2">
              <Label>Assign to</Label>
              {!agents?.length && (
                <p className="text-sm text-muted-foreground">
                  No agents yet — add one first.
                </p>
              )}
              <div className="flex flex-col gap-2">
                {agents?.map((agent) => (
                  <label key={agent.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={assignedAgents.includes(agent.id)}
                      onCheckedChange={() => toggleAgent(agent.id)}
                    />
                    {agent.name} &middot; {agent.role}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleStart} disabled={!canStart || isSubmitting}>
            {isSubmitting ? "Starting…" : isRouted ? "Route" : "Start"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
