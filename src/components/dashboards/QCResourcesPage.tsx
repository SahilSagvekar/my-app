import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Shield, FileCheck, Palette, FileText, Video, Info, ExternalLink, Download, CheckCircle, Building, Image as ImageIcon } from 'lucide-react';
import { getClients } from '../utils/clientData';
import { ImageWithFallback } from '../figma/ImageWithFallback';

export function QCResourcesPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);

  // Load clients from localStorage
  useEffect(() => {
    const loadedClients = getClients();
    setClients(loadedClients);
    
    // Set default client if available
    if (loadedClients.length > 0 && !selectedClientId) {
      setSelectedClientId(loadedClients[0].id);
    }
  }, []);

  // Update selected client when ID changes
  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      setSelectedClient(client || null);
    } else {
      setSelectedClient(null);
    }
  }, [selectedClientId, clients]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>QC Resources</h1>
          <p className="text-muted-foreground mt-2">
            Client brand guidelines, QC checklists, and quality standards
          </p>
        </div>
        
        {/* Client Selector */}
        {clients.length > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="qc-client-select" className="text-sm text-muted-foreground whitespace-nowrap">
              Client:
            </Label>
            <Select value={selectedClientId || ''} onValueChange={setSelectedClientId}>
              <SelectTrigger id="qc-client-select" className="w-64">
                <SelectValue placeholder="Select client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      {client.company}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Tabs defaultValue="brand-guidelines" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="brand-guidelines">Brand Guidelines</TabsTrigger>
          <TabsTrigger value="qc-checklists">QC Checklists</TabsTrigger>
          <TabsTrigger value="tech-specs">Technical Specs</TabsTrigger>
        </TabsList>

        {/* Brand Guidelines Tab */}
        <TabsContent value="brand-guidelines" className="space-y-6">
          {selectedClient ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{selectedClient.company} Brand Standards</CardTitle>
                  <CardDescription>Review these brand guidelines when checking content for approval</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Quality Requirements */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4 text-purple-600" />
                      <h3 className="font-medium text-sm">Quality Requirements</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-6">
                      <div className="p-4 border rounded-lg bg-accent/50">
                        <h4 className="font-medium text-sm mb-2">Content Approval</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedClient.projectSettings?.contentApprovalRequired 
                            ? '✓ Client approval required before publishing' 
                            : '○ Internal approval only'}
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg bg-accent/50">
                        <h4 className="font-medium text-sm mb-2">Default Video Length</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedClient.projectSettings?.defaultVideoLength || 'Not specified'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Brand Colors for QC */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Palette className="h-4 w-4 text-purple-600" />
                      <h3 className="font-medium text-sm">Brand Colors (Verify These)</h3>
                    </div>
                    <div className="flex gap-2 ml-6">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Primary Colors</p>
                        <div className="flex gap-2">
                          {selectedClient.brandGuidelines?.primaryColors?.map((color: string, i: number) => (
                            <div key={i} className="space-y-1">
                              <div
                                className="w-16 h-16 rounded border"
                                style={{ backgroundColor: color }}
                              />
                              <p className="text-xs text-center font-mono">{color}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {selectedClient.brandGuidelines?.secondaryColors && (
                        <div className="ml-4">
                          <p className="text-xs text-muted-foreground mb-2">Secondary Colors</p>
                          <div className="flex gap-2">
                            {selectedClient.brandGuidelines.secondaryColors.map((color: string, i: number) => (
                              <div key={i} className="space-y-1">
                                <div
                                  className="w-16 h-16 rounded border"
                                  style={{ backgroundColor: color }}
                                />
                                <p className="text-xs text-center font-mono">{color}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Typography Check */}
                  {selectedClient.brandGuidelines?.fonts && (
                    <>
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <h3 className="font-medium text-sm">Approved Typography</h3>
                        </div>
                        <div className="p-4 border rounded-lg bg-accent/50 ml-6">
                          <div className="flex gap-2 flex-wrap">
                            {selectedClient.brandGuidelines.fonts.map((font: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-sm px-4 py-2">
                                {font}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Brand Voice & Style Compliance */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-green-600" />
                      <h3 className="font-medium text-sm">Brand Voice & Style Compliance</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-6">
                      <div className="p-4 border rounded-lg bg-accent/50">
                        <h4 className="font-medium text-sm mb-2">Tone of Voice</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedClient.brandGuidelines?.toneOfVoice || 'Not specified'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          ✓ Verify all copy matches this tone
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg bg-accent/50">
                        <h4 className="font-medium text-sm mb-2">Content Style</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedClient.brandGuidelines?.contentStyle || 'Not specified'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          ✓ Ensure visual style is consistent
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg bg-accent/50">
                        <h4 className="font-medium text-sm mb-2">Target Audience</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedClient.brandGuidelines?.targetAudience || 'Not specified'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          ✓ Content should resonate with this audience
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg bg-accent/50">
                        <h4 className="font-medium text-sm mb-2">Brand Values</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedClient.brandGuidelines?.brandValues || 'Not specified'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          ✓ Content must align with these values
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Logo Usage Guidelines */}
                  {selectedClient.brandGuidelines?.logoUsage && (
                    <>
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <ImageIcon className="h-4 w-4 text-orange-600" />
                          <h3 className="font-medium text-sm">Logo Usage Requirements</h3>
                        </div>
                        <div className="p-4 border rounded-lg bg-accent/50 ml-6">
                          <p className="text-sm text-muted-foreground">
                            {selectedClient.brandGuidelines.logoUsage}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            ✓ Verify logo placement meets these guidelines
                          </p>
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Platform Preferences */}
                  {selectedClient.projectSettings?.preferredPlatforms && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Video className="h-4 w-4 text-blue-600" />
                        <h3 className="font-medium text-sm">Preferred Platforms</h3>
                      </div>
                      <div className="p-4 border rounded-lg bg-accent/50 ml-6">
                        <div className="flex gap-2 flex-wrap">
                          {selectedClient.projectSettings.preferredPlatforms.map((platform: string, i: number) => (
                            <Badge key={i} variant="secondary">{platform}</Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          ✓ Ensure content is optimized for these platforms
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Reference Assets */}
                  {selectedClient.brandAssets && selectedClient.brandAssets.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="h-4 w-4 text-purple-600" />
                          <h3 className="font-medium text-sm">Reference Brand Assets</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-6">
                          {selectedClient.brandAssets.slice(0, 3).map((asset: any) => (
                            <div key={asset.id} className="border rounded-lg p-3">
                              <div className="aspect-video bg-accent rounded mb-2 overflow-hidden">
                                <ImageWithFallback
                                  src={asset.fileUrl}
                                  alt={asset.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <p className="font-medium text-xs">{asset.name}</p>
                              <p className="text-xs text-muted-foreground">{asset.type}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No Client Selected</h3>
                <p className="text-sm text-muted-foreground">
                  Select a client above to view their brand guidelines for QC review
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* QC Checklists Tab */}
        <TabsContent value="qc-checklists" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>QC Checklists</CardTitle>
              <CardDescription>Complete checklists for different content types</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Video QC Checklist */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Video className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="font-medium">Video Content Checklist</h3>
                </div>
                <div className="ml-11 space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Video resolution matches platform requirements (1080p minimum)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Frame rate is consistent (24, 30, or 60fps)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Audio levels are balanced (-6dB to -3dB peak)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">No audio clipping or distortion</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Colors match client brand palette</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Typography uses approved brand fonts</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Logo appears correctly with proper clearspace</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">All text is legible and properly timed</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Transitions are smooth and on-brand</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Video length matches project requirements</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Content tone matches brand voice</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">No spelling or grammar errors in any text</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Final Delivery Checklist */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FileCheck className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="font-medium">Final Delivery Checklist</h3>
                </div>
                <div className="ml-11 space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">File naming follows convention: ClientName_ProjectName_Date_v1.mp4</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Exported in correct format (MP4 H.264 recommended)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Metadata includes correct client and project info</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">File uploaded to correct Google Drive folder</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Client approval obtained (if required)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">All stakeholders notified of completion</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technical Specs Tab */}
        <TabsContent value="tech-specs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Technical Specifications</CardTitle>
              <CardDescription>Standard technical requirements for all content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Video Export Settings */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Info className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="font-medium">Video Export Settings</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-11">
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Standard Video</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Format: MP4 (H.264)</li>
                      <li>• Resolution: 1920x1080</li>
                      <li>• Frame Rate: 24-60fps</li>
                      <li>• Bitrate: 8-12 Mbps</li>
                      <li>• Audio: AAC, 320kbps</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Web Graphics</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Format: PNG, JPG, WebP</li>
                      <li>• Resolution: 72dpi min</li>
                      <li>• Color: RGB</li>
                      <li>• Max size: 2MB</li>
                      <li>• Compression: 80-90%</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Print Graphics</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Format: PDF, TIFF</li>
                      <li>• Resolution: 300dpi</li>
                      <li>• Color: CMYK</li>
                      <li>• Bleed: 0.125"</li>
                      <li>• Fonts: Outlined</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Audio Standards */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Video className="h-5 w-5 text-orange-600" />
                  </div>
                  <h3 className="font-medium">Audio Standards</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-11">
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Dialog & Voice-Over</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Peak Level: -6dB to -3dB</li>
                      <li>• RMS Level: -18dB to -16dB</li>
                      <li>• Sample Rate: 48kHz</li>
                      <li>• Bit Depth: 24-bit</li>
                      <li>• Format: WAV, AAC</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Music & Sound Effects</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Peak Level: -12dB to -6dB</li>
                      <li>• RMS Level: -24dB to -18dB</li>
                      <li>• No clipping or distortion</li>
                      <li>• Proper fade in/out</li>
                      <li>• Licensed or royalty-free</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Separator />

              {/* File Naming Conventions */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="font-medium">File Naming Conventions</h3>
                </div>
                <div className="space-y-3 ml-11">
                  <div className="p-3 border rounded-lg bg-accent/50">
                    <p className="font-medium text-sm mb-1">Videos</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded">ClientName_ProjectName_Date_v1.mp4</code>
                  </div>
                  <div className="p-3 border rounded-lg bg-accent/50">
                    <p className="font-medium text-sm mb-1">Design Assets</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded">ClientName_AssetType_Size_v1.png</code>
                  </div>
                  <div className="p-3 border rounded-lg bg-accent/50">
                    <p className="font-medium text-sm mb-1">Documents</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded">ClientName_DocumentType_Date.pdf</code>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Quick Links */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <ExternalLink className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="font-medium">QC Tools & Resources</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-11">
                  <Button variant="outline" className="justify-start">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Color Contrast Checker
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Video Codec Analyzer
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Audio Loudness Meter
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Font Identifier Tool
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
