import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Calendar, MessageSquare, Play, CheckCircle } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { FullScreenReviewModal } from "../client/FullScreenReviewModal";
import { useTaskWorkflow, WorkflowTask } from "../workflow/TaskWorkflowEngine";
import { useNotifications } from "../NotificationContext";
import { toast } from "sonner";
import { Toaster } from "../ui/sonner";

export function ClientDashboard() {
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [showFullscreenReview, setShowFullscreenReview] = useState(false);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApprovals();
  }, []);

  async function loadApprovals() {
    try {
      setLoading(true);
      const res = await fetch("/api/tasks", { cache: "no-store" });
      const data = await res.json();

      setApprovals(
        (data.tasks || []).map((task) => {
          const mainFile = task.files?.[0] || null;
          const videoUrl =
            mainFile?.mimeType?.includes("video") ? mainFile.url : null;

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

            // REQUIRED by FullScreenReviewModal
            videoUrl,
            files: task.files || [],

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
          };
        })
      );
    } catch (err) {
      console.error("Failed to load approvals", err);
    } finally {
      setLoading(false);
    }
  }

  const { approveQCTask, rejectQCTask } = useTaskWorkflow();
  const { addNotification } = useNotifications();

  const handleOpenReview = (approval: any) => {
    // Asset is already modal-safe.
    setSelectedAsset(approval);
    setShowFullscreenReview(true);
  };

  const handleCloseReview = (open: boolean) => {
    setShowFullscreenReview(open);
    if (!open) setSelectedAsset(null);
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

      toast("Approved", {
        description: `${approval.title} approved successfully.`,
      });
    } catch {
      toast("Error", { description: "Failed to approve content." });
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

      toast("Revisions Requested", { description: reason });
    } catch {
      toast("Error", { description: "Failed to request changes." });
    }
  };

  return (
    <>
      <div className="space-y-6">
        
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-2xl font-medium">{approvals.length}</h3>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-2xl font-medium text-yellow-600">
                {approvals.filter((a) => a.status === "pending").length}
              </h3>
              <p className="text-sm text-muted-foreground">Pending</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-2xl font-medium text-green-600">
                {approvals.filter((a) => a.status === "approved").length}
              </h3>
              <p className="text-sm text-muted-foreground">Approved</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-2xl font-medium text-orange-600">
                {approvals.filter((a) => a.status === "changes-requested").length}
              </h3>
              <p className="text-sm text-muted-foreground">Changes Requested</p>
            </CardContent>
          </Card>
        </div>

        {/* Approval Grid */}
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
                  <span>Due {approval.deadline}</span>
                </div>

                {approval.comments > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    <span>{approval.comments} comments</span>
                  </div>
                )}

                {approval.requiresClientApproval ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleOpenReview(approval)}
                  >
                    Review
                  </Button>
                ) : (
                  <div className="w-full py-2 px-3 bg-muted text-center rounded-md text-xs text-muted-foreground">
                    No approval required
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

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
                (a) => a.requiresClientApproval && a.status === "pending"
              );

            if (next) handleOpenReview(next);
            else toast("No more pending assets.");
          }}
        />
      </div>

      <Toaster />
    </>
  );
}
