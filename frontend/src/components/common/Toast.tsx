interface ToastProps {
  message: string;
}

export default function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 animate-[fadeSlideDown_0.3s_ease] rounded-2xl bg-text-primary px-5 py-3 text-sm font-medium text-white shadow-float">
      {message}
    </div>
  );
}
