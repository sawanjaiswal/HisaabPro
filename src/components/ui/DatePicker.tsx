import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  id?: string;
  name?: string;
  label?: string;
  error?: string;
  helperText?: React.ReactNode;
  value?: string; // Expects YYYY-MM-DD or YYYY-MM-DDTHH:mm
  defaultValue?: string;
  onChange?: (dateString: string) => void;
  onValueChange?: (dateString: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  triggerClassName?: string;
  size?: 'sm' | 'default' | 'compact';
  variant?: 'default' | 'table-cell' | 'ghost';
  showTime?: boolean;
  minDate?: string;
  maxDate?: string;
  quickPresets?: boolean;
  mode?: 'default' | 'dob' | 'compliance' | 'issue' | 'expiry';
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  country?: 'IN' | 'US' | 'GB' | string;
  minAge?: number;
  required?: boolean;
  align?: 'start' | 'end' | 'center';
  dataRow?: number;
  dataField?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}

export interface TimePickerProps {
  id?: string;
  name?: string;
  label?: string;
  error?: string;
  value?: string; // Expects HH:mm
  defaultValue?: string;
  onChange?: (timeString: string) => void;
  onValueChange?: (timeString: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'default' | 'compact';
  variant?: 'default' | 'table-cell' | 'ghost';
  align?: 'start' | 'end' | 'center';
  dataRow?: number;
  dataField?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Intelligent date parser supporting:
 * - YYYY-MM-DD (ISO)
 * - DD/MM/YYYY or DD-MM-YYYY (Indian / European standard)
 * - MM/DD/YYYY or MM-DD-YYYY (US standard when format is MM/DD/YYYY)
 * - DDMMYYYY or MMDDYYYY (8 raw typed digits)
 * - DDMMYY or MMDDYY (6 raw typed digits)
 * - Optional time: HH:mm
 */
function parseFlexibleDateString(
  input?: string,
  format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' = 'DD/MM/YYYY'
): { isoDate: string; timeStr: string; dateObj: Date | null } {
  if (!input || typeof input !== 'string' || !input.trim()) {
    return { isoDate: '', timeStr: '12:00', dateObj: null };
  }

  const clean = input.trim();
  const parts = clean.split(/[T ]/);
  const datePart = parts[0].replace(/[^0-9/-]/g, '');
  const timePart = parts[1] || '12:00';

  // 1. ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (!isNaN(dateObj.getTime())) {
      return { isoDate: datePart, timeStr: timePart.substring(0, 5), dateObj };
    }
  }

  // 2. Delimited format: DD/MM/YYYY or MM/DD/YYYY
  if (/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.test(datePart)) {
    const match = datePart.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (match) {
      let d = Number(match[1]);
      let m = Number(match[2]);
      const y = Number(match[3]);

      if (format === 'MM/DD/YYYY') {
        m = Number(match[1]);
        d = Number(match[2]);
      }

      const dateObj = new Date(y, m - 1, d);
      if (!isNaN(dateObj.getTime()) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return { isoDate: iso, timeStr: timePart.substring(0, 5), dateObj };
      }
    }
  }

  // 3. Compact 8-digit typing: 23111992
  const digitsOnly = clean.replace(/\D/g, '');
  if (digitsOnly.length === 8) {
    let d = Number(digitsOnly.substring(0, 2));
    let m = Number(digitsOnly.substring(2, 4));
    const y = Number(digitsOnly.substring(4, 8));

    if (format === 'MM/DD/YYYY') {
      m = Number(digitsOnly.substring(0, 2));
      d = Number(digitsOnly.substring(2, 4));
    }

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      const dateObj = new Date(y, m - 1, d);
      if (!isNaN(dateObj.getTime())) {
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return { isoDate: iso, timeStr: timePart.substring(0, 5), dateObj };
      }
    }
  }

  // 4. Compact 6-digit typing: 231192
  if (digitsOnly.length === 6) {
    let d = Number(digitsOnly.substring(0, 2));
    let m = Number(digitsOnly.substring(2, 4));
    const rawY = Number(digitsOnly.substring(4, 6));
    const y = rawY < 50 ? 2000 + rawY : 1900 + rawY;

    if (format === 'MM/DD/YYYY') {
      m = Number(digitsOnly.substring(0, 2));
      d = Number(digitsOnly.substring(2, 4));
    }

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dateObj = new Date(y, m - 1, d);
      if (!isNaN(dateObj.getTime())) {
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return { isoDate: iso, timeStr: timePart.substring(0, 5), dateObj };
      }
    }
  }

  return { isoDate: '', timeStr: '12:00', dateObj: null };
}

function formatDateToISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Smart as-you-type mask formatter.
 * Converts raw digits like "23111992" into "23/11/1992" on the fly without blocking backspace.
 */
function formatAsYouType(
  raw: string,
  format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' = 'DD/MM/YYYY'
): string {
  if (!raw) return '';

  // If input already has non-digit delimiters like / or -, clean while allowing partial typing
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';

  if (format === 'DD/MM/YYYY' || format === 'MM/DD/YYYY') {
    if (digits.length <= 2) {
      return digits;
    }
    if (digits.length <= 4) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  } else if (format === 'YYYY-MM-DD') {
    if (digits.length <= 4) {
      return digits;
    }
    if (digits.length <= 6) {
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }

  return raw;
}

function formatDisplayDate(
  isoVal?: string,
  showTime: boolean = false,
  format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' = 'DD/MM/YYYY'
): string {
  if (!isoVal) return '';
  const { dateObj, timeStr } = parseFlexibleDateString(isoVal, format);
  if (!dateObj) return isoVal;

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();

  let base = `${day}/${month}/${year}`;
  if (format === 'MM/DD/YYYY') {
    base = `${month}/${day}/${year}`;
  } else if (format === 'YYYY-MM-DD') {
    base = `${year}-${month}-${day}`;
  }

  return showTime ? `${base} ${timeStr}` : base;
}

/**
 * Calculates accurate age in years from birthdate
 */
function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

export interface AgeGuidance {
  isLegalAdult: boolean;
  isJuniorPermit: boolean;
  isUnderMinAge: boolean;
  badgeVariant: 'emerald' | 'amber' | 'rose';
  statusText: string;
  subText: string;
}

export function getCountryAgeGuidance(age: number, country: string = 'IN'): AgeGuidance {
  const normCountry = (country || 'IN').toUpperCase();

  if (normCountry === 'US') {
    if (age >= 18) {
      return {
        isLegalAdult: true,
        isJuniorPermit: false,
        isUnderMinAge: false,
        badgeVariant: 'emerald',
        statusText: '✓ Full Driver Licence Age (≥18)',
        subText: 'Eligible for unrestricted vehicle operation in US',
      };
    }
    if (age >= 14) {
      return {
        isLegalAdult: false,
        isJuniorPermit: true,
        isUnderMinAge: false,
        badgeVariant: 'amber',
        statusText: `⚠️ Teen Driver (${age} Yrs)`,
        subText: 'Eligible for Learner Permit / Provisional Driver depending on US state (14–17 yrs)',
      };
    }
    return {
      isLegalAdult: false,
      isJuniorPermit: false,
      isUnderMinAge: true,
      badgeVariant: 'rose',
      statusText: `⚠️ Under 14 Yrs (${age} Yrs)`,
      subText: 'Below minimum statutory US learner permit age (Min 14 required in US)',
    };
  }

  if (normCountry === 'GB' || normCountry === 'UK') {
    if (age >= 17) {
      return {
        isLegalAdult: true,
        isJuniorPermit: false,
        isUnderMinAge: false,
        badgeVariant: 'emerald',
        statusText: '✓ Full Driving Licence Age (≥17)',
        subText: 'Eligible for standard LMV / Car & Commercial training in UK',
      };
    }
    if (age >= 16) {
      return {
        isLegalAdult: false,
        isJuniorPermit: true,
        isUnderMinAge: false,
        badgeVariant: 'amber',
        statusText: `⚠️ Moped / Tractor Age (${age} Yrs)`,
        subText: 'Eligible for provisional 50cc moped / tractor; 17 required for car',
      };
    }
    return {
      isLegalAdult: false,
      isJuniorPermit: false,
      isUnderMinAge: true,
      badgeVariant: 'rose',
      statusText: `⚠️ Under 16 Yrs (${age} Yrs)`,
      subText: 'Below statutory UK minimum driving age',
    };
  }

  // India (IN) & Universal defaults (Motor Vehicles Act):
  if (age >= 18) {
    return {
      isLegalAdult: true,
      isJuniorPermit: false,
      isUnderMinAge: false,
      badgeVariant: 'emerald',
      statusText: '✓ Full Legal Age (≥18)',
      subText: 'Eligible for LMV & Commercial Transport Licence under Indian RTO',
    };
  }
  if (age >= 16) {
    return {
      isLegalAdult: false,
      isJuniorPermit: true,
      isUnderMinAge: false,
      badgeVariant: 'amber',
      statusText: `⚠️ Junior / Learner (${age} Yrs)`,
      subText: 'Eligible for <50cc Gearless (MCWOG); Min 18 required for LMV/Transport',
    };
  }
  return {
    isLegalAdult: false,
    isJuniorPermit: false,
    isUnderMinAge: true,
    badgeVariant: 'rose',
    statusText: `⚠️ Under 16 Yrs (${age} Yrs)`,
    subText: 'Below statutory minimum driving age in India (Min 16 required for MCWOG)',
  };
}

/**
 * Shadcn UI DatePicker with Direct Typing Input + Interactive Calendar Popover Selector.
 * Complies with https://ui.shadcn.com/docs/components/base/date-picker#input
 */
export const DatePicker: React.FC<DatePickerProps> = ({
  id,
  name,
  label,
  error,
  helperText,
  value: controlledValue,
  defaultValue = '',
  onChange,
  onValueChange,
  placeholder,
  disabled = false,
  className,
  inputClassName,
  triggerClassName,
  size = 'default',
  variant = 'default',
  showTime = false,
  minDate,
  maxDate,
  quickPresets = true,
  mode = 'default',
  dateFormat = 'DD/MM/YYYY',
  country = 'IN',
  minAge,
  required = false,
  align = 'start',
  dataRow,
  dataField,
  onKeyDown,
  autoFocus = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : internalValue;

  const defaultPlaceholder = useMemo(() => {
    if (placeholder) return placeholder;
    if (dateFormat === 'MM/DD/YYYY') return 'MM / DD / YYYY';
    if (dateFormat === 'YYYY-MM-DD') return 'YYYY - MM - DD';
    return 'DD / MM / YYYY';
  }, [placeholder, dateFormat]);

  // Local text input state for direct keyboard typing
  const [typedText, setTypedText] = useState(() => formatDisplayDate(activeValue, showTime, dateFormat));
  const isTypingRef = useRef(false);

  const { dateObj: selectedDate, timeStr: selectedTime } = useMemo(
    () => parseFlexibleDateString(activeValue, dateFormat),
    [activeValue, dateFormat]
  );

  // Sync typed text when activeValue changes externally (e.g. initial load or auto-fill)
  useEffect(() => {
    if (!isTypingRef.current) {
      setTypedText(formatDisplayDate(activeValue, showTime, dateFormat));
    }
  }, [activeValue, showTime, dateFormat]);

  // Calendar view navigation state (current visible month/year)
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (selectedDate) return selectedDate;
    if (mode === 'dob') {
      const now = new Date();
      return new Date(now.getFullYear() - (minAge || 18), now.getMonth(), now.getDate());
    }
    return new Date();
  });

  const [timeValue, setTimeValue] = useState<string>(selectedTime || '12:00');
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync viewDate when popover opens or selected date changes
  useEffect(() => {
    if (isOpen) {
      if (selectedDate) {
        setViewDate(new Date(selectedDate));
        setTimeValue(selectedTime);
      } else if (mode === 'dob') {
        const now = new Date();
        setViewDate(new Date(now.getFullYear() - (minAge || 18), now.getMonth(), now.getDate()));
      }
    }
  }, [selectedDate, selectedTime, isOpen, mode, minAge]);

  // Viewport-aware positioning for Portal popover
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const popoverWidth = showTime ? 340 : 290;
    const popoverHeight = showTime ? 400 : 360;

    let left = rect.left;
    if (align === 'end') {
      left = rect.right - popoverWidth;
    } else if (align === 'center') {
      left = rect.left + rect.width / 2 - popoverWidth / 2;
    }

    // Horizontal bounds: ensure popover stays within viewport padding
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }
    if (left < 12) left = 12;

    // Vertical bounds: if overflow bottom, prefer displaying above input if it fits,
    // otherwise clamp within viewport with a safe minimum margin so it never overlaps modals or viewport top
    let top = rect.bottom + 6;
    if (top + popoverHeight > window.innerHeight - 12) {
      if (rect.top - popoverHeight - 6 >= 12) {
        top = rect.top - popoverHeight - 6;
      } else {
        // Clamp into available screen space
        top = Math.max(12, Math.min(top, window.innerHeight - popoverHeight - 12));
      }
    }
    if (top < 12) top = 12;

    setPopoverCoords({ top, left });
    setIsPositioned(true);
  }, [align, showTime]);

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    } else {
      setIsPositioned(false);
    }
    setIsOpen(!isOpen);
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    } else {
      setIsPositioned(false);
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen, updatePosition]);

  // Outside click listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('touchstart', handleOutsideClick);
      };
    }
  }, [isOpen]);

  // Escape key listener
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.focus();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }
  }, [isOpen]);

  const emitChange = (isoDate: string, time?: string) => {
    let finalValue = isoDate;
    if (isoDate && showTime) {
      const t = time || timeValue || '12:00';
      finalValue = `${isoDate}T${t}`;
    }

    if (!isControlled) {
      setInternalValue(finalValue);
    }
    setTypedText(formatDisplayDate(finalValue, showTime, dateFormat));
    onValueChange?.(finalValue);
    onChange?.(finalValue);
  };

  // Direct keyboard input change handler with smart as-you-type masking
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isTypingRef.current = true;
    const raw = e.target.value;

    // Apply smart formatting mask on the fly
    const formatted = formatAsYouType(raw, dateFormat);
    setTypedText(formatted);

    if (!raw.trim()) {
      emitChange('');
      return;
    }

    const { isoDate, dateObj } = parseFlexibleDateString(formatted, dateFormat);
    if (isoDate && dateObj) {
      if (!isControlled) {
        setInternalValue(isoDate);
      }
      onValueChange?.(isoDate);
      onChange?.(isoDate);
      setViewDate(dateObj);
    }
  };

  // On blur, normalize display format
  const handleInputBlur = () => {
    isTypingRef.current = false;
    if (!typedText.trim()) {
      emitChange('');
      return;
    }

    const { isoDate, dateObj, timeStr } = parseFlexibleDateString(typedText, dateFormat);
    if (isoDate && dateObj) {
      emitChange(isoDate, timeStr);
    } else {
      // Revert to last valid value or reset
      setTypedText(formatDisplayDate(activeValue, showTime, dateFormat));
    }
  };

  // Calendar Day Selection from Popover
  const handleSelectDay = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const iso = formatDateToISO(newDate);
    emitChange(iso);
    if (!showTime) {
      setIsOpen(false);
      inputRef.current?.focus();
    }
  };

  // Preset buttons handler (navigates & selects date while keeping popover open for manual adjustment)
  const handlePreset = (offsetMonths: number = 0, offsetYears: number = 0, offsetDays: number = 0) => {
    const now = new Date();
    const target = new Date(now.getFullYear() + offsetYears, now.getMonth() + offsetMonths, now.getDate() + offsetDays);
    const iso = formatDateToISO(target);
    emitChange(iso);
    setViewDate(target);
  };

  // Age preset handler for DOB mode
  const handleAgePreset = (ageYears: number) => {
    const now = new Date();
    const target = new Date(now.getFullYear() - ageYears, now.getMonth(), now.getDate());
    const iso = formatDateToISO(target);
    emitChange(iso);
    setViewDate(target);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    emitChange('');
    setTypedText('');
    inputRef.current?.focus();
  };

  // Date bounds normalization
  const todayIso = formatDateToISO(new Date());

  const effectiveMinDate = useMemo(() => {
    if (minDate) {
      const parsed = parseFlexibleDateString(minDate, dateFormat);
      return parsed.isoDate || minDate;
    }
    return undefined;
  }, [minDate, dateFormat]);

  const effectiveMaxDate = useMemo(() => {
    if (maxDate) {
      const parsed = parseFlexibleDateString(maxDate, dateFormat);
      return parsed.isoDate || maxDate;
    }
    if (mode === 'dob' || mode === 'issue') {
      return todayIso;
    }
    return undefined;
  }, [maxDate, mode, todayIso, dateFormat]);

  // Calendar Days Grid Matrix
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: Array<{
      day: number;
      isCurrentMonth: boolean;
      dateString: string;
      isSelected: boolean;
      isToday: boolean;
      isDisabled: boolean;
    }> = [];

    const selectedIso = selectedDate ? formatDateToISO(selectedDate) : '';

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, d);
      const prevIso = formatDateToISO(prevDate);
      days.push({
        day: d,
        isCurrentMonth: false,
        dateString: prevIso,
        isSelected: false,
        isToday: false,
        isDisabled: true,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const currDate = new Date(year, month, i);
      const currIso = formatDateToISO(currDate);
      const isDateOutOfRange = Boolean(
        (effectiveMinDate && currIso < effectiveMinDate) ||
        (effectiveMaxDate && currIso > effectiveMaxDate)
      );

      days.push({
        day: i,
        isCurrentMonth: true,
        dateString: currIso,
        isSelected: currIso === selectedIso,
        isToday: currIso === todayIso,
        isDisabled: isDateOutOfRange,
      });
    }

    // Next month padding to fill 35 or 42 grid cells
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(year, month + 1, i);
      const nextIso = formatDateToISO(nextDate);
      days.push({
        day: i,
        isCurrentMonth: false,
        dateString: nextIso,
        isSelected: false,
        isToday: false,
        isDisabled: true,
      });
    }

    return days;
  }, [viewDate, selectedDate, effectiveMinDate, effectiveMaxDate, todayIso]);

  // Internal date bounds validation
  const internalRangeError = useMemo(() => {
    if (!activeValue) return undefined;
    const { isoDate } = parseFlexibleDateString(activeValue, dateFormat);
    if (!isoDate) return undefined;

    if (effectiveMinDate && isoDate < effectiveMinDate) {
      return `Date cannot be earlier than ${formatDisplayDate(effectiveMinDate, false, dateFormat)}`;
    }
    if (effectiveMaxDate && isoDate > effectiveMaxDate) {
      return `Date cannot be later than ${formatDisplayDate(effectiveMaxDate, false, dateFormat)}`;
    }
    return undefined;
  }, [activeValue, effectiveMinDate, effectiveMaxDate, dateFormat]);

  const displayError = error || internalRangeError;

  // Year options for jump selector based on mode
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    if (mode === 'dob') {
      const maxBirthYear = currentYear - (minAge || 16);
      const minBirthYear = currentYear - 100;
      // Descending order for easy selection of adult age bracket
      for (let y = maxBirthYear; y >= minBirthYear; y--) {
        years.push(y);
      }
    } else if (mode === 'issue') {
      for (let y = currentYear; y >= currentYear - 35; y--) {
        years.push(y);
      }
    } else if (mode === 'expiry') {
      for (let y = currentYear - 2; y <= currentYear + 20; y++) {
        years.push(y);
      }
    } else if (mode === 'compliance') {
      for (let y = currentYear - 5; y <= currentYear + 15; y++) {
        years.push(y);
      }
    } else {
      for (let y = currentYear - 80; y <= currentYear + 25; y++) {
        years.push(y);
      }
    }
    return years;
  }, [currentYear, mode, minAge]);

  const computedAge = useMemo(() => {
    if (mode === 'dob' && selectedDate) {
      return calculateAge(selectedDate);
    }
    return null;
  }, [mode, selectedDate]);

  const isTableCell = variant === 'table-cell';

  const containerStyles = cn(
    'relative flex items-center transition-all',
    isTableCell
      ? 'w-full rounded-lg border border-transparent hover:border-slate-200 focus-within:border-emerald-500 focus-within:bg-white bg-transparent'
      : cn(
          'w-full bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:border-slate-900',
          size === 'compact' && 'h-7',
          size === 'sm' && 'h-8',
          size === 'default' && 'h-11 min-h-[44px]'
        ),
    isOpen && (isTableCell ? 'border-emerald-600 bg-white ring-1 ring-emerald-500/30' : 'border-slate-900 ring-2 ring-slate-900/10'),
    displayError && 'border-rose-500 focus-within:border-rose-500 focus-within:ring-rose-500/10',
    disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
    className
  );

  const inputStyles = cn(
    'w-full bg-transparent font-mono text-slate-800 placeholder:text-slate-300 outline-none transition-all',
    isTableCell
      ? 'px-2 py-1.5 text-[11px] font-semibold text-slate-800'
      : cn(
          'px-3 text-xs font-semibold',
          size === 'compact' && 'text-[11px] h-full',
          size === 'sm' && 'text-xs h-full',
          size === 'default' && 'text-xs h-full'
        ),
    inputClassName
  );

  return (
    <div className={cn('relative flex flex-col gap-1', !isTableCell && 'w-full')}>
      {label && (
        <label htmlFor={id} className="text-xs font-bold text-slate-700 tracking-tight select-none">
          {label}
        </label>
      )}

      {/* Dual Input & Selector Container */}
      <div ref={containerRef} className={containerStyles}>
        {/* Direct Text Typing Input with smart masking */}
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          value={typedText}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder={defaultPlaceholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          data-row={dataRow}
          data-field={dataField}
          onKeyDown={(e) => {
            if (e.key === 'F4' || (e.altKey && e.key === 'ArrowDown')) {
              e.preventDefault();
              setIsOpen(!isOpen);
            }
            onKeyDown?.(e);
          }}
          className={inputStyles}
        />

        {/* Clear Button */}
        {typedText && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            title="Clear date"
            tabIndex={-1}
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* Calendar / Selector Popover Trigger Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={toggleOpen}
          aria-label="Open calendar selector"
          tabIndex={-1}
          className={cn(
            'p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 mr-1 cursor-pointer',
            isOpen && 'text-emerald-600 bg-emerald-50',
            triggerClassName
          )}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {displayError && <p className="text-[11px] font-semibold text-rose-500">{displayError}</p>}
      {!displayError && helperText && <p className="text-[11px] text-slate-400 mt-1 font-medium">{helperText}</p>}

      {/* Floating Popover Calendar Selector */}
      {isOpen && isPositioned &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${popoverCoords.top}px`,
              left: `${popoverCoords.left}px`,
            }}
            className="z-[10001] bg-white rounded-2xl shadow-xl border border-slate-200 p-3 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-100 ease-out origin-top select-none"
          >
            {/* Quick Mode-Specific Presets */}
            {quickPresets && mode === 'dob' && (
              <div className="flex items-center gap-1 pb-2 border-b border-slate-100 flex-wrap">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Age:</span>
                {(country?.toUpperCase() === 'US' ? [14, 16, 18, 25, 35, 50] : [16, 18, 25, 35, 50, 60]).map((age) => (
                  <button
                    key={age}
                    type="button"
                    onClick={() => handleAgePreset(age)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer"
                    title={`Set Birth Year to ${currentYear - age} (${age} years old)`}
                  >
                    {age} yrs
                  </button>
                ))}
              </div>
            )}

            {quickPresets && (mode === 'compliance' || mode === 'default') && (
              <div className="flex items-center gap-1 pb-2 border-b border-slate-100 flex-wrap">
                <button
                  type="button"
                  onClick={() => handlePreset(0, 0, 0)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(0, 0, 1)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer"
                  title="Tomorrow (+1 Day)"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(0, 0, 7)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 transition-all cursor-pointer"
                  title="Next Week (+7 Days)"
                >
                  +7 Days
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(0, 0, 15)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all cursor-pointer"
                  title="+15 Days"
                >
                  +15 Days
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(1, 0, 0)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 transition-all cursor-pointer"
                  title="Next Month (+30 Days)"
                >
                  +30 Days
                </button>
              </div>
            )}

            {quickPresets && mode === 'issue' && (
              <div className="flex items-center gap-1 pb-2 border-b border-slate-100 flex-wrap">
                <button
                  type="button"
                  onClick={() => handlePreset(0)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(-1)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                >
                  -1 Mo
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(-6)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                >
                  -6 Mo
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(0, -1)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                >
                  -1 Yr
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(0, -5)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                >
                  -5 Yrs
                </button>
              </div>
            )}

            {quickPresets && mode === 'expiry' && (
              <div className="flex items-center gap-1 pb-2 border-b border-slate-100 flex-wrap">
                <button
                  type="button"
                  onClick={() => handlePreset(1)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 transition-all cursor-pointer"
                >
                  +1 Mo
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(3)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all cursor-pointer"
                >
                  +3 Mo
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(6)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 transition-all cursor-pointer"
                >
                  +6 Mo
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(0, 1)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer"
                >
                  +1 Yr
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(0, 5)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer"
                >
                  +5 Yrs
                </button>
              </div>
            )}

            {/* Header: Month / Year Selectors and Navigation Buttons */}
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() =>
                  setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
                }
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                <select
                  value={viewDate.getMonth()}
                  onChange={(e) =>
                    setViewDate(new Date(viewDate.getFullYear(), Number(e.target.value), 1))
                  }
                  className="px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  {SHORT_MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  value={viewDate.getFullYear()}
                  onChange={(e) =>
                    setViewDate(new Date(Number(e.target.value), viewDate.getMonth(), 1))
                  }
                  className="px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() =>
                  setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
                }
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {DAYS_OF_WEEK.map((d) => (
                <div key={d} className="py-0.5">
                  {d}
                </div>
              ))}
            </div>

            {/* Day Grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {calendarDays.map(({ day, isCurrentMonth, dateString, isSelected, isToday, isDisabled }, idx) => (
                <button
                  key={`${dateString}-${idx}`}
                  type="button"
                  onClick={() => isCurrentMonth && !isDisabled && handleSelectDay(day)}
                  disabled={!isCurrentMonth || isDisabled}
                  className={cn(
                    'h-7 w-7 mx-auto rounded-lg text-xs font-semibold flex items-center justify-center transition-all',
                    !isCurrentMonth && 'text-slate-300 opacity-40 cursor-default pointer-events-none',
                    isCurrentMonth && isDisabled && 'text-slate-300 opacity-30 cursor-not-allowed pointer-events-none bg-slate-50 line-through',
                    isCurrentMonth && !isDisabled && !isSelected && 'hover:bg-slate-100 text-slate-700 cursor-pointer',
                    isToday && !isSelected && !isDisabled && 'border border-emerald-500 text-emerald-700 font-bold',
                    isSelected && 'bg-emerald-600 text-white font-bold shadow-xs shadow-emerald-600/30'
                  )}
                >
                  {day}
                </button>
              ))}
            </div>

            {/* Optional Time Picker Section */}
            {showTime && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Time (24h):</span>
                  </div>
                  <input
                    type="time"
                    value={timeValue}
                    onChange={(e) => {
                      const t = e.target.value;
                      setTimeValue(t);
                      if (selectedDate) {
                        emitChange(formatDateToISO(selectedDate), t);
                      }
                    }}
                    className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 outline-none focus:border-emerald-500 bg-slate-50"
                  />
                </div>

                {/* Quick Time Presets */}
                <div className="flex items-center gap-1 flex-wrap">
                  {['09:00', '12:00', '15:00', '18:00', '23:59'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTimeValue(t);
                        if (selectedDate) {
                          emitChange(formatDateToISO(selectedDate), t);
                        }
                      }}
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all cursor-pointer',
                        timeValue === t
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* DOB Live Age & Country-Specific Legal Status Pill */}
            {mode === 'dob' && computedAge !== null && (() => {
              const guidance = getCountryAgeGuidance(computedAge, country);
              return (
                <div className={cn(
                  'p-2.5 rounded-xl text-[10px] font-bold border space-y-1',
                  guidance.badgeVariant === 'emerald' && 'bg-emerald-50 text-emerald-950 border-emerald-200',
                  guidance.badgeVariant === 'amber' && 'bg-amber-50 text-amber-950 border-amber-200',
                  guidance.badgeVariant === 'rose' && 'bg-rose-50 text-rose-950 border-rose-200'
                )}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-black">
                      <span>🎂</span>
                      <span>Age: <strong>{computedAge} Years</strong></span>
                    </span>
                    <span className="font-extrabold">{guidance.statusText}</span>
                  </div>
                  <p className="text-[9px] font-medium opacity-80 leading-tight">
                    {guidance.subText}
                  </p>
                </div>
              );
            })()}

            {/* Bottom action row */}
            <div className="pt-1 flex items-center justify-between border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]">
                {activeValue ? formatDisplayDate(activeValue, showTime, dateFormat) : 'No date set'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

/**
 * Standalone Shadcn UI TimePicker with Direct Typing Input + Quick Preset Selector.
 */
export const TimePicker: React.FC<TimePickerProps> = ({
  id,
  name,
  label,
  error,
  value: controlledValue,
  defaultValue = '',
  onChange,
  onValueChange,
  placeholder = 'HH:mm',
  disabled = false,
  className,
  size = 'default',
  variant = 'default',
  align = 'start',
  dataRow,
  dataField,
  onKeyDown,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : internalValue;

  const [typedText, setTypedText] = useState(activeValue || '');
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!isTypingRef.current) {
      setTypedText(activeValue || '');
    }
  }, [activeValue]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const popoverWidth = 220;
    const popoverHeight = 180;

    let left = rect.left;
    if (align === 'end') left = rect.right - popoverWidth;
    if (left + popoverWidth > window.innerWidth - 12) left = window.innerWidth - popoverWidth - 12;
    if (left < 12) left = 12;

    let top = rect.bottom + 6;
    if (top + popoverHeight > window.innerHeight - 12) {
      if (rect.top - popoverHeight - 6 >= 12) {
        top = rect.top - popoverHeight - 6;
      } else {
        top = Math.max(12, Math.min(top, window.innerHeight - popoverHeight - 12));
      }
    }
    if (top < 12) top = 12;

    setPopoverCoords({ top, left });
    setIsPositioned(true);
  }, [align]);

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    } else {
      setIsPositioned(false);
    }
    setIsOpen(!isOpen);
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    } else {
      setIsPositioned(false);
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('touchstart', handleOutsideClick);
      };
    }
  }, [isOpen]);

  const emitChange = (val: string) => {
    if (!isControlled) {
      setInternalValue(val);
    }
    setTypedText(val);
    onValueChange?.(val);
    onChange?.(val);
  };

  const handleSelectPreset = (t: string) => {
    emitChange(t);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const isTableCell = variant === 'table-cell';

  return (
    <div className={cn('relative flex flex-col gap-1', !isTableCell && 'w-full')}>
      {label && (
        <label htmlFor={id} className="text-xs font-bold text-slate-700 tracking-tight select-none">
          {label}
        </label>
      )}

      <div
        ref={containerRef}
        className={cn(
          'relative flex items-center transition-all',
          isTableCell
            ? 'w-full rounded-lg border border-transparent hover:border-slate-200 focus-within:border-emerald-500 focus-within:bg-white bg-transparent'
            : cn(
                'w-full bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:border-slate-900',
                size === 'compact' && 'h-7',
                size === 'sm' && 'h-8',
                size === 'default' && 'h-11 min-h-[44px]'
              ),
          isOpen && 'border-slate-900 ring-2 ring-slate-900/10',
          error && 'border-rose-500',
          disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
          className
        )}
      >
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          value={typedText}
          onChange={(e) => {
            isTypingRef.current = true;
            setTypedText(e.target.value);
            emitChange(e.target.value);
          }}
          onBlur={() => {
            isTypingRef.current = false;
          }}
          placeholder={placeholder}
          disabled={disabled}
          data-row={dataRow}
          data-field={dataField}
          onKeyDown={onKeyDown}
          className={cn(
            'w-full bg-transparent font-mono text-slate-800 placeholder:text-slate-300 outline-none',
            isTableCell ? 'px-2 py-1.5 text-[11px] font-semibold' : 'px-3 text-xs font-semibold'
          )}
        />

        <button
          type="button"
          disabled={disabled}
          onClick={toggleOpen}
          aria-label="Open time picker"
          tabIndex={-1}
          className={cn(
            'p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 mr-1 cursor-pointer',
            isOpen && 'text-emerald-600 bg-emerald-50'
          )}
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
      </div>

      {error && <p className="text-[11px] font-semibold text-rose-500">{error}</p>}

      {isOpen && isPositioned &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${popoverCoords.top}px`,
              left: `${popoverCoords.left}px`,
            }}
            className="z-[10001] bg-white rounded-2xl shadow-xl border border-slate-200 p-3 space-y-2.5 animate-in fade-in-0 slide-in-from-top-1 duration-100 ease-out origin-top select-none w-56"
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5">
              <span>Select Time</span>
              <input
                type="time"
                value={activeValue || ''}
                onChange={(e) => emitChange(e.target.value)}
                className="px-1.5 py-0.5 rounded border border-slate-200 text-xs font-mono font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {[
                '06:00', '08:00', '09:00', '10:00',
                '12:00', '14:00', '16:00', '18:00',
                '20:00', '22:00', '23:59',
              ].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleSelectPreset(t)}
                  className={cn(
                    'px-2 py-1 rounded-lg text-xs font-mono font-semibold transition-all text-center',
                    activeValue === t
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
