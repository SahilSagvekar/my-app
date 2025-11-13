import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { PlayCircle, Target, BookOpen, Award, Lock, CheckCircle, XCircle, ChevronRight, AlertCircle, Trophy } from 'lucide-react';
import { toast } from 'sonner';

// Training course password (in production, this would be managed securely)
const TRAINING_PASSWORD = 'SCHED2024';

interface Module {
  id: number;
  title: string;
  description: string;
  duration: string;
  videoUrl?: string;
  content: string[];
  quiz?: QuizQuestion[];
  completed: boolean;
  unlocked: boolean;
}

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

const initialModules: Module[] = [
  {
    id: 1,
    title: 'Introduction to Scheduling at E8 Productions',
    description: 'Learn the fundamentals of production scheduling and your role in the workflow',
    duration: '12 min',
    completed: false,
    unlocked: true,
    content: [
      'Welcome to E8 Productions Scheduling Team',
      'Understanding the FIFO (First In, First Out) workflow system',
      'Your responsibilities as a Production Scheduler',
      'How Scheduling fits into the overall production pipeline',
      'Communication protocols and timeline management best practices'
    ],
    quiz: [
      {
        id: 1,
        question: 'What does FIFO stand for in the scheduling workflow?',
        options: ['First In, First Out', 'Fast In, Fast Out', 'File In, File Out', 'Final Input, Final Output'],
        correctAnswer: 0,
        explanation: 'FIFO means First In, First Out - tasks are scheduled in the order they arrive from QC to ensure fairness.'
      },
      {
        id: 2,
        question: 'Where do approved tasks come from before reaching the Scheduler?',
        options: ['Directly from Editor', 'From QC Approval', 'From Client', 'From Manager'],
        correctAnswer: 1,
        explanation: 'Schedulers receive QC-approved tasks that are ready for production scheduling and delivery planning.'
      }
    ]
  },
  {
    id: 2,
    title: 'Production Timeline Management',
    description: 'Master the art of creating realistic and efficient production schedules',
    duration: '18 min',
    completed: false,
    unlocked: false,
    content: [
      'Pre-production timeline planning',
      'Production day scheduling and resource allocation',
      'Post-production workflow coordination',
      'Buffer time and contingency planning',
      'Client delivery date management'
    ],
    quiz: [
      {
        id: 1,
        question: 'What is the recommended buffer time between consecutive shoots?',
        options: ['5-10 minutes', '15-30 minutes', '45-60 minutes', 'No buffer needed'],
        correctAnswer: 1,
        explanation: '15-30 minute buffers between events allow for setup, breakdown, and transitions.'
      },
      {
        id: 2,
        question: 'When should you schedule a backup day for outdoor shoots?',
        options: ['Never', 'Only for important clients', 'Always when weather-dependent', 'Only in winter'],
        correctAnswer: 2,
        explanation: 'Always schedule backup days for weather-dependent outdoor shoots to avoid delays.'
      }
    ]
  },
  {
    id: 3,
    title: 'Resource & Equipment Coordination',
    description: 'Learn to manage studio spaces, equipment, and team availability',
    duration: '15 min',
    completed: false,
    unlocked: false,
    content: [
      'Studio and location booking procedures',
      'Equipment checkout and inventory management',
      'Team member availability tracking',
      'Avoiding double-booking conflicts',
      'Emergency backup resource planning'
    ],
    quiz: [
      {
        id: 1,
        question: 'What must you check before scheduling a studio shoot?',
        options: [
          'Only the studio availability',
          'Studio, equipment, and team availability',
          'Only team availability',
          'Nothing - just book it'
        ],
        correctAnswer: 1,
        explanation: 'Always verify studio space, required equipment, and team member availability before confirming any shoot.'
      },
      {
        id: 2,
        question: 'How should equipment conflicts be resolved?',
        options: [
          'First come, first served',
          'Based on priority and timeline requirements',
          'Manager always decides',
          'Randomly assign'
        ],
        correctAnswer: 1,
        explanation: 'Equipment conflicts should be resolved based on project priority and delivery timeline requirements.'
      }
    ]
  },
  {
    id: 4,
    title: 'Effective Communication & Coordination',
    description: 'Master clear communication with production teams and clients',
    duration: '10 min',
    completed: false,
    unlocked: false,
    content: [
      'How to create clear calendar invites and schedules',
      'Communicating timeline changes effectively',
      'Setting realistic expectations with clients',
      'Coordinating with videographers and editors',
      'Documentation and schedule tracking best practices'
    ],
    quiz: [
      {
        id: 1,
        question: 'What information must be included in every calendar invite?',
        options: [
          'Only date and time',
          'Date, time, location, and attendees only',
          'Date, time, location, attendees, equipment needs, and notes',
          'Just the event title'
        ],
        correctAnswer: 2,
        explanation: 'Complete calendar invites include date, time, location, all attendees, equipment requirements, and any special notes.'
      }
    ]
  },
  {
    id: 5,
    title: 'Scheduling Tools & Workflow Systems',
    description: 'Navigate the E8 Productions scheduling portal and tools effectively',
    duration: '14 min',
    completed: false,
    unlocked: false,
    content: [
      'Using the Approved Queue interface',
      'Production calendar management',
      'Scheduling tools and templates',
      'Resource planning dashboards',
      'Tracking metrics and performance'
    ],
    quiz: [
      {
        id: 1,
        question: 'How are tasks ordered in the Approved Queue?',
        options: [
          'By priority level only',
          'By submission time (oldest first)',
          'Randomly assigned',
          'By project size'
        ],
        correctAnswer: 1,
        explanation: 'The Approved Queue uses FIFO ordering - tasks are sorted by QC approval time with oldest first.'
      }
    ]
  }
];

const finalQuiz: QuizQuestion[] = [
  {
    id: 1,
    question: 'What is your primary responsibility as a Production Scheduler?',
    options: [
      'To edit video content',
      'To schedule QC-approved content for production and ensure timely delivery',
      'To review content quality',
      'To handle client communications'
    ],
    correctAnswer: 1,
    explanation: 'Schedulers coordinate production timelines, resources, and delivery schedules for QC-approved content.'
  },
  {
    id: 2,
    question: 'When should you schedule a production shoot?',
    options: [
      'Immediately without checking resources',
      'After verifying all resources, equipment, and team availability',
      'Only when the manager approves',
      'Whenever the client requests'
    ],
    correctAnswer: 1,
    explanation: 'Always verify resource availability, equipment, and team schedules before confirming any production date.'
  },
  {
    id: 3,
    question: 'What is the minimum buffer time between consecutive events?',
    options: [
      'No buffer needed',
      '5 minutes',
      '15-30 minutes',
      '2 hours'
    ],
    correctAnswer: 2,
    explanation: 'Always include 15-30 minute buffers between events for setup, breakdown, and transitions.'
  },
  {
    id: 4,
    question: 'What happens to a task after you schedule it?',
    options: [
      'It goes back to the Editor',
      'It goes to QC for review',
      'The workflow is complete and ready for production',
      'It is deleted'
    ],
    correctAnswer: 2,
    explanation: 'After scheduling, the workflow is complete and the task moves into active production.'
  },
  {
    id: 5,
    question: 'How should you handle last-minute schedule changes?',
    options: [
      'Ignore them',
      'Only notify the manager',
      'Immediately communicate with all affected parties and update calendars',
      'Wait until the next day'
    ],
    correctAnswer: 2,
    explanation: 'Last-minute changes require immediate communication to all affected team members and updated calendar invites.'
  }
];

export function SchedulerTrainingPage() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [currentModuleId, setCurrentModuleId] = useState<number | null>(null);
  const [showModuleQuiz, setShowModuleQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [showFinalQuiz, setShowFinalQuiz] = useState(false);
  const [finalQuizAnswers, setFinalQuizAnswers] = useState<{ [key: number]: number }>({});
  const [finalQuizSubmitted, setFinalQuizSubmitted] = useState(false);
  const [certified, setCertified] = useState(false);

  const handlePasswordSubmit = () => {
    if (passwordInput === TRAINING_PASSWORD) {
      setIsUnlocked(true);
      toast('✅ Access Granted', { description: 'Welcome to Scheduler Training!' });
    } else {
      toast('❌ Incorrect Password', { description: 'Please check with your manager for the training password.' });
    }
  };

  const handleModuleComplete = (moduleId: number) => {
    setModules(prev => prev.map(m => {
      if (m.id === moduleId) {
        return { ...m, completed: true };
      }
      // Unlock next module
      if (m.id === moduleId + 1) {
        return { ...m, unlocked: true };
      }
      return m;
    }));
    setCurrentModuleId(null);
    setShowModuleQuiz(false);
    setQuizAnswers({});
    setQuizSubmitted(false);
    toast('✅ Module Completed', { description: 'Great job! Next module unlocked.' });
  };

  const handleStartModule = (moduleId: number) => {
    setCurrentModuleId(moduleId);
  };

  const handleFinishModuleContent = () => {
    const currentModule = modules.find(m => m.id === currentModuleId);
    if (currentModule?.quiz && currentModule.quiz.length > 0) {
      setShowModuleQuiz(true);
    } else {
      handleModuleComplete(currentModuleId!);
    }
  };

  const handleSubmitModuleQuiz = () => {
    const currentModule = modules.find(m => m.id === currentModuleId);
    if (!currentModule?.quiz) return;

    const allAnswered = currentModule.quiz.every(q => quizAnswers[q.id] !== undefined);
    if (!allAnswered) {
      toast('⚠️ Incomplete Quiz', { description: 'Please answer all questions.' });
      return;
    }

    setQuizSubmitted(true);
    const correctCount = currentModule.quiz.filter(q => quizAnswers[q.id] === q.correctAnswer).length;
    const passed = correctCount >= currentModule.quiz.length * 0.7; // 70% passing

    if (passed) {
      setTimeout(() => handleModuleComplete(currentModuleId!), 2000);
    }
  };

  const handleStartFinalQuiz = () => {
    setShowFinalQuiz(true);
  };

  const handleSubmitFinalQuiz = () => {
    const allAnswered = finalQuiz.every(q => finalQuizAnswers[q.id] !== undefined);
    if (!allAnswered) {
      toast('⚠️ Incomplete Quiz', { description: 'Please answer all questions.' });
      return;
    }

    setFinalQuizSubmitted(true);
    const correctCount = finalQuiz.filter(q => finalQuizAnswers[q.id] === q.correctAnswer).length;
    const passed = correctCount >= finalQuiz.length * 0.8; // 80% passing for certification

    if (passed) {
      setCertified(true);
      toast('🎉 Congratulations!', { description: 'You are now a Certified Production Scheduler!' });
    } else {
      toast('📚 Keep Learning', { description: 'Review the training materials and try again.' });
    }
  };

  const completedCount = modules.filter(m => m.completed).length;
  const allModulesCompleted = completedCount === modules.length;
  const progressPercentage = (completedCount / modules.length) * 100;

  // Password Gate
  if (!isUnlocked) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Scheduler Training & Certification</h1>
          <p className="text-muted-foreground mt-2">
            Complete the comprehensive scheduler training course to become certified
          </p>
        </div>

        <Card className="max-w-md mx-auto mt-12">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle>Training Access Required</CardTitle>
            <CardDescription>
              Enter the training password provided by your manager to begin the scheduler certification course
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="password">Training Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
            </div>
            <Button onClick={handlePasswordSubmit} className="w-full">
              <Lock className="h-4 w-4 mr-2" />
              Unlock Training
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Contact your manager if you don't have the password (Password: SCHED2024)
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Module View
  if (currentModuleId !== null) {
    const currentModule = modules.find(m => m.id === currentModuleId);
    if (!currentModule) return null;

    if (showModuleQuiz && currentModule.quiz) {
      return (
        <div className="space-y-6">
          <div>
            <Button variant="ghost" onClick={() => { setShowModuleQuiz(false); setQuizSubmitted(false); setQuizAnswers({}); }}>
              ← Back to Module
            </Button>
            <h1 className="mt-4">Module {currentModule.id} Quiz</h1>
            <p className="text-muted-foreground mt-2">
              Answer all questions correctly to complete this module (70% required to pass)
            </p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-6">
              {currentModule.quiz.map((question, idx) => (
                <div key={question.id} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-3">{question.question}</h4>
                      <RadioGroup
                        value={quizAnswers[question.id]?.toString()}
                        onValueChange={(value) => setQuizAnswers(prev => ({ ...prev, [question.id]: parseInt(value) }))}
                        disabled={quizSubmitted}
                      >
                        {question.options.map((option, optIdx) => (
                          <div key={optIdx} className="flex items-center space-x-2">
                            <RadioGroupItem value={optIdx.toString()} id={`q${question.id}-opt${optIdx}`} />
                            <Label
                              htmlFor={`q${question.id}-opt${optIdx}`}
                              className={`flex-1 cursor-pointer ${
                                quizSubmitted
                                  ? optIdx === question.correctAnswer
                                    ? 'text-green-600 font-medium'
                                    : quizAnswers[question.id] === optIdx
                                    ? 'text-red-600'
                                    : ''
                                  : ''
                              }`}
                            >
                              {option}
                              {quizSubmitted && optIdx === question.correctAnswer && (
                                <CheckCircle className="inline h-4 w-4 ml-2 text-green-600" />
                              )}
                              {quizSubmitted && quizAnswers[question.id] === optIdx && optIdx !== question.correctAnswer && (
                                <XCircle className="inline h-4 w-4 ml-2 text-red-600" />
                              )}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {quizSubmitted && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-sm text-blue-900">
                            <strong>Explanation:</strong> {question.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {idx < currentModule.quiz.length - 1 && <Separator />}
                </div>
              ))}

              {!quizSubmitted && (
                <Button onClick={handleSubmitModuleQuiz} className="w-full" size="lg">
                  Submit Quiz
                </Button>
              )}

              {quizSubmitted && (
                <div className="text-center">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                    currentModule.quiz.filter(q => quizAnswers[q.id] === q.correctAnswer).length >= currentModule.quiz.length * 0.7
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {currentModule.quiz.filter(q => quizAnswers[q.id] === q.correctAnswer).length >= currentModule.quiz.length * 0.7 ? (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        <span>Passed! ({currentModule.quiz.filter(q => quizAnswers[q.id] === q.correctAnswer).length}/{currentModule.quiz.length} correct)</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5" />
                        <span>Not Passed ({currentModule.quiz.filter(q => quizAnswers[q.id] === q.correctAnswer).length}/{currentModule.quiz.length} correct) - Review and try again</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => setCurrentModuleId(null)}>
            ← Back to Course Overview
          </Button>
          <h1 className="mt-4">Module {currentModule.id}: {currentModule.title}</h1>
          <p className="text-muted-foreground mt-2">{currentModule.description}</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-200 rounded-lg flex items-center justify-center">
              <PlayCircle className="h-16 w-16 text-blue-600" />
            </div>

            <div>
              <h3 className="font-medium mb-3">Learning Objectives</h3>
              <ul className="space-y-2">
                {currentModule.content.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Duration: {currentModule.duration}
              </div>
              <Button onClick={handleFinishModuleContent} size="lg">
                {currentModule.quiz && currentModule.quiz.length > 0 ? 'Take Quiz' : 'Complete Module'}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Final Quiz View
  if (showFinalQuiz) {
    return (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => { setShowFinalQuiz(false); setFinalQuizSubmitted(false); setFinalQuizAnswers({}); }}>
            ← Back to Course
          </Button>
          <h1 className="mt-4">Final Certification Exam</h1>
          <p className="text-muted-foreground mt-2">
            Answer all questions correctly to earn your Production Scheduler Certification (80% required to pass)
          </p>
        </div>

        {certified ? (
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300">
            <CardContent className="p-8 text-center">
              <Trophy className="h-20 w-20 text-yellow-600 mx-auto mb-4" />
              <h2 className="text-2xl font-medium text-yellow-900 mb-2">Congratulations!</h2>
              <p className="text-yellow-800 mb-4">You are now a Certified Production Scheduler at E8 Productions</p>
              <Badge className="bg-yellow-600 text-white px-4 py-2 text-base">
                <Award className="h-4 w-4 mr-2 inline" />
                Certified Production Scheduler
              </Badge>
              <div className="mt-6">
                <Button onClick={() => setShowFinalQuiz(false)}>
                  Return to Training Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 space-y-6">
              {finalQuiz.map((question, idx) => (
                <div key={question.id} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-3">{question.question}</h4>
                      <RadioGroup
                        value={finalQuizAnswers[question.id]?.toString()}
                        onValueChange={(value) => setFinalQuizAnswers(prev => ({ ...prev, [question.id]: parseInt(value) }))}
                        disabled={finalQuizSubmitted}
                      >
                        {question.options.map((option, optIdx) => (
                          <div key={optIdx} className="flex items-center space-x-2">
                            <RadioGroupItem value={optIdx.toString()} id={`final-q${question.id}-opt${optIdx}`} />
                            <Label
                              htmlFor={`final-q${question.id}-opt${optIdx}`}
                              className={`flex-1 cursor-pointer ${
                                finalQuizSubmitted
                                  ? optIdx === question.correctAnswer
                                    ? 'text-green-600 font-medium'
                                    : finalQuizAnswers[question.id] === optIdx
                                    ? 'text-red-600'
                                    : ''
                                  : ''
                              }`}
                            >
                              {option}
                              {finalQuizSubmitted && optIdx === question.correctAnswer && (
                                <CheckCircle className="inline h-4 w-4 ml-2 text-green-600" />
                              )}
                              {finalQuizSubmitted && finalQuizAnswers[question.id] === optIdx && optIdx !== question.correctAnswer && (
                                <XCircle className="inline h-4 w-4 ml-2 text-red-600" />
                              )}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {finalQuizSubmitted && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-sm text-blue-900">
                            <strong>Explanation:</strong> {question.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {idx < finalQuiz.length - 1 && <Separator />}
                </div>
              ))}

              {!finalQuizSubmitted && (
                <Button onClick={handleSubmitFinalQuiz} className="w-full" size="lg">
                  Submit Final Exam
                </Button>
              )}

              {finalQuizSubmitted && !certified && (
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 text-red-700">
                    <XCircle className="h-5 w-5" />
                    <span>Score: {finalQuiz.filter(q => finalQuizAnswers[q.id] === q.correctAnswer).length}/{finalQuiz.length} - Review materials and retake</span>
                  </div>
                  <Button onClick={() => { setFinalQuizSubmitted(false); setFinalQuizAnswers({}); }}>
                    Retake Exam
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Course Overview
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1>Scheduler Training & Certification</h1>
        <p className="text-muted-foreground mt-2">
          Complete all modules and pass the final exam to become a Certified Production Scheduler
        </p>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">Course Progress</h3>
              <p className="text-sm text-muted-foreground">{completedCount} of {modules.length} modules completed</p>
            </div>
            {certified && (
              <Badge className="bg-yellow-600 text-white">
                <Award className="h-3 w-3 mr-1" />
                Certified
              </Badge>
            )}
          </div>
          <Progress value={progressPercentage} className="h-3 mb-2" />
          <p className="text-xs text-muted-foreground">{Math.round(progressPercentage)}% Complete</p>
        </CardContent>
      </Card>

      {/* Training Modules */}
      <Card>
        <CardHeader>
          <CardTitle>Training Modules</CardTitle>
          <CardDescription>Complete each module in order to unlock the next one</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {modules.map((module) => (
            <div
              key={module.id}
              className={`p-4 border rounded-lg ${
                module.completed
                  ? 'bg-green-50 border-green-200'
                  : module.unlocked
                  ? 'bg-white hover:bg-accent/50 cursor-pointer'
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
              onClick={() => module.unlocked && !module.completed && handleStartModule(module.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-lg ${
                    module.completed
                      ? 'bg-green-200'
                      : module.unlocked
                      ? 'bg-blue-100'
                      : 'bg-gray-200'
                  }`}>
                    {module.completed ? (
                      <CheckCircle className="h-5 w-5 text-green-700" />
                    ) : module.unlocked ? (
                      <BookOpen className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Lock className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">Module {module.id}: {module.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-muted-foreground">{module.duration}</span>
                      {module.quiz && (
                        <Badge variant="outline" className="text-xs">
                          Quiz Included
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {module.completed && (
                  <Badge variant="default">Completed</Badge>
                )}
                {!module.completed && module.unlocked && (
                  <Button size="sm" onClick={() => handleStartModule(module.id)}>
                    Start
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Final Certification */}
      <Card className={allModulesCompleted && !certified ? 'border-yellow-300 bg-yellow-50' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className={`h-5 w-5 ${allModulesCompleted ? 'text-yellow-600' : 'text-gray-400'}`} />
            Final Certification Exam
          </CardTitle>
          <CardDescription>
            {allModulesCompleted
              ? 'You\'ve completed all modules! Take the final exam to earn your certification.'
              : 'Complete all training modules to unlock the certification exam'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {certified ? (
            <div className="text-center p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200">
              <Trophy className="h-16 w-16 text-yellow-600 mx-auto mb-3" />
              <h3 className="font-medium text-yellow-900 mb-2">Certified Production Scheduler</h3>
              <p className="text-sm text-yellow-700">You have successfully completed the training program!</p>
            </div>
          ) : allModulesCompleted ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Ready to demonstrate your scheduling expertise? The certification exam consists of 5 questions
                and requires an 80% passing score.
              </p>
              <Button onClick={handleStartFinalQuiz} size="lg">
                <Target className="h-4 w-4 mr-2" />
                Take Certification Exam
              </Button>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <Lock className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Complete all training modules to unlock</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
