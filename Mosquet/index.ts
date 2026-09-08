export interface Task {
  id: string;
  title: string;
  assignedTo: string | null;
  dueDate: Date | null;
  createdAt: Date;
}

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'urgent';
}
