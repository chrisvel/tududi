// Jest setup for frontend tests
import '@testing-library/jest-dom';

// jsdom doesn't expose TextEncoder/TextDecoder, but react-router-dom requires
// them at import time. Polyfill from Node's util module.
import { TextEncoder, TextDecoder } from 'util';

if (typeof (globalThis as any).TextEncoder === 'undefined') {
    (globalThis as any).TextEncoder = TextEncoder;
}
if (typeof (globalThis as any).TextDecoder === 'undefined') {
    (globalThis as any).TextDecoder = TextDecoder;
}
