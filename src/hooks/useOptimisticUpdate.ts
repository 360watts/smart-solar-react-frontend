import { useState, useCallback, useRef } from 'react';

interface OptimisticUpdateOptions<T> {
  /** Callback on successful mutation */
  onSuccess?: (data: T) => void;
  /** Callback on error (rollback will already happen) */
  onError?: (error: Error, rollbackData: T | null) => void;
  /** Callback when mutation settles (success or error) */
  onSettled?: () => void;
  /** Delay before applying optimistic update (useful for debouncing) */
  optimisticDelay?: number;
}

interface MutationState {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
}

interface UseOptimisticUpdateReturn<T, P> {
  /** Current data state */
  data: T | null;
  /** Set data directly (for initial load) */
  setData: (data: T | null) => void;
  /** Mutation state */
  mutation: MutationState;
  /** Execute mutation with optimistic update */
  mutate: (
    params: P,
    optimisticData: T | ((prev: T | null) => T | null),
    mutateFn: (params: P) => Promise<T>
  ) => Promise<T | null>;
  /** Reset error state */
  resetError: () => void;
  /** Whether an optimistic update is in flight */
  isOptimistic: boolean;
}

/**
 * Hook for managing optimistic updates with automatic rollback on failure.
 * Provides instant UI feedback while mutations are in flight.
 * 
 * @example
 * ```tsx
 * const { data, mutate, mutation } = useOptimisticUpdate<Device[], UpdateParams>();
 * 
 * // Update device with instant UI feedback
 * await mutate(
 *   { id: deviceId, name: newName },
 *   (prev) => prev?.map(d => d.id === deviceId ? {...d, name: newName} : d) ?? null,
 *   (params) => apiService.updateDevice(params.id, { name: params.name })
 * );
 * ```
 */
export function useOptimisticUpdate<T, P = any>(
  initialData: T | null = null,
  options: OptimisticUpdateOptions<T> = {}
): UseOptimisticUpdateReturn<T, P> {
  const {
    onSuccess,
    onError,
    onSettled,
    optimisticDelay = 0,
  } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [mutation, setMutation] = useState<MutationState>({
    isPending: false,
    isError: false,
    error: null,
  });
  const [isOptimistic, setIsOptimistic] = useState(false);

  const rollbackDataRef = useRef<T | null>(null);
  const optimisticTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const mutate = useCallback(async (
    params: P,
    optimisticData: T | ((prev: T | null) => T | null),
    mutateFn: (params: P) => Promise<T>
  ): Promise<T | null> => {
    // Clear any pending optimistic timeout
    if (optimisticTimeoutRef.current) {
      clearTimeout(optimisticTimeoutRef.current);
    }

    // Store rollback data
    rollbackDataRef.current = data;
    
    setMutation({
      isPending: true,
      isError: false,
      error: null,
    });

    // Apply optimistic update
    const applyOptimistic = () => {
      setIsOptimistic(true);
      const newData = typeof optimisticData === 'function'
        ? (optimisticData as (prev: T | null) => T | null)(data)
        : optimisticData;
      setData(newData);
    };

    if (optimisticDelay > 0) {
      optimisticTimeoutRef.current = setTimeout(applyOptimistic, optimisticDelay);
    } else {
      applyOptimistic();
    }

    try {
      // Execute actual mutation
      const result = await mutateFn(params);
      
      // Clear timeout if still pending
      if (optimisticTimeoutRef.current) {
        clearTimeout(optimisticTimeoutRef.current);
      }

      // Update with actual result
      setData(result);
      setIsOptimistic(false);
      setMutation({
        isPending: false,
        isError: false,
        error: null,
      });
      
      onSuccess?.(result);
      onSettled?.();
      
      return result;
    } catch (err) {
      // Clear timeout if still pending
      if (optimisticTimeoutRef.current) {
        clearTimeout(optimisticTimeoutRef.current);
      }

      // Rollback to previous data
      const error = err instanceof Error ? err : new Error(String(err));
      setData(rollbackDataRef.current);
      setIsOptimistic(false);
      setMutation({
        isPending: false,
        isError: true,
        error,
      });
      
      onError?.(error, rollbackDataRef.current);
      onSettled?.();
      
      return null;
    }
  }, [data, onSuccess, onError, onSettled, optimisticDelay]);

  const resetError = useCallback(() => {
    setMutation(prev => ({
      ...prev,
      isError: false,
      error: null,
    }));
  }, []);

  return {
    data,
    setData,
    mutation,
    mutate,
    resetError,
    isOptimistic,
  };
}

/**
 * Hook for managing list operations with optimistic updates.
 * Provides common CRUD operations with automatic rollback.
 */
export function useOptimisticList<T extends { id: number | string }>(
  initialData: T[] = [],
  options: OptimisticUpdateOptions<T[]> = {}
) {
  const { data, setData, mutation, mutate, resetError, isOptimistic } = 
    useOptimisticUpdate<T[]>(initialData, options);

  const optimisticAdd = useCallback(async (
    newItem: T,
    addFn: () => Promise<T>
  ) => {
    return mutate(
      null,
      (prev) => prev ? [...prev, newItem] : [newItem],
      async () => {
        const result = await addFn();
        // Replace optimistic item with actual result
        const currentData = data ?? [];
        return currentData.map(item => 
          item.id === newItem.id ? result : item
        );
      }
    );
  }, [data, mutate]);

  const optimisticUpdate = useCallback(async (
    id: T['id'],
    updates: Partial<T>,
    updateFn: () => Promise<T>
  ) => {
    return mutate(
      null,
      (prev) => prev?.map(item => 
        item.id === id ? { ...item, ...updates } : item
      ) ?? null,
      async () => {
        const result = await updateFn();
        const currentData = data ?? [];
        return currentData.map(item => 
          item.id === id ? result : item
        );
      }
    );
  }, [data, mutate]);

  const optimisticRemove = useCallback(async (
    id: T['id'],
    removeFn: () => Promise<void>
  ) => {
    return mutate(
      null,
      (prev) => prev?.filter(item => item.id !== id) ?? null,
      async () => {
        await removeFn();
        return (data ?? []).filter(item => item.id !== id);
      }
    );
  }, [data, mutate]);

  return {
    data,
    setData,
    mutation,
    resetError,
    isOptimistic,
    optimisticAdd,
    optimisticUpdate,
    optimisticRemove,
  };
}

export default useOptimisticUpdate;
