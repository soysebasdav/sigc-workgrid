import type { AppState } from '../types';
import { nowISO } from '../utils/dates';

const STORAGE_KEY = 'sigc-workgrid-react-state-v2';

export function createInitialState(): AppState {
  const timestamp = nowISO();
  const adminId = 'usr_admin';
  const analystId = 'usr_demo';

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
        demoRole: 'admin',
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: analystId,
        name: 'Usuario Demo',
        email: 'user@test.com',
        password: 'User123*',
        demoRole: 'analyst',
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    notifications: [
      {
        id: 'not_bienvenida_sigc',
        recipientUserId: adminId,
        actorUserId: null,
        caseId: null,
        type: 'system',
        title: 'SIGC listo para operar',
        message: 'El runtime demo ya está centrado en casos, subtareas, agenda y autorización RBAC.',
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
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!Array.isArray(parsed.users) || !Array.isArray(parsed.notifications) || !parsed.settings) {
      throw new Error('Estado demo incompatible con la Fase 11.');
    }
    return {
      currentUserId: parsed.currentUserId ?? null,
      users: parsed.users,
      notifications: parsed.notifications,
      settings: parsed.settings
    };
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
