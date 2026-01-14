"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, FileText, CheckCircle, XCircle, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LeaveRequestsPage() {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/leave?sortBy=createdAt&sortOrder=desc');
      const data = await response.json();
      
      if (data.ok && data.leaves) {
        setLeaveRequests(data.leaves);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch leave requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'APPROVED':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/employment-information")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
          <h1 className="text-2xl font-semibold">Leave Requests</h1>
          <p className="text-muted-foreground mt-2">
            View all your leave requests and their approval status
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLeaveRequests}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                  <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <h3 className="text-2xl font-bold mt-1 text-yellow-600">{stats.pending}</h3>
                </div>
                <AlertCircle className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <h3 className="text-2xl font-bold mt-1 text-green-600">{stats.approved}</h3>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <h3 className="text-2xl font-bold mt-1 text-red-600">{stats.rejected}</h3>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leave Requests List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            All Leave Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-40 animate-spin" />
              <p>Loading leave requests...</p>
            </div>
          ) : leaveRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No leave requests found</p>
              <p className="text-sm mt-2">Submit your first leave request to see it here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaveRequests.map((leave) => (
                <div
                  key={leave.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(leave.status)}
                        <span className="text-sm text-muted-foreground">
                          Submitted: {new Date(leave.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">From:</span>{' '}
                          <span className="font-medium">
                            {new Date(leave.startDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">To:</span>{' '}
                          <span className="font-medium">
                            {new Date(leave.endDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Days:</span>{' '}
                          <span className="font-medium">{leave.numberOfDays}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {leave.reason && (
                    <div className="text-sm mb-2">
                      <span className="text-muted-foreground">Reason:</span>{' '}
                      <span>{leave.reason}</span>
                    </div>
                  )}
                  {leave.rejectionReason && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm">
                      <span className="text-red-700 font-medium">Rejection Reason:</span>{' '}
                      <span className="text-red-600">{leave.rejectionReason}</span>
                    </div>
                  )}
                  {leave.status === 'APPROVED' && leave.approvedAt && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Approved on: {new Date(leave.approvedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
