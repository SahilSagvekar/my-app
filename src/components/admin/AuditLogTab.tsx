// components/admin/AuditLogTab.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePickerWithRange } from '../ui/date-picker-with-range';
import { ScrollArea } from '../ui/scroll-area';
import { Shield, Search, Calendar, User, FileText, Settings, AlertTriangle, CheckCircle, Edit, Trash2, Plus, Download, Filter, RefreshCw } from 'lucide-react';

interface AuditLog {
  id: number;
  timestamp: string;
  action: string;
  actionType: string;
  user: string;
  userId: number | null;
  userRole: string;
  description: string;
  target: string;
  targetType: string;
  entity: string | null;
  entityId: string | null;
  severity: 'low' | 'medium' | 'high';
  ipAddress: string;
  userAgent: string;
  metadata?: any;
}

interface AuditLogStats {
  totalLogs: number;
  todayLogs: number;
  highSeverity: number;
  securityEvents: number;
}

const actionTypes = [
  { id: 'all', name: 'All Actions' },
  { id: 'CREATED', name: 'Creation' },
  { id: 'UPDATED', name: 'Update' },
  { id: 'DELETED', name: 'Deletion' },
  { id: 'APPROVED', name: 'Approval' },
  { id: 'REJECTED', name: 'Rejection' },
  { id: 'LOGIN', name: 'Security' },
  { id: 'PERMISSION', name: 'Permission' },
  { id: 'ROLE', name: 'Role Change' }
];

const severityLevels = [
  { id: 'all', name: 'All Levels' },
  { id: 'low', name: 'Low' },
  { id: 'medium', name: 'Medium' },
  { id: 'high', name: 'High' }
];

export function AuditLogTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  });

  // Data states
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditLogStats>({
    totalLogs: 0,
    todayLogs: 0,
    highSeverity: 0,
    securityEvents: 0
  });
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([
    { id: 'all', name: 'All Users' }
  ]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load data on mount and when filters change
  useEffect(() => {
    loadAuditLogs();
    loadStats();
  }, [searchTerm, actionTypeFilter, userFilter, dateRange]);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const res = await fetch('/api/admin/audit-logs/users');
      const data = await res.json();
      
      if (data.ok) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }

  async function loadAuditLogs() {
    try {
      setLoading(true);
      
      const startDate = dateRange.from?.toISOString().split('T')[0];
      const endDate = dateRange.to?.toISOString().split('T')[0];

      const params = new URLSearchParams({
        search: searchTerm,
        actionType: actionTypeFilter,
        userId: userFilter,
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      });

      const res = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await res.json();

      if (data.ok) {
        setAuditLogs(data.logs || []);
      } else {
        console.error('Failed to load audit logs:', data.message);
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const startDate = dateRange.from?.toISOString().split('T')[0];
      const endDate = dateRange.to?.toISOString().split('T')[0];

      const params = new URLSearchParams({
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      });

      const res = await fetch(`/api/admin/audit-logs/stats?${params}`);
      const data = await res.json();

      if (data.ok) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadAuditLogs();
    await loadStats();
    setRefreshing(false);
    console.log('Audit logs refreshed');
  }

  async function handleExport() {
    try {
      setExporting(true);
      
      const startDate = dateRange.from?.toISOString().split('T')[0];
      const endDate = dateRange.to?.toISOString().split('T')[0];

      const res = await fetch('/api/admin/audit-logs/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: 'csv',
          startDate,
          endDate
        })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('Audit logs exported successfully');
      } else {
        console.error('Failed to export audit logs');
      }
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  }

  // Apply severity filter on frontend (since backend doesn't filter by severity yet)
  const filteredLogs = severityFilter === 'all' 
    ? auditLogs 
    : auditLogs.filter(log => log.severity === severityFilter);

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
      system: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
      rejection: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    
    return (
      <Badge className={colors[actionType as keyof typeof colors] || colors.update}>
        {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString()
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Logs</p>
                <h3 className="text-2xl font-bold mt-2">{stats.totalLogs}</h3>
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
                <h3 className="text-2xl font-bold mt-2">{stats.todayLogs}</h3>
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
                <h3 className="text-2xl font-bold mt-2">{stats.highSeverity}</h3>
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
                <h3 className="text-2xl font-bold mt-2">{stats.securityEvents}</h3>
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
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExport} 
                disabled={exporting}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {exporting ? 'Exporting...' : 'Export Logs'}
              </Button>
            </div>
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

          {/* Results count */}
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {filteredLogs.length} of {auditLogs.length} logs
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
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => {
                      const { date, time } = formatTimestamp(log.timestamp);
                      return (
                        <tr key={log.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 text-sm">
                            <div>{date}</div>
                            <div className="text-muted-foreground text-xs">{time}</div>
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
                            <div className="max-w-[120px] truncate" title={log.ipAddress}>
                              {log.ipAddress}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No audit logs found matching your filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}