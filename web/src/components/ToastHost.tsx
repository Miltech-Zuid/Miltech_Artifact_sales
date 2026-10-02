import { useToast } from '../lib/toast';

export function ToastHost() {
  const msg = useToast();
  if (!msg) return null;
  return (
    <div className="toast" role="status">
      {msg}
    </div>
  );
}
