'use client';

import * as React from 'react';
import { CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from './utils';

interface DateRange {
  from?: Date;
  to?: Date;
}

interface CustomDateRangePickerProps {
  date: DateRange;
  setDate: (date: DateRange) => void;
  className?: string;
}

export function DateRangePicker({ date, setDate, className }: CustomDateRangePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [selectingStart, setSelectingStart] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [tempFrom, setTempFrom] = React.useState<Date | undefined>(date.from);
  const [tempTo, setTempTo] = React.useState<Date | undefined>(date.to);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const prevMonthDays = new Date(year, month, 0).getDate();

    return { daysInMonth, startingDayOfWeek, year, month, prevMonthDays };
  };

  const isSameDay = (date1: Date | undefined, date2: Date | undefined) => {
    if (!date1 || !date2) return false;
    return date1.toDateString() === date2.toDateString();
  };

  const isInRange = (day: Date) => {
    if (!tempFrom || !tempTo) return false;
    return day >= tempFrom && day <= tempTo;
  };

  const isRangeStart = (day: Date) => {
    return isSameDay(day, tempFrom);
  };

  const isRangeEnd = (day: Date) => {
    return isSameDay(day, tempTo);
  };

  const handleDayClick = (day: Date) => {
    if (selectingStart) {
      setTempFrom(day);
      setTempTo(undefined);
      setSelectingStart(false);
    } else {
      if (day < (tempFrom || new Date())) {
        // If end date is before start, swap them
        setTempTo(tempFrom);
        setTempFrom(day);
      } else {
        setTempTo(day);
      }
      setSelectingStart(true);
    }
  };

  const applyDateRange = () => {
    setDate({ from: tempFrom, to: tempTo });
    setOpen(false);
  };

  const cancelSelection = () => {
    setTempFrom(date.from);
    setTempTo(date.to);
    setSelectingStart(true);
    setOpen(false);
  };

  const clearSelection = () => {
    setTempFrom(undefined);
    setTempTo(undefined);
    setDate({ from: undefined, to: undefined });
    setSelectingStart(true);
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  // Removed setQuickRange function as it is no longer used in the UI
  // but kept logic just in case you want to add it back later

  const renderMonth = (monthOffset: number = 0) => {
    const displayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + monthOffset);
    const { daysInMonth, startingDayOfWeek, year, month, prevMonthDays } = getDaysInMonth(displayDate);

    const days = [];
    const monthName = displayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const today = new Date();

    // Add days from previous month
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const currentDate = new Date(year, month - 1, day);
      days.push(
        <button
          key={`prev-${day}`}
          onClick={() => handleDayClick(currentDate)}
          className={cn(
            'h-9 w-9 rounded-md text-sm transition-colors',
            'text-muted-foreground/40',
            'hover:bg-accent/50 hover:text-accent-foreground'
          )}
        >
          {day}
        </button>
      );
    }

    // Add cells for each day of the current month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const isToday = currentDate.toDateString() === today.toDateString();
      const isStart = isRangeStart(currentDate);
      const isEnd = isRangeEnd(currentDate);
      const inRange = isInRange(currentDate);

      days.push(
        <button
          key={day}
          onClick={() => handleDayClick(currentDate)}
          className={cn(
            'h-9 w-9 rounded-md text-sm transition-colors relative',
            'hover:bg-accent hover:text-accent-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            isToday && !isStart && !isEnd && 'font-bold border-2 border-primary',
            (isStart || isEnd) && 'bg-primary text-primary-foreground hover:bg-primary/90 font-semibold z-10',
            inRange && !isStart && !isEnd && 'bg-primary/10 hover:bg-primary/20',
            isStart && !isEnd && 'rounded-r-none',
            isEnd && !isStart && 'rounded-l-none',
            isStart && isEnd && 'rounded-md'
          )}
        >
          {day}
        </button>
      );
    }

    // Fill remaining cells
    const totalCells = Math.ceil((startingDayOfWeek + daysInMonth) / 7) * 7;
    const remainingCells = totalCells - (startingDayOfWeek + daysInMonth);
    for (let i = 1; i <= remainingCells; i++) {
      const currentDate = new Date(year, month + 1, i);
      days.push(
        <button
          key={`next-${i}`}
          onClick={() => handleDayClick(currentDate)}
          className={cn(
            'h-9 w-9 rounded-md text-sm transition-colors',
            'text-muted-foreground/40',
            'hover:bg-accent/50 hover:text-accent-foreground'
          )}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <div className="text-sm font-semibold text-center px-2">{monthName}</div>
        <div className="grid grid-cols-7 gap-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="h-9 w-9 text-xs font-medium text-muted-foreground flex items-center justify-center">
              {day}
            </div>
          ))}
          {days}
        </div>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[300px] justify-start text-left font-normal',
            !date.from && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date.from ? (
            date.to ? (
              <>
                {formatDate(date.from)} - {formatDate(date.to)}
              </>
            ) : (
              formatDate(date.from)
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          
          {/* REMOVED QUICK SELECT SIDEBAR HERE */}

          {/* Calendar */}
          <div className="p-4">
            {/* Instructions */}
            <div className="mb-4 p-2 bg-muted/50 rounded-md">
              <div className="text-xs text-center text-muted-foreground">
                {selectingStart ? (
                  <span className="flex items-center justify-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-primary"></span>
                    Select <strong className="mx-1">start date</strong>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-primary"></span>
                    Select <strong className="mx-1">end date</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="icon"
                onClick={previousMonth}
                className="h-7 w-7"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-semibold">
                {currentMonth.toLocaleDateString('en-US', { year: 'numeric' })}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={nextMonth}
                className="h-7 w-7"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Two months side by side */}
            <div className="flex gap-6 mb-4">
              {renderMonth(0)}
              {renderMonth(1)}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-3 border-t">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelSelection}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={applyDateRange}
                  disabled={!tempFrom || !tempTo}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}