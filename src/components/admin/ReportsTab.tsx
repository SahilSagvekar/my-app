import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePickerWithRange } from '../ui/date-picker-with-range';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { FileText, CheckCircle, Clock, Calendar, Download, TrendingUp, TrendingDown, BarChart3, Filter, Users } from 'lucide-react';

// Mock data for employee reports
const employees = [
  { id: 'all', name: 'All Employees' },
  { id: 'sarah', name: 'Sarah Johnson (Admin)' },
  { id: 'michael', name: 'Michael Chen (Manager)' },
  { id: 'emma', name: 'Emma Wilson (Editor)' },
  { id: 'david', name: 'David Rodriguez (QC)' },
  { id: 'lisa', name: 'Lisa Park (Scheduler)' },
  { id: 'james', name: 'James Thompson (Account Manager)' }
];

const dailyOutputData = [
  {
    date: '2024-08-04',
    employee: 'Emma Wilson',
    role: 'Editor',
    tasksUploaded: 8,
    tasksApproved: 6,
    qcChecks: 0,
    schedulingTasks: 0,
    totalOutput: 14
  },
  {
    date: '2024-08-04',
    employee: 'David Rodriguez',
    role: 'QC',
    tasksUploaded: 0,
    tasksApproved: 0,
    qcChecks: 12,
    schedulingTasks: 0,
    totalOutput: 12
  },
  {
    date: '2024-08-04',
    employee: 'Lisa Park',
    role: 'Scheduler',
    tasksUploaded: 0,
    tasksApproved: 0,
    qcChecks: 0,
    schedulingTasks: 9,
    totalOutput: 9
  },
  {
    date: '2024-08-05',
    employee: 'Emma Wilson',
    role: 'Editor',
    tasksUploaded: 7,
    tasksApproved: 8,
    qcChecks: 0,
    schedulingTasks: 0,
    totalOutput: 15
  },
  {
    date: '2024-08-05',
    employee: 'David Rodriguez',
    role: 'QC',
    tasksUploaded: 0,
    tasksApproved: 0,
    qcChecks: 10,
    schedulingTasks: 0,
    totalOutput: 10
  },
  {
    date: '2024-08-05',
    employee: 'Lisa Park',
    role: 'Scheduler',
    tasksUploaded: 0,
    tasksApproved: 0,
    qcChecks: 0,
    schedulingTasks: 11,
    totalOutput: 11
  },
  {
    date: '2024-08-06',
    employee: 'Emma Wilson',
    role: 'Editor',
    tasksUploaded: 9,
    tasksApproved: 7,
    qcChecks: 0,
    schedulingTasks: 0,
    totalOutput: 16
  },
  {
    date: '2024-08-06',
    employee: 'David Rodriguez',
    role: 'QC',
    tasksUploaded: 0,
    tasksApproved: 0,
    qcChecks: 14,
    schedulingTasks: 0,
    totalOutput: 14
  },
  {
    date: '2024-08-07',
    employee: 'Emma Wilson',
    role: 'Editor',
    tasksUploaded: 6,
    tasksApproved: 9,
    qcChecks: 0,
    schedulingTasks: 0,
    totalOutput: 15
  }
];

const weeklyTrendData = [
  { week: 'Week 1', tasksUploaded: 42, tasksApproved: 38, qcChecks: 56, schedulingTasks: 31 },
  { week: 'Week 2', tasksUploaded: 48, tasksApproved: 41, qcChecks: 62, schedulingTasks: 35 },
  { week: 'Week 3', tasksUploaded: 52, tasksApproved: 47, qcChecks: 58, schedulingTasks: 38 },
  { week: 'Week 4', tasksUploaded: 45, tasksApproved: 43, qcChecks: 61, schedulingTasks: 33 }
];

const employeePerformance = [
  {
    employee: 'Emma Wilson',
    role: 'Editor',
    totalTasks: 45,
    avgDaily: 6.4,
    efficiency: 94,
    trend: 'up'
  },
  {
    employee: 'David Rodriguez',
    role: 'QC',
    totalTasks: 67,
    avgDaily: 9.6,
    efficiency: 91,
    trend: 'up'
  },
  {
    employee: 'Lisa Park',
    role: 'Scheduler',
    totalTasks: 31,
    avgDaily: 4.4,
    efficiency: 88,
    trend: 'down'
  },
  {
    employee: 'James Thompson',
    role: 'Account Manager',
    totalTasks: 23,
    avgDaily: 3.3,
    efficiency: 85,
    trend: 'stable'
  }
];

export function ReportsTab() {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [dateRange, setDateRange] = useState({
    from: new Date(2024, 7, 1), // Aug 1, 2024
    to: new Date() // Today
  });

  const filteredData = selectedEmployee === 'all' 
    ? dailyOutputData 
    : dailyOutputData.filter(record => record.employee.toLowerCase().includes(selectedEmployee));

  const totalMetrics = {
    tasksUploaded: dailyOutputData.reduce((sum, record) => sum + record.tasksUploaded, 0),
    tasksApproved: dailyOutputData.reduce((sum, record) => sum + record.tasksApproved, 0),
    qcChecks: dailyOutputData.reduce((sum, record) => sum + record.qcChecks, 0),
    schedulingTasks: dailyOutputData.reduce((sum, record) => sum + record.schedulingTasks, 0)
  };

  const handleExport = (format: string) => {
    console.log(`Exporting data as ${format}`);
    // In a real app, this would generate and download the file
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

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Daily Output Reports
          </CardTitle>
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
                <h3 className="mt-2">{totalMetrics.tasksUploaded}</h3>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">+12.5%</span>
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
                <h3 className="mt-2">{totalMetrics.tasksApproved}</h3>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">+8.3%</span>
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
                <h3 className="mt-2">{totalMetrics.qcChecks}</h3>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">+15.7%</span>
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
                <h3 className="mt-2">{totalMetrics.schedulingTasks}</h3>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="h-3 w-3 text-red-600" />
                  <span className="text-xs text-red-600">-2.1%</span>
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
                  <Area 
                    type="monotone" 
                    dataKey="tasksUploaded" 
                    stackId="1"
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="tasksApproved" 
                    stackId="1"
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="qcChecks" 
                    stackId="1"
                    stroke="#f59e0b" 
                    fill="#f59e0b" 
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="schedulingTasks" 
                    stackId="1"
                    stroke="#8b5cf6" 
                    fill="#8b5cf6" 
                    fillOpacity={0.6}
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
                  <Line 
                    type="monotone" 
                    dataKey="tasksUploaded" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="qcChecks" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
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
                  { type: 'Uploaded', count: totalMetrics.tasksUploaded },
                  { type: 'Approved', count: totalMetrics.tasksApproved },
                  { type: 'QC Checks', count: totalMetrics.qcChecks },
                  { type: 'Scheduling', count: totalMetrics.schedulingTasks }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
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
                      <Badge className="bg-blue-100 text-blue-800">
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