import { useState } from 'react';
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
  start: string;
  end: string;
  enabled: boolean;
}

export interface WorkingHoursInputProps {
  value: Record<string, TimeSlot[]>;
  onChange: (hours: Record<string, TimeSlot[]>) => void;
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

export const WorkingHoursInput = ({ value, onChange }: WorkingHoursInputProps) => {
  const [copyFromDay, setCopyFromDay] = useState<string>('Monday');

  const handleTimeChange = (day: string, index: number, type: 'start' | 'end', newTime: string) => {
    const newHours = { ...value };
    if (!newHours[day]) {
      newHours[day] = [{ start: '09:00', end: '17:00', enabled: true }];
    }
    newHours[day][index][type] = newTime;
    onChange(newHours);
  };

  const handleToggleDay = (day: string, enabled: boolean) => {
    const newHours = { ...value };
    if (!newHours[day]) {
      newHours[day] = [{ start: '09:00', end: '17:00', enabled }];
    } else {
      newHours[day] = newHours[day].map(slot => ({ ...slot, enabled }));
    }
    onChange(newHours);
  };

  const copySchedule = (fromDay: string) => {
    const newHours = { ...value };
    DAYS.forEach(day => {
      if (day !== fromDay) {
        newHours[day] = [...(value[fromDay] || [])];
      }
    });
    onChange(newHours);
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
                checked={value[day]?.[0]?.enabled ?? false}
                onCheckedChange={(checked) => handleToggleDay(day, checked)}
              />
            </div>

            {value[day]?.[0]?.enabled && (
              <div className="flex items-center gap-4 ml-4">
                <Select
                  value={value[day]?.[0]?.start ?? '09:00'}
                  onValueChange={(newTime) => handleTimeChange(day, 0, 'start', newTime)}
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
                  value={value[day]?.[0]?.end ?? '17:00'}
                  onValueChange={(newTime) => handleTimeChange(day, 0, 'end', newTime)}
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