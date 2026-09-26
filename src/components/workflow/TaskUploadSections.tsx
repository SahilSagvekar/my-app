// components/workflow/TaskUploadSections.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { FileUploadDialog } from "./FileUploadDialog-Resumable";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { toast } from "sonner";
import { uploadService } from "@/lib/upload-service";
import { sortTaskImages } from "@/lib/task-image-order";
import { DraggableImageGrid } from "./DraggableImageGrid";
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
  Video,
  Music,
  Image as ImageIcon,
  LayoutGrid,
  BookOpen,
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

export function classifyDeliverableType(deliverableType?: string | null, title?: string | null) {
  const dt = (deliverableType || '').trim().toLowerCase();
  const t = (title || '').trim().toLowerCase();

  if (dt) {
    if (dt === 'bsf' || dt.includes('beta')) return 'BETA_SHORT_FORM';
    if (dt === 'sf' || dt.includes('short form') || dt.includes('short-form') || dt.includes('short_form') || dt === 'short') return 'SHORT_FORM';
    if (dt === 'lf' || dt.includes('long form') || dt.includes('long-form') || dt.includes('long_form') || dt === 'long') return 'LONG_FORM';
    if (dt === 'sqf' || dt.includes('square form') || dt.includes('square-form') || dt.includes('square_form') || dt === 'square') return 'SQUARE_FORM';
    if (dt === 'sep' || dt.includes('snapchat')) return 'SNAPCHAT';
    if (dt === 'st' || dt.includes('story') || dt.includes('stories')) return 'STORIES';
    if (dt === 'hp' || dt.includes('hard post') || dt.includes('graphic image')) return 'HARD_POST';
    if (dt === 'tp' || dt.includes('text post')) return 'TEXT_POST';
  }

  if (t) {
    if (t.includes('_bsf') || t.includes('-bsf') || t.includes('betashortform')) return 'BETA_SHORT_FORM';
    if (t.includes('_sf') || t.includes('-sf') || t.includes('shortform') || t.includes('_short')) return 'SHORT_FORM';
    if (t.includes('_lf') || t.includes('-lf') || t.includes('longform') || t.includes('_long')) return 'LONG_FORM';
    if (t.includes('_sqf') || t.includes('-sqf') || t.includes('squareform')) return 'SQUARE_FORM';
    if (t.includes('_sep') || t.includes('-sep') || t.includes('snapchat')) return 'SNAPCHAT';
    if (t.includes('_st') || t.includes('-st') || t.includes('story') || t.includes('stories')) return 'STORIES';
    if (t.includes('_hp') || t.includes('-hp') || t.includes('hardpost')) return 'HARD_POST';
    if (t.includes('_tp') || t.includes('-tp') || t.includes('textpost')) return 'TEXT_POST';
  }

  return 'OTHER_VIDEO';
}

interface TaskUploadSectionsProps {
  task: any;
  onUploadComplete: (files: any[]) => void;
  onBeforeSubmitToQC?: () => boolean; // return false to block submission
  children?: React.ReactNode;
}

export function TaskUploadSections({
  task,
  onUploadComplete,
  onBeforeSubmitToQC,
  children,
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

  // 🗑️ Request deletion — editors can't delete files directly, they ask
  // admin/videographer (see POST /api/tasks/[id]/files/deletion-requests).
  // Tracks which files already have a request in flight so the button can
  // swap to a "Requested" badge instead of letting someone double-submit.
  const [pendingDeletionFileIds, setPendingDeletionFileIds] = useState<Set<string>>(new Set());
  const [requestPopoverFileId, setRequestPopoverFileId] = useState<string | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [submittingRequestFileId, setSubmittingRequestFileId] = useState<string | null>(null);

  // 🖼️ Hard-post per-image revisions — unresolved comment count per fileId,
  // so the editor can see which image among the set needs a replacement.
  const [imageFeedbackCounts, setImageFeedbackCounts] = useState<Record<string, number>>({});
  const [replacingImageId, setReplacingImageId] = useState<string | null>(null);

  // 🔀 Hard-post image order — overrides task.attachments.imageOrder as soon
  // as the editor drags a reorder, so the grid updates immediately instead
  // of waiting on a parent refetch to pass the new `task` prop back down.
  const [localImageOrder, setLocalImageOrder] = useState<string[] | null>(null);
  const [savingImageOrder, setSavingImageOrder] = useState(false);

  const handleReorderImages = async (reordered: { id: string }[]) => {
    const newOrder = reordered.map((f) => f.id);
    setLocalImageOrder(newOrder);
    try {
      setSavingImageOrder(true);
      const res = await fetch(`/api/tasks/${task.id}/image-order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageOrder: newOrder }),
      });
      if (!res.ok) throw new Error("Failed to save image order");
      toast.success("Image order saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save image order");
    } finally {
      setSavingImageOrder(false);
    }
  };

  useEffect(() => {
    if (classifyDeliverableType(task.deliverableType, task.title) !== 'HARD_POST') return;
    let cancelled = false;
    fetch(`/api/tasks/${task.id}/feedback`)
      .then((res) => (res.ok ? res.json() : { feedback: [] }))
      .then((data) => {
        if (cancelled) return;
        const counts: Record<string, number> = {};
        (data.feedback || []).forEach((fb: any) => {
          if (!fb.fileId || fb.status === "resolved") return;
          counts[fb.fileId] = (counts[fb.fileId] || 0) + 1;
        });
        setImageFeedbackCounts(counts);
      })
      .catch(() => {}); // non-critical — worst case no badge shows
    return () => { cancelled = true; };
  }, [task.id, task.deliverableType, task.title]);

  const handleReplaceImage = async (imageId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setReplacingImageId(imageId);
    try {
      await uploadService.startUpload(file, { ...task, replaceFileId: imageId }, "main", undefined, "outputs");
      toast.success("Image replaced");
      onUploadComplete([]);
    } catch (err: any) {
      toast.error(err?.message || "Failed to replace image");
    } finally {
      setReplacingImageId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tasks/${task.id}/files/deletion-requests`)
      .then((res) => (res.ok ? res.json() : { requests: [] }))
      .then((data) => {
        if (cancelled) return;
        const pending = (data.requests || []).filter((r: any) => r.status === "PENDING");
        setPendingDeletionFileIds(new Set(pending.map((r: any) => r.fileId)));
      })
      .catch(() => {}); // non-critical — worst case the button doesn't show "Requested" yet
    return () => { cancelled = true; };
  }, [task.id]);

  const classifyDeliverable = classifyDeliverableType;

  const isHardPostDeliverable = (deliverableType: string) => {
    return classifyDeliverable(deliverableType, task.title) === 'HARD_POST';
  };

  const isStoryDeliverable = (deliverableType: string) => {
    return classifyDeliverable(deliverableType, task.title) === 'STORIES';
  };

  const isTextPostDeliverable = (deliverableType: string) => {
    return classifyDeliverable(deliverableType, task.title) === 'TEXT_POST';
  };

  const getUploadSections = (deliverableType: string): UploadSection[] => {
    const category = classifyDeliverable(deliverableType, task.title);
    if (category === 'TEXT_POST') return [];

    const mainSection: UploadSection = {
      folderType: "main",
      label: category === 'HARD_POST'
        ? "Images (PNG / JPG)"
        : category === 'STORIES'
        ? "Main Task File (Video or Image)"
        : "Main Task File",
      required: true,
      icon: category === 'HARD_POST' ? "🖼️" : "img:/icons/main-task-file.svg",
      uploaded: false,
    };

    if (category === 'HARD_POST') return [mainSection];
    const additionalSections = getAdditionalSections(category);

    // Auto-discover any folders present in task.files (e.g. if editor already uploaded music-license or thumbnails)
    const existingFolderTypes = new Set(['main', ...additionalSections.map(s => s.folderType)]);
    (task.files || []).forEach((f: any) => {
      const ft = f.folderType || f.subfolder;
      if (ft && !existingFolderTypes.has(ft)) {
        existingFolderTypes.add(ft);
        additionalSections.push({
          folderType: ft,
          label: ft === 'music-license' ? 'Music Licenses' : ft === 'thumbnails' ? 'Thumbnails' : ft === 'tiles' ? 'Tiles' : ft,
          required: false,
          icon: ft === 'music-license' ? '🎵' : '📁',
          uploaded: true,
        });
      }
    });

    return [mainSection, ...additionalSections];
  };

  const getAdditionalSections = (category: string): UploadSection[] => {
    switch (category) {
      case 'SHORT_FORM':
      case 'BETA_SHORT_FORM':
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
          ...(task.client?.requiresCoverImage
            ? [
                {
                  folderType: "covers",
                  label: "Cover Images",
                  required: false,
                  icon: "📔",
                  uploaded: false,
                } as UploadSection,
              ]
            : []),
        ];

      case 'STORIES':
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

      case 'LONG_FORM':
      case 'SQUARE_FORM':
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
            required: true,
            icon: "img:/icons/thumbnails.svg",
            uploaded: false,
          },
          ...(task.client?.requiresCoverImage
            ? [
                {
                  folderType: "covers",
                  label: "Cover Images",
                  required: false,
                  icon: "📔",
                  uploaded: false,
                } as UploadSection,
              ]
            : []),
        ];

      case 'SNAPCHAT':
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
          {
            folderType: "thumbnails",
            label: "Thumbnails",
            required: false,
            icon: "img:/icons/thumbnails.svg",
            uploaded: false,
          },
        ];

      case 'OTHER_VIDEO':
      default:
        // Default video deliverables provide both Music Licenses and Thumbnails upload slots!
        return [
          {
            folderType: "music-license",
            label: "Music Licenses",
            required: false,
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
  }, [task.deliverableType, task.files, task.title]);

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

  // Request deletion handler — editors can't delete directly; this asks
  // admin/videographer to do it, with an optional reason ("uploaded the
  // wrong version" etc).
  const handleRequestDeletion = async (fileId: string) => {
    setSubmittingRequestFileId(fileId);
    try {
      const res = await fetch(`/api/tasks/${task.id}/files/deletion-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: [fileId], reason: requestReason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send request");

      setPendingDeletionFileIds((prev) => new Set(prev).add(fileId));
      setRequestPopoverFileId(null);
      setRequestReason("");
      toast.success("Deletion request sent", {
        description: "Admin or the videographer will review it shortly.",
      });
    } catch (error: any) {
      toast.error("Couldn't send request", { description: error.message || "Please try again." });
    } finally {
      setSubmittingRequestFileId(null);
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
    <div className="space-y-2">

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
        const isHardPostSection = section.folderType === "main" && isHardPostDeliverable(task.deliverableType);
        const orderedHardPostImages = isHardPostSection
          ? sortTaskImages(
              sectionFiles.filter((f: any) => f.isActive !== false),
              localImageOrder ?? (task as any).attachments?.imageOrder
            )
          : [];

        return (
          <div
            key={section.folderType}
            className="rounded-xl border border-gray-300 bg-white overflow-hidden shadow-2xs transition-all"
          >
            <div className="p-0">
              {/* Header formatted like Task Files* in mockup */}
              <div className="w-full flex items-center">
                <button
                  type="button"
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-semibold text-gray-900 hover:bg-gray-50/80 transition-colors ${isHardPostSection ? "flex-1 min-w-0" : "w-full"}`}
                  onClick={() => toggleSection(section.folderType)}
                >
                  {section.folderType === "music-license" ? (
                    <Music className="h-3.5 w-3.5 text-orange-600 shrink-0 mr-0.5" />
                  ) : section.folderType === "thumbnails" ? (
                    <ImageIcon className="h-3.5 w-3.5 text-purple-600 shrink-0 mr-0.5" />
                  ) : section.folderType === "tiles" ? (
                    <LayoutGrid className="h-3.5 w-3.5 text-blue-600 shrink-0 mr-0.5" />
                  ) : section.folderType === "covers" ? (
                    <BookOpen className="h-3.5 w-3.5 text-emerald-600 shrink-0 mr-0.5" />
                  ) : (
                    <Video className="h-3.5 w-3.5 text-gray-700 shrink-0 mr-0.5" />
                  )}
                  <span>
                    {section.folderType === "main" ? "Task Files" : section.label}
                    {section.required && <span className="text-red-500">*</span>}
                  </span>
                  <span className="text-gray-500 font-normal text-xs">
                    ({fileCount} file{fileCount !== 1 ? "s" : ""})
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-gray-400 transition-transform ml-0.5 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </div>

              {/* Expanded Content */}
              {isOpen && (
                <div className="mt-2 space-y-2 animate-in slide-in-from-top-2">
                  {/* Hard-post images: one tile per active image, each with its
                      own Replace control + unresolved-comment badge, so a
                      revision on image 3 replaces just that image instead of
                      piling on a 6th one. */}
                  {isHardPostSection ? (
                    orderedHardPostImages.length > 0 && (
                      <DraggableImageGrid
                        items={orderedHardPostImages as any[]}
                        onReorder={handleReorderImages}
                        isSaving={savingImageOrder}
                        className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-1.5"
                        renderTile={(img: any, idx: number) => {
                          const commentCount = imageFeedbackCounts[img.id] || 0;
                          const isReplacing = replacingImageId === img.id;
                          return (
                            <div key={img.id} className="relative rounded-lg border overflow-hidden bg-gray-100 group">
                              <img
                                src={img.url}
                                alt={img.name}
                                draggable={false}
                                className="w-full aspect-square object-cover"
                              />
                              <div className="absolute top-1 left-1 text-[10px] font-medium bg-black/60 text-white px-1.5 py-0.5 rounded">
                                #{idx + 1}
                              </div>
                              {commentCount > 0 && (
                                <div
                                  className="absolute top-1 right-1 flex items-center gap-0.5 text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full"
                                  title={`${commentCount} unresolved comment${commentCount !== 1 ? "s" : ""}`}
                                >
                                  <MessageSquare className="h-2.5 w-2.5" />
                                  {commentCount}
                                </div>
                              )}
                              <label
                                className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/70 text-white text-[11px] font-medium py-1 cursor-pointer hover:bg-black/85 transition-colors"
                                title="Replace this image"
                              >
                                {isReplacing ? (
                                  <>
                                    <RefreshCw className="h-3 w-3 animate-spin" /> Replacing...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="h-3 w-3" /> Replace
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/jpg,image/webp"
                                  className="hidden"
                                  disabled={isReplacing}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (file) handleReplaceImage(img.id, file);
                                  }}
                                />
                              </label>
                            </div>
                          );
                        }}
                      />
                    )
                  ) : sectionFiles.length > 0 && (
                    <div className="space-y-1 p-1.5 bg-white/50 rounded border">
                      {sectionFiles.map((file, idx) => {
                        const isPending = pendingDeletionFileIds.has(file.id);
                        return (
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
                            {isPending ? (
                              <span
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-medium whitespace-nowrap"
                                title="Waiting on admin or videographer"
                              >
                                <Clock className="h-2.5 w-2.5" />
                                Requested
                              </span>
                            ) : (
                              <Popover
                                open={requestPopoverFileId === file.id}
                                onOpenChange={(open) => {
                                  setRequestPopoverFileId(open ? file.id : null);
                                  if (!open) setRequestReason("");
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1 hover:bg-red-100 rounded"
                                    title="Request deletion — uploaded the wrong file?"
                                  >
                                    <Trash2 className="h-3 w-3 text-gray-500 hover:text-red-500" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-72 text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <p className="font-medium mb-1">Request deletion?</p>
                                  <p className="text-xs text-gray-500 mb-2">
                                    Admin or the videographer will review and delete it — you can't undo this once they approve.
                                  </p>
                                  <Textarea
                                    value={requestReason}
                                    onChange={(e) => setRequestReason(e.target.value)}
                                    placeholder="Why? (optional) e.g. wrong version uploaded"
                                    className="text-xs mb-2 min-h-[60px]"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => { setRequestPopoverFileId(null); setRequestReason(""); }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      disabled={submittingRequestFileId === file.id}
                                      onClick={() => handleRequestDeletion(file.id)}
                                    >
                                      {submittingRequestFileId === file.id ? "Sending..." : "Send Request"}
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </div>
                        );
                      })}
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
            </div>
          </div>
        );
      })}

      {/* Task Actions Slot */}
      {children}

      {/* Mockup-styled Submit to QC Button */}
      <Button
        onClick={handleSubmitToQC}
        disabled={!canSubmitToQC() || submitting}
        className="w-full h-10 rounded-xl bg-black text-white hover:bg-neutral-800 font-semibold text-[13px] shadow-xs transition-colors flex items-center justify-center gap-2"
        size="sm"
      >
        {submitting ? (
          <>
            <div className="h-3.5 w-3.5 mr-1.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-3.5 w-3.5 mr-2" />
            Submit to QC
          </>
        )}
      </Button>
    </div>
  );
}