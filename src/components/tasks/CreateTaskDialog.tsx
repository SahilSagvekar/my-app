"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";

declare global {
  interface Window {
    __taskContext: {
      availableMembers: any[];
      formData: any;
      update: (field: string, value: any) => void;
    };
  }
}
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
    description: "",
    // type: "",
    assignedTo: "",
    editor: "",
    scheduler: "",
    videographer: "",
    qc_specialist: "",
    dueDate: "",
    clientId: "",
    folderType: "",
  });

  

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  // const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  
  
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  const [files, setFiles] = useState<FileList | null>(null);

  // move this up
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  // now assign context AFTER function exists
  window.__taskContext = {
    availableMembers,
    formData,
    update: handleInputChange,
  };


  // const [files, setFiles] = useState<FileList | null>(null);
  const [clients, setClients] = useState<any[]>([]);

  // const handleInputChange = (field: string, value: any) => {
  //   setFormData((prev) => ({ ...prev, [field]: value }));
  //   if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  // };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    // if (!formData.type) newErrors.type = "Task type is required";
    if (!formData.assignedTo) newErrors.assignedTo = "Please assign this task";
    if (!formData.dueDate) newErrors.dueDate = "Due date is required";
    if (!formData.clientId) newErrors.clientId = "Client is required";
    if (!formData.folderType) newErrors.folderType = "Choose folder type";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await fetch("/api/roles?all=true");
        const data = await res.json();
        setAvailableMembers(data.users || []);
      } catch {
        setAvailableMembers([]);
      }
    };
    fetchMembers();
  }, []);

  // useEffect(() => {
  //   fetchMembers();
  // }, []);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch("/api/clients");
        const raw = await res.text();
        const data = raw ? JSON.parse(raw) : {};
        setClients(Array.isArray(data.clients) ? data.clients : []);
      } catch {
        setClients([]);
      }
    };
    fetchClients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);

    try {
      const formPayload = new FormData();

      formPayload.append("description", formData.description || "");
      // formPayload.append("taskType", formData.type);
      formPayload.append("dueDate", formData.dueDate);
      formPayload.append("assignedTo", formData.assignedTo);
      formPayload.append("qc_specialist", formData.qc_specialist);
      formPayload.append("scheduler", formData.scheduler);
      formPayload.append("videographer", formData.videographer);
      formPayload.append("clientId", formData.clientId);
      formPayload.append("folderType", formData.folderType);

      if (files) {
        Array.from(files).forEach((file) => formPayload.append("files", file));
      }

      const res = await fetch("/api/tasks", {
        method: "POST",
        credentials: "include",
        body: formPayload,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create task");

      onTaskCreated?.(data);
      setFormData({
        description: "",
        // type: "",
        assignedTo: "",
        editor: "",
        scheduler: "",
        videographer: "",
        qc_specialist: "",
        dueDate: "",
        clientId: "",
        folderType: "",
      });

      setFiles(null);
      setAvailableMembers([]);
      setOpen(false);
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, submit: err.message }));
    } finally {
      setLoading(false);
    }
  };

  const selectedMember = availableMembers.find(
    (m) => String(m.id) === String(formData.assignedTo)
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

      <DialogContent className="!max-w-[1200px] w-[95vw] h-[95vh] !max-h-[95vh] overflow-y-auto bg-white border border-gray-200 rounded-lg">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Assign the task and upload files.
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

          {/* DESCRIPTION */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Add notes for the editor..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
            />
          </div>

          {/* CLIENT */}
          <div className="space-y-2">
            <Label>Client</Label>
            <Select
              value={formData.clientId}
              onValueChange={(v) => handleInputChange("clientId", v)}
            >
              <SelectTrigger
                className={errors.clientId ? "border-destructive" : ""}
              >
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clientId && (
              <p className="text-sm text-destructive">{errors.clientId}</p>
            )}
          </div>

          {/* FOLDER TYPE */}
          <div className="space-y-2">
            <Label>Folder Type</Label>
            <Select
              value={formData.folderType}
              onValueChange={(v) => handleInputChange("folderType", v)}
            >
              <SelectTrigger
                className={errors.folderType ? "border-destructive" : ""}
              >
                <SelectValue placeholder="raw footage / elements" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rawFootage">Raw Footage</SelectItem>
                <SelectItem value="essentials">Elements</SelectItem>
              </SelectContent>
            </Select>
            {errors.folderType && (
              <p className="text-sm text-destructive">{errors.folderType}</p>
            )}
          </div>

          {/* TYPE */}
          {/* <div className="space-y-2">
            <Label>Task Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => {
                handleInputChange("type", value);
                handleInputChange("assignedTo", "");
              }}
            >
              <SelectTrigger className={errors.type ? "border-destructive" : ""}>
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
            {errors.type && <p className="text-sm text-destructive">{errors.type}</p>}
          </div> */}

          {/* DUE DATE */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input
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

          {/* FILES */}
          <div className="space-y-2">
            <Label>Upload Files</Label>
            <Input type="file" multiple onChange={handleFileChange} />
            {files && (
              <ul className="text-sm mt-2 space-y-1">
                {Array.from(files).map((f, i) => (
                  <li key={i}>{f.name}</li>
                ))}
              </ul>
            )}
          </div>

          {/* ASSIGN TO */}
          {/* <div className="space-y-3">
            <Label>Assign To</Label>

            <div className="space-y-3 max-h-48 overflow-y-auto">
              {availableMembers.length > 0 ? (
                availableMembers.map((member) => (
                  <Card
                    key={member.id}
                    className={`cursor-pointer transition ${
                      String(formData.assignedTo) === String(member.id)
                        ? "border-primary bg-primary/10"
                        : "hover:bg-accent"
                    }`}
                    onClick={() =>
                      handleInputChange("assignedTo", String(member.id))
                    }
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatarUrl || ""} />
                          <AvatarFallback>
                            {member.name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <h4 className="text-sm">{member.name}</h4>
                      </div>
                      <Badge>{member.availability}</Badge>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No members available.
                </p>
              )}
            </div>

            {errors.assignedTo && (
              <p className="text-sm text-destructive">{errors.assignedTo}</p>
            )}
          </div> */}

          {/* ROLE SECTIONS */}
          <RoleAssign
            title="Assign Editor"
            role="editor"
            field="assignedTo"
            formData={formData}
            update={handleInputChange}
            availableMembers={availableMembers}
            error={errors.assignedTo}
          />

          <RoleAssign
            title="Assign Scheduler"
            role="scheduler"
            field="scheduler"
            formData={formData}
            update={handleInputChange}
            availableMembers={availableMembers}
            error={errors.assignedTo}
          />

          <RoleAssign
            title="Assign Videographer"
            role="videographer"
            field="videographer"
            formData={formData}
            update={handleInputChange}
            availableMembers={availableMembers}
            error={errors.assignedTo}
          />

          <RoleAssign
            title="Assign QC"
            role="qc"
            field="qc_specialist"
            formData={formData}
            update={handleInputChange}
            availableMembers={availableMembers}
            error={errors.assignedTo}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
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

function RoleAssign({ title, role, field, formData, update, availableMembers, error }) {
  const members = availableMembers.filter((m) => m.role === role);

  return (
    <div className="space-y-2">
      <Label>{title}</Label>

      <div className="space-y-3 max-h-48 overflow-y-auto">
        {members.length > 0 ? (
          members.map((member) => (
            <Card
              key={member.id}
              className={`cursor-pointer transition ${
                String(formData[field]) === String(member.id)
                  ? "border-primary bg-primary/10"
                  : "hover:bg-accent"
              }`}
              onClick={() => update(field, String(member.id))}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatarUrl || ""} />
                    <AvatarFallback>{member.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <h4 className="text-sm">{member.name}</h4>
                </div>
                <Badge>{member.availability}</Badge>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No members available.</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

