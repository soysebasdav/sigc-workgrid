export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function addDaysISO(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDate(date: string | null): string {
  if (!date) return 'Sin fecha';
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(year, month - 1, day));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function isPastDate(date: string | null): boolean {
  if (!date) return false;
  return date < todayISO();
}

export function getMonthMatrix(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  const day = firstDay.getDay();
  const mondayIndex = day === 0 ? 6 : day - 1;
  start.setDate(firstDay.getDate() - mondayIndex);

  const weeks: Date[][] = [];
  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const week: Date[] = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const current = new Date(start);
      current.setDate(start.getDate() + weekIndex * 7 + dayIndex);
      week.push(current);
    }
    weeks.push(week);
  }
  return weeks;
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function monthTitle(year: number, month: number): string {
  return new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric'
  }).format(new Date(year, month, 1));
}
