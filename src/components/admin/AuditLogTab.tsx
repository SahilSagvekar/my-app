import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePickerWithRange } from '../ui/date-picker-with-range';
import { ScrollArea } from '../ui/scroll-area';
import { Shield, Search, Calendar, User, FileText, Settings, AlertTriangle, CheckCircle, Edit, Trash2, Plus, Download, Filter } from 'lucide-react';

// Mock audit log data
const auditLogs = [
  {
    id: 1,
    timestamp: '2024-08-10 15:30:25',
    action: 'content_edited',
    actionType: 'edit',
    user: 'Emma Wilson',
    userRole: 'Editor',
    description: 'Modified video content for Acme Corp campaign',
    target: 'Video Campaign #VID-2024-003',
    targetType: 'project',
    client: 'Acme Corporation',
    severity: 'low',
    ipAddress: '192.168.1.45',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  {
    id: 2,
    timestamp: '2024-08-10 14:22:18',
    action: 'qc_approved',
    actionType: 'approval',
    user: 'David Rodriguez',
    userRole: 'QC',
    description: 'QC approved social media assets after revision',
    target: 'Social Media Asset #SM-2024-089',
    targetType: 'asset',
    client: 'Tech Startup Inc.',
    severity: 'low',
    ipAddress: '192.168.1.67',
    userAgent: 'Mozilla/5.0 (macOS; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  },
  {
    id: 3,
    timestamp: '2024-08-10 13:45:52',
    action: 'schedule_changed',
    actionType: 'modification',
    user: 'Lisa Park',
    userRole: 'Scheduler',
    description: 'Updated delivery schedule for Fashion Forward campaign',
    target: 'Campaign Schedule #CS-2024-012',
    targetType: 'schedule',
    client: 'Fashion Forward',
    severity: 'medium',
    ipAddress: '192.168.1.23',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  {
    id: 4,
    timestamp: '2024-08-10 12:15:33',
    action: 'client_data_updated',
    actionType: 'update',
    user: 'Sarah Johnson',
    userRole: 'Admin',
    description: 'Updated client contact information and billing details',
    target: 'Client Profile: Foodie Delights',
    targetType: 'client',
    client: 'Foodie Delights',
    severity: 'high',
    ipAddress: '192.168.1.10',
    userAgent: 'Mozilla/5.0 (macOS; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  },
  {
    id: 5,
    timestamp: '2024-08-10 11:30:41',
    action: 'user_role_changed',
    actionType: 'security',
    user: 'Sarah Johnson',
    userRole: 'Admin',
    description: 'Changed user role from Editor to Senior Editor',
    target: 'User: Michael Chen',
    targetType: 'user',
    client: 'Internal',
    severity: 'high',
    ipAddress: '192.168.1.10',
    userAgent: 'Mozilla/5.0 (macOS; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  },
  {
    id: 6,
    timestamp: '2024-08-10 10:45:29',
    action: 'project_created',
    actionType: 'creation',
    user: 'Michael Chen',
    userRole: 'Manager',
    description: 'Created new project for holiday marketing campaign',
    target: 'Project: Holiday Campaign 2024',
    targetType: 'project',
    client: 'Acme Corporation',
    severity: 'low',
    ipAddress: '192.168.1.34',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  {
    id: 7,
    timestamp: '2024-08-10 09:20:15',
    action: 'file_deleted',
    actionType: 'deletion',
    user: 'Emma Wilson',
    userRole: 'Editor',
    description: 'Deleted outdated design files from project folder',
    target: 'Design Files #DF-2024-067',
    targetType: 'file',
    client: 'Fashion Forward',
    severity: 'medium',
    ipAddress: '192.168.1.45',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  {
    id: 8,
    timestamp: '2024-08-09 16:55:42',
    action: 'system_backup',
    actionType: 'system',
    user: 'System',
    userRole: 'System',
    description: 'Automated daily backup completed successfully',
    target: 'Database Backup #DB-2024-08-09',
    targetType: 'system',
    client: 'Internal',
    severity: 'low',
    ipAddress: 'System',
    userAgent: 'System Process'
  },
  {
    id: 9,
    timestamp: '2024-08-09 15:30:18',
    action: 'login_failed',
    actionType: 'security',
    user: 'Unknown',
    userRole: 'Unknown',
    description: 'Failed login attempt with invalid credentials',
    target: 'Login Attempt',
    targetType: 'security',
    client: 'N/A',
    severity: 'high',
    ipAddress: '45.67.123.89',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
  },
  {
    id: 10,
    timestamp: '2024-08-09 14:12:07',
    action: 'permission_granted',
    actionType: 'security',
    user: 'Sarah Johnson',
    userRole: 'Admin',
    description: 'Granted file access permissions to new team member',
    target: 'User: James Thompson',
    targetType: 'user',
    client: 'Internal',
    severity: 'medium',
    ipAddress: '192.168.1.10',
    userAgent: 'Mozilla/5.0 (macOS; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  }
];

const actionTypes = [
  { id: 'all', name: 'All Actions' },
  { id: 'edit', name: 'Edit' },
  { id: 'approval', name: 'Approval' },
  { id: 'modification', name: 'Modification' },
  { id: 'update', name: 'Update' },
  { id: 'security', name: 'Security' },
  { id: 'creation', name: 'Creation' },
  { id: 'deletion', name: 'Deletion' },
  { id: 'system', name: 'System' }
];

const severityLevels = [
  { id: 'all', name: 'All Levels' },
  { id: 'low', name: 'Low' },
  { id: 'medium', name: 'Medium' },
  { id: 'high', name: 'High' }
];

const users = [
  { id: 'all', name: 'All Users' },
  { id: 'sarah', name: 'Sarah Johnson' },
  { id: 'michael', name: 'Michael Chen' },
  { id: 'emma', name: 'Emma Wilson' },
  { id: 'david', name: 'David Rodriguez' },
  { id: 'lisa', name: 'Lisa Park' },
  { id: 'james', name: 'James Thompson' },
  { id: 'system', name: 'System' }
];

export function AuditLogTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateRange, setDateRange] = useState({
    from: new Date(2024, 7, 9), // Aug 9, 2024
    to: new Date() // Today
  });

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.user.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActionType = actionTypeFilter === 'all' || log.actionType === actionTypeFilter;
    const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
    const matchesUser = userFilter === 'all' || log.user.toLowerCase().includes(userFilter);
    
    return matchesSearch && matchesActionType && matchesSeverity && matchesUser;
  });

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'edit': return <Edit className="h-4 w-4" />;
      case 'approval': return <CheckCircle className="h-4 w-4" />;
      case 'modification': return <Settings className="h-4 w-4" />;
      case 'update': return <FileText className="h-4 w-4" />;
      case 'security': return <Shield className="h-4 w-4" />;
      case 'creation': return <Plus className="h-4 w-4" />;
      case 'deletion': return <Trash2 className="h-4 w-4" />;
      case 'system': return <Settings className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    
    return (
      <Badge className={colors[severity as keyof typeof colors] || colors.low}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </Badge>
    );
  };

  const getActionTypeBadge = (actionType: string) => {
    const colors = {
      edit: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      approval: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      modification: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      update: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      security: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      creation: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      deletion: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      system: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200'
    };
    
    return (
      <Badge className={colors[actionType as keyof typeof colors] || colors.edit}>
        {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
      </Badge>
    );
  };

  const handleExport = () => {
    console.log('Exporting audit logs');
    // In a real app, this would generate and download the audit log export
  };

  const stats = {
    totalLogs: auditLogs.length,
    todayLogs: auditLogs.filter(log => log.timestamp.startsWith('2024-08-10')).length,
    highSeverity: auditLogs.filter(log => log.severity === 'high').length,
    securityEvents: auditLogs.filter(log => log.actionType === 'security').length
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Logs</p>
                <h3 className="mt-2">{stats.totalLogs}</h3>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Logs</p>
                <h3 className="mt-2">{stats.todayLogs}</h3>
              </div>
              <Calendar className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Severity</p>
                <h3 className="mt-2">{stats.highSeverity}</h3>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Security Events</p>
                <h3 className="mt-2">{stats.securityEvents}</h3>
              </div>
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Audit Log
            </CardTitle>
            <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Logs
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div className="space-y-2">
              <label className="text-sm">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm">Action Type</label>
              <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  {actionTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm">Severity</label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by severity" />
                </SelectTrigger>
                <SelectContent>
                  {severityLevels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm">User</label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
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
          </div>

          {/* Audit Log Table */}
          <ScrollArea className="h-[600px] w-full border rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="text-left py-3 px-4 min-w-[140px]">Timestamp</th>
                    <th className="text-left py-3 px-4 min-w-[120px]">Action</th>
                    <th className="text-left py-3 px-4 min-w-[120px]">User</th>
                    <th className="text-left py-3 px-4 min-w-[300px]">Description</th>
                    <th className="text-left py-3 px-4 min-w-[200px]">Target</th>
                    <th className="text-left py-3 px-4 min-w-[100px]">Severity</th>
                    <th className="text-left py-3 px-4 min-w-[120px]">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 text-sm">
                        <div>{log.timestamp.split(' ')[0]}</div>
                        <div className="text-muted-foreground text-xs">
                          {log.timestamp.split(' ')[1]}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.actionType)}
                          {getActionTypeBadge(log.actionType)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-sm">{log.user}</div>
                          <div className="text-xs text-muted-foreground">{log.userRole}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">{log.description}</div>
                        {log.client !== 'Internal' && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Client: {log.client}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">{log.target}</div>
                        <div className="text-xs text-muted-foreground">
                          Type: {log.targetType}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getSeverityBadge(log.severity)}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="max-w-[120px] truncate">
                          {log.ipAddress}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}