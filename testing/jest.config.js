/** @type {import('jest').Config} */
const config = {
    // The root of your source code, allows Jest to resolve modules
    rootDir: '.',
    // Use Node.js environment for testing
    testEnvironment: 'node',
    // Explicitly tell Jest to use babel-jest for transforming JS/MJS files.
    // This is crucial for ESM support, including `import.meta.url`.
    transform: {
        '^.+\\.m?js$': 'babel-jest',
    },
    // By default, jest doesn't transform node_modules. We need to override this
    // to transform ES Modules that are published as dependencies.
    transformIgnorePatterns: [
        // The default is /node_modules/. We want to inverse this to say "transform
        // everything in node_modules EXCEPT for these packages".
        '/node_modules/(?!(@rdfjs|rdf-validate-shacl|clownface|jsonc-parser|@vocabulary)/)',
    ],
};

export default config;