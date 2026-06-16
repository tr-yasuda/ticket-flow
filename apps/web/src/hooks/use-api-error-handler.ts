import { useToast } from "@/hooks/use-toast";
import { reportApiError } from "@/lib/api-error";

export interface UseApiErrorHandlerReturn {
  handleApiError: (error: unknown) => void;
}

export function useApiErrorHandler(): UseApiErrorHandlerReturn {
  const { notifyError } = useToast();

  const handleApiError = (error: unknown) => {
    reportApiError(error, notifyError);
  };

  return { handleApiError };
}
