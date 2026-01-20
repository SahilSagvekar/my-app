import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { BarChart3, TrendingUp, Video, Palette, FileText, AlertTriangle, Award, Zap } from 'lucide-react';

export function QCReportsPage() {
  // Mock data for stats
  const approvalRate = 76.5;
  const avgReviewTime = 24;
  const weeklyReviews = 47;
  const firstPassRate = 68;

  return (
    <div className="space-y-6 bg-[#0a0e1a] p-6 rounded-lg">
      {/* Page Header */}
      <div>
        <h1 className="text-gray-100">QC Reports</h1>
        <p className="text-gray-400 mt-2">
          Analytics and metrics for quality control operations
        </p>
      </div>

      <Card className="bg-[#1e2330] border-[#2a3142]">
        <CardHeader>
          <CardTitle className="text-gray-100">Performance Metrics</CardTitle>
          <CardDescription className="text-gray-400">Track your QC performance and identify areas for improvement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-[#252b3d] border-[#2a3142]">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">Avg Review Time</p>
                  <h3 className="text-gray-100">{avgReviewTime} min</h3>
                  <Progress value={75} className="h-2" />
                  <p className="text-xs text-gray-500">Target: 30 min</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#252b3d] border-[#2a3142]">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">This Week</p>
                  <h3 className="text-gray-100">{weeklyReviews} reviews</h3>
                  <Progress value={94} className="h-2" />
                  <p className="text-xs text-gray-500">+12% vs last week</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#252b3d] border-[#2a3142]">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">Approval Rate</p>
                  <h3 className="text-gray-100">{approvalRate}%</h3>
                  <Progress value={approvalRate} className="h-2" />
                  <p className="text-xs text-gray-500">Industry avg: 75%</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#252b3d] border-[#2a3142]">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">First-Pass Rate</p>
                  <h3 className="text-gray-100">{firstPassRate}%</h3>
                  <Progress value={firstPassRate} className="h-2" />
                  <p className="text-xs text-gray-500">+5% vs last month</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator className="bg-[#2a3142]" />

          {/* Category Breakdown */}
          <div>
            <h3 className="font-medium mb-4 text-gray-100">Reviews by Category</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-[#2a3142] rounded-lg bg-[#252b3d]">
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-purple-400" />
                  <div>
                    <p className="font-medium text-gray-200">Video Content</p>
                    <p className="text-sm text-gray-400">28 reviews this month</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-200">82% approved</p>
                  <p className="text-sm text-green-400">Excellent</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border border-[#2a3142] rounded-lg bg-[#252b3d]">
                <div className="flex items-center gap-3">
                  <Palette className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="font-medium text-gray-200">Design Assets</p>
                    <p className="text-sm text-gray-400">35 reviews this month</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-200">71% approved</p>
                  <p className="text-sm text-yellow-400">Good</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border border-[#2a3142] rounded-lg bg-[#252b3d]">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-green-400" />
                  <div>
                    <p className="font-medium text-gray-200">Copywriting</p>
                    <p className="text-sm text-gray-400">12 reviews this month</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-200">91% approved</p>
                  <p className="text-sm text-green-400">Excellent</p>
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-[#2a3142]" />

          {/* Monthly Trend */}
          <div>
            <h3 className="font-medium mb-4 text-gray-100">Monthly Review Trend</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#252b3d] border border-[#2a3142] rounded-lg">
                <div>
                  <p className="font-medium text-gray-200">November 2024</p>
                  <p className="text-sm text-gray-400">Current month</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-200">75 reviews</p>
                  <div className="flex items-center gap-1 text-sm text-green-400">
                    <TrendingUp className="h-3 w-3" />
                    <span>+18%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border border-[#2a3142] rounded-lg bg-[#1a1f2e]">
                <div>
                  <p className="font-medium text-gray-200">October 2024</p>
                  <p className="text-sm text-gray-400">Previous month</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-200">64 reviews</p>
                  <p className="text-sm text-gray-500">Baseline</p>
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-[#2a3142]" />

          {/* Common Rejection Reasons */}
          <div>
            <h3 className="font-medium mb-4 text-gray-100">Top Rejection Reasons</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-900/20 border border-red-900/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-red-200">Brand color mismatch</span>
                </div>
                <Badge variant="destructive">18 cases</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-900/20 border border-red-900/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-red-200">Typography inconsistencies</span>
                </div>
                <Badge variant="destructive">14 cases</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-900/20 border border-red-900/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-red-200">Audio quality issues</span>
                </div>
                <Badge variant="destructive">11 cases</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-900/20 border border-red-900/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-red-200">Grid alignment errors</span>
                </div>
                <Badge variant="destructive">9 cases</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-900/20 border border-red-900/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-red-200">Missing required elements</span>
                </div>
                <Badge variant="destructive">7 cases</Badge>
              </div>
            </div>
          </div>

          <Separator className="bg-[#2a3142]" />

          {/* Achievements */}
          <div>
            <h3 className="font-medium mb-4 text-gray-100">Recent Achievements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 border border-yellow-700/50 rounded-lg bg-gradient-to-br from-yellow-900/20 to-yellow-800/20">
                <Award className="h-8 w-8 text-yellow-400" />
                <div>
                  <p className="font-medium text-yellow-200">Quality Champion</p>
                  <p className="text-sm text-yellow-300/70">90%+ approval rate for 30 days</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 border border-blue-700/50 rounded-lg bg-gradient-to-br from-blue-900/20 to-blue-800/20">
                <Zap className="h-8 w-8 text-blue-400" />
                <div>
                  <p className="font-medium text-blue-200">Speed Reviewer</p>
                  <p className="text-sm text-blue-300/70">50+ reviews completed this month</p>
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-[#2a3142]" />

          {/* Weekly Breakdown */}
          <div>
            <h3 className="font-medium mb-4 text-gray-100">This Week's Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 border border-[#2a3142] rounded-lg text-center bg-[#252b3d]">
                <p className="text-2xl font-medium text-green-400">34</p>
                <p className="text-sm text-gray-400">Approved</p>
              </div>
              <div className="p-3 border border-[#2a3142] rounded-lg text-center bg-[#252b3d]">
                <p className="text-2xl font-medium text-red-400">13</p>
                <p className="text-sm text-gray-400">Rejected</p>
              </div>
              <div className="p-3 border border-[#2a3142] rounded-lg text-center bg-[#252b3d]">
                <p className="text-2xl font-medium text-blue-400">22</p>
                <p className="text-sm text-gray-400">Avg Time (min)</p>
              </div>
              <div className="p-3 border border-[#2a3142] rounded-lg text-center bg-[#252b3d]">
                <p className="text-2xl font-medium text-purple-400">72%</p>
                <p className="text-sm text-gray-400">First Pass</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


// 'use client';

// import { useEffect, useState } from 'react';
// import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
// import { Badge } from '../ui/badge';
// import { Progress } from '../ui/progress';
// import { Separator } from '../ui/separator';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
// import { BarChart3, TrendingUp, Video, Palette, FileText, AlertTriangle, Award, Zap, Loader } from 'lucide-react';
// import { toast } from 'sonner';

// interface PerformanceMetrics {
//   avgReviewTime: number;
//   approvalRate: number;
//   firstPassRate: number;
//   thisWeekReviews: number;
// }

// interface ReviewByCategory {
//   category: string;
//   reviews: number;
//   approvalRate: number;
//   status: string;
// }

// interface RejectionReason {
//   reason: string;
//   cases: number;
// }

// interface MonthlyTrend {
//   month: string;
//   reviews: number;
// }

// interface WeeklyBreakdown {
//   approved: number;
//   rejected: number;
//   avgTime: number;
//   firstPassRate: number;
// }

// interface Analytics {
//   period: 'week' | 'month' | 'year';
//   qcSpecialistId: number;
//   performanceMetrics: PerformanceMetrics;
//   reviewsByCategory: ReviewByCategory[];
//   topRejectionReasons: RejectionReason[];
//   monthlyTrend: MonthlyTrend[];
//   weeklyBreakdown: WeeklyBreakdown;
//   achievements: {
//     qualityChampion: boolean;
//     speedReviewer: boolean;
//   };
// }

// export function QCReportsPage() {
//   const [analytics, setAnalytics] = useState<Analytics | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

//   useEffect(() => {
//     loadAnalytics();
//   }, [period]);

//   const loadAnalytics = async () => {
//     try {
//       setLoading(true);
//       const res = await fetch(`/api/qc-analytics?period=${period}`, {
//         credentials: 'include',
//       });

//       if (!res.ok) {
//         throw new Error('Failed to load analytics');
//       }

//       const data = await res.json();
//       setAnalytics(data);
//     } catch (err) {
//       console.error('Analytics load error:', err);
//       toast.error('Failed to load analytics');
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center h-96">
//         <div className="text-center space-y-4">
//           <Loader className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
//           <p className="text-muted-foreground">Loading analytics...</p>
//         </div>
//       </div>
//     );
//   }

//   if (!analytics) {
//     return (
//       <div className="flex items-center justify-center h-96">
//         <div className="text-center space-y-4">
//           <AlertTriangle className="h-12 w-12 mx-auto text-red-500" />
//           <p className="text-red-500">Failed to load analytics</p>
//         </div>
//       </div>
//     );
//   }

//   const { performanceMetrics, reviewsByCategory, topRejectionReasons, monthlyTrend, weeklyBreakdown, achievements } = analytics;

//   const getCategoryIcon = (category: string) => {
//     switch (category) {
//       case 'Video':
//         return <Video className="h-5 w-5 text-purple-600" />;
//       case 'Design':
//         return <Palette className="h-5 w-5 text-blue-600" />;
//       case 'Copywriting':
//         return <FileText className="h-5 w-5 text-green-600" />;
//       default:
//         return <BarChart3 className="h-5 w-5 text-gray-600" />;
//     }
//   };

//   const getStatusColor = (status: string) => {
//     switch (status) {
//       case 'Excellent':
//         return 'text-green-600';
//       case 'Good':
//         return 'text-yellow-600';
//       default:
//         return 'text-red-600';
//     }
//   };

//   return (
//     <div className="space-y-6">
//       {/* Page Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h1>QC Reports</h1>
//           <p className="text-muted-foreground mt-2">
//             Analytics and metrics for quality control operations
//           </p>
//         </div>
//         <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
//           <SelectTrigger className="w-40">
//             <SelectValue placeholder="Select period" />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="week">This Week</SelectItem>
//             <SelectItem value="month">This Month</SelectItem>
//             <SelectItem value="year">This Year</SelectItem>
//           </SelectContent>
//         </Select>
//       </div>

//       <Card>
//         <CardHeader>
//           <CardTitle>Performance Metrics</CardTitle>
//           <CardDescription>Track your QC performance and identify areas for improvement</CardDescription>
//         </CardHeader>
//         <CardContent className="space-y-6">
//           {/* Performance Metrics */}
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//             <Card>
//               <CardContent className="p-4">
//                 <div className="space-y-2">
//                   <p className="text-sm text-muted-foreground">Avg Review Time</p>
//                   <h3 className="text-2xl font-bold">{performanceMetrics.avgReviewTime} min</h3>
//                   <Progress value={Math.min((performanceMetrics.avgReviewTime / 30) * 100, 100)} className="h-2" />
//                   <p className="text-xs text-muted-foreground">Target: 30 min</p>
//                 </div>
//               </CardContent>
//             </Card>
//             <Card>
//               <CardContent className="p-4">
//                 <div className="space-y-2">
//                   <p className="text-sm text-muted-foreground">This {period === 'week' ? 'Week' : period === 'month' ? 'Month' : 'Year'}</p>
//                   <h3 className="text-2xl font-bold">{performanceMetrics.thisWeekReviews} reviews</h3>
//                   <Progress value={Math.min((performanceMetrics.thisWeekReviews / 50) * 100, 100)} className="h-2" />
//                   <p className="text-xs text-muted-foreground">Performance tracking</p>
//                 </div>
//               </CardContent>
//             </Card>
//             <Card>
//               <CardContent className="p-4">
//                 <div className="space-y-2">
//                   <p className="text-sm text-muted-foreground">Approval Rate</p>
//                   <h3 className="text-2xl font-bold">{performanceMetrics.approvalRate}%</h3>
//                   <Progress value={performanceMetrics.approvalRate} className="h-2" />
//                   <p className="text-xs text-muted-foreground">Industry avg: 75%</p>
//                 </div>
//               </CardContent>
//             </Card>
//             <Card>
//               <CardContent className="p-4">
//                 <div className="space-y-2">
//                   <p className="text-sm text-muted-foreground">First-Pass Rate</p>
//                   <h3 className="text-2xl font-bold">{performanceMetrics.firstPassRate}%</h3>
//                   <Progress value={performanceMetrics.firstPassRate} className="h-2" />
//                   <p className="text-xs text-muted-foreground">Quality indicator</p>
//                 </div>
//               </CardContent>
//             </Card>
//           </div>

//           <Separator />

//           {/* Category Breakdown */}
//           <div>
//             <h3 className="font-medium mb-4">Reviews by Category</h3>
//             <div className="space-y-3">
//               {reviewsByCategory.map((category, index) => (
//                 <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition">
//                   <div className="flex items-center gap-3">
//                     {getCategoryIcon(category.category)}
//                     <div>
//                       <p className="font-medium">{category.category}</p>
//                       <p className="text-sm text-muted-foreground">{category.reviews} reviews</p>
//                     </div>
//                   </div>
//                   <div className="text-right">
//                     <p className="font-medium">{category.approvalRate}% approved</p>
//                     <p className={`text-sm ${getStatusColor(category.status)}`}>{category.status}</p>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           <Separator />

//           {/* Monthly Trend */}
//           <div>
//             <h3 className="font-medium mb-4">Monthly Review Trend</h3>
//             <div className="space-y-3">
//               {monthlyTrend.map((trend, index) => (
//                 <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${index === 0 ? 'bg-accent/50' : 'border'}`}>
//                   <div>
//                     <p className="font-medium">{trend.month}</p>
//                     <p className="text-sm text-muted-foreground">{index === 0 ? 'Current period' : 'Previous'}</p>
//                   </div>
//                   <div className="text-right">
//                     <p className="font-medium">{trend.reviews} reviews</p>
//                     {index === 0 && (
//                       <div className="flex items-center gap-1 text-sm text-green-600">
//                         <TrendingUp className="h-3 w-3" />
//                         <span>Updated</span>
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           <Separator />

//           {/* Common Rejection Reasons */}
//           <div>
//             <h3 className="font-medium mb-4">Top Rejection Reasons</h3>
//             <div className="space-y-3">
//               {topRejectionReasons.length > 0 ? (
//                 topRejectionReasons.map((reason, index) => (
//                   <div key={index} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100/50 transition">
//                     <div className="flex items-center gap-2">
//                       <AlertTriangle className="h-4 w-4 text-red-600" />
//                       <span className="text-sm">{reason.reason}</span>
//                     </div>
//                     <Badge variant="destructive">{reason.cases} cases</Badge>
//                   </div>
//                 ))
//               ) : (
//                 <div className="p-4 text-center text-muted-foreground">
//                   <p>No rejection reasons yet - Keep up the great work!</p>
//                 </div>
//               )}
//             </div>
//           </div>

//           <Separator />

//           {/* Achievements */}
//           <div>
//             <h3 className="font-medium mb-4">Recent Achievements</h3>
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               <div className={`flex items-center gap-3 p-4 border rounded-lg ${achievements.qualityChampion ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200' : 'bg-gray-50 border-gray-200 opacity-50'}`}>
//                 <Award className={`h-8 w-8 ${achievements.qualityChampion ? 'text-yellow-600' : 'text-gray-400'}`} />
//                 <div>
//                   <p className="font-medium">Quality Champion</p>
//                   <p className="text-sm text-muted-foreground">90%+ approval rate for 30 days</p>
//                 </div>
//               </div>
//               <div className={`flex items-center gap-3 p-4 border rounded-lg ${achievements.speedReviewer ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200' : 'bg-gray-50 border-gray-200 opacity-50'}`}>
//                 <Zap className={`h-8 w-8 ${achievements.speedReviewer ? 'text-blue-600' : 'text-gray-400'}`} />
//                 <div>
//                   <p className="font-medium">Speed Reviewer</p>
//                   <p className="text-sm text-muted-foreground">50+ reviews completed this {period}</p>
//                 </div>
//               </div>
//             </div>
//           </div>

//           <Separator />

//           {/* Weekly Breakdown */}
//           <div>
//             <h3 className="font-medium mb-4">This {period === 'week' ? 'Week' : 'Month'}&#39;s Breakdown</h3>
//             <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
//               <div className="p-3 border rounded-lg text-center hover:bg-accent/50 transition">
//                 <p className="text-2xl font-medium text-green-600">{weeklyBreakdown.approved}</p>
//                 <p className="text-sm text-muted-foreground">Approved</p>
//               </div>
//               <div className="p-3 border rounded-lg text-center hover:bg-accent/50 transition">
//                 <p className="text-2xl font-medium text-red-600">{weeklyBreakdown.rejected}</p>
//                 <p className="text-sm text-muted-foreground">Rejected</p>
//               </div>
//               <div className="p-3 border rounded-lg text-center hover:bg-accent/50 transition">
//                 <p className="text-2xl font-medium text-blue-600">{weeklyBreakdown.avgTime}</p>
//                 <p className="text-sm text-muted-foreground">Avg Time (min)</p>
//               </div>
//               <div className="p-3 border rounded-lg text-center hover:bg-accent/50 transition">
//                 <p className="text-2xl font-medium text-purple-600">{weeklyBreakdown.firstPassRate}%</p>
//                 <p className="text-sm text-muted-foreground">First Pass</p>
//               </div>
//             </div>
//           </div>
//         </CardContent>
//       </Card>
//     </div>
//   );
// }