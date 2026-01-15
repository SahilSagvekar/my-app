// components/workflow/TaskUploadSections.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { FileUploadDialog } from "./FileUploadDialog-Resumable";
import { CheckCircle, AlertCircle, Eye, Send } from "lucide-react";
import { ChevronDown } from "lucide-react";

interface UploadSection {
  folderType: string;
  label: string;
  required: boolean;
  icon: string;
  uploaded: boolean;
}

interface TaskUploadSectionsProps {
  task: any;
  onUploadComplete: (files: any[]) => void;
}

export function TaskUploadSections({
  task,
  onUploadComplete,
}: TaskUploadSectionsProps) {
  const [sections, setSections] = useState<UploadSection[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, any[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const getUploadSections = (deliverableType: string): UploadSection[] => {
    const mainSection: UploadSection = {
      folderType: "main",
      label: "Main Task File",
      required: true,
      icon: "🎬",
      uploaded: false,
    };

    const additionalSections = getAdditionalSections(deliverableType);
    return [mainSection, ...additionalSections];
  };

  const getAdditionalSections = (deliverableType: string): UploadSection[] => {
    switch (deliverableType) {
      case "Short Form Videos":
      case "Beta Short Form":
        return [
          {
            folderType: "music-license",
            label: "Music Licenses",
            required: true,
            icon: "🎵",
            uploaded: false,
          },
          {
            folderType: "thumbnails",
            label: "Thumbnails",
            required: false,
            icon: "🖼️",
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
            icon: "🖼️",
            uploaded: false,
          },
          {
            folderType: "music-license",
            label: "Music Licenses",
            required: true,
            icon: "🎵",
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
            icon: "🎵",
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

  const allRequiredFilesUploaded = () => {
    return sections.filter((s) => s.required).every((s) => s.uploaded);
  };

  // 🔥 NEW: Submit to QC handler
  const handleSubmitToQC = async () => {
    if (!allRequiredFilesUploaded()) return;

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

      // Notify parent component
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

  return (
    <div className="space-y-1.5">
      {/* Compact Status Bar */}
      <div
        className={`flex items-center justify-between px-2 py-1 rounded text-xs ${
          allRequiredFilesUploaded()
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-amber-50 text-amber-700 border border-amber-200"
        }`}
      >
        <div className="flex items-center gap-1.5">
          {allRequiredFilesUploaded() ? (
            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
          )}
          <span className="font-medium">
            {allRequiredFilesUploaded()
              ? "Ready to Submit"
              : `${sections.filter((s) => s.required && s.uploaded).length}/${
                  sections.filter((s) => s.required).length
                } Required Uploaded`}
          </span>
        </div>
        {Object.keys(uploadedFiles).length > 0 && (
          <span className="text-[10px] opacity-75">
            {Object.values(uploadedFiles).flat().length} file
            {Object.values(uploadedFiles).flat().length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Enhanced Accordion Upload Sections with inline file info */}
      {sections.map((section) => {
        const isOpen = openSections[section.folderType] || false;
        const fileCount = getSectionFileCount(section.folderType);
        const sectionFiles = uploadedFiles[section.folderType] || [];

        return (
          <Card
            key={section.folderType}
            className={`transition-all ${
              section.uploaded
                ? "border-green-500 bg-green-50/30"
                : section.required
                ? "border-amber-200"
                : "border-gray-200"
            }`}
          >
            <CardContent className="p-2">
              {/* Enhanced Header with Summary Info */}
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                  onClick={() => toggleSection(section.folderType)}
                >
                  <div
                    className={`p-1 rounded shrink-0 ${
                      section.uploaded ? "bg-green-100" : "bg-purple-100"
                    }`}
                  >
                    <span className="text-base">{section.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-xs font-medium truncate">
                        {section.label}
                        {section.required && (
                          <span className="text-red-500 ml-0.5">*</span>
                        )}
                      </h3>
                      {section.uploaded && (
                        <Badge
                          variant="outline"
                          className="text-green-600 border-green-600 text-[10px] px-1 py-0 h-3.5"
                        >
                          <CheckCircle className="h-2 w-2 mr-0.5" />
                          Done
                        </Badge>
                      )}
                      {fileCount > 0 && (
                        <span className="text-[10px] text-gray-500">
                          ({fileCount} file{fileCount !== 1 ? "s" : ""})
                        </span>
                      )}
                    </div>
                    {/* Show file names when collapsed */}
                    {!isOpen && sectionFiles.length > 0 && (
                      <div className="mt-0.5">
                        {sectionFiles.slice(0, 2).map((file, idx) => (
                          <p
                            key={idx}
                            className="text-[10px] text-gray-600 truncate"
                          >
                            • {file.name}
                          </p>
                        ))}
                        {sectionFiles.length > 2 && (
                          <p className="text-[10px] text-gray-500">
                            +{sectionFiles.length - 2} more
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-gray-500 transition-transform shrink-0 ${
                      isOpen ? "rotate-180" : ""
                    }`}
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
                            <span className="text-xs">{section.icon}</span>
                            <span className="font-medium truncate text-[11px]">
                              {file.name}
                            </span>
                            <span className="text-gray-500 text-[10px]">
                              ({(file.size / 1024).toFixed(0)} KB)
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(file.url, "_blank");
                            }}
                            className="p-1 hover:bg-gray-200 rounded ml-2"
                          >
                            <Eye className="h-3 w-3 text-gray-600" />
                          </button>
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
                          <span className="text-lg">{section.icon}</span>
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
        disabled={!allRequiredFilesUploaded() || submitting}
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
