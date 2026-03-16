"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

interface Metric {
  name: string;
  duration: number;
  description?: string;
}

interface VitalsContextType {
  lastMetrics: Metric[];
  recordMetrics: (metrics: Metric[]) => void;
  recordResponse: (res: Response) => void;
}

const VitalsContext = createContext<VitalsContextType | undefined>(undefined);

export function VitalsProvider({ children }: { children: React.ReactNode }) {
  const [lastMetrics, setLastMetrics] = useState<Metric[]>([]);

  const recordMetrics = useCallback((metrics: Metric[]) => {
    setLastMetrics(metrics);
  }, []);

  const recordResponse = useCallback((res: Response) => {
    const timingHeader = res.headers.get('Server-Timing');
    if (timingHeader) {
      const parts = timingHeader.split(',');
      const metrics: Metric[] = parts.map(part => {
        const [name, ...params] = part.split(';');
        const durParam = params.find(p => p.startsWith('dur='));
        const descParam = params.find(p => p.startsWith('desc='));
        
        return {
          name: name.trim(),
          duration: durParam ? parseFloat(durParam.split('=')[1]) : 0,
          description: descParam ? descParam.split('=')[1].replace(/"/g, '') : undefined
        };
      });
      setLastMetrics(metrics);
    }
  }, []);

  return (
    <VitalsContext.Provider value={{ lastMetrics, recordMetrics, recordResponse }}>
      {children}
    </VitalsContext.Provider>
  );
}

export function useVitals() {
  const context = useContext(VitalsContext);
  if (!context) throw new Error("useVitals must be used within a VitalsProvider");
  return context;
}
