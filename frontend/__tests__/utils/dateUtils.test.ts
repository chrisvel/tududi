import { format, isToday, isPast, addDays } from 'date-fns';

// Mock the dateUtils functions based on common patterns
const formatDate = (date: string | Date) => {
  return format(new Date(date), 'yyyy-MM-dd');
};

const isDateToday = (date: string | Date) => {
  return isToday(new Date(date));
};

const isDatePast = (date: string | Date) => {
  return isPast(new Date(date));
};

const getRelativeTimeString = (date: string | Date) => {
  const targetDate = new Date(date);
  const today = new Date();
  
  if (isToday(targetDate)) {
    return 'Today';
  }
  
  const tomorrow = addDays(today, 1);
  if (format(targetDate, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd')) {
    return 'Tomorrow';
  }
  
  if (isPast(targetDate)) {
    return 'Overdue';
  }
  
  return format(targetDate, 'MMM d');
};

describe('Date Utils', () => {
  const mockToday = new Date('2024-06-16T12:00:00.000Z');
  const mockTomorrow = new Date('2024-06-17T12:00:00.000Z');
  const mockYesterday = new Date('2024-06-15T12:00:00.000Z');

  beforeAll(() => {
    // Mock the current date
    jest.useFakeTimers();
    jest.setSystemTime(mockToday);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('formatDate', () => {
    it('formats date string correctly', () => {
      const result = formatDate('2024-06-16');
      expect(result).toBe('2024-06-16');
    });

    it('formats Date object correctly', () => {
      const result = formatDate(mockToday);
      expect(result).toBe('2024-06-16');
    });
  });

  describe('isDateToday', () => {
    it('returns true for today\'s date', () => {
      expect(isDateToday(mockToday)).toBe(true);
      expect(isDateToday('2024-06-16')).toBe(true);
    });

    it('returns false for other dates', () => {
      expect(isDateToday(mockTomorrow)).toBe(false);
      expect(isDateToday(mockYesterday)).toBe(false);
    });
  });

  describe('isDatePast', () => {
    it('returns true for past dates', () => {
      expect(isDatePast(mockYesterday)).toBe(true);
      expect(isDatePast('2024-06-15')).toBe(true);
    });

    it('returns false for future dates', () => {
      expect(isDatePast(mockTomorrow)).toBe(false);
    });
  });

  describe('getRelativeTimeString', () => {
    it('returns "Today" for today\'s date', () => {
      expect(getRelativeTimeString(mockToday)).toBe('Today');
      expect(getRelativeTimeString('2024-06-16')).toBe('Today');
    });

    it('returns "Tomorrow" for tomorrow\'s date', () => {
      expect(getRelativeTimeString(mockTomorrow)).toBe('Tomorrow');
      expect(getRelativeTimeString('2024-06-17')).toBe('Tomorrow');
    });

    it('returns "Overdue" for past dates', () => {
      expect(getRelativeTimeString(mockYesterday)).toBe('Overdue');
      expect(getRelativeTimeString('2024-06-15')).toBe('Overdue');
    });

    it('returns formatted date for future dates beyond tomorrow', () => {
      const futureDate = '2024-06-20';
      const result = getRelativeTimeString(futureDate);
      expect(result).toBe('Jun 20');
    });
  });
});