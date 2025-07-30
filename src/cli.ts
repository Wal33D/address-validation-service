#!/usr/bin/env node

import { Command } from 'commander';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { config } from './config';

const program = new Command();

// CLI configuration
program
    .name('location-correction-cli')
    .description('CLI tool for testing the CandyComp Location Correction Service')
    .version('1.0.0');

// Helper function to format output
function formatOutput(data: any, format: string = 'json'): string {
    if (format === 'json') {
        return JSON.stringify(data, null, 2);
    }
    // Add more formats as needed
    return JSON.stringify(data);
}

// Validate location command
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
            const requestBody: any = {
                streetAddress: options.address
            };

            if (options.city) requestBody.city = options.city;
            if (options.state) requestBody.state = options.state;
            if (options.zip) requestBody.zipCode = options.zip;
            
            if (options.lat !== undefined && options.lng !== undefined) {
                requestBody.geo = {
                    type: 'Point',
                    coordinates: [options.lng, options.lat]
                };
            }

            console.log('🔍 Validating address...\n');
            
            const response = await axios.post(
                `${options.host}/validate-location`,
                requestBody,
                { 
                    headers: { 'Content-Type': 'application/json' },
                    validateStatus: () => true
                }
            );

            if (response.status === 200) {
                console.log('✅ Success!\n');
                console.log(formatOutput(response.data, options.format));
            } else {
                console.error(`❌ Error (${response.status}):\n`);
                console.error(formatOutput(response.data, options.format));
                process.exit(1);
            }
        } catch (error: any) {
            console.error('❌ Request failed:', error.message);
            process.exit(1);
        }
    });

// Batch validation command
program
    .command('batch')
    .description('Validate multiple addresses from a file')
    .requiredOption('--file <file>', 'JSON file with addresses array')
    .option('--host <host>', 'API host', 'http://localhost:3715')
    .option('--output <output>', 'Output file path')
    .option('--parallel <parallel>', 'Number of parallel requests', '5')
    .action(async (options) => {
        try {
            // Read input file
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
            
            // Process in batches
            for (let i = 0; i < addresses.length; i += parallel) {
                const batch = addresses.slice(i, i + parallel);
                const promises = batch.map(async (address, index) => {
                    try {
                        const response = await axios.post(
                            `${options.host}/validate-location`,
                            address,
                            { 
                                headers: { 'Content-Type': 'application/json' },
                                validateStatus: () => true
                            }
                        );
                        
                        return {
                            index: i + index,
                            input: address,
                            status: response.status,
                            output: response.data
                        };
                    } catch (error: any) {
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

            // Summary
            const successful = results.filter(r => r.status === 200).length;
            console.log(`\n✅ Successful: ${successful}`);
            console.log(`❌ Failed: ${results.length - successful}`);

            // Save results
            if (options.output) {
                fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
                console.log(`\n📁 Results saved to: ${options.output}`);
            } else {
                console.log('\nResults:');
                console.log(JSON.stringify(results, null, 2));
            }

        } catch (error: any) {
            console.error('❌ Batch processing failed:', error.message);
            process.exit(1);
        }
    });

// Test command with sample addresses
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
                const response = await axios.post(
                    `${options.host}/validate-location`,
                    test.data,
                    { 
                        headers: { 'Content-Type': 'application/json' },
                        validateStatus: () => true
                    }
                );

                if (response.status === 200) {
                    console.log('✅ Success');
                    console.log(`  Address: ${response.data.formattedAddress}`);
                    console.log(`  Coordinates: ${response.data.geo.coordinates.join(', ')}`);
                } else {
                    console.log(`❌ Failed (${response.status})`);
                }
            } catch (error: any) {
                console.log(`❌ Error: ${error.message}`);
            }
            
            console.log('');
        }
    });

// Health check command
program
    .command('health')
    .description('Check API health status')
    .option('--host <host>', 'API host', 'http://localhost:3715')
    .action(async (options) => {
        try {
            const response = await axios.get(`${options.host}/health`);
            
            if (response.status === 200) {
                console.log('✅ API is healthy');
                console.log(JSON.stringify(response.data, null, 2));
            } else {
                console.log(`❌ API health check failed (${response.status})`);
            }
        } catch (error: any) {
            console.error('❌ Cannot connect to API:', error.message);
            process.exit(1);
        }
    });

// Cache stats command (when implemented)
program
    .command('cache-stats')
    .description('Get geocoding cache statistics')
    .option('--host <host>', 'API host', 'http://localhost:3715')
    .action(async (options) => {
        try {
            const response = await axios.get(`${options.host}/cache/stats`);
            
            console.log('📊 Cache Statistics:\n');
            console.log(JSON.stringify(response.data, null, 2));
        } catch (error: any) {
            if (error.response?.status === 404) {
                console.log('ℹ️  Cache stats endpoint not yet implemented');
            } else {
                console.error('❌ Error:', error.message);
            }
        }
    });

// Parse arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}