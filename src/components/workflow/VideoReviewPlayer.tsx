import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward, MessageCircle, Plus, X, Edit3, Clock, User, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { WorkflowFile } from './TaskWorkflowEngine';

interface VideoNote {
  id: string;
  timestamp: number;
  comment: string;
  author: string;
  authorAvatar: string;
  createdAt: string;
  type: 'feedback' | 'approval' | 'revision';
  resolved?: boolean;
}

interface VideoReviewPlayerProps {
  file: WorkflowFile;
  notes: VideoNote[];
  onAddNote: (timestamp: number, comment: string, type: 'feedback' | 'revision') => void;
  onResolveNote: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  isReviewer?: boolean;
}

export function VideoReviewPlayer({
  file,
  notes = [],
  onAddNote,
  onResolveNote,
  onDeleteNote,
  isReviewer = true
}: VideoReviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteComment, setNewNoteComment] = useState('');
  const [newNoteType, setNewNoteType] = useState<'feedback' | 'revision'>('feedback');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Mock video duration - in real app this would come from the actual video
  useEffect(() => {
    setDuration(124); // 2:04 mock duration
  }, []);

  // Update current time when video plays
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying && currentTime < duration) {
        setCurrentTime(prev => Math.min(prev + 0.1, duration));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, currentTime, duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    setCurrentTime(Math.max(0, Math.min(newTime, duration)));
  };

  const handleSkip = (seconds: number) => {
    setCurrentTime(Math.max(0, Math.min(currentTime + seconds, duration)));
  };

  const handleVolumeToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleAddNoteAtCurrentTime = () => {
    setShowAddNote(true);
  };

  const handleSaveNote = () => {
    if (newNoteComment.trim()) {
      onAddNote(currentTime, newNoteComment, newNoteType);
      setNewNoteComment('');
      setShowAddNote(false);
      setNewNoteType('feedback');
    }
  };

  const handleCancelNote = () => {
    setNewNoteComment('');
    setShowAddNote(false);
  };

  const handleNoteClick = (noteId: string, timestamp: number) => {
    setSelectedNoteId(noteId);
    setCurrentTime(timestamp);
  };

  const getNotesAtCurrentTime = () => {
    return notes.filter(note => Math.abs(note.timestamp - currentTime) < 1);
  };

  const sortedNotes = [...notes].sort((a, b) => a.timestamp - b.timestamp);

  const getNoteTypeColor = (type: string) => {
    switch (type) {
      case 'revision': return 'bg-red-500';
      case 'approval': return 'bg-green-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="space-y-4">
      {/* Video Player */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        {/* Mock Video Display */}
        <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-xl mb-2">{file.name}</h3>
            <p className="text-sm opacity-75">Mock Video Player</p>
            <p className="text-xs opacity-50 mt-2">
              In real app: <br />
              &lt;video src="{file.url}" controls /&gt;
            </p>
          </div>
        </div>

        {/* Video Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <div 
              ref={progressBarRef}
              className="relative h-2 bg-white/20 rounded-full cursor-pointer"
              onClick={handleSeek}
            >
              {/* Progress */}
              <div 
                className="absolute left-0 top-0 h-full bg-white rounded-full transition-all"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              
              {/* Note markers */}
              {sortedNotes.map((note) => (
                <div
                  key={note.id}
                  className={`absolute top-0 w-3 h-3 -mt-0.5 rounded-full border-2 border-white cursor-pointer ${getNoteTypeColor(note.type)}`}
                  style={{ left: `${(note.timestamp / duration) * 100}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNoteClick(note.id, note.timestamp);
                  }}
                  title={`${formatTime(note.timestamp)} - ${note.comment.substring(0, 50)}${note.comment.length > 50 ? '...' : ''}`}
                />
              ))}
              
              {/* Playhead */}
              <div 
                className="absolute top-0 w-4 h-4 -mt-1 -ml-2 bg-white rounded-full border-2 border-blue-500"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => handleSkip(-10)}>
                <SkipBack className="h-4 w-4" />
              </Button>
              
              <Button size="sm" variant="ghost" onClick={handlePlayPause}>
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              
              <Button size="sm" variant="ghost" onClick={() => handleSkip(10)}>
                <SkipForward className="h-4 w-4" />
              </Button>

              <span className="text-white text-sm ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <select 
                value={playbackRate} 
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="ml-2 bg-white/10 text-white text-xs rounded px-1 py-0.5"
              >
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>1x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {isReviewer && (
                <Button size="sm" variant="ghost" onClick={handleAddNoteAtCurrentTime}>
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Add Note
                </Button>
              )}
              
              <Button size="sm" variant="ghost" onClick={handleVolumeToggle}>
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              
              <Button size="sm" variant="ghost">
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Current Time Notes Overlay */}
        {getNotesAtCurrentTime().map((note) => (
          <div
            key={note.id}
            className={`absolute top-4 right-4 bg-black/90 text-white p-3 rounded-lg max-w-xs border-l-4 ${
              note.type === 'revision' ? 'border-red-500' : 
              note.type === 'approval' ? 'border-green-500' : 'border-blue-500'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">{note.authorAvatar}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{note.author}</span>
              <Badge variant="secondary" className="text-xs">
                {formatTime(note.timestamp)}
              </Badge>
            </div>
            <p className="text-sm">{note.comment}</p>
          </div>
        ))}
      </div>

      {/* Add Note Panel */}
      {showAddNote && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  <h4 className="font-medium">Add Note at {formatTime(currentTime)}</h4>
                </div>
                <Button size="sm" variant="ghost" onClick={handleCancelNote}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={newNoteType === 'feedback' ? 'default' : 'outline'}
                  onClick={() => setNewNoteType('feedback')}
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Feedback
                </Button>
                <Button
                  size="sm"
                  variant={newNoteType === 'revision' ? 'destructive' : 'outline'}
                  onClick={() => setNewNoteType('revision')}
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Needs Revision
                </Button>
              </div>

              <Textarea
                placeholder="Add your feedback or revision request..."
                value={newNoteComment}
                onChange={(e) => setNewNoteComment(e.target.value)}
                rows={3}
              />

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCancelNote}>
                  Cancel
                </Button>
                <Button onClick={handleSaveNote} disabled={!newNoteComment.trim()}>
                  Add Note
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes Timeline */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">Notes & Feedback ({notes.length})</h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Feedback</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Revision</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Approved</span>
              </div>
            </div>
          </div>

          {sortedNotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>No notes yet</p>
              <p className="text-sm">Click "Add Note" while watching to leave feedback</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedNotes.map((note, index) => (
                <div key={note.id}>
                  <div 
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedNoteId === note.id ? 'bg-accent border-primary' : 'hover:bg-accent/50'
                    } ${note.resolved ? 'opacity-60' : ''}`}
                    onClick={() => handleNoteClick(note.id, note.timestamp)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getNoteTypeColor(note.type)}`} />
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">{note.authorAvatar}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{note.author}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatTime(note.timestamp)}</span>
                            <span>•</span>
                            <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {note.resolved && (
                          <Badge variant="default" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Resolved
                          </Badge>
                        )}
                        
                        {isReviewer && !note.resolved && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onResolveNote(note.id);
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        
                        {isReviewer && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteNote(note.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm ml-11">{note.comment}</p>
                  </div>
                  
                  {index < sortedNotes.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}