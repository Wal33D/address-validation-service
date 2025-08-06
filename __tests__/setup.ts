// Test setup file
import dotenv from 'dotenv';

// Suppress dotenv logging by intercepting console.log temporarily
const originalLog = console.log;
console.log = () => {};
// Load test environment variables
dotenv.config({ path: '.env.local' });
console.log = originalLog;

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'error'; // Reduce log noise during tests

// Mock external services
jest.mock('axios');
jest.mock('node-fetch');

// Global test timeout
jest.setTimeout(10000);

// Clean up after tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});

// Add a dummy test to satisfy Jest requirement
describe('Test Setup', () => {
  it('should configure test environment', () => {
    expect(process.env['NODE_ENV']).toBe('test');
    expect(process.env['LOG_LEVEL']).toBe('error');
  });
});
