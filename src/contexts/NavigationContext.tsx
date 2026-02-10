import React, { createContext, useContext, useState, useCallback } from 'react';

interface Breadcrumb {
  label: string;
  path: string;
  icon?: React.ReactNode;
}

interface NavigationContextType {
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: (breadcrumbs: Breadcrumb[]) => void;
  isNavigating: boolean;
  setIsNavigating: (isNavigating: boolean) => void;
  navigationHistory: string[];
  addToHistory: (path: string) => void;
  goBack: () => string | null;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);

  const addToHistory = useCallback((path: string) => {
    setNavigationHistory((prev) => [...prev.slice(-9), path]); // Keep last 10 items
  }, []);

  const goBack = useCallback(() => {
    if (navigationHistory.length > 1) {
      const newHistory = navigationHistory.slice(0, -1);
      setNavigationHistory(newHistory);
      return newHistory[newHistory.length - 1];
    }
    return null;
  }, [navigationHistory]);

  return (
    <NavigationContext.Provider
      value={{
        breadcrumbs,
        setBreadcrumbs,
        isNavigating,
        setIsNavigating,
        navigationHistory,
        addToHistory,
        goBack,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};
