export const mockShootingTasks = [
  {
    id: 'VID-2024-001',
    title: 'Acme Corp Product Launch',
    client: 'Acme Corporation',
    location: 'Downtown Studio A',
    scheduledDate: '2024-08-12',
    scheduledTime: '09:00 AM',
    duration: '4 hours',
    status: 'upcoming' as const,
    priority: 'high' as const,
    shotList: ['Product close-ups', 'CEO interview', 'B-roll footage'],
    equipment: ['Canon EOS R5', 'Sony FX6', 'Lighting Kit'],
    notes: 'Client prefers natural lighting. CEO available 10-11 AM only.',
    deliverables: ['Raw footage', 'Backup files', 'Shot notes']
  },
  {
    id: 'VID-2024-002',
    title: 'Fashion Forward Summer Collection',
    client: 'Fashion Forward',
    location: 'Outdoor Location - Central Park',
    scheduledDate: '2024-08-11',
    scheduledTime: '07:00 AM',
    duration: '6 hours',
    status: 'in-progress' as const,
    priority: 'medium' as const,
    shotList: ['Model shots', 'Detail shots', 'Lifestyle footage'],
    equipment: ['Canon EOS R6', 'DJI Ronin', 'Reflectors'],
    notes: 'Golden hour shots required. Weather backup plan ready.',
    deliverables: ['Raw footage', 'Color cards', 'Behind the scenes']
  },
  {
    id: 'VID-2024-003',
    title: 'Tech Startup Office Tour',
    client: 'Tech Startup Inc.',
    location: 'Client Office - 42nd Street',
    scheduledDate: '2024-08-10',
    scheduledTime: '02:00 PM',
    duration: '3 hours',
    status: 'completed' as const,
    priority: 'low' as const,
    shotList: ['Office walkthrough', 'Team interviews', 'Product demos'],
    equipment: ['Sony FX30', 'Wireless mics', 'Gimbal'],
    notes: 'Completed successfully. All footage uploaded.',
    deliverables: ['Raw footage', 'Audio files', 'Shot log']
  }
];

export const mockUploadTasks = [
  {
    id: 'UP-2024-001',
    projectId: 'VID-2024-003',
    title: 'Tech Startup Office Tour - Raw Footage',
    filesCount: 24,
    totalSize: '15.6 GB',
    uploadedSize: '15.6 GB',
    status: 'completed' as const,
    uploadDate: '2024-08-10',
    driveLink: 'https://drive.google.com/folder/abc123'
  },
  {
    id: 'UP-2024-002',
    projectId: 'VID-2024-002',
    title: 'Fashion Forward - Batch 1',
    filesCount: 18,
    totalSize: '22.3 GB',
    uploadedSize: '8.1 GB',
    status: 'uploading' as const,
    uploadDate: '2024-08-11',
    progress: 36
  },
  {
    id: 'UP-2024-003',
    projectId: 'VID-2024-001',
    title: 'Acme Corp Product Launch',
    filesCount: 0,
    totalSize: '0 GB',
    uploadedSize: '0 GB',
    status: 'pending' as const,
    uploadDate: null
  }
];

export const mockEquipment = [
  {
    id: 'CAM-001',
    name: 'Canon EOS R5',
    type: 'Camera',
    status: 'available' as const,
    location: 'Studio A',
    lastMaintenance: '2024-07-15'
  },
  {
    id: 'CAM-002',
    name: 'Sony FX6',
    type: 'Camera',
    status: 'in-use' as const,
    location: 'On location',
    assignedTo: 'Fashion Forward Shoot',
    lastMaintenance: '2024-07-20'
  },
  {
    id: 'LIGHT-001',
    name: 'Godox LED Panel Kit',
    type: 'Lighting',
    status: 'maintenance' as const,
    location: 'Equipment Room',
    lastMaintenance: '2024-08-01'
  },
  {
    id: 'AUDIO-001',
    name: 'Rode Wireless GO II',
    type: 'Audio',
    status: 'available' as const,
    location: 'Studio B',
    lastMaintenance: '2024-07-10'
  }
];

export const statusColors = {
  upcoming: 'bg-blue-100 text-blue-800',
  'in-progress': 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
};

export const uploadStatusColors = {
  pending: 'bg-gray-100 text-gray-800',
  uploading: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800'
};

export const equipmentStatusColors = {
  available: 'bg-green-100 text-green-800',
  'in-use': 'bg-orange-100 text-orange-800',
  maintenance: 'bg-red-100 text-red-800'
};