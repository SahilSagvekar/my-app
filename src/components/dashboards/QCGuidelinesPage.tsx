import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Separator } from '../ui/separator';
import { CheckCircle, Video, Palette, FileText, AlertTriangle, Target } from 'lucide-react';

export function QCGuidelinesPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1>QC Guidelines</h1>
        <p className="text-muted-foreground mt-2">
          Standards and best practices for quality control reviews
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quality Control Standards</CardTitle>
          <CardDescription>Comprehensive guidelines for reviewing all content types</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Video QC Guidelines */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Video className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="font-medium">Video Content Review</h3>
            </div>
            <div className="space-y-3 ml-11">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Technical Quality</p>
                  <p className="text-sm text-muted-foreground">Check resolution (min 1920x1080), frame rate (24-60fps), audio levels (-6dB to -3dB), and color grading consistency</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Brand Compliance</p>
                  <p className="text-sm text-muted-foreground">Verify logo placement, brand colors match guidelines, correct fonts used, and approved messaging</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Content Accuracy</p>
                  <p className="text-sm text-muted-foreground">Review for typos, factual accuracy, timestamps, transitions, and overall flow</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Client Requirements</p>
                  <p className="text-sm text-muted-foreground">Ensure all deliverables match project brief, runtime requirements, and platform specifications</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Design QC Guidelines */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Palette className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-medium">Design Asset Review</h3>
            </div>
            <div className="space-y-3 ml-11">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Design System Compliance</p>
                  <p className="text-sm text-muted-foreground">Verify 8px grid alignment, proper spacing, correct typography scale, and color system usage</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Technical Specifications</p>
                  <p className="text-sm text-muted-foreground">Check file formats, dimensions, resolution (min 72dpi web, 300dpi print), and color modes (RGB/CMYK)</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Visual Consistency</p>
                  <p className="text-sm text-muted-foreground">Ensure consistent styling across all assets, proper hierarchy, and accessibility standards (WCAG AA)</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Asset Preparation</p>
                  <p className="text-sm text-muted-foreground">Verify proper naming conventions, organized layers, and export settings for intended use</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Common Issues */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="font-medium">Common Issues to Flag</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-11">
              <div className="p-3 border border-red-200 rounded-lg bg-red-50">
                <p className="font-medium text-sm text-red-900 mb-1">Critical Issues</p>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Incorrect brand colors or logo</li>
                  <li>• Spelling or grammatical errors</li>
                  <li>• Missing required elements</li>
                  <li>• Audio sync issues</li>
                  <li>• Broken links or assets</li>
                </ul>
              </div>
              <div className="p-3 border border-yellow-200 rounded-lg bg-yellow-50">
                <p className="font-medium text-sm text-yellow-900 mb-1">Minor Issues</p>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Inconsistent spacing</li>
                  <li>• Minor color variations</li>
                  <li>• Suboptimal transitions</li>
                  <li>• Small alignment issues</li>
                  <li>• Typography inconsistencies</li>
                </ul>
              </div>
            </div>
          </div>

          <Separator />

          {/* Review Process */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Target className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="font-medium">Review Process Best Practices</h3>
            </div>
            <div className="space-y-3 ml-11">
              <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex-shrink-0">1</span>
                <p className="text-sm">Review tasks in FIFO order (oldest first) to ensure fair processing</p>
              </div>
              <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex-shrink-0">2</span>
                <p className="text-sm">Check all files thoroughly before making approval decision</p>
              </div>
              <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex-shrink-0">3</span>
                <p className="text-sm">Provide clear, actionable feedback for rejected items</p>
              </div>
              <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex-shrink-0">4</span>
                <p className="text-sm">Verify workflow destination before approval (Client/Scheduler)</p>
              </div>
              <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex-shrink-0">5</span>
                <p className="text-sm">Document any deviations from standard guidelines in feedback</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Copywriting Guidelines */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="font-medium">Copywriting & Content Review</h3>
            </div>
            <div className="space-y-3 ml-11">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Grammar & Spelling</p>
                  <p className="text-sm text-muted-foreground">Check for typos, punctuation errors, and proper grammar usage</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Brand Voice</p>
                  <p className="text-sm text-muted-foreground">Ensure tone matches brand guidelines and target audience</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Factual Accuracy</p>
                  <p className="text-sm text-muted-foreground">Verify statistics, dates, names, and product information</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Call-to-Action</p>
                  <p className="text-sm text-muted-foreground">Confirm CTAs are clear, compelling, and properly placed</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
