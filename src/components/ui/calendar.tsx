"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "./utils";
import { buttonVariants } from "./button";

// NOTE: react-day-picker v9 renamed its classNames API from the old v8 keys
// (head_row/head_cell/row/cell/day/day_selected/…) to a new set
// (weekdays/weekday/week/day/day_button/selected/…). This component targets
// v9's keys — using the old v8 names silently no-ops (no error, no styling),
// which is what caused the weekday header to render unstyled/garbled.
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4 w-full",
        month_caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium",
        nav: "flex items-center justify-between absolute inset-x-1 top-1 z-10",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        month_grid: "w-full border-collapse table-fixed",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-8 flex-1 font-normal text-[0.8rem] text-center",
        week: "flex w-full mt-2",
        day: cn(
          "relative p-0 text-center text-sm flex-1 focus-within:relative focus-within:z-20",
          "[&:has([data-selected=true])]:bg-accent [&:has([data-range-end=true])]:rounded-r-md [&:has([data-range-start=true])]:rounded-l-md",
          props.mode === "range"
            ? "first:[&:has([data-selected=true])]:rounded-l-md last:[&:has([data-selected=true])]:rounded-r-md"
            : "[&:has([data-selected=true])]:rounded-md",
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal aria-selected:opacity-100 mx-auto",
        ),
        range_start:
          "day-range-start data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground",
        range_end:
          "day-range-end data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:focus:bg-primary [&>button]:focus:text-primary-foreground",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside:
          "day-outside text-muted-foreground data-[selected=true]:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...props }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", className)} {...props} />
          ) : (
            <ChevronRight className={cn("size-4", className)} {...props} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };