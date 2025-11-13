// Utility to access client data from localStorage or default mock data

interface PostingTime {
  weekdays: string;
  weekends: string;
  bestTimes: string;
}

interface PostingSchedule {
  instagram?: PostingTime;
  tiktok?: PostingTime;
  youtube?: PostingTime;
  facebook?: PostingTime;
  twitter?: PostingTime;
  linkedin?: PostingTime;
}

interface Client {
  id: string;
  name: string;
  company: string;
  postingSchedule?: PostingSchedule;
  projectSettings?: {
    preferredPlatforms?: string[];
  };
}

// Default posting times (fallback if no client-specific times)
const defaultPostingSchedule: PostingSchedule = {
  instagram: {
    weekdays: '11am-1pm, 7-9pm',
    weekends: '10am-12pm',
    bestTimes: 'General: Weekdays 11am-1pm'
  },
  tiktok: {
    weekdays: '6-10am, 7-11pm',
    weekends: '9am-12pm',
    bestTimes: 'General: Tue-Thu 7-9am'
  },
  youtube: {
    weekdays: '2-4pm',
    weekends: '9-11am',
    bestTimes: 'General: Weekdays 2-4pm'
  },
  facebook: {
    weekdays: '1-3pm, 7-9pm',
    weekends: '12-2pm',
    bestTimes: 'General: Wed-Thu 1-2pm'
  },
  twitter: {
    weekdays: '9am-12pm, 5-7pm',
    weekends: '11am-1pm',
    bestTimes: 'General: Weekdays 9-10am'
  },
  linkedin: {
    weekdays: '8-10am, 12-2pm',
    weekends: 'N/A - B2B audience',
    bestTimes: 'General: Tue-Wed 8-9am'
  }
};

export function getClients(): Client[] {
  try {
    const stored = localStorage.getItem('pm_clients');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading clients:', error);
  }
  return [];
}

export function getClientById(clientId: string): Client | null {
  const clients = getClients();
  return clients.find(c => c.id === clientId) || null;
}

export function getClientByCompanyName(companyName: string): Client | null {
  const clients = getClients();
  return clients.find(c => c.company.toLowerCase().includes(companyName.toLowerCase())) || null;
}

export function getPostingScheduleForClient(clientId?: string): PostingSchedule {
  if (!clientId) {
    return defaultPostingSchedule;
  }

  const client = getClientById(clientId);
  
  if (client?.postingSchedule) {
    return client.postingSchedule;
  }

  return defaultPostingSchedule;
}

export function getDefaultPostingSchedule(): PostingSchedule {
  return defaultPostingSchedule;
}
