import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3715';

interface TestCase {
    name: string;
    endpoint: string;
    method: 'GET' | 'POST';
    body?: any;
    description: string;
}

const testCases: TestCase[] = [
    {
        name: 'health-check',
        endpoint: '/health',
        method: 'GET',
        description: 'Health check endpoint'
    },
    {
        name: 'validate-location-complete',
        endpoint: '/validate-location',
        method: 'POST',
        body: {
            streetAddress: '1600 Pennsylvania Avenue',
            city: 'Washington',
            state: 'DC',
            zipCode: '20500',
            geo: {
                type: 'Point',
                coordinates: [-77.0365, 38.8977]
            }
        },
        description: 'Complete address validation with all fields'
    },
    {
        name: 'validate-location-minimal',
        endpoint: '/validate-location',
        method: 'POST',
        body: {
            streetAddress: '1 Apple Park Way',
            city: 'Cupertino',
            state: 'CA'
        },
        description: 'Minimal address validation'
    },
    {
        name: 'validate-location-with-geo-only',
        endpoint: '/validate-location',
        method: 'POST',
        body: {
            geo: {
                type: 'Point',
                coordinates: [-122.0322, 37.3229]
            }
        },
        description: 'Reverse geocoding from coordinates'
    },
    {
        name: 'validate-location-missing-required',
        endpoint: '/validate-location',
        method: 'POST',
        body: {
            streetAddress: '123 Main St'
            // Missing city or zipCode
        },
        description: 'Missing required fields for USPS'
    }
];

async function captureBaseline() {
    console.log('🚀 Starting baseline API response capture...');
    console.log(`Testing against ${BASE_URL}\n`);
    
    const results: any = {
        timestamp: new Date().toISOString(),
        baseUrl: BASE_URL,
        tests: []
    };

    for (const test of testCases) {
        console.log(`📋 Testing: ${test.name}`);
        console.log(`   ${test.description}`);
        
        try {
            const startTime = Date.now();
            
            const response = await axios({
                method: test.method,
                url: `${BASE_URL}${test.endpoint}`,
                data: test.body,
                headers: {
                    'Content-Type': 'application/json'
                },
                validateStatus: () => true // Don't throw on any status code
            });
            
            const duration = Date.now() - startTime;
            
            const result = {
                name: test.name,
                endpoint: test.endpoint,
                method: test.method,
                requestBody: test.body,
                statusCode: response.status,
                responseHeaders: response.headers,
                responseBody: response.data,
                duration,
                timestamp: new Date().toISOString()
            };
            
            results.tests.push(result);
            
            console.log(`   ✅ Status: ${response.status} (${duration}ms)`);
            
        } catch (error: any) {
            console.log(`   ❌ Error: ${error.message}`);
            
            results.tests.push({
                name: test.name,
                endpoint: test.endpoint,
                method: test.method,
                requestBody: test.body,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        console.log('');
    }
    
    // Save results
    const outputPath = path.join(__dirname, 'baseline-responses.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    
    console.log(`\n📁 Baseline responses saved to: ${outputPath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   Total tests: ${results.tests.length}`);
    console.log(`   Successful: ${results.tests.filter((t: any) => !t.error).length}`);
    console.log(`   Failed: ${results.tests.filter((t: any) => t.error).length}`);
    
    // Create a response structure documentation
    const structureDoc = generateStructureDoc(results);
    const structurePath = path.join(__dirname, 'api-response-structures.md');
    fs.writeFileSync(structurePath, structureDoc);
    console.log(`\n📝 API structure documentation saved to: ${structurePath}`);
}

function generateStructureDoc(results: any): string {
    let doc = '# Location Correction API Response Structures\n\n';
    doc += `Generated: ${results.timestamp}\n\n`;
    
    for (const test of results.tests) {
        if (!test.error) {
            doc += `## ${test.name}\n\n`;
            doc += `**Endpoint:** \`${test.method} ${test.endpoint}\`\n\n`;
            
            if (test.requestBody) {
                doc += '**Request Body:**\n```json\n';
                doc += JSON.stringify(test.requestBody, null, 2);
                doc += '\n```\n\n';
            }
            
            doc += `**Response Status:** ${test.statusCode}\n\n`;
            doc += '**Response Structure:**\n```json\n';
            doc += JSON.stringify(test.responseBody, null, 2);
            doc += '\n```\n\n';
            doc += '---\n\n';
        }
    }
    
    return doc;
}

// Run if called directly
if (require.main === module) {
    captureBaseline().catch(console.error);
}

export { captureBaseline, testCases };