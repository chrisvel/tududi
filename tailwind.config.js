/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './frontend/**/*.{js,ts,jsx,tsx}', // Your React components
        './app/views/**/*.erb', // Any .erb templates that might remain
    ],
    theme: {
        extend: {
            colors: {
                // tududi's own palette, as used on the marketing site
                brand: {
                    DEFAULT: '#1e86e5',
                    50: '#eaf3fc',
                    100: '#d4e7f9',
                    200: '#a9cff3',
                    300: '#7db7ec',
                    400: '#4d9fe8',
                    500: '#1e86e5',
                    600: '#176fc1',
                    700: '#125a9c',
                    900: '#0b3a66',
                },
                paper: {
                    DEFAULT: '#f7f6f3',
                    deep: '#f4f1ec',
                },
                ink: '#111827',
            },
            fontFamily: {
                // The Untangle page's pair, self-hosted (see public/index.html)
                display: ['Fraunces', 'Lora', 'Georgia', 'serif'],
                ui: [
                    '"Instrument Sans"',
                    'ui-sans-serif',
                    'system-ui',
                    '-apple-system',
                    'sans-serif',
                ],
            },
            spacing: {
                sidebar: 'var(--sidebar-width, 22rem)',
                rail: '3.5rem',
            },
            keyframes: {
                'scale-in': {
                    '0%': { transform: 'scale(0.8)', opacity: '0.5' },
                    '50%': { transform: 'scale(1.1)' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'inbox-row-in': {
                    '0%': { opacity: '0', transform: 'translateY(-5px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'inbox-detach': {
                    '0%': {
                        transform: 'scale(0.985)',
                        boxShadow: '0 0 0 rgba(0,0,0,0)',
                    },
                    '100%': { transform: 'scale(1)' },
                },
            },
            animation: {
                'scale-in': 'scale-in 0.3s ease-out',
                'fade-in': 'fade-in 0.3s ease-out',
                'inbox-row-in': 'inbox-row-in 0.22s ease-out',
                'inbox-detach':
                    'inbox-detach 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
            },
        },
    },
    plugins: [],
    // theme: {
    //   extend: {
    //     colors: {
    //       // Override the default colors in dark mode
    //       gray: {
    //         50: '#f9f9f9',  // Lightest gray (near white)
    //         100: '#f0f0f0', // Lighter gray
    //         200: '#e0e0e0', // Lighter gray
    //         300: '#c0c0c0', // Light gray
    //         400: '#a0a0a0', // Gray
    //         500: '#808080', // Neutral gray
    //         600: '#606060', // Darker gray
    //         700: '#404040', // Even darker gray
    //         800: '#202020', // Near black
    //         900: '#101010', // Darkest gray (almost black)
    //       },
    //       background: {
    //         DEFAULT: '#000000', // Black background in dark mode
    //       },
    //       text: {
    //         DEFAULT: '#ffffff', // White text in dark mode
    //       },
    //     },
    //   },
    // },
};
