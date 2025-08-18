import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Card, CardContent } from "../ui/card";
import { useAuth } from "../auth/AuthContext";

interface CreateTaskDialogProps {
  trigger?: React.ReactNode;
  onTaskCreated?: (task: any) => void;
}

const taskTypes = [
  { value: "design", label: "Design Work", roles: ["editor"] },
  { value: "video", label: "Video Production", roles: ["editor"] },
  { value: "review", label: "Quality Review", roles: ["qc_specialist"] },
  { value: "schedule", label: "Schedule Planning", roles: ["scheduler"] },
  { value: "copywriting", label: "Copywriting", roles: ["editor"] },
  { value: "audit", label: "Content Audit", roles: ["qc_specialist"] },
  {
    value: "coordination",
    label: "Project Coordination",
    roles: ["scheduler"],
  },
];

export function CreateTaskDialog({
  trigger,
  onTaskCreated,
}: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "",
    assignedTo: "",
    dueDate: "",
    estimatedHours: "",
    projectId: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const [availableMembers, setAvailableMembers] = useState<any[]>([]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = "Task title is required";
    if (!formData.type) newErrors.type = "Task type is required";
    if (!formData.assignedTo)
      newErrors.assignedTo = "Please assign this task to someone";
    if (!formData.dueDate) newErrors.dueDate = "Due date is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchMembers = async () => {
    if (!formData.type) {
      setAvailableMembers([]);
      return;
    }

    try {
      const res = await fetch(`/api/roles?taskType=${formData.type}`);
      if (!res.ok) {
        console.error("Failed to fetch members:", res.statusText);
        setAvailableMembers([]);
        return;
      }

      const data = await res.json();
      // Accept both possible response shapes
      setAvailableMembers(data.roleUsers || data.users || []);
    } catch (error) {
      console.error("Error fetching members:", error);
      setAvailableMembers([]);
    }
  };

  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          taskType: formData.type,
          dueDate: formData.dueDate,
          assignedTo: Number(formData.assignedTo), // ensure int
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create task");

      onTaskCreated?.(data);

      setFormData({
        title: "",
        description: "",
        type: "",
        assignedTo: "",
        dueDate: "",
        estimatedHours: "",
        projectId: "",
      });
      setAvailableMembers([]);
      setOpen(false);
    } catch (error) {
      console.error("Error creating task:", error);
      setErrors((prev) => ({ ...prev, submit: (error as Error).message }));
    } finally {
      setLoading(false);
    }
  };

  const selectedMember = availableMembers.find(
    (m) => m.id === formData.assignedTo
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Create Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Assign a task to your team members. Choose the appropriate role
            based on the task type.
          </DialogDescription>
          {user && (
            <div className="text-xs text-muted-foreground">
              Creating as: {user.name} ({user.role})
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.submit && (
            <p className="text-sm text-destructive">{errors.submit}</p>
          )}

          {/* Task Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              placeholder="Enter task title..."
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Provide detailed task instructions..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
            />
          </div>

          {/* Task Type */}
          <div className="space-y-2">
            <Label>Task Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => {
                handleInputChange("type", value);
                handleInputChange("assignedTo", "");
              }}
            >
              <SelectTrigger
                className={errors.type ? "border-destructive" : ""}
              >
                <SelectValue placeholder="Select task type" />
              </SelectTrigger>
              <SelectContent>
                {taskTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleInputChange("dueDate", e.target.value)}
                className={errors.dueDate ? "border-destructive" : ""}
                min={new Date().toISOString().split("T")[0]}
              />
              {errors.dueDate && (
                <p className="text-sm text-destructive">{errors.dueDate}</p>
              )}
            </div>

            {/* Estimated Hours */}
            <div className="space-y-2">
              <Label htmlFor="estimatedHours">Estimated Hours</Label>
              <Input
                id="estimatedHours"
                type="number"
                placeholder="e.g. 8"
                value={formData.estimatedHours}
                onChange={(e) =>
                  handleInputChange("estimatedHours", e.target.value)
                }
                min="0.5"
                step="0.5"
              />
            </div>
          </div>

          {/* Assign To */}
          <div className="space-y-3">
            <Label>Assign To</Label>
            {formData.type ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                  {availableMembers.map((member) => (
                    <Card
                      key={member.id}
                      className={`cursor-pointer transition-colors ${
                        formData.assignedTo === member.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent"
                      }`}
                      onClick={() => handleInputChange("assignedTo", member.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.avatarUrl || ""} />
                              <AvatarFallback>
                                {member?.avatar ||
                                  member?.name?.charAt(0) ||
                                  "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="text-sm font-medium">
                                {member.name}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {member.department} • {member.currentTasks}{" "}
                                active tasks
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={
                              member.availability === "available"
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {member.availability}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {errors.assignedTo && (
                  <p className="text-sm text-destructive">
                    {errors.assignedTo}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a task type first to see available team members.
              </p>
            )}
          </div>

          {/* Selected Member Summary */}
          {selectedMember && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-2">
                  Task Assignment Summary
                </h4>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedMember.avatarUrl || ""} />
                    <AvatarFallback>
                      {selectedMember?.avatar ||
                        selectedMember?.name?.charAt(0) ||
                        "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{selectedMember.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedMember.department} • Currently has{" "}
                      {selectedMember.currentTasks} active tasks
                    </p>
                  </div>
                  <Badge
                    variant={
                      selectedMember.availability === "available"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {selectedMember.availability}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
