
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastEventDetail {
    id: string;
    message: string;
    type: ToastType;
}

// Dispatch a custom event that App.tsx listens to
export const notify = (message: string, type: ToastType = 'info') => {
    const event = new CustomEvent<ToastEventDetail>('app-toast', {
        detail: {
            id: Date.now().toString(),
            message,
            type
        }
    });
    window.dispatchEvent(event);
};

export const toast = {
    success: (msg: string) => notify(msg, 'success'),
    error: (msg: string) => notify(msg, 'error'),
    info: (msg: string) => notify(msg, 'info'),
    warning: (msg: string) => notify(msg, 'warning'),
};
