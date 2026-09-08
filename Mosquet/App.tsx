import React, { useEffect, useState } from 'react';
import { TaskService } from './utils/taskService';
import { Task, Notification } from './types';
import { ChatInput } from './components/ChatInput';

// Mock de datos para ejemplificar la ejecución (Simulando respuesta de API)
const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Revisar PR de Autenticación',
    assignedTo: 'user_123',
    dueDate: new Date(Date.now() + 86400000), // Mañana
    createdAt: new Date()
  },
  {
    id: '2',
    title: 'Actualizar dependencias de seguridad',
    assignedTo: null,
    dueDate: null,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // Hace 4 días
  }
];

export const App: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const currentUserId = 'user_123'; // Simulación de sesión actual (ej. extraído de un JWT)

  // Disparador de notificaciones emergentes apenas el usuario entra
  useEffect(() => {
    try {
      // En un entorno real, `mockTasks` vendría de una llamada API / fetch
      const generatedAlerts = TaskService.generateInitialNotifications(mockTasks, currentUserId);
      setNotifications(generatedAlerts);

      // Limpieza automática de las notificaciones emergentes después de 8 segundos
      const timer = setTimeout(() => {
        setNotifications([]);
      }, 8000);

      return () => clearTimeout(timer);
    } catch (error) {
      console.error('[App]: Error durante la inicialización de notificaciones', error);
    }
  }, [currentUserId]);

  const handleSendMessage = (msg: string) => {
    // Aquí iría la lógica para enviar al backend (ej. POST /api/messages)
    // Se recomienda enviar un token JWT en los headers para la autorización.
    console.log('Enviando mensaje sanitizado y validado:', msg);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      {/* Sistema de Toasts / Notificaciones Emergentes */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
        {notifications.map(notif => (
          <div 
            key={notif.id} 
            style={{
              padding: '15px 20px',
              marginBottom: '10px',
              borderRadius: '8px',
              backgroundColor: notif.type === 'warning' ? '#FEF3C7' : '#DBEAFE',
              color: notif.type === 'warning' ? '#92400E' : '#1E40AF',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              borderLeft: `4px solid ${notif.type === 'warning' ? '#F59E0B' : '#3B82F6'}`
            }}
          >
            {notif.message}
          </div>
        ))}
      </div>

      <h1>Dashboard del Equipo</h1>
      
      <div style={{ marginTop: '50px', maxWidth: '600px' }}>
        <ChatInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
};

export default App;
