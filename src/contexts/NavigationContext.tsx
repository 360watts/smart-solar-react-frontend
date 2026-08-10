import React, { createContext, useContext, useState } from 'react';

interface NavigationContextType {
  isNavigating: boolean;
  setIsNavigating: (isNavigating: boolean) => void;
  navigationHistory: string[];
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationHistory] = useState<string[]>([]);

  return (
    <NavigationContext.Provider value={{ isNavigating, setIsNavigating, navigationHistory }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('useNavigation must be used within NavigationProvider');
  return context;
};
