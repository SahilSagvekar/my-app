import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { globalSearchAction, SearchResult } from '../app/actions/search';

interface SearchContextType {
  searchResults: SearchResult[];
  isLoading: boolean;
  search: (query: string, role: string) => Promise<SearchResult[]>;
  navigateToResult: (result: SearchResult, onPageChange: (page: string) => void) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}

interface SearchProviderProps {
  children: ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const search = useCallback(async (query: string, role: string): Promise<SearchResult[]> => {
    if (!query.trim()) {
      setSearchResults([]);
      return [];
    }

    setIsLoading(true);

    try {
      // 🚀 Using Real Server Action for searching across Tasks, Clients, and Users
      const results = await globalSearchAction(query);
      setSearchResults(results);
      return results;
    } catch (error) {
      console.error("[Search] Search failed:", error);
      setSearchResults([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const navigateToResult = useCallback((result: SearchResult, onPageChange: (page: string) => void) => {
    // Parse the URL to determine the page to navigate to
    const urlParts = result.url.split('/');
    let page = '';

    switch (urlParts[1]) {
      case 'admin':
        page = urlParts[2] || 'dashboard';
        break;
      case 'editor':
        page = urlParts[2] === 'my-tasks' ? 'my-tasks' : urlParts[2] || 'my-tasks';
        break;
      case 'qc_specialist':
        page = urlParts[2] === 'review-queue' ? 'review-queue' : 
              urlParts[2] === 'completed' ? 'completed' :
              urlParts[2] === 'guidelines' ? 'guidelines' : 'review-queue';
        break;
      case 'qc':
        page = urlParts[2] === 'review-queue' ? 'review-queue' : 
              urlParts[2] === 'completed' ? 'completed' :
              urlParts[2] === 'guidelines' ? 'guidelines' : 'review-queue';
        break;
      case 'scheduler':
        page = urlParts[2] === 'calendar' ? 'calendar' :
              urlParts[2] === 'approved-queue' ? 'approved-queue' :
              urlParts[2] === 'resources' ? 'resources' :
              urlParts[2] === 'reports' ? 'reports' : 'calendar';
        break;
      case 'manager':
        page = urlParts[2] === 'dashboard' ? 'dashboard' :
              urlParts[2] === 'projects' ? 'projects' :
              urlParts[2] === 'team' ? 'team' :
              urlParts[2] === 'performance' ? 'performance' :
              urlParts[2] === 'reports' ? 'reports' : 'dashboard';
        break;
      case 'client':
        page = urlParts[2] === 'monthly-overview' ? 'monthly-overview' :
              urlParts[2] === 'approvals' ? 'approvals' :
              urlParts[2] === 'projects' ? 'projects' :
              urlParts[2] === 'feedback' ? 'feedback' :
              urlParts[2] === 'archive' ? 'archive' : 'monthly-overview';
        break;
      default:
        return;
    }

    onPageChange(page);
  }, []);

  const value = {
    searchResults,
    isLoading,
    search,
    navigateToResult
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}