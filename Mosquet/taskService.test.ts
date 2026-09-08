import { TaskService } from '../utils/taskService';
import { Task } from '../types';

describe('TaskService.generateInitialNotifications', () => {
  const currentUserId = 'user_1';
  const now = new Date();
  
  it('Debe generar una notificación para la tarea más próxima asignada al usuario', () => {
    const tasks: Task[] = [
      { id: 't1', title: 'Lejana', assignedTo: currentUserId, dueDate: new Date(now.getTime() + 100000000), createdAt: now },
      { id: 't2', title: 'Próxima', assignedTo: currentUserId, dueDate: new Date(now.getTime() + 10000), createdAt: now },
    ];

    const notifications = TaskService.generateInitialNotifications(tasks, currentUserId);
    
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('info');
    expect(notifications[0].message).toContain('Próxima');
  });

  it('Debe generar una alerta si hay tareas sin asignar por más de 3 días', () => {
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    const tasks: Task[] = [
      { id: 't3', title: 'Olvidada', assignedTo: null, dueDate: null, createdAt: fourDaysAgo },
    ];

    const notifications = TaskService.generateInitialNotifications(tasks, currentUserId);
    
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('warning');
    expect(notifications[0].message).toContain('1 tarea(s) sin asignar');
  });

  it('Debe manejar arreglos vacíos de forma segura', () => {
    const notifications = TaskService.generateInitialNotifications([], currentUserId);
    expect(notifications).toEqual([]);
  });
});
