import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { User, Bell, Shield, Palette, Clock, Mail, Phone, Globe, Moon, Sun, Monitor, Save, Eye, EyeOff } from 'lucide-react';

interface SettingsProps {
  currentRole: string;
  onClose: () => void;
}

export function Settings({ currentRole, onClose }: SettingsProps) {
  const [formData, setFormData] = useState({
    // Profile settings
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.com',
    phone: '+1 (555) 123-4567',
    jobTitle: 'Senior Administrator',
    department: 'Management',
    bio: 'Experienced administrator with 5+ years in project management and team leadership.',
    
    // Notification preferences
    emailNotifications: true,
    pushNotifications: true,
    taskReminders: true,
    deadlineAlerts: true,
    teamUpdates: false,
    systemMaintenance: true,
    weeklyReports: true,
    
    // Appearance settings
    theme: 'system', // light, dark, system
    language: 'en',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    
    // Privacy settings
    profileVisibility: 'team', // public, team, private
    showOnlineStatus: true,
    allowDirectMessages: true,
    
    // Security settings
    twoFactorEnabled: false,
    sessionTimeout: '30', // minutes
  });

  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSave = () => {
    console.log('Saving settings:', formData);
    // In a real app, this would make an API call
    onClose();
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getRoleSpecificSettings = () => {
    switch (currentRole) {
      case 'admin':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-bold">
                <Shield className="h-5 w-5" />
                Admin Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>System Maintenance Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified about system updates and maintenance</p>
                </div>
                <Switch
                  checked={formData.systemMaintenance}
                  onCheckedChange={(checked) => handleInputChange('systemMaintenance', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Weekly Reports</Label>
                  <p className="text-sm text-muted-foreground">Receive automated weekly performance reports</p>
                </div>
                <Switch
                  checked={formData.weeklyReports}
                  onCheckedChange={(checked) => handleInputChange('weeklyReports', checked)}
                />
              </div>
            </CardContent>
          </Card>
        );
      case 'editor':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-bold">
                <User className="h-5 w-5" />
                Editor Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default File Format</Label>
                <Select defaultValue="png">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="jpg">JPG</SelectItem>
                    <SelectItem value="svg">SVG</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Auto-save Interval</Label>
                <Select defaultValue="5">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 minute</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="0">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        );
      case 'qc_specialist':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-bold">
                <Eye className="h-5 w-5" />
                QC Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Review Queue Sorting</Label>
                <Select defaultValue="priority">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="deadline">Deadline</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="date">Date Submitted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Auto-refresh Queue</Label>
                  <p className="text-sm text-muted-foreground">Automatically refresh the review queue</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full flex flex-col max-w-none">
      {/* Fixed Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account settings and preferences
          </p>
        </div>
        <Button onClick={onClose} variant="outline">
          Close
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6">
            <div className="space-y-6">
              <section id="profile" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-bold">Profile Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Avatar Section */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <Avatar className="w-20 h-20">
                        <AvatarImage src="/avatars/user.jpg" />
                        <AvatarFallback className="text-lg">JD</AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        <Button>Upload New Photo</Button>
                        <p className="text-sm text-muted-foreground">
                          JPG, GIF or PNG. 1MB max.
                        </p>
                      </div>
                    </div>

                    {/* Name Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Job Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="jobTitle">Job Title</Label>
                        <Input
                          id="jobTitle"
                          value={formData.jobTitle}
                          onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Input
                          id="department"
                          value={formData.department}
                          onChange={(e) => handleInputChange('department', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Bio */}
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => handleInputChange('bio', e.target.value)}
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                  </CardContent>
                </Card>

                {getRoleSpecificSettings()}
              </section>

              <section id="notifications" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-bold">Notification Preferences</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                      </div>
                      <Switch
                        checked={formData.emailNotifications}
                        onCheckedChange={(checked) => handleInputChange('emailNotifications', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Push Notifications</Label>
                        <p className="text-sm text-muted-foreground">Receive push notifications in browser</p>
                      </div>
                      <Switch
                        checked={formData.pushNotifications}
                        onCheckedChange={(checked) => handleInputChange('pushNotifications', checked)}
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Task Reminders</Label>
                        <p className="text-sm text-muted-foreground">Get reminded about upcoming tasks</p>
                      </div>
                      <Switch
                        checked={formData.taskReminders}
                        onCheckedChange={(checked) => handleInputChange('taskReminders', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Deadline Alerts</Label>
                        <p className="text-sm text-muted-foreground">Urgent notifications for approaching deadlines</p>
                      </div>
                      <Switch
                        checked={formData.deadlineAlerts}
                        onCheckedChange={(checked) => handleInputChange('deadlineAlerts', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Team Updates</Label>
                        <p className="text-sm text-muted-foreground">Notifications about team activity</p>
                      </div>
                      <Switch
                        checked={formData.teamUpdates}
                        onCheckedChange={(checked) => handleInputChange('teamUpdates', checked)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section id="appearance" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-bold">Appearance Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Theme</Label>
                      <Select value={formData.theme} onValueChange={(value) => handleInputChange('theme', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">
                            <div className="flex items-center gap-2">
                              <Sun className="h-4 w-4" />
                              Light
                            </div>
                          </SelectItem>
                          <SelectItem value="dark">
                            <div className="flex items-center gap-2">
                              <Moon className="h-4 w-4" />
                              Dark
                            </div>
                          </SelectItem>
                          <SelectItem value="system">
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4" />
                              System
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select value={formData.language} onValueChange={(value) => handleInputChange('language', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Select value={formData.timezone} onValueChange={(value) => handleInputChange('timezone', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/New_York">Eastern Time</SelectItem>
                          <SelectItem value="America/Chicago">Central Time</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                          <SelectItem value="UTC">UTC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date Format</Label>
                        <Select value={formData.dateFormat} onValueChange={(value) => handleInputChange('dateFormat', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                            <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Time Format</Label>
                        <Select value={formData.timeFormat} onValueChange={(value) => handleInputChange('timeFormat', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="12h">12 Hour</SelectItem>
                            <SelectItem value="24h">24 Hour</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section id="privacy" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-bold">Privacy Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Profile Visibility</Label>
                      <Select value={formData.profileVisibility} onValueChange={(value) => handleInputChange('profileVisibility', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Public - Visible to everyone</SelectItem>
                          <SelectItem value="team">Team - Visible to team members only</SelectItem>
                          <SelectItem value="private">Private - Only visible to you</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Show Online Status</Label>
                        <p className="text-sm text-muted-foreground">Let others see when you're online</p>
                      </div>
                      <Switch
                        checked={formData.showOnlineStatus}
                        onCheckedChange={(checked) => handleInputChange('showOnlineStatus', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Allow Direct Messages</Label>
                        <p className="text-sm text-muted-foreground">Allow team members to message you directly</p>
                      </div>
                      <Switch
                        checked={formData.allowDirectMessages}
                        onCheckedChange={(checked) => handleInputChange('allowDirectMessages', checked)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section id="security" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-bold">Password & Security</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <div className="relative">
                          <Input
                            id="newPassword"
                            type={showPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                          id="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                        />
                      </div>

                      <Button className="w-full">Update Password</Button>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Label>Two-Factor Authentication</Label>
                        <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                        <Badge variant={formData.twoFactorEnabled ? "default" : "secondary"}>
                          {formData.twoFactorEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <Button variant="outline">
                        {formData.twoFactorEnabled ? "Disable" : "Enable"} 2FA
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Session Timeout</Label>
                      <Select value={formData.sessionTimeout} onValueChange={(value) => handleInputChange('sessionTimeout', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                          <SelectItem value="240">4 hours</SelectItem>
                          <SelectItem value="0">Never</SelectItem>
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
      <div className="flex-shrink-0 border-t p-6">
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}