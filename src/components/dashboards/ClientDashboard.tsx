"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Calendar, MessageSquare, Play, CheckCircle, FileText, Download, Eye, Link as LinkIcon, ExternalLink, ChevronDown } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { FullScreenReviewModal } from "../client/FullScreenReviewModal";
import { useTaskWorkflow, WorkflowTask } from "../workflow/TaskWorkflowEngine";
import { useNotifications } from "../NotificationContext";
import { toast } from "sonner";
import { Toaster } from "../ui/sonner";

// Update folderTypes object to match API folder types
const folderTypes = {
  'main': { label: 'Main Output', icon: '✅', color: 'bg-emerald-100 text-emerald-800' },
  'script': { label: 'Script', icon: '📝', color: 'bg-blue-100 text-blue-800' },
  'voiceover': { label: 'Voice Over', icon: '🎤', color: 'bg-purple-100 text-purple-800' },
  'broll': { label: 'B-Roll', icon: '🎬', color: 'bg-green-100 text-green-800' },
  'music': { label: 'Music', icon: '🎵', color: 'bg-pink-100 text-pink-800' },
  'music-license': { label: 'Music License', icon: '📜', color: 'bg-amber-100 text-amber-800' },
  'graphics': { label: 'Graphics', icon: '🎨', color: 'bg-yellow-100 text-yellow-800' },
  'thumbnail': { label: 'Thumbnail', icon: '🖼️', color: 'bg-indigo-100 text-indigo-800' },
  'thumbnails': { label: 'Thumbnails', icon: '🖼️', color: 'bg-indigo-100 text-indigo-800' },
  'outputs': { label: 'Final Output', icon: '✅', color: 'bg-emerald-100 text-emerald-800' },
  'other': { label: 'Other', icon: '📁', color: 'bg-gray-100 text-gray-800' },
};

export function ClientDashboard() {
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [showFullscreenReview, setShowFullscreenReview] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadApprovals();
  }, []);

  async function loadApprovals() {
    try {
      setLoading(true);
      const res = await fetch("/api/tasks", { cache: "no-store" });
      const data = await res.json();

      setApprovals(
        (data.tasks || []).map((task: any) => {
          // Use files directly from API (they already have folderType)
          const filesFromAPI = (task.files || []).map((file: any) => ({
            id: file.id,
            name: file.name,
            url: file.url,
            key: file.s3Key || file.url.replace("https://" + process.env.E8_APP_S3_BUCKET_STAGING + ".s3.us-east-1.amazonaws.com/", ""),
            size: file.size || 0,
            folderType: file.folderType || 'other',
            mimeType: file.mimeType,
          }));

          // Also map driveLinks in case there are extra links not in files
          const filesFromDriveLinks = (task.driveLinks || [])
            .filter((url: string) => {
              // Skip if this URL is already in files
              return !filesFromAPI.some(f => f.url === url);
            })
            .map((url: string, index: number) => {
              const urlParts = url.split('/');
              const filename = urlParts[urlParts.length - 1];
              
              let folderType = 'other';
              if (url.includes('/music-license/')) {
                folderType = 'music-license';
              } else if (url.includes('/thumbnails/')) {
                folderType = 'thumbnails';
              } else if (url.includes('/broll/')) {
                folderType = 'broll';
              } else if (url.includes('/script/')) {
                folderType = 'script';
              } else if (url.includes('/voiceover/')) {
                folderType = 'voiceover';
              } else if (url.includes('/graphics/')) {
                folderType = 'graphics';
              } else if (url.includes('/outputs/')) {
                folderType = 'outputs';
              }

              const bucketUrl = "https://" + process.env.E8_APP_S3_BUCKET_STAGING + ".s3.us-east-1.amazonaws.com/";
              const key = url.replace(bucketUrl, "");

              return {
                id: `${task.id}-drivelink-${index}`,
                name: decodeURIComponent(filename),
                url: url,
                key: key,
                size: 0,
                folderType: folderType,
              };
            });

          // Combine files from API and driveLinks (avoiding duplicates)
          const allFiles = [...filesFromAPI, ...filesFromDriveLinks];

          const mainFile = allFiles.find(f => f.mimeType?.includes("video")) || allFiles[0] || null;
          const videoUrl = mainFile?.mimeType?.includes("video") ? mainFile.url : null;

          return {
            id: task.id,
            title: task.title,
            description: task.description,
            status: (task.status || "pending").toLowerCase(),
            submittedDate: task.createdAt,
            deadline: task.dueDate,
            submittedBy: {
              id: task.assignedTo,
              name: "Unknown User",
              avatar: "U",
            },
            requiresClientApproval: task.requiresClientReview || false,
            comments: 0,
            type: videoUrl ? "Video" : "Document",
            thumbnail: "/placeholder.png",

            videoUrl,
            files: allFiles,
            driveLinks: task.driveLinks || [],
            socialMediaLinks: Array.isArray(task.socialMediaLinks) ? task.socialMediaLinks : [],

            versions: [
              {
                id: "v1",
                number: "1",
                thumbnail: "/placeholder.png",
                duration: "0:00",
                uploadDate: task.createdAt,
                status: "client_review",
              },
            ],

            currentVersion: "v1",
            runtime: "0:00",
            platform: "Unknown",
            resolution: "Unknown",
            fileSize: mainFile ? `${Math.round(mainFile.size / 1024)} KB` : "Unknown",
            uploader: "Unknown",
            uploadDate: task.createdAt,
            approvalLocked: false,
            timestampComments: [],
            projectId: task.clientId,
          };
        })
      );
    } catch (err) {
      console.error("Failed to load approvals", err);
      toast.error("Error", {
        description: "Failed to load tasks",
      });
    } finally {
      setLoading(false);
    }
  }

  const { approveQCTask, rejectQCTask } = useTaskWorkflow();
  const { addNotification } = useNotifications();

  const handleOpenReview = (approval: any) => {
    setSelectedAsset(approval);
    setShowFullscreenReview(true);
  };

  const handleCloseReview = (open: boolean) => {
    setShowFullscreenReview(open);
    if (!open) setSelectedAsset(null);
  };

  const handleViewDetails = (task: any) => {
  console.log("🔍 Selected task details:", task);
  console.log("📎 Files:", task.files); 
  console.log("🔗 Social media links:", task.socialMediaLinks);
  setSelectedTaskDetails(task);
  setShowDetailsDialog(true);
};

  const toggleFolder = (folderType: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderType]: !prev[folderType],
    }));
  };

  const handleApproveContent = async (approval: any, feedback?: string) => {
    try {
      const workflowTask: WorkflowTask = {
        id: approval.id,
        title: approval.title,
        description: approval.description,
        type: "scheduling",
        status: "approved",
        assignedTo: approval.submittedBy.id,
        assignedToName: approval.submittedBy.name,
        assignedToRole: "editor",
        createdAt: approval.submittedDate,
        dueDate: approval.deadline,
        projectId: approval.projectId,
        files: approval.files,
        workflowStep: "qc_review",
        queuePosition: 0,
      };

      await approveQCTask(workflowTask, feedback);

      setApprovals((prev) =>
        prev.map((a) => (a.id === approval.id ? { ...a, status: "approved" } : a))
      );

      toast.success("Approved", {
        description: `${approval.title} approved successfully.`,
      });
    } catch (err) {
      console.error("Failed to approve:", err);
      toast.error("Error", { description: "Failed to approve content." });
    }
  };

  const handleRejectContent = async (approval: any, reason: string) => {
    try {
      const workflowTask: WorkflowTask = {
        id: approval.id,
        title: approval.title,
        description: approval.description,
        type: "qc_review",
        status: "pending",
        assignedTo: approval.submittedBy.id,
        assignedToName: approval.submittedBy.name,
        assignedToRole: "editor",
        createdAt: approval.submittedDate,
        dueDate: approval.deadline,
        projectId: approval.projectId,
        files: approval.files,
        workflowStep: "qc_review",
        queuePosition: 0,
      };

      await rejectQCTask(workflowTask, reason);

      setApprovals((prev) =>
        prev.map((a) =>
          a.id === approval.id ? { ...a, status: "changes-requested" } : a
        )
      );

      addNotification({
        type: "client_feedback",
        title: "Changes Requested",
        message: `${approval.title} was sent back with revisions`,
        priority: "high",
        actionRequired: true,
        user: { name: "Client", avatar: "C" },
      });

      toast.success("Revisions Requested", { description: reason });
    } catch (err) {
      console.error("Failed to reject:", err);
      toast.error("Error", { description: "Failed to request changes." });
    }
  };

  // Group files by folder type
  const getFilesByFolder = (files: any[]) => {
    return files.reduce((acc, file) => {
      const folder = file.folderType || 'other';
      if (!acc[folder]) acc[folder] = [];
      acc[folder].push(file);
      return acc;
    }, {} as Record<string, any[]>);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1>Client Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Review and approve submitted content
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-2xl font-medium">{approvals.length}</h3>
              <p className="text-sm text-muted-foreground">Total Tasks</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-2xl font-medium text-yellow-600">
                {
                  approvals.filter(
                    (a) => a.status === "pending" || a.status === "in_progress"
                  ).length
                }
              </h3>
              <p className="text-sm text-muted-foreground">Pending Review</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-2xl font-medium text-green-600">
                {
                  approvals.filter(
                    (a) =>
                      a.status === "approved" ||
                      a.status === "completed" ||
                      a.status === "scheduled"
                  ).length
                }
              </h3>
              <p className="text-sm text-muted-foreground">Completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-2xl font-medium text-orange-600">
                {
                  approvals.filter(
                    (a) =>
                      a.status === "changes-requested" ||
                      a.status === "rejected"
                  ).length
                }
              </h3>
              <p className="text-sm text-muted-foreground">Revisions</p>
            </CardContent>
          </Card>
        </div>

        {/* Approval Grid */}
        {approvals.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No tasks available</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {approvals.map((approval) => (
              <Card
                key={approval.id}
                className="overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="relative">
                  <ImageWithFallback
                    src={approval.thumbnail}
                    alt={approval.title}
                    className="w-full h-48 object-cover"
                  />
                  {approval.type === "Video" && (
                    <div
                      className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={() => handleOpenReview(approval)}
                    >
                      <Play className="h-12 w-12 text-white" />
                    </div>
                  )}

                  {/* Status badge */}
                  <Badge
                    className="absolute top-2 right-2"
                    variant={
                      approval.status === "completed" ||
                      approval.status === "scheduled"
                        ? "default"
                        : approval.status === "approved"
                        ? "default"
                        : approval.status === "pending" ||
                          approval.status === "in_progress"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {approval.status}
                  </Badge>
                </div>

                <CardContent className="p-4 space-y-3">
                  <h3 className="font-medium text-sm">{approval.title}</h3>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[8px]">
                        {approval.submittedBy.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <span>{approval.submittedBy.name}</span>
                    <span>•</span>
                    <Calendar className="h-3 w-3" />
                    <span>
                      Due {new Date(approval.deadline).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Show file and social media link counts for completed tasks */}
                  {(approval.status === "completed" ||
                    approval.status === "approved" ||
                    approval.status === "scheduled") && (
                    <div className="flex gap-2 text-xs flex-wrap">
                      {approval.files.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          {approval.files.length} file
                          {approval.files.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {approval.socialMediaLinks.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <LinkIcon className="h-3 w-3 mr-1" />
                          {approval.socialMediaLinks.length} post
                          {approval.socialMediaLinks.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {approval.requiresClientApproval &&
                    (approval.status === "pending" ||
                      approval.status === "in_progress") ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleOpenReview(approval)}
                      >
                        Review
                      </Button>
                    ) : null}

                    {/* Show details button for completed tasks */}
                    {(approval.status === "completed" ||
                      approval.status === "approved" ||
                      approval.status === "scheduled") && (
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1"
                        onClick={() => handleViewDetails(approval)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Details
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Full-Screen Review Modal */}
        <FullScreenReviewModal
          open={showFullscreenReview}
          onOpenChange={handleCloseReview}
          asset={selectedAsset}
          onApprove={(asset, final) =>
            handleApproveContent(asset, final ? "Final Approval" : "Approved")
          }
          onRequestRevisions={(asset, data) =>
            handleRejectContent(
              asset,
              `Revisions Requested:\n${data.notes || "Please adjust content"}`
            )
          }
          onNextAsset={() => {
            const currentIndex = approvals.findIndex(
              (a) => a.id === selectedAsset?.id
            );
            const next = approvals
              .slice(currentIndex + 1)
              .find(
                (a) =>
                  a.requiresClientApproval &&
                  (a.status === "pending" || a.status === "in_progress")
              );

            if (next) handleOpenReview(next);
            else toast.success("No more pending assets.");
          }}
        />

        {/* Task Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTaskDetails?.title}</DialogTitle>
              <DialogDescription>
                View completed task files and social media posts
              </DialogDescription>
            </DialogHeader>

            {selectedTaskDetails && (
              <div className="space-y-6 py-4">
                {/* Task Info */}
                <div>
                  <h4 className="font-medium mb-2">Task Information</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedTaskDetails.description ||
                      "No description provided"}
                  </p>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      Status:{" "}
                      <Badge variant="default">
                        {selectedTaskDetails.status}
                      </Badge>
                    </span>
                    <span>
                      Due:{" "}
                      {new Date(
                        selectedTaskDetails.deadline
                      ).toLocaleDateString()}
                    </span>
                    <span>
                      Submitted:{" "}
                      {new Date(
                        selectedTaskDetails.submittedDate
                      ).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Files organized by folder */}
                {selectedTaskDetails.files.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Task Files ({selectedTaskDetails.files.length})
                    </h4>

                    {Object.entries(
                      getFilesByFolder(selectedTaskDetails.files)
                    ).map(([folderType, files]) => {
                      const folderInfo =
                        folderTypes[folderType as keyof typeof folderTypes] ||
                        folderTypes.other;
                      const isExpanded = expandedFolders[folderType] !== false;

                      return (
                        <div
                          key={folderType}
                          className="border rounded-lg overflow-hidden"
                        >
                          <button
                            className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                            onClick={() => toggleFolder(folderType)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{folderInfo.icon}</span>
                              <span className="font-medium text-sm">
                                {folderInfo.label}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {files.length} file
                                {files.length !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          {isExpanded && (
                            <div className="border-t bg-muted/20">
                              {files.map((file: any) => (
                                <div
                                  key={file.id}
                                  className="p-3 border-b last:border-b-0 flex items-center justify-between gap-2"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {file.name}
                                    </p>
                                    {file.size > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        {(file.size / 1024 / 1024).toFixed(2)}{" "}
                                        MB
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex gap-2 flex-shrink-0">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      // onClick={async () => {
                                      //   try {
                                      //     const res = await fetch("/api/download", {
                                      //       method: "POST",
                                      //       headers: { "Content-Type": "application/json" },
                                      //       body: JSON.stringify({
                                      //         key: file.key,
                                      //         filename: file.name,
                                      //         action: 'view',
                                      //       }),
                                      //     });

                                      //     if (!res.ok) throw new Error('Failed to get file URL');

                                      //     const { url } = await res.json();
                                      //     window.open(url, "_blank");
                                      //   } catch (err) {
                                      //     console.error(err);
                                      //     toast.error('Error', {
                                      //       description: 'Failed to view file',
                                      //     });
                                      //   }
                                      // }}
                                      onClick={() =>
                                        window.open(file.url, "_blank")
                                      }
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      View
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(
                                            "/api/download",
                                            {
                                              method: "POST",
                                              headers: {
                                                "Content-Type":
                                                  "application/json",
                                              },
                                              body: JSON.stringify({
                                                key: file.key,
                                                filename: file.name,
                                              }),
                                            }
                                          );

                                          if (!res.ok)
                                            throw new Error(
                                              "Failed to download file"
                                            );

                                          const { url } = await res.json();

                                          const a = document.createElement("a");
                                          a.href = url;
                                          a.download = file.name;
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                        } catch (err) {
                                          console.error(err);
                                          toast.error("Error", {
                                            description:
                                              "Failed to download file",
                                          });
                                        }
                                      }}
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground border rounded-lg">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No files uploaded yet</p>
                  </div>
                )}

                {/* Social Media Links */}
                {/* {selectedTaskDetails.socialMediaLinks.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <LinkIcon className="h-4 w-4" />
                      Social Media Posts ({selectedTaskDetails.socialMediaLinks.length})
                    </h4>

                    <div className="space-y-2">
                      {selectedTaskDetails.socialMediaLinks.map((link: any, index: number) => (
                        <div
                          key={index}
                          className="border rounded-lg p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium capitalize">{link.platform}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {link.url}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Posted: {new Date(link.postedAt).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(link.url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null} */}

                {/* Social Media Links - Always show for debugging */}
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Social Media Posts (
                    {selectedTaskDetails?.socialMediaLinks?.length || 0})
                  </h4>

                  {selectedTaskDetails?.socialMediaLinks?.length > 0 ? (
                    <div className="space-y-2">
                      {selectedTaskDetails.socialMediaLinks.map(
                        (link: any, index: number) => (
                          <div
                            key={index}
                            className="border rounded-lg p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium capitalize">
                                {link.platform}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {link.url}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Posted:{" "}
                                {new Date(link.postedAt).toLocaleString()}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(link.url, "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground border rounded-lg">
                      <LinkIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No social media posts added yet</p>
                    </div>
                  )}
                </div>

                {selectedTaskDetails.files.length === 0 &&
                  selectedTaskDetails.socialMediaLinks.length === 0 && (
                    <div className="text-center py-8 border rounded-lg">
                      <p className="text-muted-foreground">
                        No files or social media posts available for this task.
                      </p>
                    </div>
                  )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Toaster />
    </>
  );
}