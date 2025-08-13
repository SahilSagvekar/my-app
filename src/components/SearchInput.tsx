import { useState, useRef, useEffect } from 'react';
import { Search, Clock, FileText, User, Folder, AlertCircle, ChevronRight } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { useSearch } from './SearchContext';

interface SearchInputProps {
  currentRole: string;
  onPageChange: (page: string) => void;
}

export function SearchInput({ currentRole, onPageChange }: SearchInputProps) {
  const { searchResults, isLoading, search, navigateToResult } = useSearch();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (query.trim()) {
        search(query, currentRole);
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    }, 150);

    return () => clearTimeout(delayedSearch);
  }, [query, currentRole, search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
          handleResultClick(searchResults[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleResultClick = (result: any) => {
    navigateToResult(result, onPageChange);
    setQuery('');
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const getResultIcon = (type: string, priority?: string) => {
    switch (type) {
      case 'task':
        return priority === 'high' ? (
          <AlertCircle className="h-4 w-4 text-red-500" />
        ) : (
          <FileText className="h-4 w-4 text-blue-500" />
        );
      case 'project':
        return <Folder className="h-4 w-4 text-green-500" />;
      case 'user':
        return <User className="h-4 w-4 text-purple-500" />;
      case 'page':
        return <FileText className="h-4 w-4 text-gray-500" />;
      case 'report':
        return <FileText className="h-4 w-4 text-orange-500" />;
      case 'client':
        return <User className="h-4 w-4 text-indigo-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="relative flex-1 max-w-md mx-4" ref={searchRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Search projects, tasks..."
          className="pl-10 pr-4"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && setIsOpen(true)}
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-96">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              Searching...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No results found for "{query}"</p>
              <p className="text-sm mt-1">Try searching for projects, tasks, or team members</p>
            </div>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="p-2">
                {searchResults.map((result, index) => (
                  <Button
                    key={result.id}
                    variant="ghost"
                    className={`w-full justify-start p-3 h-auto ${
                      index === highlightedIndex ? 'bg-accent' : ''
                    }`}
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className="flex-shrink-0 mt-0.5">
                        {getResultIcon(result.type, result.priority)}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium truncate">{result.title}</h4>
                          {result.priority && (
                            <div className={`w-2 h-2 rounded-full ${getPriorityColor(result.priority)}`} />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                          {result.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {result.category}
                          </Badge>
                          {result.status && (
                            <Badge variant="secondary" className="text-xs">
                              {result.status}
                            </Badge>
                          )}
                          {result.date && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {result.date}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}