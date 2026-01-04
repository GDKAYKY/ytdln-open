import React, { useState, useEffect } from 'react';

const ToastContainer = () => {
    const [toasts, setToasts] = useState([]);

    const addToast = (message, type = 'success', duration = 3000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, duration }]);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    useEffect(() => {
        if(!window.electronAPI) return;

        // Success listener
        const onSuccess = window.electronAPI.onDownloadSuccess((msg) => {
             // If msg provided use it, else default
             const message = typeof msg === 'string' && msg ? msg : "Download completed successfully.";
             addToast(message, 'success');
        });

        // Error listener
        const onError = window.electronAPI.onDownloadError((msg) => {
             addToast(msg || "Download failed.", 'error'); 
        });

        // Global toast event if we decide to emit it from other components
        const handleCustomToast = (e) => {
            const { message, type, duration } = e.detail;
            addToast(message, type, duration);
        };
        window.addEventListener('show-toast', handleCustomToast);

        return () => {
            // cleanup listeners if needed
            window.removeEventListener('show-toast', handleCustomToast);
        };
    }, []);

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
            ))}
        </div>
    );
};

const ToastItem = ({ toast, onRemove }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(toast.id);
        }, toast.duration);
        return () => clearTimeout(timer);
    }, [toast, onRemove]);

    return (
        <div className={`toast-bg ${toast.type === 'error' ? 'error' : ''}`}> {/* Add error styles in CSS if needed */}
             <div className="toast-checkmark">
                {toast.type === 'error' ? (
                     <svg viewBox="0 0 24 24" stroke="currentColor" fill="none">
                         <path d="M18 6L6 18M6 6l12 12" stroke="#dc3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                     </svg>
                ) : (
                    <svg viewBox="0 0 24 24">
                        <path d="M20 6L9 17L4 12" stroke="#28A745" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                )}
             </div>
             <a className="toast-text">{toast.message}</a>
             <button className="toast-close" onClick={() => onRemove(toast.id)}>
                 <svg width="12" height="12" viewBox="0 0 12 12">
                     <path d="M9 3L3 9M3 3L9 9" stroke={toast.type === 'error' ? '#dc3545' : '#28A745'} strokeWidth="1.5" strokeLinecap="round"/>
                 </svg>
             </button>
             <div className="progress-bg">
                 <div className="progress-fill" style={{animationDuration: `${toast.duration}ms`}}></div>
             </div>
        </div>
    );
};

// Helper to trigger toast from anywhere
export const showToast = (message, type = 'success', duration = 3000) => {
    const event = new CustomEvent('show-toast', { detail: { message, type, duration } });
    window.dispatchEvent(event);
};

export default ToastContainer;
