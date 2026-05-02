import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: '/WorldCUP-BET/',
    build: {
        rollupOptions: {
            maxParallelFileOps: 128,
        },
    },
});
