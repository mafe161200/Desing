import { Task, Notification } from '../types';

/**
 * Servicio de dominio puro para evaluar reglas de negocio sobre tareas.
 * Principio KISS: Funciones puras, sin dependencias externas.
 */
export class TaskService {
  /**
   * Genera notificaciones basadas en las reglas de negocio solicitadas.
   */
  static generateInitialNotifications(tasks: Task[], currentUserId: string): Notification[] {
    const notifications: Notification[] = [];
    const now = new Date();

    try {
      // 1. Encontrar la tarea más próxima asignada al usuario
      const userTasks = tasks.filter(t => t.assignedTo === currentUserId && t.dueDate !== null);
      if (userTasks.length > 0) {
        // Ordenar por fecha de vencimiento ascendente
        userTasks.sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
        const nearestTask = userTasks[0];
        
        notifications.push({
          id: `nearest-${nearestTask.id}`,
          message: `Tu tarea más próxima es: "${nearestTask.title}" para el ${nearestTask.dueDate!.toLocaleDateString()}`,
          type: 'info'
        });
      }

      // 2. Encontrar tareas no asignadas con más de 3 días desde su creación
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
      const unassignedOldTasks = tasks.filter(t => {
        if (t.assignedTo !== null) return false;
        const timeSinceCreation = now.getTime() - t.createdAt.getTime();
        return timeSinceCreation > THREE_DAYS_MS;
      });

      if (unassignedOldTasks.length > 0) {
        notifications.push({
          id: `unassigned-alert-${Date.now()}`,
          message: `Hay ${unassignedOldTasks.length} tarea(s) sin asignar desde hace más de 3 días.`,
          type: 'warning'
        });
      }

      return notifications;
    } catch (error) {
      // Observabilidad: Log estructurado en lugar de un try/catch vacío
      console.error('[TaskService Error]: Fallo al generar notificaciones iniciales.', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      return []; // Degradación elegante
    }
  }
}
