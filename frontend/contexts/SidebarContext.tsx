import React, { createContext, useContext } from 'react';

interface SidebarContextType {
    isSidebarOpen: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
    isSidebarOpen: true,
});

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    return context;
};

interface SidebarProviderProps {
    isSidebarOpen: boolean;
    children: React.ReactNode;
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({
    isSidebarOpen,
    children,
}) => {
    return (
        <SidebarContext.Provider value={{ isSidebarOpen }}>
            {children}
        </SidebarContext.Provider>
    );
};
