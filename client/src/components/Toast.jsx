import { useEffect } from 'react';

// Shows a message for a few seconds; "Undo" brings back a deleted expense.
export default function Toast({ toast, onUndo, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.message}</span>
      <button className="link" onClick={onUndo}>Undo</button>
    </div>
  );
}

