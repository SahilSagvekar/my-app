import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePickerWithRange } from '../ui/date-picker-with-range';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Eye, Heart, MessageCircle, Share, Users, MousePointer, DollarSign, Calendar, Download, Filter, RefreshCw, Youtube, Instagram } from 'lucide-react';
import { DateRangePicker } from '../ui/date-range-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { MetaAnalyticsWrapper } from '../meta/MetaAnalyticsWrapper';

// Types for data
interface AnalyticsData {
  summary: {
    totalViews: number;
    viewsChange: string;
    totalEngagement: number;
    engagementChange: string;
    connectedChannels: number;
  };
  dailyData: Array<{ date: string; views: number; engagement: number }>;
  clientPerformance: Array<{ id: string; name: string; views: number; engagement: number; subs: number }>;
  clients: Array<{ id: string; name: string }>;
}

export function AnalyticsTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedRange, setSelectedRange] = useState('30d');

  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/reports/youtube-analytics?range=${selectedRange}&clientId=${selectedClient}`);
      const json = await res.json();
      if (json.ok) {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClient, selectedRange]);

  const handleRefresh = () => fetchData();


  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  const kpiMetrics = [
    {
      title: 'Total aggregate Views',
      value: (data?.summary.totalViews || 0).toLocaleString(),
      change: data?.summary.viewsChange || '+0%',
      trend: data?.summary.viewsChange.startsWith('+') ? 'up' : 'down',
      icon: Eye,
      color: 'text-blue-600'
    },
    {
      title: 'Connected Channels',
      value: data?.summary.connectedChannels || '0',
      change: 'Active',
      trend: 'up',
      icon: Users,
      color: 'text-green-600'
    },
    {
      title: 'Total Engagement',
      value: (data?.summary.totalEngagement || 0).toLocaleString(),
      change: data?.summary.engagementChange || '+0%',
      trend: data?.summary.engagementChange.startsWith('+') ? 'up' : 'down',
      icon: Heart,
      color: 'text-pink-600'
    }
  ];

  return (
    <Tabs defaultValue="youtube" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
        <TabsTrigger value="youtube" className="flex items-center gap-2">
          <Youtube className="h-4 w-4 text-red-600" />
          YouTube
        </TabsTrigger>
        <TabsTrigger value="instagram" className="flex items-center gap-2">
          <Instagram className="h-4 w-4 text-pink-600" />
          Instagram
        </TabsTrigger>
      </TabsList>

      <TabsContent value="youtube" className="space-y-6 border-none p-0 outline-none">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              YouTube Analytics Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <label className="text-sm">Client</label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {data?.clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm">Range</label>
                <Select value={selectedRange} onValueChange={setSelectedRange}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="28d">Last 28 Days</SelectItem>
                    <SelectItem value="90d">Last 90 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={fetchData} variant="outline" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>

            </div>
          </CardContent>
        </Card>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpiMetrics.map((metric, index) => {
            const Icon = metric.icon;
            const isPositive = metric.trend === 'up';

            return (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{metric.title}</p>
                      <h3 className="mt-2">{metric.value}</h3>
                      <div className="flex items-center gap-1 mt-1">
                        {isPositive ? (
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-600" />
                        )}
                        <span className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {metric.change}
                        </span>
                      </div>
                    </div>
                    <Icon className={`h-6 w-6 ${metric.color}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Performance Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Performance Trend */}
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle>Performance Trend (Views & Engagement)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.dailyData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="views"
                      name="Views"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="engagement"
                      name="Engagement"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>


          {/* Engagement over time for current daily data */}
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle>Daily Engagement Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.dailyData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="engagement"
                      name="Engagement"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ fill: '#f59e0b' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Client Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Client Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Client</th>
                    <th className="text-left py-3 px-4">Total Views</th>
                    <th className="text-left py-3 px-4">Engagement</th>
                    <th className="text-left py-3 px-4">Current Subscribers</th>
                    <th className="text-left py-3 px-4">Status</th>
                  </tr>

                </thead>
                <tbody>
                  {data?.clientPerformance.map((client, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="font-medium">{client.name}</div>
                      </td>
                      <td className="py-3 px-4">
                        {client.views.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        {client.engagement.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        {client.subs.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">
                          ACTIVE
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="instagram" className="border-none p-0 outline-none">
        <MetaAnalyticsWrapper />
      </TabsContent>
    </Tabs>
  );
}