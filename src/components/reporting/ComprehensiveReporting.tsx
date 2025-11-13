import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePickerWithRange } from '../ui/date-picker-with-range';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { FileText, CheckCircle, Clock, Calendar, Download, TrendingUp, TrendingDown, BarChart3, Filter, Users, Target, Award, Activity } from 'lucide-react';

// Mock data for comprehensive reporting
const employees = [
  { id: 'all', name: 'All Employees' },
  { id: 'sarah', name: 'Sarah Chen (Editor)' },
  { id: 'mike', name: 'Mike Rodriguez (QC)' },
  { id: 'emily', name: 'Emily Foster (Scheduler)' },
  { id: 'david', name: 'David Wilson (Manager)' },
  { id: 'alex', name: 'Alex Thompson (Videographer)' }
];

const performanceData = [
  { date: '2024-08-01', tasksCompleted: 45, efficiency: 92, quality: 96 },
  { date: '2024-08-02', tasksCompleted: 52, efficiency: 89, quality: 94 },
  { date: '2024-08-03', tasksCompleted: 48, efficiency: 95, quality: 98 },
  { date: '2024-08-04', tasksCompleted: 56, efficiency: 91, quality: 95 },
  { date: '2024-08-05', tasksCompleted: 43, efficiency: 88, quality: 97 },
  { date: '2024-08-06', tasksCompleted: 59, efficiency: 94, quality: 93 },
  { date: '2024-08-07', tasksCompleted: 47, efficiency: 90, quality: 96 }
];

const workflowData = [
  { stage: 'Editing', tasks: 34, avgTime: 2.5, completion: 94 },
  { stage: 'QC Review', tasks: 32, avgTime: 1.2, completion: 89 },
  { stage: 'Client Review', tasks: 28, avgTime: 4.8, completion: 76 },
  { stage: 'Scheduling', tasks: 24, avgTime: 0.8, completion: 98 }
];

const projectData = [
  { name: 'TechStartup Campaign', status: 'Active', progress: 78, tasks: 45, deadline: '2024-09-15' },
  { name: 'EcoFriendly Rebrand', status: 'Active', progress: 92, tasks: 23, deadline: '2024-08-30' },
  { name: 'Fashion Forward Launch', status: 'Review', progress: 45, tasks: 67, deadline: '2024-10-20' },
  { name: 'Healthcare Initiative', status: 'Planning', progress: 15, tasks: 89, deadline: '2024-11-01' }
];

const clientSatisfactionData = [
  { client: 'TechStartup Inc.', satisfaction: 4.8, projects: 3, feedback: 'Excellent' },
  { client: 'EcoFriendly Solutions', satisfaction: 4.6, projects: 2, feedback: 'Very Good' },
  { client: 'Fashion Forward', satisfaction: 4.2, projects: 4, feedback: 'Good' },
  { client: 'Healthcare Plus', satisfaction: 4.9, projects: 1, feedback: 'Excellent' }
];

const taskTypeDistribution = [
  { name: 'Video Editing', value: 35, color: '#3b82f6' },
  { name: 'Graphic Design', value: 28, color: '#10b981' },
  { name: 'Content Writing', value: 18, color: '#f59e0b' },
  { name: 'Social Media', value: 12, color: '#8b5cf6' },
  { name: 'Other', value: 7, color: '#6b7280' }
];

export function ComprehensiveReporting() {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedMetric, setSelectedMetric] = useState('performance');
  const [dateRange, setDateRange] = useState({
    from: new Date(2024, 7, 1), // Aug 1, 2024
    to: new Date() // Today
  });

  const handleExport = (format: string) => {
    console.log(`Exporting data as ${format}`);
    // In a real app, this would generate and download the file
  };

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Review':
        return 'bg-yellow-100 text-yellow-800';
      case 'Planning':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSatisfactionColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 4.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics & Reports</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive insights into team performance and project analytics
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm">Report Type</label>
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="performance">Performance Analytics</SelectItem>
                  <SelectItem value="workflow">Workflow Analytics</SelectItem>
                  <SelectItem value="projects">Project Reports</SelectItem>
                  <SelectItem value="client">Client Satisfaction</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <h3 className="mt-2">1,247</h3>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">+12.5%</span>
                </div>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <h3 className="mt-2">94.2%</h3>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">+3.1%</span>
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
                <p className="text-sm text-muted-foreground">Avg Efficiency</p>
                <h3 className="mt-2">91.8%</h3>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="h-3 w-3 text-red-600" />
                  <span className="text-xs text-red-600">-1.2%</span>
                </div>
              </div>
              <Activity className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Quality Score</p>
                <h3 className="mt-2">95.7%</h3>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">+2.3%</span>
                </div>
              </div>
              <Award className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Line 
                    type="monotone" 
                    dataKey="tasksCompleted" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Tasks Completed"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="efficiency" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Efficiency %"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="quality" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    name="Quality %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskTypeDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {taskTypeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Stage Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workflowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" />
                <YAxis />
                <Bar dataKey="tasks" fill="#3b82f6" radius={4} name="Tasks" />
                <Bar dataKey="completion" fill="#10b981" radius={4} name="Completion %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Project Status */}
      <Card>
        <CardHeader>
          <CardTitle>Active Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Project</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Progress</th>
                  <th className="text-left py-3 px-4">Tasks</th>
                  <th className="text-left py-3 px-4">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {projectData.map((project, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{project.name}</td>
                    <td className="py-3 px-4">
                      <Badge className={getProjectStatusColor(project.status)}>
                        {project.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-sm">{project.progress}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">{project.tasks}</td>
                    <td className="py-3 px-4 text-sm">
                      {new Date(project.deadline).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Client Satisfaction */}
      <Card>
        <CardHeader>
          <CardTitle>Client Satisfaction Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {clientSatisfactionData.map((client, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">{client.client}</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Rating</span>
                    <span className={`font-medium ${getSatisfactionColor(client.satisfaction)}`}>
                      {client.satisfaction}/5.0
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Projects</span>
                    <span>{client.projects}</span>
                  </div>
                  <Badge variant="outline" className="w-full justify-center">
                    {client.feedback}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}