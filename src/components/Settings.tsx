import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { User, Bell, Shield, Palette, Mail, Phone, Globe, Moon, Sun, Monitor, Save, Eye, EyeOff, Loader, Edit2 } from 'lucide-react';

interface SettingsProps {
  currentRole: string;
  onClose: () => void;
}

export function Settings({ currentRole, onClose }: SettingsProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    image: '',
    
    // Notification preferences
    emailNotifications: true,
    pushNotifications: true,
    taskReminders: true,
    deadlineAlerts: true,
    teamUpdates: false,
    systemMaintenance: true,
    weeklyReports: true,
    
    // Appearance settings
    theme: 'system',
    language: 'en',
    timezone: 'America/New_York',
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const isQC = currentRole?.toLowerCase() === 'qc';

  // Fetch user profile on mount
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/profile', {
        method: 'GET',
        credentials: 'include', // This sends cookies automatically
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch profile');
      }

      const data = await response.json();

      if (data.success) {
        const userData = data.data;
        setFormData(prev => ({
          ...prev,
          name: userData.name || '',
          email: userData.email || '',
          phone: userData.phone || '',
          role: userData.role || '',
          image: userData.image || '',
          // If backend returns these preferences, use them
          emailNotifications: userData.emailNotifications ?? prev.emailNotifications,
          pushNotifications: userData.pushNotifications ?? prev.pushNotifications,
          taskReminders: userData.taskReminders ?? prev.taskReminders,
          deadlineAlerts: userData.deadlineAlerts ?? prev.deadlineAlerts,
          teamUpdates: userData.teamUpdates ?? prev.teamUpdates,
          systemMaintenance: userData.systemMaintenance ?? prev.systemMaintenance,
          weeklyReports: userData.weeklyReports ?? prev.weeklyReports,
          theme: userData.theme ?? prev.theme,
          language: userData.language ?? prev.language,
          timezone: userData.timezone ?? prev.timezone,
        }));
        if (userData.image) {
          setPreviewUrl(userData.image);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (1MB max)
      if (file.size > 1024 * 1024) {
        setError('Image size must be less than 1MB');
        return;
      }
      
      setImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');
      setMessage('');

      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name || '');
      formDataToSend.append('phone', formData.phone || '');
      // Note: Don't send 'role' as it's the system role (admin/editor/qc), not job title

      if (imageFile) {
        formDataToSend.append('image', imageFile);
      }

      console.log('Sending profile update:', {
        name: formData.name,
        phone: formData.phone,
        hasImage: !!imageFile,
      });

      const response = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        body: formDataToSend,
      });

      const data = await response.json();
      console.log('Profile update response:', data);

      if (!response.ok) {
        throw new Error(data.error || data.message || `Server error: ${response.status}`);
      }

      if (data.success) {
        setMessage('Profile updated successfully!');
        setImageFile(null);
        setIsEditing(false);
        
        // Update form data with response if provided
        if (data.data) {
          setFormData(prev => ({
            ...prev,
            name: data.data.name || prev.name,
            email: data.data.email || prev.email,
            phone: data.data.phone || prev.phone,
            role: data.data.role || prev.role,
            image: data.data.image || prev.image,
          }));
          if (data.data.image) {
            setPreviewUrl(data.data.image);
          }
        }
        
        setTimeout(() => {
          setMessage('');
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to update profile');
      }
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setImageFile(null);
    setError('');
    fetchProfile(); // Reload original data
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getRoleSpecificSettings = () => {
    switch (currentRole) {
      case 'admin':
        return (
          <Card className={isQC ? 'bg-[#1e2330] border-[#2a3142]' : ''}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 font-bold ${isQC ? 'text-gray-100' : ''}`}>
                <Shield className="h-5 w-5" />
                Admin Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className={isQC ? 'text-gray-200' : ''}>System Maintenance Alerts</Label>
                  <p className={`text-sm ${isQC ? 'text-gray-400' : 'text-muted-foreground'}`}>Get notified about system updates and maintenance</p>
                </div>
                <Switch
                  disabled={!isEditing}
                  checked={formData.systemMaintenance}
                  onCheckedChange={(checked) => handleInputChange('systemMaintenance', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className={isQC ? 'text-gray-200' : ''}>Weekly Reports</Label>
                  <p className={`text-sm ${isQC ? 'text-gray-400' : 'text-muted-foreground'}`}>Receive automated weekly performance reports</p>
                </div>
                <Switch
                  disabled={!isEditing}
                  checked={formData.weeklyReports}
                  onCheckedChange={(checked) => handleInputChange('weeklyReports', checked)}
                />
              </div>
            </CardContent>
          </Card>
        );
      case 'editor':
        return (
          <Card className={isQC ? 'bg-[#1e2330] border-[#2a3142]' : ''}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 font-bold ${isQC ? 'text-gray-100' : ''}`}>
                <User className="h-5 w-5" />
                Editor Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className={isQC ? 'text-gray-200' : ''}>Default File Format</Label>
                <Select disabled={!isEditing} defaultValue="png">
                  <SelectTrigger className={isQC ? 'bg-[#141824] border-[#2a3142] text-gray-200' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={isQC ? 'bg-[#1e2330] border-[#2a3142] text-gray-200' : ''}>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="jpg">JPG</SelectItem>
                    <SelectItem value="svg">SVG</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  // Show loading state on initial load
  if (loading && !formData.email) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${isQC ? 'bg-[#0a0e1a]' : ''}`}>
        <div className="text-center">
          <Loader className={`h-8 w-8 animate-spin mx-auto mb-4 ${isQC ? 'text-blue-500' : ''}`} />
          <p className={isQC ? 'text-gray-400' : 'text-muted-foreground'}>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex flex-col max-w-none ${isQC ? 'bg-[#0a0e1a]' : ''}`}>
      {/* Fixed Header */}
      <div className={`flex-shrink-0 flex items-center justify-between p-6 border-b transition-colors ${
        isQC ? 'border-[#1e2330]' : 'bg-white'
      }`}>
        <div>
          <h1 className={`text-xl font-semibold ${isQC ? 'text-gray-100' : 'text-gray-900'}`}>Settings</h1>
          <p className={`text-sm mt-1 ${isQC ? 'text-gray-400' : 'text-muted-foreground'}`}>
            Manage your account settings and preferences
          </p>
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <Button 
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </Button>
          )}
          <Button 
            onClick={onClose} 
            variant="outline" 
            className={isQC ? 'border-[#2a3142] text-gray-300 hover:bg-[#1e2330] hover:text-white' : ''}
          >
            Close
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6">
            <div className="space-y-6">
              {/* Messages */}
              {message && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
                  {message}
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                  {error}
                </div>
              )}

              <section id="profile" className="space-y-6">
                <Card className={isQC ? 'bg-[#1e2330] border-[#2a3142]' : ''}>
                  <CardHeader>
                    <CardTitle className={`font-bold ${isQC ? 'text-gray-100' : ''}`}>Profile Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Avatar Section */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <Avatar className="w-20 h-20">
                        <AvatarImage src={previewUrl || formData.image} />
                        <AvatarFallback className="text-lg">
                          {formData.name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        {isEditing && (
                          <label>
                            <Button asChild className="cursor-pointer">
                              <span>Upload New Photo</span>
                            </Button>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              className="hidden"
                            />
                          </label>
                        )}
                        <p className={`text-sm ${isQC ? 'text-gray-400' : 'text-muted-foreground'}`}>
                          JPG, GIF or PNG. 1MB max.
                        </p>
                      </div>
                    </div>

                    {/* Name Field */}
                    <div className="space-y-2">
                      <Label htmlFor="name" className={isQC ? 'text-gray-200' : ''}>Full Name</Label>
                      <Input
                        id="name"
                        disabled={!isEditing}
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Enter your full name"
                        className={isQC ? 'bg-[#141824] border-[#2a3142] text-gray-200 placeholder-gray-500' : ''}
                      />
                    </div>

                    {/* Contact Information */}
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className={isQC ? 'text-gray-200' : ''}>Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          disabled
                          className={isQC ? 'bg-[#0f1218] border-[#2a3142] text-gray-400' : 'bg-gray-50'}
                        />
                        <p className={`text-sm ${isQC ? 'text-gray-500' : 'text-muted-foreground'}`}>Email cannot be changed</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className={isQC ? 'text-gray-200' : ''}>Phone Number</Label>
                        <Input
                          id="phone"
                          disabled={!isEditing}
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          placeholder="Enter your phone number"
                          className={isQC ? 'bg-[#141824] border-[#2a3142] text-gray-200 placeholder-gray-500' : ''}
                        />
                      </div>
                    </div>

                    {/* Job Role - Display Only */}
                    <div className="space-y-2">
                      <Label htmlFor="role" className={isQC ? 'text-gray-200' : ''}>Role</Label>
                      <Input
                        id="role"
                        value={formData.role}
                        disabled
                        className={`${isQC ? 'bg-[#0f1218] border-[#2a3142] text-gray-400' : 'bg-gray-50'} capitalize`}
                      />
                      <p className={`text-sm ${isQC ? 'text-gray-500' : 'text-muted-foreground'}`}>Role is assigned by administrators</p>
                    </div>
                  </CardContent>
                </Card>

                {getRoleSpecificSettings()}
              </section>

              <section id="notifications" className="space-y-6">
                <Card className={isQC ? 'bg-[#1e2330] border-[#2a3142]' : ''}>
                  <CardHeader>
                    <CardTitle className={`font-bold ${isQC ? 'text-gray-100' : ''}`}>Notification Preferences</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className={isQC ? 'text-gray-200' : ''}>Email Notifications</Label>
                        <p className={`text-sm ${isQC ? 'text-gray-400' : 'text-muted-foreground'}`}>Receive notifications via email</p>
                      </div>
                      <Switch
                        disabled={!isEditing}
                        checked={formData.emailNotifications}
                        onCheckedChange={(checked) => handleInputChange('emailNotifications', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className={isQC ? 'text-gray-200' : ''}>Push Notifications</Label>
                        <p className={`text-sm ${isQC ? 'text-gray-400' : 'text-muted-foreground'}`}>Receive push notifications in browser</p>
                      </div>
                      <Switch
                        disabled={!isEditing}
                        checked={formData.pushNotifications}
                        onCheckedChange={(checked) => handleInputChange('pushNotifications', checked)}
                      />
                    </div>

                    <Separator className={isQC ? 'bg-[#2a3142]' : ''} />

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className={isQC ? 'text-gray-200' : ''}>Task Reminders</Label>
                        <p className={`text-sm ${isQC ? 'text-gray-400' : 'text-muted-foreground'}`}>Get reminded about upcoming tasks</p>
                      </div>
                      <Switch
                        disabled={!isEditing}
                        checked={formData.taskReminders}
                        onCheckedChange={(checked) => handleInputChange('taskReminders', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className={isQC ? 'text-gray-200' : ''}>Deadline Alerts</Label>
                        <p className={`text-sm ${isQC ? 'text-gray-400' : 'text-muted-foreground'}`}>Urgent notifications for approaching deadlines</p>
                      </div>
                      <Switch
                        disabled={!isEditing}
                        checked={formData.deadlineAlerts}
                        onCheckedChange={(checked) => handleInputChange('deadlineAlerts', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className={isQC ? 'text-gray-200' : ''}>Team Updates</Label>
                        <p className={`text-sm ${isQC ? 'text-gray-400' : 'text-muted-foreground'}`}>Notifications about team activity</p>
                      </div>
                      <Switch
                        disabled={!isEditing}
                        checked={formData.teamUpdates}
                        onCheckedChange={(checked) => handleInputChange('teamUpdates', checked)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section id="appearance" className="space-y-6">
                <Card className={isQC ? 'bg-[#1e2330] border-[#2a3142]' : ''}>
                  <CardHeader>
                    <CardTitle className={`font-bold ${isQC ? 'text-gray-100' : ''}`}>Appearance Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label className={isQC ? 'text-gray-200' : ''}>Theme</Label>
                      <Select disabled={!isEditing} value={formData.theme} onValueChange={(value) => handleInputChange('theme', value)}>
                        <SelectTrigger className={isQC ? 'bg-[#141824] border-[#2a3142] text-gray-200' : ''}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={isQC ? 'bg-[#1e2330] border-[#2a3142] text-gray-200' : ''}>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className={isQC ? 'text-gray-200' : ''}>Language</Label>
                      <Select disabled={!isEditing} value={formData.language} onValueChange={(value) => handleInputChange('language', value)}>
                        <SelectTrigger className={isQC ? 'bg-[#141824] border-[#2a3142] text-gray-200' : ''}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={isQC ? 'bg-[#1e2330] border-[#2a3142] text-gray-200' : ''}>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className={isQC ? 'text-gray-200' : ''}>Timezone</Label>
                      <Select disabled={!isEditing} value={formData.timezone} onValueChange={(value) => handleInputChange('timezone', value)}>
                        <SelectTrigger className={isQC ? 'bg-[#141824] border-[#2a3142] text-gray-200' : ''}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={isQC ? 'bg-[#1e2330] border-[#2a3142] text-gray-200' : ''}>
                          <SelectItem value="America/New_York">Eastern Time</SelectItem>
                          <SelectItem value="America/Chicago">Central Time</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                          <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                          <SelectItem value="UTC">UTC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Fixed Footer */}
      <div className={`flex-shrink-0 border-t p-6 transition-colors ${
        isQC ? 'border-[#1e2330] bg-[#1a1f2e]' : 'bg-white'
      }`}>
        {isEditing ? (
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleSave} 
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleCancel}
              disabled={loading}
              className={isQC ? 'border-[#2a3142] text-gray-300 hover:bg-[#1e2330]' : ''}
            >
              Cancel
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}