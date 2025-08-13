import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar, Download, FileText, TrendingUp, Eye, Heart, Share2, MousePointer, DollarSign, CreditCard, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { ClientCalendarView } from './ClientCalendarView';

// Mock data for posts
const mockPosts = [
  {
    id: 'post-001',
    title: 'Holiday Campaign Launch',
    thumbnail: '/api/placeholder/400/300',
    publishDate: '2024-08-01',
    platform: 'Instagram',
    type: 'video',
    status: 'published',
    views: 15420,
    engagement: 892,
    reach: 12300
  },
  {
    id: 'post-002',
    title: 'Summer Product Showcase',
    thumbnail: '/api/placeholder/400/300',
    publishDate: '2024-08-03',
    platform: 'YouTube',
    type: 'video',
    status: 'published',
    views: 8750,
    engagement: 445,
    reach: 7200
  },
  {
    id: 'post-003',
    title: 'Behind the Scenes',
    thumbnail: '/api/placeholder/400/300',
    publishDate: '2024-08-05',
    platform: 'Facebook',
    type: 'image',
    status: 'published',
    views: 5230,
    engagement: 312,
    reach: 4800
  },
  {
    id: 'post-004',
    title: 'Customer Testimonial',
    thumbnail: '/api/placeholder/400/300',
    publishDate: '2024-08-08',
    platform: 'LinkedIn',
    type: 'video',
    status: 'published',
    views: 3420,
    engagement: 186,
    reach: 2900
  },
  {
    id: 'post-005',
    title: 'Product Tutorial Series',
    thumbnail: '/api/placeholder/400/300',
    publishDate: '2024-08-12',
    platform: 'YouTube',
    type: 'video',
    status: 'published',
    views: 12100,
    engagement: 678,
    reach: 9800
  },
  {
    id: 'post-006',
    title: 'Flash Sale Announcement',
    thumbnail: '/api/placeholder/400/300',
    publishDate: '2024-08-15',
    platform: 'Instagram',
    type: 'image',
    status: 'published',
    views: 9850,
    engagement: 721,
    reach: 8200
  },
  {
    id: 'post-007',
    title: 'Team Spotlight',
    thumbnail: '/api/placeholder/400/300',
    publishDate: '2024-08-18',
    platform: 'Facebook',
    type: 'image',
    status: 'published',
    views: 4650,
    engagement: 298,
    reach: 3900
  },
  {
    id: 'post-008',
    title: 'Industry Insights',
    thumbnail: '/api/placeholder/400/300',
    publishDate: '2024-08-22',
    platform: 'LinkedIn',
    type: 'text',
    status: 'published',
    views: 2780,
    engagement: 154,
    reach: 2300
  },
  {
    id: 'post-009',
    title: 'Weekend Inspiration',
    thumbnail: '/api/placeholder/400/300',
    publishDate: '2024-08-25',
    platform: 'Instagram',
    type: 'image',
    status: 'published',
    views: 7340,
    engagement: 523,
    reach: 6100
  },
  {
    id: 'post-010',
    title: 'Monthly Recap Video',
    thumbnail: '/api/placeholder/400/300',
    publishDate: '2024-08-30',
    platform: 'YouTube',
    type: 'video',
    status: 'published',
    views: 11200,
    engagement: 634,
    reach: 9400
  }
];

// Mock analytics data
const dailyPerformanceData = [
  { date: '08/01', views: 2100, engagement: 145, reach: 1800 },
  { date: '08/02', views: 1800, engagement: 120, reach: 1500 },
  { date: '08/03', views: 3200, engagement: 220, reach: 2700 },
  { date: '08/04', views: 2800, engagement: 190, reach: 2400 },
  { date: '08/05', views: 2400, engagement: 165, reach: 2000 },
  { date: '08/06', views: 1900, engagement: 135, reach: 1600 },
  { date: '08/07', views: 2200, engagement: 150, reach: 1900 },
  { date: '08/08', views: 2600, engagement: 180, reach: 2200 },
  { date: '08/09', views: 2100, engagement: 140, reach: 1800 },
  { date: '08/10', views: 2900, engagement: 200, reach: 2500 },
  { date: '08/11', views: 3100, engagement: 215, reach: 2600 },
  { date: '08/12', views: 4200, engagement: 290, reach: 3500 },
  { date: '08/13', views: 3800, engagement: 260, reach: 3200 },
  { date: '08/14', views: 3400, engagement: 230, reach: 2900 },
  { date: '08/15', views: 4100, engagement: 285, reach: 3400 },
  { date: '08/16', views: 3600, engagement: 245, reach: 3000 },
  { date: '08/17', views: 3200, engagement: 220, reach: 2700 },
  { date: '08/18', views: 2800, engagement: 195, reach: 2400 },
  { date: '08/19', views: 2500, engagement: 170, reach: 2100 },
  { date: '08/20', views: 2900, engagement: 200, reach: 2500 },
  { date: '08/21', views: 3300, engagement: 225, reach: 2800 },
  { date: '08/22', views: 2700, engagement: 185, reach: 2300 },
  { date: '08/23', views: 2400, engagement: 165, reach: 2000 },
  { date: '08/24', views: 2800, engagement: 190, reach: 2400 },
  { date: '08/25', views: 3500, engagement: 240, reach: 2900 },
  { date: '08/26', views: 3100, engagement: 210, reach: 2600 },
  { date: '08/27', views: 2900, engagement: 200, reach: 2500 },
  { date: '08/28', views: 3200, engagement: 220, reach: 2700 },
  { date: '08/29', views: 3600, engagement: 245, reach: 3000 },
  { date: '08/30', views: 4000, engagement: 275, reach: 3300 }
];

const platformDistribution = [
  { name: 'Instagram', value: 35, posts: 3, color: '#E4405F' },
  { name: 'YouTube', value: 28, posts: 3, color: '#FF0000' },
  { name: 'Facebook', value: 22, posts: 2, color: '#1877F2' },
  { name: 'LinkedIn', value: 15, posts: 2, color: '#0A66C2' }
];

// Mock billing data
const billingData = {
  currentInvoice: {
    id: 'INV-2024-08',
    amount: 4850,
    dueDate: '2024-09-01',
    status: 'paid',
    services: [
      { name: 'Content Creation', quantity: 10, rate: 350, total: 3500 },
      { name: 'Social Media Management', quantity: 1, rate: 800, total: 800 },
      { name: 'Performance Analytics', quantity: 1, rate: 300, total: 300 },
      { name: 'Strategy Consultation', quantity: 1, rate: 250, total: 250 }
    ]
  },
  previousInvoices: [
    { id: 'INV-2024-07', amount: 4200, dueDate: '2024-08-01', status: 'paid' },
    { id: 'INV-2024-06', amount: 3950, dueDate: '2024-07-01', status: 'paid' },
    { id: 'INV-2024-05', amount: 4100, dueDate: '2024-06-01', status: 'paid' }
  ]
};

const currentDate = new Date(2024, 7, 30); // August 30, 2024

export function ClientMonthlyOverview() {
  const [selectedMonth, setSelectedMonth] = useState('2024-08');
  const [viewType, setViewType] = useState<'calendar' | 'list'>('list');
  
  // Calculate aggregated metrics
  const totalViews = mockPosts.reduce((sum, post) => sum + post.views, 0);
  const totalEngagement = mockPosts.reduce((sum, post) => sum + post.engagement, 0);
  const totalReach = mockPosts.reduce((sum, post) => sum + post.reach, 0);
  const averageEngagementRate = ((totalEngagement / totalViews) * 100).toFixed(2);
  
  const getPlatformIcon = (platform: string) => {
    const icons = {
      'Instagram': '📸',
      'YouTube': '📹', 
      'Facebook': '👥',
      'LinkedIn': '💼'
    };
    return icons[platform as keyof typeof icons] || '📱';
  };

  const getPlatformColor = (platform: string) => {
    const colors = {
      'Instagram': 'bg-pink-500',
      'YouTube': 'bg-red-500',
      'Facebook': 'bg-blue-500',
      'LinkedIn': 'bg-blue-700'
    };
    return colors[platform as keyof typeof colors] || 'bg-gray-500';
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Play className="h-4 w-4" />;
      case 'image': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const handleExport = (type: 'pdf' | 'csv') => {
    console.log(`Exporting ${type} for ${selectedMonth}`);
    // In real app, would trigger download
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getMonthName = (monthString: string) => {
    const [year, month] = monthString.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1>Client Portal</h1>
          <p className="text-muted-foreground mt-2">
            Track your monthly content performance, analytics, and billing
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024-08">August 2024</SelectItem>
              <SelectItem value="2024-07">July 2024</SelectItem>
              <SelectItem value="2024-06">June 2024</SelectItem>
              <SelectItem value="2024-05">May 2024</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={() => handleExport('pdf')}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Views</p>
                <h3>{formatNumber(totalViews)}</h3>
                <div className="flex items-center gap-1 text-sm text-green-600 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>+12.5%</span>
                </div>
              </div>
              <Eye className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reach</p>
                <h3>{formatNumber(totalReach)}</h3>
                <div className="flex items-center gap-1 text-sm text-green-600 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>+8.2%</span>
                </div>
              </div>
              <Share2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Engagement Rate</p>
                <h3>{averageEngagementRate}%</h3>
                <div className="flex items-center gap-1 text-sm text-green-600 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>+3.1%</span>
                </div>
              </div>
              <Heart className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Posts Published</p>
                <h3>{mockPosts.length}</h3>
                <div className="flex items-center gap-1 text-sm text-blue-600 mt-1">
                  <Calendar className="h-3 w-3" />
                  <span>On schedule</span>
                </div>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Daily Performance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="views" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                <Area type="monotone" dataKey="engagement" stackId="1" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={platformDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                  >
                    {platformDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Content Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Content Published in {getMonthName(selectedMonth)}</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={viewType === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewType('list')}
              >
                List View
              </Button>
              <Button
                variant={viewType === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewType('calendar')}
              >
                Calendar View
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewType === 'list' ? (
            <div className="space-y-4">
              {mockPosts.map((post) => (
                <div key={post.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  {/* Thumbnail */}
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                      {getContentTypeIcon(post.type)}
                    </div>
                    <div className={`absolute top-1 right-1 w-3 h-3 rounded-full ${getPlatformColor(post.platform)}`} />
                  </div>

                  {/* Content Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{post.title}</h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>{new Date(post.publishDate).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1">
                        <span>{getPlatformIcon(post.platform)}</span>
                        {post.platform}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {post.type}
                      </Badge>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="hidden sm:flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-medium">{formatNumber(post.views)}</p>
                      <p className="text-xs text-muted-foreground">Views</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{formatNumber(post.engagement)}</p>
                      <p className="text-xs text-muted-foreground">Engagement</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{formatNumber(post.reach)}</p>
                      <p className="text-xs text-muted-foreground">Reach</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ClientCalendarView posts={mockPosts} selectedMonth={selectedMonth} />
          )}
        </CardContent>
      </Card>

      {/* Billing & Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Billing & Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Current Invoice */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-medium">Current Invoice - {billingData.currentInvoice.id}</h4>
                  <p className="text-sm text-muted-foreground">
                    Due: {new Date(billingData.currentInvoice.dueDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={billingData.currentInvoice.status === 'paid' ? 'default' : 'destructive'}>
                    {billingData.currentInvoice.status === 'paid' ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Paid
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Unpaid
                      </>
                    )}
                  </Badge>
                  <span className="text-lg font-medium">
                    {formatCurrency(billingData.currentInvoice.amount)}
                  </span>
                </div>
              </div>

              {/* Service Breakdown */}
              <div className="space-y-2">
                {billingData.currentInvoice.services.map((service, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                    <div>
                      <span className="text-sm font-medium">{service.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {service.quantity} × {formatCurrency(service.rate)}
                      </span>
                    </div>
                    <span className="font-medium">{formatCurrency(service.total)}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </div>
            </div>

            {/* Previous Invoices */}
            <div>
              <h4 className="font-medium mb-3">Previous Invoices</h4>
              <div className="space-y-2">
                {billingData.previousInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{invoice.id}</p>
                        <p className="text-sm text-muted-foreground">
                          Due: {new Date(invoice.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Paid
                      </Badge>
                      <span className="font-medium">{formatCurrency(invoice.amount)}</span>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}