"use client";

import { BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Progress } from "../../ui/progress";
import type { ClientProgress } from "./types";

interface MonthlyDeliverablesCardProps {
  clientProgress: ClientProgress[];
}

export function MonthlyDeliverablesCard({
  clientProgress,
}: MonthlyDeliverablesCardProps) {
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    if (clientProgress.length === 0) {
      setCarouselIndex(0);
      return;
    }

    setCarouselIndex((currentIndex) =>
      Math.min(currentIndex, clientProgress.length - 1),
    );
  }, [clientProgress]);

  const activeClient = clientProgress[carouselIndex];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Monthly Deliverables Progress
        </CardTitle>

        {clientProgress.length > 1 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">
              {carouselIndex + 1} / {clientProgress.length}
            </span>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 sm:h-8 sm:w-8"
              onClick={() =>
                setCarouselIndex(
                  (currentIndex) =>
                    (currentIndex - 1 + clientProgress.length) %
                    clientProgress.length,
                )
              }
              aria-label="Show previous client"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 sm:h-8 sm:w-8"
              onClick={() =>
                setCarouselIndex(
                  (currentIndex) => (currentIndex + 1) % clientProgress.length,
                )
              }
              aria-label="Show next client"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </CardHeader>

      <CardContent>
        {activeClient ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-gray-900 sm:text-lg">
                  {activeClient.clientName}
                </h3>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {activeClient.totalCompleted} of {activeClient.totalExpected}{" "}
                  completed
                </p>
              </div>

              <div className="shrink-0 text-right">
                <div
                  className={`text-xl font-bold sm:text-2xl ${
                    activeClient.overallProgress >= 100
                      ? "text-emerald-600"
                      : "text-gray-900"
                  }`}
                >
                  {activeClient.overallProgress}%
                </div>
                <p className="text-xs text-muted-foreground">Overall</p>
              </div>
            </div>

            <Progress
              value={activeClient.overallProgress}
              className="h-2"
              indicatorColor={
                activeClient.overallProgress >= 100 ? "#10b981" : "#3b82f6"
              }
            />

            <div className="flex flex-col gap-2">
              {activeClient.deliverables.map((deliverable) => {
                const progress = Math.min(deliverable.progress, 100);
                const isComplete = progress >= 100;

                return (
                  <div
                    key={deliverable.id}
                    className="rounded-lg border bg-gray-50/50 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-gray-900">
                          {deliverable.type}
                        </span>
                        <span className="text-xs whitespace-nowrap text-muted-foreground">
                          ({deliverable.completedTasks}/
                          {deliverable.quantity || deliverable.totalTasks})
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {deliverable.platforms.slice(0, 2).map((platform) => (
                          <Badge
                            key={platform}
                            variant="outline"
                            className="h-5 px-1.5 text-[10px]"
                          >
                            {platform}
                          </Badge>
                        ))}

                        {deliverable.platforms.length > 2 ? (
                          <span className="text-[10px] text-muted-foreground">
                            +{deliverable.platforms.length - 2}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Progress
                        value={progress}
                        className="h-1.5 flex-1"
                        indicatorColor={isComplete ? "#10b981" : "#3b82f6"}
                      />
                      <span
                        className={`w-9 text-right text-xs font-medium whitespace-nowrap ${
                          isComplete
                            ? "text-emerald-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {progress}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {clientProgress.length > 1 ? (
              <div className="flex items-center justify-center gap-1.5 pt-2">
                {clientProgress.map((client, index) => (
                  <button
                    key={client.clientId}
                    type="button"
                    onClick={() => setCarouselIndex(index)}
                    aria-label={`Show deliverable progress for ${client.clientName}`}
                    className={`h-1.5 rounded-full transition-all ${
                      index === carouselIndex
                        ? "w-6 bg-primary"
                        : "w-1.5 bg-gray-300 hover:bg-gray-400"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            No active client deliverables this month
          </div>
        )}
      </CardContent>
    </Card>
  );
}
