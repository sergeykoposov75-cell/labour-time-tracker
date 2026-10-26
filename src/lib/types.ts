export interface Employee {
  id: string;
  name: string;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  description: string;
  startTime: string;
  endTime: string | null;
  createdAt: string;
  employee?: Employee;
}
