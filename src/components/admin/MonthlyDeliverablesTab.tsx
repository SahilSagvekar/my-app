'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Package,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Target,
  CheckCircle,
} from 'lucide-react';

interface MonthData {
  completed: number;
  posted: number;
  scheduled: number;
  total: number;
}

interface ClientDeliverable {
  clientId: string;
  clientName: string;
  companyName: string | null;
  targetMonthly: number;
  months: Record<string, MonthData>;
}

interface ClientBreakdown {
  clientName: string;
  companyName: string | null;
  count: number;
}

interface EmployeeMonthData {
  tasksCompleted: number;
  clientBreakdown: Record<string, ClientBreakdown>;
}

interface EmployeeProductivity {
  employeeId: number;
  employeeName: string;
  role: string;
  months: Record<string, EmployeeMonthData>;
}

interface MonthOption {
  key: string;
  label: string;
}

interface Summary {
  totalClients: number;
  totalActiveEmployees: number;
  totalTargetDeliverables: number;
  currentMonthCompleted: number;
  previousMonthCompleted: number;
  completionRate: number;
  monthOverMonthChange: number;
}

const roleColors: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  MANAGER: 'bg-purple-100 text-purple-800',
  EDITOR: 'bg-blue-100 text-blue-800',
  QC: 'bg-green-100 text-green-800',
  SCHEDULER: 'bg-orange-100 text-orange-800',
  VIDEOGRAPHER: 'bg-pink-100 text-pink-800',
};

export function MonthlyDeliverablesTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'clients' | 'employees'>('clients');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthsList, setMonthsList] = useState<MonthOption[]>([]);
  const [clientDeliverables, setClientDeliverables] = useState<ClientDeliverable[]>([]);
  const [employeeProductivity, setEmployeeProductivity] = useState<EmployeeProductivity[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/monthly-deliverables');
      const data = await res.json();

      if (data.ok) {
        setSummary(data.summary);
        setMonthsList(data.monthsList);
        setClientDeliverables(data.clientDeliverables);
        setEmployeeProductivity(data.employeeProductivity);
      }
    } catch (error) {
      console.error('Failed to load monthly deliverables:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  function toggleExpand(id: string) {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  }

  // Get visible months based on selection
  const visibleMonths = selectedMonth === 'all' 
    ? monthsList.slice(0, 6) // Show last 6 months by default
    : monthsList.filter(m => m.key === selectedMonth);

  // Calculate totals for an employee across visible months
  function getEmployeeTotals(emp: EmployeeProductivity) {
    let total = 0;
    const clientTotals: Record<string, { clientName: string; companyName: string | null; count: number }> = {};

    for (const month of visibleMonths) {
      const monthData = emp.months[month.key];
      if (monthData) {
        total += monthData.tasksCompleted;
        for (const [clientId, breakdown] of Object.entries(monthData.clientBreakdown)) {
          if (!clientTotals[clientId]) {
            clientTotals[clientId] = { clientName: breakdown.clientName, companyName: breakdown.companyName, count: 0 };
          }
          clientTotals[clientId].count += breakdown.count;
        }
      }
    }

    return { total, clientTotals };
  }

  // Calculate totals for a client across visible months
  function getClientTotals(client: ClientDeliverable) {
    let completed = 0;
    let posted = 0;
    let scheduled = 0;
    let total = 0;

    for (const month of visibleMonths) {
      const monthData = client.months[month.key];
      if (monthData) {
        completed += monthData.completed;
        posted += monthData.posted;
        scheduled += monthData.scheduled;
        total += monthData.total;
      }
    }

    return { completed, posted, scheduled, total };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading deliverables data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={view === 'clients' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('clients')}
              >
                <Package className="h-4 w-4 mr-2" />
                By Client
              </Button>
              <Button
                variant={view === 'employees' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('employees')}
              >
                <Users className="h-4 w-4 mr-2" />
                By Employee
              </Button>
            </div>

            <div className="flex gap-3 items-center">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {/* <SelectItem value="all">Last 6 Months</SelectItem> */}
                  {monthsList.map((month) => (
                    <SelectItem key={month.key} value={month.key}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client View */}
      {view === 'clients' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Client Deliverables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium">Client</th>
                    <th className="text-center py-3 px-4 font-medium">Target/Mo</th>
                    {visibleMonths.map((month) => (
                      <th key={month.key} className="text-center py-3 px-4 font-medium">
                        {month.label}
                      </th>
                    ))}
                    <th className="text-center py-3 px-4 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {clientDeliverables
                    .filter(client => {
                      // Only show clients with some activity
                      const totals = getClientTotals(client);
                      return totals.total > 0 || client.targetMonthly > 0;
                    })
                    .sort((a, b) => {
                      const aTotals = getClientTotals(a);
                      const bTotals = getClientTotals(b);
                      return bTotals.total - aTotals.total;
                    })
                    .map((client) => {
                      const totals = getClientTotals(client);
                      const targetTotal = client.targetMonthly * visibleMonths.length;
                      const isOnTrack = totals.total >= targetTotal * 0.8;

                      return (
                        <tr key={client.clientId} className="border-b hover:bg-muted/30">
                          <td className="py-3 px-4">
                            <span className="font-medium">{client.companyName || client.clientName}</span>
                          </td>
                          <td className="text-center py-3 px-4">
                            <Badge variant="outline">{client.targetMonthly}</Badge>
                          </td>
                          {visibleMonths.map((month) => {
                            const monthData = client.months[month.key];
                            const count = monthData?.total || 0;
                            const isLow = count < client.targetMonthly * 0.5;
                            const isGood = count >= client.targetMonthly;

                            return (
                              <td key={month.key} className="text-center py-3 px-4">
                                {count > 0 ? (
                                  <span className={`inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded text-sm font-medium ${
                                    isGood ? 'bg-green-100 text-green-800' :
                                    isLow ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {count}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="text-center py-3 px-4">
                            <Badge className={isOnTrack ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                              {totals.total}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {clientDeliverables.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No client data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee View */}
      {view === 'employees' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Employee Productivity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium w-8"></th>
                    <th className="text-left py-3 px-4 font-medium">Employee</th>
                    <th className="text-left py-3 px-4 font-medium">Role</th>
                    {visibleMonths.map((month) => (
                      <th key={month.key} className="text-center py-3 px-4 font-medium">
                        {month.label}
                      </th>
                    ))}
                    <th className="text-center py-3 px-4 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeProductivity
                    .filter(emp => {
                      const totals = getEmployeeTotals(emp);
                      return totals.total > 0;
                    })
                    .sort((a, b) => {
                      const aTotals = getEmployeeTotals(a);
                      const bTotals = getEmployeeTotals(b);
                      return bTotals.total - aTotals.total;
                    })
                    .map((emp) => {
                      const totals = getEmployeeTotals(emp);
                      const isExpanded = expandedRows.has(emp.employeeId.toString());
                      const hasClientBreakdown = Object.keys(totals.clientTotals).length > 1;

                      return (
                        <React.Fragment key={emp.employeeId}>
                          <tr 
                            className={`border-b hover:bg-muted/30 ${hasClientBreakdown ? 'cursor-pointer' : ''}`}
                            onClick={() => hasClientBreakdown && toggleExpand(emp.employeeId.toString())}
                          >
                            <td className="py-3 px-4">
                              {hasClientBreakdown && (
                                isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-medium">{emp.employeeName}</span>
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={roleColors[emp.role] || 'bg-gray-100 text-gray-800'}>
                                {emp.role}
                              </Badge>
                            </td>
                            {visibleMonths.map((month) => {
                              const monthData = emp.months[month.key];
                              const count = monthData?.tasksCompleted || 0;

                              return (
                                <td key={month.key} className="text-center py-3 px-4">
                                  {count > 0 ? (
                                    <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded bg-blue-50 text-blue-700 text-sm font-medium">
                                      {count}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="text-center py-3 px-4">
                              <Badge className="bg-blue-100 text-blue-800">
                                {totals.total}
                              </Badge>
                            </td>
                          </tr>

                          {/* Expanded Client Breakdown */}
                          {isExpanded && hasClientBreakdown && (
                            <tr key={`${emp.employeeId}-breakdown`} className="bg-muted/20">
                              <td colSpan={3 + visibleMonths.length + 1} className="py-2 px-4 pl-12">
                                <div className="text-xs text-muted-foreground mb-2">Client breakdown:</div>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(totals.clientTotals)
                                    .sort((a, b) => b[1].count - a[1].count)
                                    .map(([clientId, data]) => (
                                      <span 
                                        key={clientId}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-white border rounded text-xs"
                                      >
                                        <span className="font-medium">{data.companyName}:</span>
                                        <span className="text-blue-600">{data.count}</span>
                                      </span>
                                    ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>

              {employeeProductivity.filter(emp => getEmployeeTotals(emp).total > 0).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No employee activity data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Comparison (Simple Stats) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Top Performing Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clientDeliverables
                .map(client => ({
                  ...client,
                  totals: getClientTotals(client),
                }))
                .filter(client => client.totals.total > 0)
                .sort((a, b) => b.totals.total - a.totals.total)
                .slice(0, 5)
                .map((client, index) => (
                  <div key={client.clientId} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-5">{index + 1}.</span>
                      <span className="font-medium">{client.companyName || client.clientName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {client.totals.posted} posted
                      </span>
                      <Badge variant="outline">{client.totals.total} total</Badge>
                    </div>
                  </div>
                ))}

              {clientDeliverables.filter(c => getClientTotals(c).total > 0).length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Top Performing Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {employeeProductivity
                .map(emp => ({
                  ...emp,
                  totals: getEmployeeTotals(emp),
                }))
                .filter(emp => emp.totals.total > 0)
                .sort((a, b) => b.totals.total - a.totals.total)
                .slice(0, 5)
                .map((emp, index) => (
                  <div key={emp.employeeId} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-5">{index + 1}.</span>
                      <span className="font-medium">{emp.employeeName}</span>
                      <Badge className={`text-xs ${roleColors[emp.role] || 'bg-gray-100 text-gray-800'}`}>
                        {emp.role}
                      </Badge>
                    </div>
                    <Badge variant="outline">{emp.totals.total} tasks</Badge>
                  </div>
                ))}

              {employeeProductivity.filter(e => getEmployeeTotals(e).total > 0).length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}