// components/workflow/TaskUploadSections.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { TagPicker } from "./TagPicker";
import { FileUploadDialog } from "./FileUploadDialog-Resumable";
import {
  CheckCircle,
  AlertCircle,
  Eye,
  Send,
  Trash2,
  Plus,
  ChevronDown,
  History,
  RefreshCw,
  MessageSquare,
  Clock,
} from "lucide-react";

interface UploadSection {
  folderType: string;
  label: string;
  required: boolean;
  icon: string;
  uploaded: boolean;
}

interface FileRecord {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType?: string;
  version: number;
  isActive: boolean;
  folderType: string;
  createdAt: string;
  replacedAt?: string;
}

interface FeedbackRecord {
  id: string;
  folderType: string;
  fileId?: string;
  feedback: string;
  timestamp?: string;
  category?: string;
  status: string;
  createdBy: number;
  resolvedAt?: string;
  createdAt: string;
  user?: {
    id: number;
    name: string;
    role: string;
  };
  file?: {
    id: string;
    name: string;
    version: number;
  };
}

interface TaskUploadSectionsProps {
  task: any;
  onUploadComplete: (files: any[]) => void;
  onBeforeSubmitToQC?: () => boolean; // return false to block submission
}

export function TaskUploadSections({
  task,
  onUploadComplete,
  onBeforeSubmitToQC,
}: TaskUploadSectionsProps) {
  const [sections, setSections] = useState<UploadSection[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, FileRecord[]>>({});
  const [sectionFeedback, setSectionFeedback] = useState<Record<string, FeedbackRecord[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});
  const [showFeedback, setShowFeedback] = useState<Record<string, boolean>>({});
  const [textContent, setTextContent] = useState(task.textContent || "");
  const [savingText, setSavingText] = useState(false);
  const [taskTags, setTaskTags] = useState<string[]>((task.tags || []).map((t: any) => t.name));

  const isHardPostDeliverable = (deliverableType: string) => {
    const t = (deliverableType || '').toLowerCase();
    return t.includes('hard post') || t.includes('graphic image');
  };

  const isStoryDeliverable = (deliverableType: string) => {
    const t = (deliverableType || '').toLowerCase();
    return t.includes('stories') || t.includes('story');
  };

  const isTextPostDeliverable = (deliverableType: string) => {
    return (deliverableType || '').toLowerCase().includes('text post');
  };

  const getUploadSections = (deliverableType: string): UploadSection[] => {
    if (isTextPostDeliverable(deliverableType)) return [];

    const mainSection: UploadSection = {
      folderType: "main",
      label: isHardPostDeliverable(deliverableType)
        ? "Images (PNG / JPG)"
        : isStoryDeliverable(deliverableType)
        ? "Main Task File (Video or Image)"
        : "Main Task File",
      required: true,
      icon: isHardPostDeliverable(deliverableType) ? "🖼️" : "img:/icons/main-task-file.svg",
      uploaded: false,
    };

    if (isHardPostDeliverable(deliverableType)) return [mainSection];
    const additionalSections = getAdditionalSections(deliverableType);
    return [mainSection, ...additionalSections];
  };

  const getAdditionalSections = (deliverableType: string): UploadSection[] => {
    switch (deliverableType) {
      case "Short Form Videos":
      case "Beta Short Form":
      case "Stories":
        return [
          {
            folderType: "music-license",
            label: "Music Licenses",
            required: true,
            icon: "img:/icons/music-license.svg",
            uploaded: false,
          },
          {
            folderType: "thumbnails",
            label: "Thumbnails",
            required: false,
            icon: "img:/icons/thumbnails.svg",
            uploaded: false,
          },
        ];

      case "Long Form Videos":
      case "Square Form Videos":
        return [
          {
            folderType: "thumbnails",
            label: "Thumbnails",
            required: true,
            icon: "img:/icons/thumbnails.svg",
            uploaded: false,
          },
          {
            folderType: "music-license",
            label: "Music Licenses",
            required: true,
            icon: "img:/icons/music-license.svg",
            uploaded: false,
          },
        ];

      case "Snapchat Episodes":
        return [
          {
            folderType: "tiles",
            label: "Tiles",
            required: true,
            icon: "🎨",
            uploaded: false,
          },
          {
            folderType: "music-license",
            label: "Music Licenses",
            required: true,
            icon: "img:/icons/music-license.svg",
            uploaded: false,
          },
        ];

      default:
        return [];
    }
  };

  useEffect(() => {
    const uploadSections = getUploadSections(task.deliverableType);

    // Initialize sections with uploaded status from task.files
    const taskFiles = task.files || [];
    const filesByFolder: Record<string, any[]> = {};

    taskFiles.forEach((file: any) => {
      const folderType = file.folderType || file.subfolder || "main";
      if (!filesByFolder[folderType]) {
        filesByFolder[folderType] = [];
      }
      filesByFolder[folderType].push(file);
    });

    // Update sections with uploaded status
    const updatedSections = uploadSections.map((section) => ({
      ...section,
      uploaded: filesByFolder[section.folderType]?.length > 0 || false,
    }));

    setSections(updatedSections);
    setUploadedFiles(filesByFolder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.deliverableType, task.files]);

  const handleFileUploaded = (folderType: string, files: any[]) => {
    setSections((prev) =>
      prev.map((section) =>
        section.folderType === folderType
          ? { ...section, uploaded: true }
          : section
      )
    );

    setUploadedFiles((prev) => ({
      ...prev,
      [folderType]: files,
    }));
  };

  // Check if required sections have active files
  const allRequiredFilesUploaded = () => {
    return sections.filter((s) => s.required).every((s) => s.uploaded);
  };

  const canSubmitToQC = () =>
    isTextPostDeliverable(task.deliverableType)
      ? textContent.trim().length > 0
      : allRequiredFilesUploaded();

  const handleSaveTextContent = async () => {
    setSavingText(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/text-content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textContent }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch (error) {
      console.error("Failed to save text content:", error);
      alert("Failed to save text post. Try again.");
    } finally {
      setSavingText(false);
    }
  };

  // Toggle history visibility
  const toggleHistory = (folderType: string) => {
    setShowHistory((prev: Record<string, boolean>) => ({
      ...prev,
      [folderType]: !prev[folderType],
    }));
  };

  // Toggle feedback visibility
  const toggleFeedbackVisibility = (folderType: string) => {
    setShowFeedback((prev: Record<string, boolean>) => ({
      ...prev,
      [folderType]: !prev[folderType],
    }));
  };

  // Delete file handler
  const handleDeleteFile = async (fileId: string, folderType: string) => {
    if (!confirm("Delete this file? This cannot be undone.")) return;
    
    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
      });
      
      if (!res.ok) {
        throw new Error("Failed to delete file");
      }
      
      // Remove from local state
      setUploadedFiles((prev) => ({
        ...prev,
        [folderType]: prev[folderType]?.filter((f) => f.id !== fileId) || [],
      }));
      
      // Update section uploaded status
      setSections((prev) =>
        prev.map((section) =>
          section.folderType === folderType
            ? { ...section, uploaded: (uploadedFiles[folderType]?.length || 0) > 1 }
            : section
        )
      );
      
      onUploadComplete([]);
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete file. Try again.");
    }
  };

  // Submit to QC handler
  const handleSubmitToQC = async () => {
    if (!canSubmitToQC()) return;
    if (isTextPostDeliverable(task.deliverableType)) await handleSaveTextContent();

    // 🔥 Run feedback acknowledgement gate before allowing submission
    if (onBeforeSubmitToQC && !onBeforeSubmitToQC()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "READY_FOR_QC" }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit to QC");
      }

      onUploadComplete([]);

      // Reload page to refresh task status
      window.location.reload();
    } catch (error) {
      console.error("Failed to submit to QC:", error);
      alert("Failed to submit to QC. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSection = (folderType: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [folderType]: !prev[folderType],
    }));
  };

  // Get file count for a section
  const getSectionFileCount = (folderType: string) => {
    return uploadedFiles[folderType]?.length || 0;
  };

  const renderIcon = (icon: string, className = "w-5 h-5") =>
    icon.startsWith("img:")
      ? <img src={icon.slice(4)} alt="" className={className} />
      : <span>{icon}</span>;

  return (
    <div className="space-y-1.5">

      <div className="p-2">
        <TagPicker taskId={task.id} tags={taskTags} onChange={setTaskTags} />
      </div>

      {isTextPostDeliverable(task.deliverableType) && (
        <Card className={textContent.trim() ? "border-green-500 bg-green-50/30" : "border-amber-200"}>
          <CardContent className="p-3 space-y-2">
            <h3 className="text-sm font-medium">
              Post Copy
              <span className="text-red-500 ml-0.5">*</span>
            </h3>
            <Textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              onBlur={handleSaveTextContent}
              placeholder="Write the text post copy here..."
              rows={6}
              className="text-sm"
            />
            {savingText && <p className="text-xs text-gray-500">Saving...</p>}
          </CardContent>
        </Card>
      )}

      {/* Enhanced Accordion Upload Sections with inline file info */}
      {sections.map((section) => {
        const isOpen = openSections[section.folderType] || false;
        const fileCount = getSectionFileCount(section.folderType);
        const sectionFiles = uploadedFiles[section.folderType] || [];

        return (
          <Card
            key={section.folderType}
            className={`transition-all ${section.uploaded
              ? "border-green-500 bg-green-50/30"
              : section.required
                ? "border-amber-200"
                : "border-gray-200"
              }`}
          >
            <CardContent className="p-2 !pb-2">
              {/* Enhanced Header with Summary Info */}
              <div 
                className="relative flex items-center w-full min-h-[40px] cursor-pointer"
                onClick={() => toggleSection(section.folderType)}
              >
                {/* Center Content */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none">
                  <div className="p-1 rounded shrink-0 bg-white flex items-center justify-center">
                    {renderIcon(section.icon, "w-6 h-6")}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-medium">
                      {section.label}
                      {section.required && (
                        <span className="text-red-500 ml-0.5">*</span>
                      )}
                    </h3>
                    {fileCount > 0 && (
                      <span className="text-xs text-gray-500">
                        ({fileCount} file{fileCount !== 1 ? "s" : ""})
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Right Chevron */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <ChevronDown
                    className={`h-4 w-4 text-gray-500 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </div>

              {/* Expanded Content */}
              {isOpen && (
                <div className="mt-2 space-y-2 animate-in slide-in-from-top-2">
                  {/* Show uploaded files for this section */}
                  {sectionFiles.length > 0 && (
                    <div className="space-y-1 p-1.5 bg-white/50 rounded border">
                      {sectionFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-1.5 bg-white rounded text-xs"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {renderIcon(section.icon, "w-4 h-4")}
                            <span className="font-medium truncate text-[11px]">
                              {file.name}
                            </span>
                            <span className="text-gray-500 text-[10px]">
                              ({(file.size / 1024).toFixed(0)} KB)
                            </span>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(file.url, "_blank");
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                              title="View file"
                            >
                              <Eye className="h-3 w-3 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Button */}
                  <FileUploadDialog
                    task={task}
                    subfolder={section.folderType}
                    onUploadComplete={(files) => {
                      handleFileUploaded(section.folderType, files);
                      onUploadComplete(files);
                    }}
                    trigger={
                      <button className="w-full p-2.5 border-2 border-dashed rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
                        <div className="flex flex-col items-center gap-1">
                          {renderIcon(section.icon, "w-6 h-6")}
                          <span className="text-xs font-medium text-gray-700">
                            {section.uploaded
                              ? "Upload new version"
                              : `Click to upload ${section.label.toLowerCase()}`}
                          </span>
                        </div>
                      </button>
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Compact Submit to QC Button */}
      <Button
        onClick={handleSubmitToQC}
        disabled={!canSubmitToQC() || submitting}
        className="w-full"
        size="sm"
      >
        {submitting ? (
          <>
            <div className="h-3.5 w-3.5 mr-1.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Submit to QC
          </>
        )}
      </Button>
    </div>
  );
}