// components/admin/ReportsTab.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePickerWithRange } from '../ui/date-picker-with-range';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, AreaChart, Area, Tooltip } from 'recharts';
import { FileText, CheckCircle, Clock, Calendar, Download, TrendingUp, TrendingDown, BarChart3, RefreshCw } from 'lucide-react';

interface DailyReport {
  date: string;
  employee: string;
  role: string;
  tasksUploaded: number;
  tasksApproved: number;
  qcChecks: number;
  schedulingTasks: number;
  totalOutput: number;
}

interface EmployeePerformance {
  employee: string;
  role: string;
  totalTasks: number;
  avgDaily: number;
  efficiency: number;
  trend: 'up' | 'down' | 'stable';
}

interface WeeklyTrend {
  week: string;
  tasksUploaded: number;
  tasksApproved: number;
  qcChecks: number;
  schedulingTasks: number;
}

interface SummaryMetric {
  value: number;
  change: string;
}

export function ReportsTab() {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  });
  
  // Data states
  const [dailyOutputData, setDailyOutputData] = useState<DailyReport[]>([]);
  const [employeePerformance, setEmployeePerformance] = useState<EmployeePerformance[]>([]);
  const [weeklyTrendData, setWeeklyTrendData] = useState<WeeklyTrend[]>([]);
  const [summaryMetrics, setSummaryMetrics] = useState<{
    tasksUploaded: SummaryMetric;
    tasksApproved: SummaryMetric;
    qcChecks: SummaryMetric;
    schedulingTasks: SummaryMetric;
  } | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([
    { id: 'all', name: 'All Employees' }
  ]);

  // Load all data on mount and when filters change
  useEffect(() => {
    loadAllReports();
  }, [selectedEmployee, dateRange]);

  // Load employees on mount
  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    try {
      const res = await fetch('/api/employee/list?status=ACTIVE');
      const data = await res.json();
      
      if (data.ok) {
        const employeeList = data.employees.map((emp: any) => ({
          id: emp.id.toString(),
          name: `${emp.name} (${emp.role})`
        }));
        setEmployees([{ id: 'all', name: 'All Employees' }, ...employeeList]);
      }
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  }

  async function loadAllReports() {
  try {
    setLoading(true);
    
    const startDate = dateRange.from?.toISOString().split('T')[0];
    const endDate = dateRange.to?.toISOString().split('T')[0];

    console.log('Loading reports with:', { startDate, endDate, selectedEmployee });

    // Fetch all data in parallel
    const [dailyRes, performanceRes, weeklyRes, summaryRes] = await Promise.all([
      fetch(`/api/admin/reports/daily?employeeId=${selectedEmployee}&startDate=${startDate}&endDate=${endDate}`),
      fetch(`/api/admin/reports/performance?startDate=${startDate}&endDate=${endDate}`),
      fetch(`/api/admin/reports/weekly-trends?weeks=4`),
      fetch(`/api/admin/reports/summary?startDate=${startDate}&endDate=${endDate}`)
    ]);

    console.log('Response statuses:', {
      daily: dailyRes.status,
      performance: performanceRes.status,
      weekly: weeklyRes.status,
      summary: summaryRes.status
    });

    // Check if responses are OK
    if (!dailyRes.ok) {
      const errorText = await dailyRes.text();
      console.error('Daily report error:', errorText);
      throw new Error(`Daily report failed: ${dailyRes.status}`);
    }

    if (!performanceRes.ok) {
      const errorText = await performanceRes.text();
      console.error('Performance report error:', errorText);
      throw new Error(`Performance report failed: ${performanceRes.status}`);
    }

    if (!weeklyRes.ok) {
      const errorText = await weeklyRes.text();
      console.error('Weekly trends error:', errorText);
      throw new Error(`Weekly trends failed: ${weeklyRes.status}`);
    }

    if (!summaryRes.ok) {
      const errorText = await summaryRes.text();
      console.error('Summary error:', errorText);
      throw new Error(`Summary failed: ${summaryRes.status}`);
    }

    // Parse JSON responses
    const [dailyData, performanceData, weeklyData, summaryData] = await Promise.all([
      dailyRes.json(),
      performanceRes.json(),
      weeklyRes.json(),
      summaryRes.json()
    ]);

    console.log('Parsed data:', {
      daily: dailyData,
      performance: performanceData,
      weekly: weeklyData,
      summary: summaryData
    });

    if (dailyData.ok) {
      setDailyOutputData(dailyData.reports || []);
    } else {
      console.error('Daily data error:', dailyData.message);
    }

    if (performanceData.ok) {
      setEmployeePerformance(performanceData.performance || []);
    } else {
      console.error('Performance data error:', performanceData.message);
    }

    if (weeklyData.ok) {
      setWeeklyTrendData(weeklyData.trends || []);
    } else {
      console.error('Weekly data error:', weeklyData.message);
    }

    if (summaryData.ok) {
      setSummaryMetrics(summaryData.summary);
    } else {
      console.error('Summary data error:', summaryData.message);
    }

  } catch (error: any) {
    console.error('Failed to load reports:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    
    // Show user-friendly error
    alert(`Failed to load reports: ${error.message}`);
  } finally {
    setLoading(false);
  }
}

  async function handleRefresh() {
    setRefreshing(true);
    await loadAllReports();
    setRefreshing(false);
    
   console.log("Reports refreshed successfully");
  }

  async function handleExport(format: 'csv' | 'pdf') {
    try {
      const startDate = dateRange.from?.toISOString().split('T')[0];
      const endDate = dateRange.to?.toISOString().split('T')[0];

      const res = await fetch('/api/admin/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          employeeId: selectedEmployee,
          startDate,
          endDate
        })
      });

      if (format === 'csv' && res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `daily-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Success",
          description: "Report exported successfully",
        });
      } else {
        const data = await res.json();
        toast({
          title: "Error",
          description: data.message || "Failed to export report",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "Failed to export report",
        variant: "destructive",
      });
    }
  }

  const filteredData = selectedEmployee === 'all' 
    ? dailyOutputData 
    : dailyOutputData.filter(record => record.employee.toLowerCase().includes(selectedEmployee));

  const totalMetrics = summaryMetrics || {
    tasksUploaded: { value: 0, change: '+0%' },
    tasksApproved: { value: 0, change: '+0%' },
    qcChecks: { value: 0, change: '+0%' },
    schedulingTasks: { value: 0, change: '+0%' }
  };

  const getDayData = () => {
    const dayTotals: { [key: string]: any } = {};
    
    filteredData.forEach(record => {
      if (!dayTotals[record.date]) {
        dayTotals[record.date] = {
          date: record.date,
          tasksUploaded: 0,
          tasksApproved: 0,
          qcChecks: 0,
          schedulingTasks: 0
        };
      }
      
      dayTotals[record.date].tasksUploaded += record.tasksUploaded;
      dayTotals[record.date].tasksApproved += record.tasksApproved;
      dayTotals[record.date].qcChecks += record.qcChecks;
      dayTotals[record.date].schedulingTasks += record.schedulingTasks;
    });
    
    return Object.values(dayTotals).sort((a: any, b: any) => a.date.localeCompare(b.date));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Daily Output Reports
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm">Employee</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm">Date Range</label>
              <DatePickerWithRange 
                date={dateRange}
                setDate={setDateRange}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleExport('csv')} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => handleExport('pdf')} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasks Uploaded</p>
                <h3 className="text-2xl font-bold mt-2">{totalMetrics.tasksUploaded.value}</h3>
                <div className="flex items-center gap-1 mt-1">
                  {totalMetrics.tasksUploaded.change.startsWith('+') ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                  <span className={`text-xs ${totalMetrics.tasksUploaded.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {totalMetrics.tasksUploaded.change}
                  </span>
                </div>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasks Approved</p>
                <h3 className="text-2xl font-bold mt-2">{totalMetrics.tasksApproved.value}</h3>
                <div className="flex items-center gap-1 mt-1">
                  {totalMetrics.tasksApproved.change.startsWith('+') ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                  <span className={`text-xs ${totalMetrics.tasksApproved.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {totalMetrics.tasksApproved.change}
                  </span>
                </div>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">QC Checks</p>
                <h3 className="text-2xl font-bold mt-2">{totalMetrics.qcChecks.value}</h3>
                <div className="flex items-center gap-1 mt-1">
                  {totalMetrics.qcChecks.change.startsWith('+') ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                  <span className={`text-xs ${totalMetrics.qcChecks.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {totalMetrics.qcChecks.change}
                  </span>
                </div>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scheduling Tasks</p>
                <h3 className="text-2xl font-bold mt-2">{totalMetrics.schedulingTasks.value}</h3>
                <div className="flex items-center gap-1 mt-1">
                  {totalMetrics.schedulingTasks.change.startsWith('+') ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                  <span className={`text-xs ${totalMetrics.schedulingTasks.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {totalMetrics.schedulingTasks.change}
                  </span>
                </div>
              </div>
              <Calendar className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Output Chart */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily Output Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getDayData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="tasksUploaded" 
                    stackId="1"
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.6}
                    name="Tasks Uploaded"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="tasksApproved" 
                    stackId="1"
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.6}
                    name="Tasks Approved"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="qcChecks" 
                    stackId="1"
                    stroke="#f59e0b" 
                    fill="#f59e0b" 
                    fillOpacity={0.6}
                    name="QC Checks"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="schedulingTasks" 
                    stackId="1"
                    stroke="#8b5cf6" 
                    fill="#8b5cf6" 
                    fillOpacity={0.6}
                    name="Scheduling"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="tasksUploaded" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Tasks Uploaded"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="qcChecks" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    name="QC Checks"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Task Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Task Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { type: 'Uploaded', count: totalMetrics.tasksUploaded.value },
                  { type: 'Approved', count: totalMetrics.tasksApproved.value },
                  { type: 'QC Checks', count: totalMetrics.qcChecks.value },
                  { type: 'Scheduling', count: totalMetrics.schedulingTasks.value }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Employee</th>
                  <th className="text-left py-3 px-4">Role</th>
                  <th className="text-left py-3 px-4">Total Tasks</th>
                  <th className="text-left py-3 px-4">Daily Average</th>
                  <th className="text-left py-3 px-4">Efficiency</th>
                  <th className="text-left py-3 px-4">Trend</th>
                </tr>
              </thead>
              <tbody>
                {employeePerformance.map((employee, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="font-medium">{employee.employee}</div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{employee.role}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      {employee.totalTasks}
                    </td>
                    <td className="py-3 px-4">
                      {employee.avgDaily}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span>{employee.efficiency}%</span>
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500" 
                            style={{ width: `${employee.efficiency}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {employee.trend === 'up' && (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600">Improving</span>
                          </>
                        )}
                        {employee.trend === 'down' && (
                          <>
                            <TrendingDown className="h-4 w-4 text-red-600" />
                            <span className="text-sm text-red-600">Declining</span>
                          </>
                        )}
                        {employee.trend === 'stable' && (
                          <span className="text-sm text-muted-foreground">Stable</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Daily Records */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Daily Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Employee</th>
                  <th className="text-left py-3 px-4">Role</th>
                  <th className="text-left py-3 px-4">Tasks Uploaded</th>
                  <th className="text-left py-3 px-4">Tasks Approved</th>
                  <th className="text-left py-3 px-4">QC Checks</th>
                  <th className="text-left py-3 px-4">Scheduling</th>
                  <th className="text-left py-3 px-4">Total Output</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((record, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">{record.date}</td>
                    <td className="py-3 px-4">{record.employee}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{record.role}</Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {record.tasksUploaded || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {record.tasksApproved || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {record.qcChecks || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {record.schedulingTasks || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                        {record.totalOutput}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}