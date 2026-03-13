import { afterEach } from '@jest/globals';

const originalConsoleError = console.error;
const currentTestErrors = [];

console.error = (...args) => {
    // 1. Still print the error to the terminal exactly as before
    originalConsoleError(...args);

    // 2. Record that the error happened during this test
    const formattedArgs = args.map(arg => {
        if (arg instanceof Error) {
            return arg.stack || arg.message;
        }
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
    });
    currentTestErrors.push(formattedArgs.join(' '));
};

afterEach(() => {
    if (currentTestErrors.length > 0) {
        // Copy the errors to report them
        const errorsToReport = [...currentTestErrors];

        // Reset the tracker for the next test
        currentTestErrors.length = 0;

        // Force the test to fail natively
        throw new Error(`Test failed because console.error was called during execution:\n${errorsToReport.join('\n')}`);
    }
});
