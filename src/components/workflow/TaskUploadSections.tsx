// components/workflow/TaskUploadSections.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import { FileUploadDialog } from "./FileUploadDialog-Resumable";
import { CheckCircle, AlertCircle, Eye, Send, Trash2, Plus } from "lucide-react";
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

  useEffect(() => {
    const uploadSections = getUploadSections(task.deliverableType);
    setSections(uploadSections);
    
    // Open all sections by default
    const initialOpen: Record<string, boolean> = {};
    uploadSections.forEach(section => {
      initialOpen[section.folderType] = true;
    });
    setOpenSections(initialOpen);
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

  // 🔥 NEW: Handle multiple file uploads
  const handleFileUploaded = (folderType: string, newFiles: any[]) => {
    setSections((prev) =>
      prev.map((section) =>
        section.folderType === folderType
          ? { ...section, uploaded: true }
          : section
      )
    );
    
    // Append new files to existing files
    setUploadedFiles((prev) => ({
      ...prev,
      [folderType]: [...(prev[folderType] || []), ...newFiles],
    }));
  };

  // 🔥 NEW: Remove a specific file
  const handleRemoveFile = (folderType: string, fileIndex: number) => {
    setUploadedFiles((prev) => {
      const updatedFiles = [...(prev[folderType] || [])];
      updatedFiles.splice(fileIndex, 1);
      
      // Update section uploaded status
      if (updatedFiles.length === 0) {
        setSections((prevSections) =>
          prevSections.map((section) =>
            section.folderType === folderType
              ? { ...section, uploaded: false }
              : section
          )
        );
      }
      
      return {
        ...prev,
        [folderType]: updatedFiles,
      };
    });
  };

  // 🔥 UPDATED: Check if at least one file uploaded for required sections
  const allRequiredFilesUploaded = () => {
    return sections
      .filter((s) => s.required)
      .every((s) => {
        const files = uploadedFiles[s.folderType] || [];
        return files.length > 0;
      });
  };

  // Toggle section open/closed
  const toggleSection = (folderType: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [folderType]: !prev[folderType],
    }));
  };

  // Submit to QC handler
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

      onUploadComplete([]);
      window.location.reload();
    } catch (error) {
      console.error("Failed to submit to QC:", error);
      alert("Failed to submit to QC. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Get total file count
  const getTotalFileCount = () => {
    return Object.values(uploadedFiles).flat().length;
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
                Please upload at least one file for each required section (marked with *) before submitting to QC.
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      {/* Overall Uploaded Files Summary */}
      {getTotalFileCount() > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-700">
                📎 Total Attached Files
              </span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {getTotalFileCount()} files
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Section Cards */}
      {sections.map((section) => {
        const sectionFiles = uploadedFiles[section.folderType] || [];
        const isOpen = openSections[section.folderType];
        const hasFiles = sectionFiles.length > 0;

        return (
          <Card
            key={section.folderType}
            className={`transition-all ${
              hasFiles
                ? "border-green-500"
                : section.required
                ? "border-red-200"
                : "border-gray-200"
            }`}
          >
            <CardContent className="p-4">
              {/* Clickable Header */}
              <div
                className="flex items-start gap-3 cursor-pointer"
                onClick={() => toggleSection(section.folderType)}
              >
                <div className="p-2 bg-purple-100 rounded">
                  <span className="text-2xl">{section.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-medium">
                      {section.label}
                      {section.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </h3>
                    {hasFiles && (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-600 text-xs"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {sectionFiles.length} file{sectionFiles.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                    {section.required && !hasFiles && (
                      <Badge variant="destructive" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {section.required 
                      ? "Upload at least 1 file. You can add multiple files."
                      : "Optional. You can upload multiple files if needed."}
                  </p>
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
                <div className="mt-4 space-y-3 animate-in slide-in-from-top-2">
                  {/* Display uploaded files */}
                  {sectionFiles.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {sectionFiles.map((file, idx) => (
                        <div
                          key={`${section.folderType}-${idx}`}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded border hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="p-2 bg-white rounded">
                              <span className="text-xl">{section.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file.name}</p>
                              <p className="text-xs text-gray-500">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => window.open(file.url, "_blank")}
                              className="p-2 hover:bg-gray-200 rounded transition-colors"
                              title="View file"
                            >
                              <Eye className="h-4 w-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => handleRemoveFile(section.folderType, idx)}
                              className="p-2 hover:bg-red-100 rounded transition-colors"
                              title="Remove file"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
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
                      <button className="w-full p-6 border-2 border-dashed rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
                        <div className="flex flex-col items-center gap-2">
                          {hasFiles ? (
                            <Plus className="h-8 w-8 text-purple-500" />
                          ) : (
                            <span className="text-3xl">{section.icon}</span>
                          )}
                          <span className="text-sm font-medium text-gray-700">
                            {hasFiles
                              ? `Add more ${section.label.toLowerCase()}`
                              : `Click to upload ${section.label.toLowerCase()}`}
                          </span>
                          <span className="text-xs text-gray-500">
                            You can upload multiple files
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

      {/* Submit to QC Button */}
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
            Submit to QC ({getTotalFileCount()} files)
          </>
        )}
      </Button>
    </div>
  );
}