"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  Briefcase,
  Calendar,
  DollarSign,
  Clock,
  User,
  Mail,
  Phone,
  ArrowRight,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth/AuthContext";

interface EmploymentInfoProps {
  currentRole?: string;
}

export function EmploymentInfo({ currentRole }: EmploymentInfoProps) {
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    fetchEmployeeInfo();
  }, []);

  const fetchEmployeeInfo = async () => {
    try {
      setLoading(true);
      const token =
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken");

      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.user) {
        setEmployee(data.user);
      }
    } catch (err) {
      console.error("Failed to fetch employee info:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground">
          Loading employment information...
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground">
          Unable to load employment information
        </div>
      </div>
    );
  }

  const showRequestLeave = currentRole !== "admin";

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">
          Employment Information
        </h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          View your employment details and manage leave requests
        </p>
      </div>

      {/* Employee Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Employee Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Avatar className="w-16 h-16 sm:w-20 sm:h-20">
              <AvatarImage src={employee.image || ""} />
              <AvatarFallback className="text-base sm:text-lg">
                {employee.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold">
                {employee.name || "N/A"}
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground">
                {employee.role || "N/A"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                Email
              </div>
              <p className="font-medium">{employee.email || "N/A"}</p>
            </div>

            {employee.phone && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  Phone
                </div>
                <p className="font-medium">{employee.phone}</p>
              </div>
            )}

            {employee.joinedAt && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Join Date
                </div>
                <p className="font-medium">
                  {new Date(employee.joinedAt).toLocaleDateString()}
                </p>
              </div>
            )}

            {employee.employeeStatus && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  Status
                </div>
                <p className="font-medium capitalize">
                  {employee.employeeStatus.toLowerCase()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Employment Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Employment Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {employee.hourlyRate && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Hourly Rate
                </div>
                <p className="text-lg font-semibold">
                  ${Number(employee.hourlyRate).toFixed(2)}/hr
                </p>
              </div>
            )}

            {employee.monthlyRate && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Monthly Rate
                </div>
                <p className="text-lg font-semibold">
                  ${employee.monthlyRate.toLocaleString()}
                </p>
              </div>
            )}

            {employee.hoursPerWeek && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Hours Per Week
                </div>
                <p className="text-lg font-semibold">
                  {Number(employee.hoursPerWeek)} hours
                </p>
              </div>
            )}

            {employee.monthlyBaseHours && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Monthly Base Hours
                </div>
                <p className="text-lg font-semibold">
                  {employee.monthlyBaseHours} hours
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Request Leave Card - Only for non-admin roles */}
      {showRequestLeave && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Leave Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Submit a leave request for approval. You can select dates and
              provide a reason for your absence.
            </p>
            <Button
              onClick={() => router.push("/leave-request")}
              className="w-full sm:w-auto"
            >
              Request Leave
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Leave Requests List - Only for non-admin roles */}
      {showRequestLeave && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Leave Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              View all your leave requests and their approval status. Track
              pending, approved, and rejected requests.
            </p>
            <Button
              onClick={() => router.push("/leave-requests")}
              className="w-full sm:w-auto"
            >
              View Leave Requests
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
