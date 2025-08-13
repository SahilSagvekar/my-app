import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePickerWithRange } from '../ui/date-picker-with-range';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Eye, Heart, MessageCircle, Share, Users, MousePointer, DollarSign, Calendar, Download, Filter } from 'lucide-react';

// Mock data for client analytics
const clients = [
  { id: 'all', name: 'All Clients' },
  { id: 'acme', name: 'Acme Corporation' },
  { id: 'techstart', name: 'Tech Startup Inc.' },
  { id: 'fashion', name: 'Fashion Forward' },
  { id: 'foodie', name: 'Foodie Delights' }
];

const socialPlatforms = [
  { id: 'all', name: 'All Platforms' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'twitter', name: 'Twitter' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'youtube', name: 'YouTube' }
];

const kpiMetrics = [
  {
    title: 'Total Views',
    value: '2.4M',
    change: '+15.2%',
    trend: 'up',
    icon: Eye,
    color: 'text-blue-600'
  },
  {
    title: 'Total Reach',
    value: '1.8M',
    change: '+22.8%',
    trend: 'up',
    icon: Users,
    color: 'text-green-600'
  },
  {
    title: 'Engagement Rate',
    value: '4.7%',
    change: '+0.8%',
    trend: 'up',
    icon: Heart,
    color: 'text-pink-600'
  },
  {
    title: 'Click-through Rate',
    value: '2.3%',
    change: '-0.2%',
    trend: 'down',
    icon: MousePointer,
    color: 'text-orange-600'
  },
  {
    title: 'Conversions',
    value: '1,247',
    change: '+18.9%',
    trend: 'up',
    icon: DollarSign,
    color: 'text-purple-600'
  },
  {
    title: 'Total Posts',
    value: '328',
    change: '+12',
    trend: 'up',
    icon: MessageCircle,
    color: 'text-indigo-600'
  }
];

const monthlyPerformanceData = [
  { month: 'Jan', views: 180000, reach: 150000, engagement: 8500, clicks: 4200, conversions: 89 },
  { month: 'Feb', views: 220000, reach: 180000, engagement: 10200, clicks: 5100, conversions: 112 },
  { month: 'Mar', views: 280000, reach: 230000, engagement: 13100, clicks: 6400, conversions: 145 },
  { month: 'Apr', views: 320000, reach: 270000, engagement: 15000, clicks: 7300, conversions: 167 },
  { month: 'May', views: 380000, reach: 315000, engagement: 17800, clicks: 8700, conversions: 198 },
  { month: 'Jun', views: 450000, reach: 380000, engagement: 21200, clicks: 10300, conversions: 234 }
];

const platformDistribution = [
  { platform: 'Instagram', views: 850000, color: '#E4405F' },
  { platform: 'Facebook', views: 680000, color: '#1877F2' },
  { platform: 'TikTok', views: 520000, color: '#000000' },
  { platform: 'LinkedIn', views: 280000, color: '#0A66C2' },
  { platform: 'Twitter', views: 220000, color: '#1DA1F2' },
  { platform: 'YouTube', views: 180000, color: '#FF0000' }
];

const clientPerformance = [
  { 
    client: 'Acme Corporation',
    views: 820000,
    reach: 690000,
    engagement: 38500,
    conversions: 456,
    roi: '245%'
  },
  { 
    client: 'Tech Startup Inc.',
    views: 650000,
    reach: 540000,
    engagement: 29800,
    conversions: 312,
    roi: '189%'
  },
  { 
    client: 'Fashion Forward',
    views: 480000,
    reach: 420000,
    engagement: 35600,
    conversions: 298,
    roi: '312%'
  },
  { 
    client: 'Foodie Delights',
    views: 380000,
    reach: 310000,
    engagement: 18900,
    conversions: 181,
    roi: '156%'
  }
];

export function AnalyticsTab() {
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [dateRange, setDateRange] = useState({
    from: new Date(2024, 0, 1), // Jan 1, 2024
    to: new Date() // Today
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Analytics Filters
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
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm">Platform</label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {socialPlatforms.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.name}
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

            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Data
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
            <CardTitle>Monthly Performance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Area 
                    type="monotone" 
                    dataKey="views" 
                    stackId="1"
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="reach" 
                    stackId="2"
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Platform Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={platformDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="views"
                  >
                    {platformDistribution.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {platformDistribution.map((platform, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: platform.color }}
                    />
                    <span>{platform.platform}</span>
                  </div>
                  <span className="font-medium">{(platform.views / 1000).toFixed(0)}K</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Engagement Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Line 
                    type="monotone" 
                    dataKey="engagement" 
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
                  <th className="text-left py-3 px-4">Reach</th>
                  <th className="text-left py-3 px-4">Engagement</th>
                  <th className="text-left py-3 px-4">Conversions</th>
                  <th className="text-left py-3 px-4">ROI</th>
                </tr>
              </thead>
              <tbody>
                {clientPerformance.map((client, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="font-medium">{client.client}</div>
                    </td>
                    <td className="py-3 px-4">
                      {(client.views / 1000).toFixed(0)}K
                    </td>
                    <td className="py-3 px-4">
                      {(client.reach / 1000).toFixed(0)}K
                    </td>
                    <td className="py-3 px-4">
                      {(client.engagement / 1000).toFixed(1)}K
                    </td>
                    <td className="py-3 px-4">
                      {client.conversions}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        {client.roi}
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