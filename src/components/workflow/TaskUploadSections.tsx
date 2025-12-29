// components/workflow/TaskUploadSections.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
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
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const uploadSections = getUploadSections(task.deliverableType);
    setSections(uploadSections);
  }, [task.deliverableType]);

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
            label: "Music License",
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
            label: "Music License",
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
            label: "Music License",
            required: true,
            icon: "🎵",
            uploaded: false,
          },
        ];

      default:
        return [];
    }
  };

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
    return sections
      .filter((s) => s.required)
      .every((s) => s.uploaded);
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

  return (
    <div className="space-y-3">
      {/* Status Alert */}
      {sections.length > 1 && (
        <Alert variant={allRequiredFilesUploaded() ? "default" : "destructive"}>
          {allRequiredFilesUploaded() ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-sm text-green-700">
                ✅ All required files uploaded! Ready to submit to QC.
              </AlertDescription>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Please upload all required files (marked with *) before
                submitting to QC.
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      {/* Uploaded Files Preview (like first image) */}
      {Object.keys(uploadedFiles).length > 0 && (
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">
                Attached Files
              </span>
              <span className="text-xs text-gray-500">
                {Object.values(uploadedFiles).flat().length} files
              </span>
            </div>

            <div className="space-y-2">
              {Object.entries(uploadedFiles).map(([folderType, files]) =>
                files.map((file, idx) => (
                  <div
                    key={`${folderType}-${idx}`}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded">
                        {folderType === "main"
                          ? "🎬"
                          : folderType === "thumbnails"
                          ? "🖼️"
                          : folderType === "tiles"
                          ? "🎨"
                          : folderType === "music-license"
                          ? "🎵"
                          : "📁"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => window.open(file.url, "_blank")}
                      className="p-2 hover:bg-gray-200 rounded"
                    >
                      <Eye className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Section Cards (like first image) */}
      {sections.map((section) => {
        

        return (
          <Card
            key={section.folderType}
            className={`transition-all ${
              section.uploaded
                ? "border-green-500"
                : section.required
                ? "border-red-200"
                : "border-gray-200"
            }`}
          >
            <CardContent className="p-4">
              {/* Clickable Header */}
              <div
                className="flex items-start gap-3 mb-3 cursor-pointer"
                onClick={() => setIsOpen(!isOpen)}
              >
                <div className="p-2 bg-purple-100 rounded">
                  <span className="text-2xl">{section.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">
                      {section.label}
                      {section.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </h3>
                    {section.uploaded && (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-600 text-xs"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Uploaded
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Dropdown Icon */}
                <ChevronDown
                  className={`h-5 w-5 text-gray-500 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </div>

              {/* Collapsible Upload Section */}
              {isOpen && (
                <div className="mt-3 animate-in slide-in-from-top-2">
                  <FileUploadDialog
                    task={task}
                    subfolder={section.folderType}
                    onUploadComplete={(files) => {
                      handleFileUploaded(section.folderType, files);
                      onUploadComplete(files);
                    }}
                    trigger={
                      <button className="w-full p-6 border-2 border-dashed rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-3xl">{section.icon}</span>
                          <span className="text-sm font-medium text-gray-700">
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

      {/* 🔥 NEW: Submit to QC Button */}
      <Button
        onClick={handleSubmitToQC}
        disabled={!allRequiredFilesUploaded() || submitting}
        className="w-full"
        size="lg"
      >
        {submitting ? (
          <>
            <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Submit to QC
          </>
        )}
      </Button>
    </div>
  );
} 