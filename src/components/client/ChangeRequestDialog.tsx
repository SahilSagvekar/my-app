import { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Card, CardContent } from '../ui/card';
import { VisuallyHidden } from '../ui/visually-hidden';
import { 
  MessageSquare, 
  Send, 
  AlertCircle, 
  Clock, 
  FileText,
  Video,
  Image as ImageIcon,
  Monitor
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface ChangeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approval: any;
  onSubmitChanges: (changeRequest: ChangeRequest) => void;
}

interface ChangeRequest {
  category: 'content' | 'design' | 'timing' | 'technical' | 'other';
  description: string;
  specificIssues: string[];
  additionalNotes?: string;
  requestRevision: boolean;
}

const changeCategories = [
  { value: 'content', label: 'Content Changes', description: 'Text, messaging, or narrative adjustments' },
  { value: 'design', label: 'Design Changes', description: 'Visual elements, colors, layout modifications' },
  { value: 'timing', label: 'Timing Changes', description: 'Pacing, duration, or sequence adjustments' },
  { value: 'technical', label: 'Technical Issues', description: 'Quality, format, or technical problems' },
  { value: 'other', label: 'Other', description: 'Other feedback or requests' }
];

// Removed priority levels as requested

const commonIssues = {
  content: [
    'Messaging doesn\'t align with brand voice',
    'Text needs to be shorter/longer',
    'Call-to-action needs adjustment',
    'Information is missing or incorrect',
    'Tone needs to be more/less formal'
  ],
  design: [
    'Colors don\'t match brand guidelines',
    'Layout needs restructuring',
    'Typography issues',
    'Images need to be replaced',
    'Logo placement or sizing issues'
  ],
  timing: [
    'Video pacing is too fast/slow',
    'Transitions need adjustment',
    'Audio sync issues',
    'Duration needs to be shorter/longer',
    'Scene timing problems'
  ],
  technical: [
    'Audio quality issues',
    'Video resolution problems',
    'File format incompatible',
    'Compression artifacts',
    'Performance issues'
  ],
  other: [
    'Legal compliance concerns',
    'Accessibility improvements needed',
    'Platform-specific requirements',
    'Client stakeholder feedback',
    'Competition considerations'
  ]
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'Video': return <Video className="h-4 w-4" />;
    case 'Graphics': return <ImageIcon className="h-4 w-4" />;
    case 'Web Graphics': return <Monitor className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

// Removed priority color function as priority levels are removed

export function ChangeRequestDialog({ open, onOpenChange, approval, onSubmitChanges }: ChangeRequestDialogProps) {
  const [changeRequest, setChangeRequest] = useState<ChangeRequest>({
    category: 'design',
    description: '',
    specificIssues: [],
    additionalNotes: '',
    requestRevision: true
  });

  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);

  const handleIssueToggle = (issue: string, checked: boolean) => {
    if (checked) {
      setSelectedIssues(prev => [...prev, issue]);
    } else {
      setSelectedIssues(prev => prev.filter(i => i !== issue));
    }
  };

  const handleSubmit = () => {
    if (!changeRequest.description.trim()) {
      toast('❌ Error', {
        description: 'Please provide a detailed description of the changes needed.',
      });
      return;
    }

    const finalChangeRequest = {
      ...changeRequest,
      specificIssues: selectedIssues,
    };

    onSubmitChanges(finalChangeRequest);
    onOpenChange(false);
    
    // Reset form
    setChangeRequest({
      category: 'design',
      description: '',
      specificIssues: [],
      additionalNotes: '',
      requestRevision: true
    });
    setSelectedIssues([]);
  };

  if (!approval) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="change-request-description">
        <DialogHeader className="pb-6">
          <div className="flex items-center gap-3">
            {getTypeIcon(approval.type)}
            <div>
              <DialogTitle id="change-request-title">Request Changes: {approval.title}</DialogTitle>
              <DialogDescription id="change-request-description" className="mt-1">
                Provide detailed feedback for revisions
              </DialogDescription>
            </div>
            <Badge variant="outline">{approval.type}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Change Category */}
          <div>
            <label className="text-sm font-medium mb-3 block">What type of changes are needed?</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {changeCategories.map((category) => (
                <Card 
                  key={category.value}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    changeRequest.category === category.value 
                      ? 'border-primary bg-primary/5' 
                      : ''
                  }`}
                  onClick={() => setChangeRequest(prev => ({ ...prev, category: category.value as any }))}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{category.label}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{category.description}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        changeRequest.category === category.value 
                          ? 'bg-primary border-primary' 
                          : 'border-gray-300'
                      }`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Specific Issues */}
          <div>
            <label className="text-sm font-medium mb-3 block">
              Common issues for {changeCategories.find(c => c.value === changeRequest.category)?.label.toLowerCase()}:
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-4">
              {commonIssues[changeRequest.category as keyof typeof commonIssues]?.map((issue) => (
                <div key={issue} className="flex items-start space-x-2">
                  <Checkbox
                    id={issue}
                    checked={selectedIssues.includes(issue)}
                    onCheckedChange={(checked) => handleIssueToggle(issue, checked as boolean)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={issue}
                    className="text-sm cursor-pointer flex-1 leading-relaxed"
                  >
                    {issue}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Level section removed as requested */}

          {/* Detailed Description */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Detailed Description <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Please provide specific, actionable feedback about what needs to be changed and why. The more detailed your feedback, the better the editor can address your concerns."
              value={changeRequest.description}
              onChange={(e) => setChangeRequest(prev => ({ ...prev, description: e.target.value }))}
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {changeRequest.description.length}/500 characters
            </p>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="text-sm font-medium mb-2 block">Additional Notes (Optional)</label>
            <Textarea
              placeholder="Any additional context, references, or notes that might help the editor..."
              value={changeRequest.additionalNotes}
              onChange={(e) => setChangeRequest(prev => ({ ...prev, additionalNotes: e.target.value }))}
              className="min-h-[80px]"
            />
          </div>

          {/* Request Options */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="requestRevision"
                checked={changeRequest.requestRevision}
                onCheckedChange={(checked) => setChangeRequest(prev => ({ ...prev, requestRevision: checked as boolean }))}
              />
              <div className="flex-1">
                <label htmlFor="requestRevision" className="font-medium text-sm cursor-pointer">
                  Send back for revision
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  This will create a revision task for the editor with your feedback. Uncheck if you want to approve with comments.
                </p>
              </div>
            </div>
          </div>

          {/* Summary */}
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <h4 className="font-medium text-sm">Change Request Summary</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium">{changeCategories.find(c => c.value === changeRequest.category)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Specific Issues:</span>
                  <span>{selectedIssues.length} selected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Action:</span>
                  <span className="font-medium">
                    {changeRequest.requestRevision ? 'Send for Revision' : 'Approve with Comments'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!changeRequest.description.trim()}
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              {changeRequest.requestRevision ? 'Send for Revision' : 'Approve with Comments'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}