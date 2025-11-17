import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    publicDir: 'public',
    server: {
        port: 8080,
        host: '0.0.0.0',
        proxy: {
            '/api': {
                target: 'http://localhost:3002',
                changeOrigin: true,
                secure: false,
                configure: (proxy, _options) => {
                    proxy.on('proxyRes', (proxyRes) => {
                        proxyRes.headers['Access-Control-Allow-Origin'] =
                            'http://localhost:8080';
                        proxyRes.headers['Access-Control-Allow-Credentials'] =
                            'true';
                    });
                },
            },
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.jsx'],
    },
    define: {
        'process.env.ENABLE_NOTE_COLOR': JSON.stringify(
            process.env.ENABLE_NOTE_COLOR
        ),
        'process.env.TUDUDI_BASE_PATH': JSON.stringify(
            process.env.TUDUDI_BASE_PATH || ''
        ),
    },
});
