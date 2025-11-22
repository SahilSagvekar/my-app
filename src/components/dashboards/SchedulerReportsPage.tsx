import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Video, Users, Clock, AlertTriangle, Award, Zap, CheckCircle } from 'lucide-react';
import { useTaskWorkflow, WorkflowTask } from '../workflow/TaskWorkflowEngine';

export function SchedulerReportsPage() {
  // Mock data for stats
  const schedulingEfficiency = 87;
  const avgScheduleTime = 18;
  const weeklySchedules = 32;
  const onTimeRate = 94;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1>Schedule Reports</h1>
        <p className="text-muted-foreground mt-2">
          Analytics and metrics for production scheduling operations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>Track your scheduling performance and optimize production workflows</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Avg Schedule Time</p>
                  <h3>{avgScheduleTime} min</h3>
                  <Progress value={85} className="h-2" />
                  <p className="text-xs text-muted-foreground">Target: 20 min</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">This Week</p>
                  <h3>{weeklySchedules} schedules</h3>
                  <Progress value={94} className="h-2" />
                  <p className="text-xs text-muted-foreground">+8% vs last week</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Efficiency Rate</p>
                  <h3>{schedulingEfficiency}%</h3>
                  <Progress value={schedulingEfficiency} className="h-2" />
                  <p className="text-xs text-muted-foreground">Industry avg: 80%</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">On-Time Rate</p>
                  <h3>{onTimeRate}%</h3>
                  <Progress value={onTimeRate} className="h-2" />
                  <p className="text-xs text-muted-foreground">+3% vs last month</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Category Breakdown */}
          <div>
            <h3 className="font-medium mb-4">Schedules by Category</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Video Production</p>
                    <p className="text-sm text-muted-foreground">42 shoots scheduled this month</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">96% on-time</p>
                  <p className="text-sm text-green-600">Excellent</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium">Client Meetings</p>
                    <p className="text-sm text-muted-foreground">28 meetings scheduled this month</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">89% on-time</p>
                  <p className="text-sm text-yellow-600">Good</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Content Deliveries</p>
                    <p className="text-sm text-muted-foreground">19 deliveries scheduled this month</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">100% on-time</p>
                  <p className="text-sm text-green-600">Perfect</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Monthly Trend */}
          <div>
            <h3 className="font-medium mb-4">Monthly Scheduling Trend</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                <div>
                  <p className="font-medium">November 2024</p>
                  <p className="text-sm text-muted-foreground">Current month</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">89 schedules</p>
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <TrendingUp className="h-3 w-3" />
                    <span>+12%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">October 2024</p>
                  <p className="text-sm text-muted-foreground">Previous month</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">79 schedules</p>
                  <p className="text-sm text-muted-foreground">Baseline</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Common Scheduling Issues */}
          <div>
            <h3 className="font-medium mb-4">Common Scheduling Issues</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">Equipment conflicts</span>
                </div>
                <Badge variant="outline" className="bg-white">8 cases</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">Studio double-booking</span>
                </div>
                <Badge variant="outline" className="bg-white">5 cases</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">Team availability mismatch</span>
                </div>
                <Badge variant="outline" className="bg-white">4 cases</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">Last-minute client changes</span>
                </div>
                <Badge variant="outline" className="bg-white">3 cases</Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Resource Utilization */}
          <div>
            <h3 className="font-medium mb-4">Resource Utilization</h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Studio A</span>
                  <span className="font-medium">85% utilized</span>
                </div>
                <Progress value={85} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Studio B</span>
                  <span className="font-medium">72% utilized</span>
                </div>
                <Progress value={72} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Camera Equipment</span>
                  <span className="font-medium">91% utilized</span>
                </div>
                <Progress value={91} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Videography Team</span>
                  <span className="font-medium">78% utilized</span>
                </div>
                <Progress value={78} className="h-2" />
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
                  <p className="font-medium">Perfect Scheduler</p>
                  <p className="text-sm text-muted-foreground">Zero conflicts for 30 days</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-blue-100">
                <Zap className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="font-medium">Speed Planner</p>
                  <p className="text-sm text-muted-foreground">50+ schedules this month</p>
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
                <p className="text-2xl font-medium text-green-600">24</p>
                <p className="text-sm text-muted-foreground">Scheduled</p>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <p className="text-2xl font-medium text-blue-600">8</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <p className="text-2xl font-medium text-purple-600">16</p>
                <p className="text-sm text-muted-foreground">Avg Time (min)</p>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <p className="text-2xl font-medium text-orange-600">2</p>
                <p className="text-sm text-muted-foreground">Conflicts</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Team Performance */}
          <div>
            <h3 className="font-medium mb-4">Team Scheduling Performance</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="font-medium text-blue-600">EW</span>
                  </div>
                  <div>
                    <p className="font-medium">Emma White (You)</p>
                    <p className="text-sm text-muted-foreground">Lead Scheduler</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">32 schedules</p>
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>94% on-time</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
