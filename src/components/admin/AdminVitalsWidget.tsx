"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ChevronUp, ChevronDown, Database, Cpu, HardDrive, Zap } from 'lucide-react';
import { useVitals } from './VitalsContext';

export function AdminVitalsWidget() {
  const { lastMetrics } = useVitals();
  const [isExpanded, setIsExpanded] = useState(false);

  if (lastMetrics.length === 0) return null;

  const totalDuration = lastMetrics.reduce((sum, m) => sum + m.duration, 0);

  const getMetricIcon = (name: string) => {
    if (name.includes('db')) return <Database className="h-3 w-3" />;
    if (name.includes('s3')) return <HardDrive className="h-3 w-3" />;
    if (name.includes('sort')) return <Cpu className="h-3 w-3" />;
    return <Zap className="h-3 w-3" />;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <motion.div
        layout
        className="bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-2xl overflow-hidden"
        style={{ width: isExpanded ? '280px' : 'auto' }}
      >
        <div 
          className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 px-1">
            <div className="relative">
              <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />
            </div>
            {!isExpanded && (
              <span className="text-xs font-bold text-gray-700">
                {totalDuration.toFixed(1)}ms
              </span>
            )}
            {isExpanded && <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">System Vitals</span>}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pb-4 space-y-3"
            >
              <div className="h-px bg-gray-100 -mx-4" />
              
              <div className="space-y-2">
                {lastMetrics.map((metric, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase font-medium">
                      <div className="flex items-center gap-1.5">
                        {getMetricIcon(metric.name)}
                        {metric.name.replace('-', ' ')}
                      </div>
                      <span className="text-gray-900 font-bold">{metric.duration.toFixed(1)}ms</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((metric.duration / totalDuration) * 100, 100)}%` }}
                        className="h-full bg-emerald-500/60 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                <span className="text-[10px] text-gray-400 font-medium">TOTAL LATENCY</span>
                <span className="text-xs font-black text-emerald-600">{totalDuration.toFixed(1)}ms</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// Helper button for internal use to avoid circular deps
function Button({ children, className, onClick, size, variant }: any) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground ${className}`}
    >
      {children}
    </button>
  );
}
