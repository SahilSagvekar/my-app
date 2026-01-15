// components/workflow/TaskUploadSections.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
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
  RefreshCw
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

interface TaskUploadSectionsProps {
  task: any;
  onUploadComplete: (files: any[]) => void;
}

export function TaskUploadSections({
  task,
  onUploadComplete,
}: TaskUploadSectionsProps) {
  const [sections, setSections] = useState<UploadSection[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, FileRecord[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // 🔥 Fetch existing files from database on mount
  useEffect(() => {
    fetchExistingFiles();
  }, [task.id]);

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

  // 🔥 NEW: Fetch existing files from database
  const fetchExistingFiles = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tasks/${task.id}/files`);
      
      if (!res.ok) {
        console.error("Failed to fetch files");
        return;
      }

      const data = await res.json();
      const files: FileRecord[] = data.files || [];

      // Group files by folderType
      const grouped: Record<string, FileRecord[]> = {};
      files.forEach((file: FileRecord) => {
        const folderType = file.folderType || "main";
        if (!grouped[folderType]) {
          grouped[folderType] = [];
        }
        grouped[folderType].push(file);
      });

      // Sort each group by version (newest first)
      Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => b.version - a.version);
      });

      setUploadedFiles(grouped);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  };

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

  // 🔥 Handle file upload - refresh from database
  const handleFileUploaded = async (folderType: string, newFiles: any[]) => {
    // Refresh files from database to get updated versions
    await fetchExistingFiles();
    
    setSections((prev) =>
      prev.map((section) =>
        section.folderType === folderType
          ? { ...section, uploaded: true }
          : section
      )
    );
  };

  // 🔥 Get active files for a section
  const getActiveFiles = (folderType: string): FileRecord[] => {
    const files = uploadedFiles[folderType] || [];
    return files.filter(f => f.isActive);
  };

  // 🔥 Get inactive (historical) files for a section
  const getHistoricalFiles = (folderType: string): FileRecord[] => {
    const files = uploadedFiles[folderType] || [];
    return files.filter(f => !f.isActive);
  };

  // Check if required sections have active files
  const allRequiredFilesUploaded = () => {
    return sections
      .filter((s) => s.required)
      .every((s) => {
        const activeFiles = getActiveFiles(s.folderType);
        return activeFiles.length > 0;
      });
  };

  // Toggle section open/closed
  const toggleSection = (folderType: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [folderType]: !prev[folderType],
    }));
  };

  // Toggle history visibility
  const toggleHistory = (folderType: string) => {
    setShowHistory((prev) => ({
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

  // Get total active file count
  const getTotalFileCount = () => {
    return Object.values(uploadedFiles)
      .flat()
      .filter(f => f.isActive)
      .length;
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading files...</span>
      </div>
    );
  }

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
                📎 Total Active Files
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
        const activeFiles = getActiveFiles(section.folderType);
        const historicalFiles = getHistoricalFiles(section.folderType);
        const isOpen = openSections[section.folderType];
        const hasActiveFiles = activeFiles.length > 0;
        const hasHistory = historicalFiles.length > 0;
        const isHistoryOpen = showHistory[section.folderType];

        return (
          <Card
            key={section.folderType}
            className={`transition-all ${
              hasActiveFiles
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
                    {hasActiveFiles && (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-600 text-xs"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        v{activeFiles[0].version}
                      </Badge>
                    )}
                    {hasHistory && (
                      <Badge variant="secondary" className="text-xs">
                        <History className="h-3 w-3 mr-1" />
                        {historicalFiles.length} prev
                      </Badge>
                    )}
                    {section.required && !hasActiveFiles && (
                      <Badge variant="destructive" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {section.required 
                      ? "Upload required. New uploads replace the current version."
                      : "Optional. New uploads replace the current version."}
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-gray-500 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </div>

              {/* Collapsible Upload Section */}
              {isOpen && (
                <div className="mt-4 space-y-3 animate-in slide-in-from-top-2">
                  
                  {/* 🔥 Current Active Files */}
                  {activeFiles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                        Current Version
                      </p>
                      {activeFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 bg-green-50 rounded border border-green-200 hover:border-green-300 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="p-2 bg-white rounded">
                              <span className="text-xl">{section.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">{file.name}</p>
                                <Badge className="bg-green-600 text-xs">v{file.version}</Badge>
                              </div>
                              <p className="text-xs text-gray-500">
                                {formatSize(file.size)} • {formatDate(file.createdAt)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => window.open(file.url, "_blank")}
                            className="p-2 hover:bg-green-100 rounded transition-colors"
                            title="View file"
                          >
                            <Eye className="h-4 w-4 text-green-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 🔥 Version History (Collapsible) */}
                  {hasHistory && (
                    <div className="space-y-2">
                      <button
                        onClick={() => toggleHistory(section.folderType)}
                        className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <History className="h-3 w-3" />
                        <span>Previous Versions ({historicalFiles.length})</span>
                        <ChevronDown
                          className={`h-3 w-3 transition-transform ${
                            isHistoryOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      
                      {isHistoryOpen && (
                        <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                          {historicalFiles.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 opacity-70 hover:opacity-100 transition-opacity"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm truncate">{file.name}</p>
                                    <Badge variant="secondary" className="text-xs">v{file.version}</Badge>
                                  </div>
                                  <p className="text-xs text-gray-400">
                                    {formatSize(file.size)} • Replaced {file.replacedAt ? formatDate(file.replacedAt) : ''}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => window.open(file.url, "_blank")}
                                className="p-2 hover:bg-gray-200 rounded transition-colors"
                                title="View old version"
                              >
                                <Eye className="h-4 w-4 text-gray-500" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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
                          {hasActiveFiles ? (
                            <>
                              <RefreshCw className="h-8 w-8 text-purple-500" />
                              <span className="text-sm font-medium text-gray-700">
                                Upload New Version
                              </span>
                              <span className="text-xs text-gray-500">
                                Current v{activeFiles[0].version} will be archived
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-3xl">{section.icon}</span>
                              <span className="text-sm font-medium text-gray-700">
                                Click to upload {section.label.toLowerCase()}
                              </span>
                              <span className="text-xs text-gray-500">
                                This will be version 1
                              </span>
                            </>
                          )}
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