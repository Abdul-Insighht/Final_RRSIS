import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Initialize from localStorage or default to 'dark'
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('geosegai_theme');
        return saved || 'dark';
    });

    // Apply theme to <html> element whenever it changes
    useEffect(() => {
        console.log('🎨 ThemeContext: Theme changed to:', theme);
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
            console.log('🌙 Added dark class to <html>');
        } else {
            root.classList.remove('dark');
            console.log('☀️ Removed dark class from <html>');
        }
        // Persist to localStorage
        localStorage.setItem('geosegai_theme', theme);
        console.log('💾 Saved theme to localStorage:', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};
