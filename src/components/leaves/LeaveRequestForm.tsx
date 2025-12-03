"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";

// -------------------------------------------
// API WRAPPER
// -------------------------------------------
const apiFetch = async (path: string, options: RequestInit = {}) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(data?.message || "Request failed");
  }
  return data;
};

// -------------------------------------------
// Utility
// -------------------------------------------
function calculateDays(
  start: Date | undefined,
  end: Date | undefined,
  worksOnSaturday: boolean
) {
  if (!start || !end) return 0;

  let count = 0;
  const d = new Date(start);

  while (d <= end) {
    const day = d.getDay(); // 0 = Sunday, 6 = Saturday

    if (day !== 0) {
      if (day === 6 && !worksOnSaturday) {
        // skip Saturday
      } else {
        count++;
      }
    }

    d.setDate(d.getDate() + 1);
  }

  return count;
}

// -------------------------------------------
// COMPONENT
// -------------------------------------------
export default function LeaveRequestForm() {
  // Auto-fetched user data
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [worksOnSaturday, setWorksOnSaturday] = useState<boolean>(false);

  // Form state
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState("");

  const days = calculateDays(startDate, endDate, worksOnSaturday);

  // -------------------------------------------
  // Load logged-in user details
  // -------------------------------------------
  useEffect(() => {
    async function loadUser() {
      try {
        const me = await apiFetch("/api/auth/me", { method: "GET" });

        setEmployeeId(me.id);
        setWorksOnSaturday(!!me.worksOnSaturday);
      } catch (err: any) {
        toast("Error loading profile", { description: err.message });
      }
    }

    loadUser();
  }, []);

  // -------------------------------------------
  // Submit handler
  // -------------------------------------------
  const handleSubmit = async () => {
    if (!employeeId) {
      toast("User not loaded");
      return;
    }

    if (!startDate || !endDate) {
      toast("Start and end date required");
      return;
    }

    if (endDate < startDate) {
      toast("End date cannot be before start date");
      return;
    }

    if (!reason.trim()) {
      toast("Reason required");
      return;
    }

    try {
      await apiFetch(`/api/leave`, {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          startDate,
          endDate,
          reason,
        }),
      });

      toast("Leave Request Submitted", {
        description: "Your leave request has been sent to admin.",
      });

      // Reset form
      setStartDate(undefined);
      setEndDate(undefined);
      setReason("");
    } catch (err: any) {
      toast("Error submitting leave", { description: err.message });
    }
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardContent className="p-6 space-y-6">
        <h2 className="text-lg font-semibold">Apply for Leave</h2>

        {/* Start Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Start Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? startDate.toDateString() : "Pick a start date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(d) => setStartDate(d ?? undefined)}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium">End Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? endDate.toDateString() : "Pick an end date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(d) => setEndDate(d ?? undefined)}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Reason */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Reason</label>
          <Textarea
            rows={4}
            placeholder="Why do you need leave?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {/* Days Preview */}
        {startDate && endDate && (
          <div className="p-3 rounded-md bg-muted text-sm">
            <span className="font-medium">Total working days:</span>{" "}
            {days} day{days === 1 ? "" : "s"}
          </div>
        )}

        {/* Submit */}
        <Button className="w-full" onClick={handleSubmit}>
          Submit Leave Request
        </Button>
      </CardContent>
    </Card>
  );
}
