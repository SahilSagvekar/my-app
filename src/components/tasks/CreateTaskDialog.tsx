"use client";

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

declare global {
  interface Window {
    __taskContext: {
      availableMembers: any[];
      formData: any;
      update: (field: string, value: any) => void;
    };
  }
}

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
  { value: "coordination", label: "Project Coordination", roles: ["scheduler"] },
];

export function CreateTaskDialog({ trigger, onTaskCreated }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);

  // ------------ form data (include monthlyDeliverableId) ------------
  const [formData, setFormData] = useState({
    description: "",
    assignedTo: "",
    editor: "",
    scheduler: "",
    videographer: "",
    qc_specialist: "",
    dueDate: "",
    clientId: "",
    folderType: "",
    monthlyDeliverableId: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // list of available people for roles
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  const [files, setFiles] = useState<FileList | null>(null);

  // --- clients must be declared BEFORE any effect which references it ---
  const [clients, setClients] = useState<any[]>([]);

  // deliverables derived from selected client
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [selectedDeliverable, setSelectedDeliverable] = useState<string>("");

  // helper to update form
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  // expose lightweight context for outside scripts if needed
  useEffect(() => {
    window.__taskContext = {
      availableMembers,
      formData,
      update: handleInputChange,
    };
  }, [availableMembers, formData]);

  // reload members every time dialog opens
  useEffect(() => {
    if (!open) return;

    async function fetchMembers() {
      try {
        const res = await fetch("/api/roles?all=true");
        if (!res.ok) throw new Error("Failed to load members");
        const data = await res.json();
        setAvailableMembers(data.users || []);
      } catch {
        setAvailableMembers([]);
      }
    }

    fetchMembers();
  }, [open]);

  // fetch clients once (on mount)
  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch("/api/clients");
        if (!res.ok) {
          // try text parse fallback
          const txt = await res.text();
          const parsed = txt ? JSON.parse(txt) : {};
          setClients(Array.isArray(parsed.clients) ? parsed.clients : []);
          return;
        }
        const data = await res.json();
        setClients(Array.isArray(data.clients) ? data.clients : []);
      } catch (err) {
        setClients([]);
      }
    }
    fetchClients();
  }, []);

  // when clientId changes, populate deliverables from embedded clients or fetch endpoint
  useEffect(() => {
    async function populateDeliverables() {
      if (!formData.clientId) {
        setDeliverables([]);
        setSelectedDeliverable("");
        handleInputChange("monthlyDeliverableId", "");
        return;
      }

      const client = clients.find((c) => String(c.id) === String(formData.clientId));

      if (client && Array.isArray(client.monthlyDeliverables)) {
        // filter to only items with valid ids
        const filtered = client.monthlyDeliverables.filter((d: any) => d && d.id && String(d.id).trim() !== "");
        setDeliverables(filtered);
        if (filtered.length === 1) {
          setSelectedDeliverable(filtered[0].id);
          handleInputChange("monthlyDeliverableId", filtered[0].id);
        } else {
          setSelectedDeliverable("");
          handleInputChange("monthlyDeliverableId", "");
        }
        return;
      }

      // fallback: fetch from API endpoint for client deliverables (if available)
      try {
        const res = await fetch(`/api/clients/${formData.clientId}/deliverables`);
        if (!res.ok) throw new Error("no deliverables");
        const payload = await res.json();
        const list = Array.isArray(payload.monthlyDeliverables) ? payload.monthlyDeliverables : [];
        const filtered = list.filter((d: any) => d && d.id && String(d.id).trim() !== "");
        setDeliverables(filtered);
        if (filtered.length === 1) {
          setSelectedDeliverable(filtered[0].id);
          handleInputChange("monthlyDeliverableId", filtered[0].id);
        } else {
          setSelectedDeliverable("");
          handleInputChange("monthlyDeliverableId", "");
        }
      } catch {
        setDeliverables([]);
        setSelectedDeliverable("");
        handleInputChange("monthlyDeliverableId", "");
      }
    }

    populateDeliverables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.clientId, clients]);

  // file input handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.assignedTo) newErrors.assignedTo = "Please assign this task";
    if (!formData.dueDate) newErrors.dueDate = "Due date is required";
    if (!formData.clientId) newErrors.clientId = "Client is required";
    if (!formData.folderType) newErrors.folderType = "Choose folder type";
    if (!formData.monthlyDeliverableId) newErrors.monthlyDeliverableId = "Choose a deliverable for this task";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!validateForm()) return;
  setLoading(true);

  if (formData.monthlyDeliverableId === "__no_deliverables__") {
    setErrors((prev) => ({ ...prev, monthlyDeliverableId: "Choose a valid deliverable" }));
    setLoading(false);
    return;
  }

  try {
    const formPayload = new FormData();

    formPayload.append("description", formData.description || "");
    formPayload.append("dueDate", formData.dueDate);
    formPayload.append("assignedTo", String(formData.assignedTo));
    formPayload.append("qc_specialist", String(formData.qc_specialist || ""));
    formPayload.append("scheduler", String(formData.scheduler || ""));
    formPayload.append("videographer", String(formData.videographer || ""));
    formPayload.append("clientId", formData.clientId);
    formPayload.append("folderType", formData.folderType);
    formPayload.append("monthlyDeliverableId", formData.monthlyDeliverableId);

    // 🔥 DEBUG: Log what we're sending
    console.log("📤 SENDING TO API:");
    console.log("- clientId:", formData.clientId);
    console.log("- monthlyDeliverableId:", formData.monthlyDeliverableId);
    
    // Find the actual deliverable to see its type
    const deliverable = deliverables.find(d => String(d.id) === String(formData.monthlyDeliverableId));
    console.log("- Deliverable type:", deliverable?.type);
    console.log("- Full deliverable:", deliverable);

    if (files) {
      Array.from(files).forEach((file) => formPayload.append("files", file));
    }

    const res = await fetch("/api/tasks", {
      method: "POST",
      credentials: "include",
      body: formPayload,
    });

    const data = await res.json();
    
    // 🔥 DEBUG: Log what we got back
    console.log("📥 RECEIVED FROM API:", data);
    
    if (!res.ok) throw new Error(data.message || "Failed to create task");

    onTaskCreated?.(data);

      setFormData({
        description: "",
        assignedTo: "",
        editor: "",
        scheduler: "",
        videographer: "",
        qc_specialist: "",
        dueDate: "",
        clientId: "",
        folderType: "",
        monthlyDeliverableId: "",
      });

      setFiles(null);
      setAvailableMembers([]);
      setDeliverables([]);
      setSelectedDeliverable("");
      setOpen(false);
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, submit: err.message }));
    } finally {
      setLoading(false);
    }
  };

  const selectedMember = availableMembers.find((m) => String(m.id) === String(formData.assignedTo));

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
          <DialogDescription>Assign the task and upload files.</DialogDescription>

          {user && (
            <div className="text-xs text-muted-foreground">
              Creating as: {user.name} ({user.role})
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.submit && <p className="text-sm text-destructive">{errors.submit}</p>}

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Add notes for the editor..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={formData.clientId} onValueChange={(v) => handleInputChange("clientId", v)}>
              <SelectTrigger className={errors.clientId ? "border-destructive" : ""}>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={String(client.id)}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clientId && <p className="text-sm text-destructive">{errors.clientId}</p>}
          </div>

          {/* Folder type */}
          <div className="space-y-2">
            <Label>Folder Type</Label>
            <Select value={formData.folderType} onValueChange={(v) => handleInputChange("folderType", v)}>
              <SelectTrigger className={errors.folderType ? "border-destructive" : ""}>
                <SelectValue placeholder="raw footage / elements" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rawFootage">Raw Footage</SelectItem>
                <SelectItem value="essentials">Elements</SelectItem>
              </SelectContent>
            </Select>
            {errors.folderType && <p className="text-sm text-destructive">{errors.folderType}</p>}
          </div>

          {/* MONTHLY DELIVERABLE */}
          <div className="space-y-2">
            <Label>Monthly Deliverable</Label>
            <Select
              value={formData.monthlyDeliverableId || selectedDeliverable || ""}
              onValueChange={(v) => {
                if (v === "__no_deliverables__") return;
                handleInputChange("monthlyDeliverableId", v);
                setSelectedDeliverable(v);
              }}
            >
              <SelectTrigger className={errors.monthlyDeliverableId ? "border-destructive" : ""}>
                <SelectValue placeholder="Select deliverable for this task" />
              </SelectTrigger>

              <SelectContent>
                {deliverables.length > 0 ? (
                  deliverables.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.type} {d.quantity ? `— ${d.quantity}` : ""}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__no_deliverables__" disabled>
                    No deliverables found for selected client
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            {errors.monthlyDeliverableId && <p className="text-sm text-destructive">{errors.monthlyDeliverableId}</p>}
          </div>

          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input
              type="date"
              value={formData.dueDate}
              onChange={(e) => handleInputChange("dueDate", e.target.value)}
              className={errors.dueDate ? "border-destructive" : ""}
              min={new Date().toISOString().split("T")[0]}
            />
            {errors.dueDate && <p className="text-sm text-destructive">{errors.dueDate}</p>}
          </div>

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
            title="Assign Editor"
            role="editor"
            field="assignedTo"
            formData={formData}
            update={handleInputChange}
            availableMembers={availableMembers}
            error={errors.assignedTo}
          />

          <RoleAssign
            title="Assign QC"
            role="qc_specialist"
            field="qc_specialist"
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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

function RoleAssign({ title, role, field, formData, update, availableMembers, error }: any) {
  const members = availableMembers.filter((m) => m.role === role);

  return (
    <div className="space-y-2">
      <Label>{title}</Label>

      <Select value={formData[field] || ""} onValueChange={(v) => update(field, v)}>
        <SelectTrigger className={members.length === 0 ? "text-muted-foreground" : ""}>
          <SelectValue placeholder="Select a member" />
        </SelectTrigger>
        <SelectContent className="max-h-48 overflow-y-auto">
          {members.length > 0 ? (
            members.map((member: any) => (
              <SelectItem key={member.id} value={String(member.id)}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.avatarUrl || ""} />
                      <AvatarFallback>{member.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{member.name}</span>
                  </div>
                  {member.availability ? (
                    <Badge>{member.availability}</Badge>
                  ) : null}
                </div>
              </SelectItem>
            ))
          ) : (
            <SelectItem value="__no_members__" disabled>
              No members available
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
