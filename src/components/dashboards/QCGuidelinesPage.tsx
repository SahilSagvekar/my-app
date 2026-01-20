import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Separator } from '../ui/separator';
import { CheckCircle, Video, Palette, FileText, AlertTriangle, Target } from 'lucide-react';

export function QCGuidelinesPage() {
  return (
    <div className="space-y-6 bg-[#0a0e1a] p-6 rounded-lg">
      {/* Page Header */}
      <div>
        <h1 className="text-gray-100">QC Guidelines</h1>
        <p className="text-gray-400 mt-2">
          Standards and best practices for quality control reviews
        </p>
      </div>

      <Card className="bg-[#1e2330] border-[#2a3142]">
        <CardHeader>
          <CardTitle className="text-gray-100">Quality Control Standards</CardTitle>
          <CardDescription className="text-gray-400">Comprehensive guidelines for reviewing all content types</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Video QC Guidelines */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-purple-900/30 rounded-lg">
                <Video className="h-5 w-5 text-purple-400" />
              </div>
              <h3 className="font-medium text-gray-100">Video Content Review</h3>
            </div>
            <div className="space-y-3 ml-11">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-200">Technical Quality</p>
                  <p className="text-sm text-gray-400">Check resolution (min 1920x1080), frame rate (24-60fps), audio levels (-6dB to -3dB), and color grading consistency</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-200">Brand Compliance</p>
                  <p className="text-sm text-gray-400">Verify logo placement, brand colors match guidelines, correct fonts used, and approved messaging</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-200">Content Accuracy</p>
                  <p className="text-sm text-gray-400">Review for typos, factual accuracy, timestamps, transitions, and overall flow</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-200">Client Requirements</p>
                  <p className="text-sm text-gray-400">Ensure all deliverables match project brief, runtime requirements, and platform specifications</p>
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-[#2a3142]" />

          {/* Design QC Guidelines */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-blue-900/30 rounded-lg">
                <Palette className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="font-medium text-gray-100">Design Asset Review</h3>
            </div>
            <div className="space-y-3 ml-11">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-200">Design System Compliance</p>
                  <p className="text-sm text-gray-400">Verify 8px grid alignment, proper spacing, correct typography scale, and color system usage</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-200">Technical Specifications</p>
                  <p className="text-sm text-gray-400">Check file formats, dimensions, resolution (min 72dpi web, 300dpi print), and color modes (RGB/CMYK)</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-200">Visual Consistency</p>
                  <p className="text-sm text-gray-400">Ensure consistent styling across all assets, proper hierarchy, and accessibility standards (WCAG AA)</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-200">Asset Preparation</p>
                  <p className="text-sm text-gray-400">Verify proper naming conventions, organized layers, and export settings for intended use</p>
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-[#2a3142]" />

          {/* Common Issues */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-red-900/30 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="font-medium text-gray-100">Common Issues to Flag</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-11">
              <div className="p-3 border border-red-900/50 rounded-lg bg-red-900/20">
                <p className="font-medium text-sm text-red-300 mb-1">Critical Issues</p>
                <ul className="text-sm text-red-200 space-y-1">
                  <li>• Incorrect brand colors or logo</li>
                  <li>• Spelling or grammatical errors</li>
                  <li>• Missing required elements</li>
                  <li>• Audio sync issues</li>
                  <li>• Broken links or assets</li>
                </ul>
              </div>
              <div className="p-3 border border-yellow-900/50 rounded-lg bg-yellow-900/20">
                <p className="font-medium text-sm text-yellow-300 mb-1">Minor Issues</p>
                <ul className="text-sm text-yellow-200 space-y-1">
                  <li>• Inconsistent spacing</li>
                  <li>• Minor color variations</li>
                  <li>• Suboptimal transitions</li>
                  <li>• Small alignment issues</li>
                  <li>• Typography inconsistencies</li>
                </ul>
              </div>
            </div>
          </div>

          <Separator className="bg-[#2a3142]" />

          {/* Review Process */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-green-900/30 rounded-lg">
                <Target className="h-5 w-5 text-green-400" />
              </div>
              <h3 className="font-medium text-gray-100">Review Process Best Practices</h3>
            </div>
            <div className="space-y-3 ml-11">
              <div className="flex items-center gap-2 p-3 bg-[#252b3d] rounded-lg">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-medium flex-shrink-0">1</span>
                <p className="text-sm text-gray-300">Review tasks in FIFO order (oldest first) to ensure fair processing</p>
              </div>
              <div className="flex items-center gap-2 p-3 bg-[#252b3d] rounded-lg">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-medium flex-shrink-0">2</span>
                <p className="text-sm text-gray-300">Check all files thoroughly before making approval decision</p>
              </div>
              <div className="flex items-center gap-2 p-3 bg-[#252b3d] rounded-lg">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-medium flex-shrink-0">3</span>
                <p className="text-sm text-gray-300">Provide clear, actionable feedback for rejected items</p>
              </div>
              <div className="flex items-center gap-2 p-3 bg-[#252b3d] rounded-lg">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-medium flex-shrink-0">4</span>
                <p className="text-sm text-gray-300">Verify workflow destination before approval (Client/Scheduler)</p>
              </div>
              <div className="flex items-center gap-2 p-3 bg-[#252b3d] rounded-lg">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-medium flex-shrink-0">5</span>
                <p className="text-sm text-gray-300">Document any deviations from standard guidelines in feedback</p>
              </div>
            </div>
          </div>

          <Separator className="bg-[#2a3142]" />

          {/* Copywriting Guidelines */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-green-900/30 rounded-lg">
                <FileText className="h-5 w-5 text-green-400" />
              </div>
              <h3 className="font-medium text-gray-100">Copywriting & Content Review</h3>
            </div>
            <div className="space-y-3 ml-11">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-200">Grammar & Spelling</p>
                  <p className="text-sm text-gray-400">Check for typos, punctuation errors, and proper grammar usage</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-200">Brand Voice</p>
                  <p className="text-sm text-gray-400">Ensure tone matches brand guidelines and target audience</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-200">Factual Accuracy</p>
                  <p className="text-sm text-gray-400">Verify statistics, dates, names, and product information</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-200">Call-to-Action</p>
                  <p className="text-sm text-gray-400">Confirm CTAs are clear, compelling, and properly placed</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
