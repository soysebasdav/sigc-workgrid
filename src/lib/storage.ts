import type { AppState } from '../types';
import { addDaysISO, nowISO } from '../utils/dates';

const STORAGE_KEY = 'sigc-workgrid-react-state-v1';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function makeId(prefix: string): string {
  return uid(prefix);
}

export function createInitialState(): AppState {
  const timestamp = nowISO();
  const adminId = 'usr_admin';
  const userId = 'usr_demo';

  return {
    currentUserId: null,
    settings: {
      inactivityTimeoutMinutes: 10
    },
    users: [
      {
        id: adminId,
        name: 'Erik González',
        email: 'admin@test.com',
        password: 'Admin123*',
        role: 'admin',
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: userId,
        name: 'Usuario Demo',
        email: 'user@test.com',
        password: 'User123*',
        role: 'user',
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    tasks: [
      {
        id: 'tsk_revisar_entregables',
        userId,
        title: 'Revisar entregables',
        description: 'Verificar el avance de la prueba técnica y confirmar que el CRUD de tareas funcione correctamente.',
        status: 'pending',
        dueDate: addDaysISO(2),
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: 'tsk_auditar_usuarios',
        userId: adminId,
        title: 'Auditar módulo de usuarios',
        description: 'Comprobar permisos, edición de roles y consistencia de usuarios administradores.',
        status: 'in_progress',
        dueDate: addDaysISO(4),
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: 'tsk_tarea_vencida',
        userId,
        title: 'Tarea vencida de ejemplo',
        description: 'Esta tarea sirve para validar visualmente el estado derivado Retraso.',
        status: 'pending',
        dueDate: addDaysISO(-1),
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    notifications: [
      {
        id: 'not_bienvenida',
        recipientUserId: adminId,
        actorUserId: null,
        taskId: null,
        type: 'system',
        title: 'SIGC visual actualizado',
        message: 'La aplicación ya corre como SPA React con estética WorkGrid Color, navegación SIGC y datos demo en localStorage.',
        isRead: false,
        createdAt: timestamp
      },
      {
        id: 'not_demo_user',
        recipientUserId: userId,
        actorUserId: adminId,
        taskId: 'tsk_revisar_entregables',
        type: 'task_created',
        title: 'Nueva tarea asignada',
        message: 'Administrador te asignó la tarea Revisar entregables.',
        isRead: false,
        createdAt: timestamp
      }
    ]
  };
}

export function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initialState = createInitialState();
    saveState(initialState);
    return initialState;
  }

  try {
    return JSON.parse(raw) as AppState;
  } catch {
    const initialState = createInitialState();
    saveState(initialState);
    return initialState;
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): AppState {
  const initialState = createInitialState();
  saveState(initialState);
  return initialState;
}
