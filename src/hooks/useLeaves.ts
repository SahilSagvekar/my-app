import { api } from "@/lib/api";

export function useLeaves() {

  function approveLeave(leaveId: number) {
    return api(`/api/leave/${leaveId}/approve`, {
      method: "PATCH"
    });
  }

  function rejectLeave(leaveId: number) {
    return api(`/api/leave/${leaveId}/reject`, {
      method: "PATCH"
    });
  }

  return { approveLeave, rejectLeave };
}
