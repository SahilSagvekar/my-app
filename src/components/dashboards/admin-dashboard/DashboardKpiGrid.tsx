"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Card, CardContent } from "../../ui/card";
import type { KpiCardConfig } from "./types";

interface DashboardKpiGridProps {
  cards: KpiCardConfig[];
}

export function DashboardKpiGrid({ cards }: DashboardKpiGridProps) {
  const [revenueVisible, setRevenueVisible] = useState(false);

  return (
    <section
      aria-label="Key performance indicators"
      className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4 sm:gap-6"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        const isRevenue = card.title === "Total Revenue";

        return (
          <Card key={card.title} className="flex flex-col">
            <CardContent className="flex flex-1 flex-row items-center justify-center gap-3 p-3 sm:p-5">
              <div className="shrink-0 rounded-lg bg-muted p-2">
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.colorClassName}`} />
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center gap-1">
                  <h3 className="text-base font-bold whitespace-nowrap sm:text-lg">
                    {isRevenue
                      ? revenueVisible
                        ? card.value
                        : "••••••"
                      : card.value}
                  </h3>

                  {isRevenue ? (
                    <button
                      type="button"
                      onClick={() => setRevenueVisible((value) => !value)}
                      className="shrink-0 p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={revenueVisible ? "Hide revenue" : "Show revenue"}
                    >
                      {revenueVisible ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : null}
                </div>

                <p className="text-[10px] leading-tight whitespace-nowrap text-muted-foreground sm:text-xs">
                  {card.title}
                </p>

                <span
                  className={`mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[9px] whitespace-nowrap sm:text-xs ${card.colorClassName}`}
                >
                  {card.change} vs last month
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
