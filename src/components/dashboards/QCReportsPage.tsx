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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1>QC Reports</h1>
        <p className="text-muted-foreground mt-2">
          Analytics and metrics for quality control operations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>Track your QC performance and identify areas for improvement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Avg Review Time</p>
                  <h3>{avgReviewTime} min</h3>
                  <Progress value={75} className="h-2" />
                  <p className="text-xs text-muted-foreground">Target: 30 min</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">This Week</p>
                  <h3>{weeklyReviews} reviews</h3>
                  <Progress value={94} className="h-2" />
                  <p className="text-xs text-muted-foreground">+12% vs last week</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Approval Rate</p>
                  <h3>{approvalRate}%</h3>
                  <Progress value={approvalRate} className="h-2" />
                  <p className="text-xs text-muted-foreground">Industry avg: 75%</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">First-Pass Rate</p>
                  <h3>{firstPassRate}%</h3>
                  <Progress value={firstPassRate} className="h-2" />
                  <p className="text-xs text-muted-foreground">+5% vs last month</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Category Breakdown */}
          <div>
            <h3 className="font-medium mb-4">Reviews by Category</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium">Video Content</p>
                    <p className="text-sm text-muted-foreground">28 reviews this month</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">82% approved</p>
                  <p className="text-sm text-green-600">Excellent</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Palette className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Design Assets</p>
                    <p className="text-sm text-muted-foreground">35 reviews this month</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">71% approved</p>
                  <p className="text-sm text-yellow-600">Good</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Copywriting</p>
                    <p className="text-sm text-muted-foreground">12 reviews this month</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">91% approved</p>
                  <p className="text-sm text-green-600">Excellent</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Monthly Trend */}
          <div>
            <h3 className="font-medium mb-4">Monthly Review Trend</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                <div>
                  <p className="font-medium">November 2024</p>
                  <p className="text-sm text-muted-foreground">Current month</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">75 reviews</p>
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <TrendingUp className="h-3 w-3" />
                    <span>+18%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">October 2024</p>
                  <p className="text-sm text-muted-foreground">Previous month</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">64 reviews</p>
                  <p className="text-sm text-muted-foreground">Baseline</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Common Rejection Reasons */}
          <div>
            <h3 className="font-medium mb-4">Top Rejection Reasons</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Brand color mismatch</span>
                </div>
                <Badge variant="destructive">18 cases</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Typography inconsistencies</span>
                </div>
                <Badge variant="destructive">14 cases</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Audio quality issues</span>
                </div>
                <Badge variant="destructive">11 cases</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Grid alignment errors</span>
                </div>
                <Badge variant="destructive">9 cases</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Missing required elements</span>
                </div>
                <Badge variant="destructive">7 cases</Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Achievements */}
          <div>
            <h3 className="font-medium mb-4">Recent Achievements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-gradient-to-br from-yellow-50 to-yellow-100">
                <Award className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="font-medium">Quality Champion</p>
                  <p className="text-sm text-muted-foreground">90%+ approval rate for 30 days</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-blue-100">
                <Zap className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="font-medium">Speed Reviewer</p>
                  <p className="text-sm text-muted-foreground">50+ reviews completed this month</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Weekly Breakdown */}
          <div>
            <h3 className="font-medium mb-4">This Week's Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 border rounded-lg text-center">
                <p className="text-2xl font-medium text-green-600">34</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <p className="text-2xl font-medium text-red-600">13</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <p className="text-2xl font-medium text-blue-600">22</p>
                <p className="text-sm text-muted-foreground">Avg Time (min)</p>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <p className="text-2xl font-medium text-purple-600">72%</p>
                <p className="text-sm text-muted-foreground">First Pass</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
