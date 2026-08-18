import { createServer } from '../../api/src/server.js';

/**
 * Starts the native API server on an ephemeral port for testing.
 * @returns {Promise<{ server: import('http').Server, baseUrl: string, close: () => Promise<void> }>}
 */
export async function startTestServer() {
    const server = createServer();
    
    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            resolve();
        });
    });

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    const close = () => {
        return new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    };

    return { server, baseUrl, close };
}
