const { spawn } = require('child_process');
const path = require('path');

function measureMemory() {
    console.log('Starting location-correction service...');
    
    const serverPath = path.join(__dirname, 'dist', 'server.js');
    const server = spawn('node', [serverPath], {
        env: { ...process.env },
        detached: false
    });

    let peakMemory = 0;
    const startTime = Date.now();

    const interval = setInterval(() => {
        try {
            const usage = process.memoryUsage();
            const currentMemory = Math.round(usage.heapUsed / 1024 / 1024);
            if (currentMemory > peakMemory) {
                peakMemory = currentMemory;
            }
        } catch (e) {
            // Process might have ended
        }
    }, 100);

    server.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server running on port')) {
            console.log('Server started successfully');
            
            // Measure memory after 3 seconds
            setTimeout(() => {
                server.kill();
                clearInterval(interval);
                
                const memInfo = {
                    timestamp: new Date().toISOString(),
                    peakMemoryMB: peakMemory,
                    startupTimeMs: Date.now() - startTime
                };
                
                console.log('\nMemory Usage Report:');
                console.log(`Peak Memory: ${memInfo.peakMemoryMB} MB`);
                console.log(`Startup Time: ${memInfo.startupTimeMs} ms`);
                
                // Save to file
                const fs = require('fs');
                fs.writeFileSync('baseline-memory.json', JSON.stringify(memInfo, null, 2));
                console.log('\nSaved to baseline-memory.json');
                
                process.exit(0);
            }, 3000);
        }
    });

    server.stderr.on('data', (data) => {
        console.error(`Error: ${data}`);
    });

    server.on('error', (error) => {
        console.error('Failed to start server:', error);
        clearInterval(interval);
        process.exit(1);
    });
}

// Check if .env file exists
const fs = require('fs');
if (!fs.existsSync('.env')) {
    console.error('Please create a .env file with required environment variables');
    process.exit(1);
}

require('dotenv').config();
measureMemory();