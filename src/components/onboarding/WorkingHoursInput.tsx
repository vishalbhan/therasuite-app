import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';

export interface TimeSlot {
  day: string;
  start: string;
  end: string;
  isWorking: boolean;
}

export interface WorkingHoursInputProps {
  value: TimeSlot[];
  onChange: (value: TimeSlot[]) => void;
}

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minute}`;
});

export const WorkingHoursInput = ({ value = [], onChange }: WorkingHoursInputProps) => {
  const [copyFromDay, setCopyFromDay] = useState<string>('Monday');

  useEffect(() => {
    if (value.length === 0) {
      const initialValue = DAYS.map(day => ({
        day,
        start: '09:00',
        end: '17:00',
        isWorking: !['Saturday', 'Sunday'].includes(day)
      }));
      onChange(initialValue);
    }
  }, [value, onChange]);

  const handleTimeChange = (day: string, type: 'start' | 'end', newTime: string) => {
    const newValue = value.map(slot => 
      slot.day === day ? { ...slot, [type]: newTime } : slot
    );
    onChange(newValue);
  };

  const handleToggleDay = (day: string, isWorking: boolean) => {
    const newValue = value.map(slot => 
      slot.day === day ? { ...slot, isWorking } : slot
    );
    onChange(newValue);
  };

  const copySchedule = (fromDay: string) => {
    const sourceSlot = value.find(slot => slot.day === fromDay);
    if (!sourceSlot) return;

    const newValue = value.map(slot => 
      slot.day !== fromDay ? { ...slot, start: sourceSlot.start, end: sourceSlot.end } : slot
    );
    onChange(newValue);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select
          value={copyFromDay}
          onValueChange={setCopyFromDay}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select day" />
          </SelectTrigger>
          <SelectContent>
            {DAYS.map(day => (
              <SelectItem key={day} value={day}>
                {day}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button
          type="button"
          variant="outline"
          onClick={() => copySchedule(copyFromDay)}
        >
          <Copy className="mr-2 h-4 w-4" />
          Apply to All Days
        </Button>
      </div>

      <div className="space-y-4">
        {DAYS.map(day => (
          <div key={day} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base">{day}</Label>
              <Switch
                checked={value.find(slot => slot.day === day)?.isWorking ?? false}
                onCheckedChange={(checked) => handleToggleDay(day, checked)}
              />
            </div>

            {value.find(slot => slot.day === day)?.isWorking && (
              <div className="flex items-center gap-4 ml-4">
                <Select
                  value={value.find(slot => slot.day === day)?.start ?? '09:00'}
                  onValueChange={(newTime) => handleTimeChange(day, 'start', newTime)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(time => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <span>to</span>
                
                <Select
                  value={value.find(slot => slot.day === day)?.end ?? '17:00'}
                  onValueChange={(newTime) => handleTimeChange(day, 'end', newTime)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(time => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}; 