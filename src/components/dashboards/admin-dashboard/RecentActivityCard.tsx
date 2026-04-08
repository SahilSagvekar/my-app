"use client";

import { TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import type { ActivityData } from "./types";

interface RecentActivityCardProps {
  recentActivity: ActivityData[];
}

function getStatusClassName(status: ActivityData["status"]) {
  switch (status) {
    case "success":
      return "bg-green-500";
    case "error":
      return "bg-red-500";
    case "warning":
      return "bg-yellow-500";
    default:
      return "bg-blue-500";
  }
}

export function RecentActivityCard({
  recentActivity,
}: RecentActivityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-4">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 border-b pb-3 last:border-b-0"
              >
                <div
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full ${getStatusClassName(activity.status)}`}
                />

                <div className="min-w-0 flex-1">
                  <p className="text-sm">{activity.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activity.time}
                    {activity.user ? ` • ${activity.user}` : ""}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No recent activity
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
