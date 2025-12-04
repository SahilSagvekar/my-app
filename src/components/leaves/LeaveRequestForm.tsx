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

import {
  Calendar as CalendarIcon,
  Send,
  User,
  Briefcase,
  Clock,
} from "lucide-react";

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

// Calendar styles
const calendarStyles = {
  caption: { color: "#1e3a8a", fontWeight: "bold" },
  head_cell: { fontWeight: 600, color: "#475569" },
  nav_button_next: { color: "#1e3a8a" },
  nav_button_previous: { color: "#1e3a8a" },
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
            <Briefcase className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Request Time Off
          </h1>
          <p className="text-muted-foreground">
            Submit your leave request for approval
          </p>
        </div>

        {/* User Info */}
        {userName && (
          <Card className="mb-6 border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Requesting as</p>
                  <p className="font-semibold">{userName}</p>
                </div>
                {worksOnSaturday && (
                  <Badge variant="outline" className="ml-auto">
                    Works on Saturday
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Form */}
        <Card className="shadow-lg border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <CardTitle className="text-2xl">Leave Request Form</CardTitle>
            <CardDescription className="text-blue-50">
              Fill the details below
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Date Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <CalendarIcon className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-lg">Select Dates</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Start Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Start Date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left h-12 hover:bg-blue-50 transition-colors"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-blue-600" />
                        {startDate ? (
                          <span className="font-medium">
                            {startDate.toLocaleDateString()}
                          </span>
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
                        styles={calendarStyles}
                        modifiersClassNames={{
                          selected: "bg-blue-600 text-white rounded-md",
                          today: "border border-blue-600 rounded-md",
                        }}
                        className="p-3 rounded-lg shadow-sm bg-white"
                        showOutsideDays
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* End Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    End Date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left h-12 hover:bg-purple-50 transition-colors"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-purple-600" />
                        {endDate ? (
                          <span className="font-medium">
                            {endDate.toLocaleDateString()}
                          </span>
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
                        styles={calendarStyles}
                        modifiersClassNames={{
                          selected: "bg-purple-600 text-white rounded-md",
                          today: "border border-purple-600 rounded-md",
                        }}
                        className="p-3 rounded-lg shadow-sm bg-white"
                        showOutsideDays
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Days Preview */}
              {startDate && endDate && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-white">
                        <Clock className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Total Working Days
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {days} {days === 1 ? "day" : "days"}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant="secondary"
                      className="text-lg px-4 py-2 bg-white"
                    >
                      {days}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Reason */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                Reason for Leave
              </label>
              <Textarea
                rows={5}
                placeholder="Provide the reason for your leave request..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="resize-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              <p className="text-xs text-muted-foreground">
                {reason.length}/500 characters
              </p>
            </div>

            {/* Submit */}
            <Button
              type="button"
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all"
              onClick={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              disabled={loading || !startDate || !endDate || !reason.trim()}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  Submit Leave Request
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card className="mt-6 border-dashed">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <div className="p-1 rounded-full bg-blue-100 mt-0.5">
                <CalendarIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Note:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Sundays are excluded from working days</li>
                  {!worksOnSaturday && <li>Saturdays are excluded</li>}
                  <li>Submit at least 3 days before the leave date</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
