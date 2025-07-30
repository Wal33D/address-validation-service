#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const program = new commander_1.Command();
program
    .name('location-correction-cli')
    .description('CLI tool for testing the CandyComp Location Correction Service')
    .version('1.0.0');
function formatOutput(data, format = 'json') {
    if (format === 'json') {
        return JSON.stringify(data, null, 2);
    }
    return JSON.stringify(data);
}
program
    .command('validate')
    .description('Validate and correct a single address')
    .requiredOption('--address <address>', 'Street address')
    .option('--city <city>', 'City name')
    .option('--state <state>', 'State code (2 letters)')
    .option('--zip <zip>', 'ZIP code')
    .option('--lat <latitude>', 'Latitude for reverse geocoding', parseFloat)
    .option('--lng <longitude>', 'Longitude for reverse geocoding', parseFloat)
    .option('--host <host>', 'API host', 'http://localhost:3715')
    .option('--format <format>', 'Output format (json)', 'json')
    .action(async (options) => {
    try {
        const requestBody = {
            streetAddress: options.address
        };
        if (options.city)
            requestBody.city = options.city;
        if (options.state)
            requestBody.state = options.state;
        if (options.zip)
            requestBody.zipCode = options.zip;
        if (options.lat !== undefined && options.lng !== undefined) {
            requestBody.geo = {
                type: 'Point',
                coordinates: [options.lng, options.lat]
            };
        }
        console.log('🔍 Validating address...\n');
        const response = await axios_1.default.post(`${options.host}/validate-location`, requestBody, {
            headers: { 'Content-Type': 'application/json' },
            validateStatus: () => true
        });
        if (response.status === 200) {
            console.log('✅ Success!\n');
            console.log(formatOutput(response.data, options.format));
        }
        else {
            console.error(`❌ Error (${response.status}):\n`);
            console.error(formatOutput(response.data, options.format));
            process.exit(1);
        }
    }
    catch (error) {
        console.error('❌ Request failed:', error.message);
        process.exit(1);
    }
});
program
    .command('batch')
    .description('Validate multiple addresses from a file')
    .requiredOption('--file <file>', 'JSON file with addresses array')
    .option('--host <host>', 'API host', 'http://localhost:3715')
    .option('--output <output>', 'Output file path')
    .option('--parallel <parallel>', 'Number of parallel requests', '5')
    .action(async (options) => {
    try {
        const filePath = path.resolve(options.file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const addresses = JSON.parse(fileContent);
        if (!Array.isArray(addresses)) {
            console.error('❌ Input file must contain an array of addresses');
            process.exit(1);
        }
        console.log(`🔍 Validating ${addresses.length} addresses...\n`);
        const results = [];
        const parallel = parseInt(options.parallel);
        for (let i = 0; i < addresses.length; i += parallel) {
            const batch = addresses.slice(i, i + parallel);
            const promises = batch.map(async (address, index) => {
                try {
                    const response = await axios_1.default.post(`${options.host}/validate-location`, address, {
                        headers: { 'Content-Type': 'application/json' },
                        validateStatus: () => true
                    });
                    return {
                        index: i + index,
                        input: address,
                        status: response.status,
                        output: response.data
                    };
                }
                catch (error) {
                    return {
                        index: i + index,
                        input: address,
                        status: 'error',
                        error: error.message
                    };
                }
            });
            const batchResults = await Promise.all(promises);
            results.push(...batchResults);
            console.log(`Progress: ${results.length}/${addresses.length}`);
        }
        const successful = results.filter(r => r.status === 200).length;
        console.log(`\n✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${results.length - successful}`);
        if (options.output) {
            fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
            console.log(`\n📁 Results saved to: ${options.output}`);
        }
        else {
            console.log('\nResults:');
            console.log(JSON.stringify(results, null, 2));
        }
    }
    catch (error) {
        console.error('❌ Batch processing failed:', error.message);
        process.exit(1);
    }
});
program
    .command('test')
    .description('Test with sample addresses')
    .option('--host <host>', 'API host', 'http://localhost:3715')
    .action(async (options) => {
    const testAddresses = [
        {
            name: 'White House',
            data: {
                streetAddress: '1600 Pennsylvania Avenue',
                city: 'Washington',
                state: 'DC',
                zipCode: '20500'
            }
        },
        {
            name: 'Empire State Building',
            data: {
                streetAddress: '350 5th Ave',
                city: 'New York',
                state: 'NY',
                zipCode: '10118'
            }
        },
        {
            name: 'Golden Gate Bridge (coordinates)',
            data: {
                streetAddress: 'Golden Gate Bridge',
                geo: {
                    type: 'Point',
                    coordinates: [-122.4783, 37.8199]
                }
            }
        }
    ];
    console.log('🧪 Running tests with sample addresses...\n');
    for (const test of testAddresses) {
        console.log(`Testing: ${test.name}`);
        try {
            const response = await axios_1.default.post(`${options.host}/validate-location`, test.data, {
                headers: { 'Content-Type': 'application/json' },
                validateStatus: () => true
            });
            if (response.status === 200) {
                console.log('✅ Success');
                console.log(`  Address: ${response.data.formattedAddress}`);
                console.log(`  Coordinates: ${response.data.geo.coordinates.join(', ')}`);
            }
            else {
                console.log(`❌ Failed (${response.status})`);
            }
        }
        catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
        console.log('');
    }
});
program
    .command('health')
    .description('Check API health status')
    .option('--host <host>', 'API host', 'http://localhost:3715')
    .action(async (options) => {
    try {
        const response = await axios_1.default.get(`${options.host}/health`);
        if (response.status === 200) {
            console.log('✅ API is healthy');
            console.log(JSON.stringify(response.data, null, 2));
        }
        else {
            console.log(`❌ API health check failed (${response.status})`);
        }
    }
    catch (error) {
        console.error('❌ Cannot connect to API:', error.message);
        process.exit(1);
    }
});
program
    .command('cache-stats')
    .description('Get geocoding cache statistics')
    .option('--host <host>', 'API host', 'http://localhost:3715')
    .action(async (options) => {
    try {
        const response = await axios_1.default.get(`${options.host}/cache/stats`);
        console.log('📊 Cache Statistics:\n');
        console.log(JSON.stringify(response.data, null, 2));
    }
    catch (error) {
        if (error.response?.status === 404) {
            console.log('ℹ️  Cache stats endpoint not yet implemented');
        }
        else {
            console.error('❌ Error:', error.message);
        }
    }
});
program.parse();
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
//# sourceMappingURL=cli.js.map