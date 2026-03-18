'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface QuickAddClientDialogProps {
  trigger?: React.ReactNode;
  onClientCreated?: (client: any) => void;
}

export function QuickAddClientDialog({ trigger, onClientCreated }: QuickAddClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    status: 'active' as 'active' | 'pending' | 'expired',
    clientReviewRequired: 'no',
    videographerRequired: 'no',
    hasPostingServices: true,
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      companyName: '',
      email: '',
      phone: '',
      status: 'active',
      clientReviewRequired: 'no',
      videographerRequired: 'no',
      hasPostingServices: true,
    });
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.name?.trim()) {
      toast.error('Contact name is required');
      return;
    }
    if (!formData.companyName?.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (!formData.email?.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!formData.phone?.trim()) {
      toast.error('Phone number is required');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          monthlyDeliverables: [],
          oneOffDeliverables: [],
          brandAssets: [],
          brandGuidelines: {
            primaryColors: [],
            secondaryColors: [],
            fonts: [],
            logoUsage: '',
            toneOfVoice: '',
            brandValues: '',
            targetAudience: '',
            contentStyle: '',
          },
          projectSettings: {
            defaultVideoLength: '60 seconds',
            preferredPlatforms: [],
            contentApprovalRequired: true,
            quickTurnaroundAvailable: false,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || 'Failed to create client');
        return;
      }

      toast.success('Client created successfully!');
      onClientCreated?.(data.client);
      setOpen(false);
      resetForm();
    } catch (err) {
      console.error('Create client failed:', err);
      toast.error('Server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <div onClick={() => setOpen(true)}>
          {trigger}
        </div>
      )}

      <DialogContent className="max-w-lg bg-white border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Quick Add Client</DialogTitle>
          <DialogDescription className="text-gray-600">
            Add a new client with basic information. You can add deliverables and other details later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Contact Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-700">
              Contact Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="John Smith"
              className="bg-white border-gray-200 text-gray-900"
            />
          </div>

          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName" className="text-gray-700">
              Company Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              placeholder="Acme Corp"
              className="bg-white border-gray-200 text-gray-900"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="john@acmecorp.com"
              className="bg-white border-gray-200 text-gray-900"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-gray-700">
              Phone <span className="text-red-500">*</span>
            </Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="bg-white border-gray-200 text-gray-900"
            />
          </div>

          {/* Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status" className="text-gray-700">
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
              >
                <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientReviewRequired" className="text-gray-700">
                Client Review Required
              </Label>
              <Select
                value={formData.clientReviewRequired}
                onValueChange={(value) => handleInputChange('clientReviewRequired', value)}
              >
                <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="videographerRequired" className="text-gray-700">
              Videographer Required
            </Label>
            <Select
              value={formData.videographerRequired}
              onValueChange={(value) => handleInputChange('videographerRequired', value)}
            >
              <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              resetForm();
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button className='shadow-sm' onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Client'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}