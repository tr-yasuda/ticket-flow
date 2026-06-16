import { toast } from "sonner";

export type ToastMessage = string;

export interface UseToastReturn {
  notifySuccess: (message: ToastMessage) => void;
  notifyError: (message: ToastMessage) => void;
  notifyInfo: (message: ToastMessage) => void;
  notifyWarning: (message: ToastMessage) => void;
  dismiss: (toastId?: string | number) => void;
}

export function useToast(): UseToastReturn {
  const notifySuccess = (message: ToastMessage) => {
    toast.success(message);
  };

  const notifyError = (message: ToastMessage) => {
    toast.error(message);
  };

  const notifyInfo = (message: ToastMessage) => {
    toast.info(message);
  };

  const notifyWarning = (message: ToastMessage) => {
    toast.warning(message);
  };

  const dismiss = (toastId?: string | number) => {
    toast.dismiss(toastId);
  };

  return {
    notifySuccess,
    notifyError,
    notifyInfo,
    notifyWarning,
    dismiss,
  };
}
