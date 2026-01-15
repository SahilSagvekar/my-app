"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

import { Calendar as CalendarIcon, Send, User, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

// Convert JS Date to "YYYY-MM-DD 00:00:00"
const toSQLDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day} 00:00:00`;
};

// -------------------------------------------
// COMPONENT
// -------------------------------------------
export default function LeaveRequestForm() {
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [worksOnSaturday, setWorksOnSaturday] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState("");

  const days = calculateDays(startDate, endDate, worksOnSaturday);

  // Fetch user profile
  useEffect(() => {
    async function loadUser() {
      try {
        const me = await apiFetch("/api/auth/me", { method: "GET" });
        setEmployeeId(me.user.id);
        setWorksOnSaturday(!!me.worksOnSaturday);
        setUserName(me.user.name || "Employee");
      } catch (err: any) {
        toast.error("Error loading profile", { description: err.message });
      }
    }

    loadUser();
  }, []);

  // Normalize selected dates
  const handleStartDateSelect = (date: Date | undefined) => {
    if (!date) return setStartDate(undefined);
    setStartDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    if (!date) return setEndDate(undefined);
    setEndDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
  };

  // Submit form
  const handleSubmit = async () => {
    if (!employeeId) return toast.error("User not loaded");
    if (!startDate || !endDate) return toast.error("Select both dates");
    if (endDate < startDate) return toast.error("End date must be after start");
    if (!reason.trim()) return toast.error("Enter a reason");

    setLoading(true);

    try {
      const payload = {
        employeeId,
        startDate: toSQLDate(startDate),
        endDate: toSQLDate(endDate),
        reason: reason.trim(),
      };

      await apiFetch(`/api/leave`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Leave Request Submitted", {
        description: "Your request has been sent to management.",
      });

      setStartDate(undefined);
      setEndDate(undefined);
      setReason("");
    } catch (err: any) {
      toast.error("Failed to submit", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Employee Info Card */}
      {userName && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <User className="h-4 w-4 sm:h-5 sm:w-5" />
              Employee Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Requesting as</p>
                <p className="font-semibold text-base sm:text-lg">{userName}</p>
              </div>
              {worksOnSaturday && (
                <Badge variant="outline" className="w-fit">Works on Saturday</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leave Request Form Card */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            Leave Request Details
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Fill in the details below to submit your leave request
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
          {/* Date Section */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4">
              {/* Start Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? (
                        <span>{startDate.toLocaleDateString()}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          Pick start date
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-auto p-0" align="start">
                    <DayPicker
                      mode="single"
                      selected={startDate}
                      onSelect={handleStartDateSelect}
                      className="p-3 rounded-lg"
                      showOutsideDays
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? (
                        <span>{endDate.toLocaleDateString()}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          Pick end date
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-auto p-0" align="start">
                    <DayPicker
                      mode="single"
                      selected={endDate}
                      onSelect={handleEndDateSelect}
                      className="p-3 rounded-lg"
                      showOutsideDays
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Days Preview */}
            {startDate && endDate && (
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Total Working Days
                        </p>
                        <p className="text-base sm:text-lg font-semibold">
                          {days} {days === 1 ? "day" : "days"}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-sm sm:text-base">
                      {days}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* Reason */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason for Leave</label>
            <Textarea
              rows={5}
              placeholder="Provide the reason for your leave request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/500 characters
            </p>
          </div>

          {/* Submit */}
          <Button
            type="button"
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            disabled={loading || !startDate || !endDate || !reason.trim()}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit Leave Request
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Footer Note */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4" />
            Important Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-muted-foreground list-disc list-inside">
            <li>Sundays are excluded from working days</li>
            {!worksOnSaturday && <li>Saturdays are excluded</li>}
            <li>Submit at least 3 days before the leave date</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
