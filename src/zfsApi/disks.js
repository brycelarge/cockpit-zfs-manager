const cockpit = window.cockpit;

export class DisksApi {
    static async getPoolDisks(poolName) {
        return new Promise(async (resolve, reject) => {
            try {
                // Get devices used by the pool
                const devices = await DisksApi.getPoolDevices(poolName);
                
                // Get SMART info for each device
                const disksWithSmart = await Promise.all(
                    devices.map(async (device) => {
                        const smartInfo = await DisksApi.getSmartInfo(device.path).catch(() => null);
                        return {
                            ...device,
                            smart: smartInfo
                        };
                    })
                );
                
                resolve(disksWithSmart);
            } catch (exc) {
                reject(exc);
            }
        });
    }

    static async getPoolDevices(poolName) {
        return new Promise((resolve, reject) => {
            const devices = [];
            const proc = cockpit.spawn(['zpool', 'status', poolName], { err: 'message' });
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined || output.trim().length > 0) {
                    console.log(`zpool status output for ${poolName}:`, output);
                    const lines = output.split('\n');
                    const deviceSet = new Set();
                    let inDeviceTable = false;
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        const originalLine = line;
                        
                        // Device table starts with "NAME" header (can be indented)
                        if (trimmed.startsWith('NAME') || trimmed.match(/^\s*NAME\s+STATE\s+READ\s+WRITE\s+CHECKSUM/)) {
                            inDeviceTable = true;
                            console.log('Found NAME header, entering device table');
                            continue;
                        }
                        
                        // Stop parsing if we hit a new section (pool:, state:, etc.)
                        if (trimmed.startsWith('pool:') || trimmed.startsWith('state:') || trimmed.startsWith('status:') || trimmed.startsWith('action:') || trimmed.startsWith('scan:') || trimmed.startsWith('errors:')) {
                            if (inDeviceTable) {
                                console.log('Leaving device table, found section:', trimmed);
                            }
                            inDeviceTable = false;
                            continue;
                        }
                        
                        // Parse device rows (can be indented)
                        if (inDeviceTable && trimmed) {
                            // Skip separator lines
                            if (trimmed.match(/^-+$/)) continue;
                            
                            // Skip empty lines
                            if (!trimmed) continue;
                            
                            // Skip the pool name row itself (exact match or starts with pool name)
                            if (trimmed === poolName || trimmed.startsWith(poolName + ' ') || trimmed.startsWith(poolName + '\t')) {
                                console.log('Skipping pool name row:', trimmed);
                                continue;
                            }
                            
                            // Split by whitespace (handles both spaces and tabs)
                            const parts = trimmed.split(/\s+/);
                            if (parts.length >= 1) {
                                const deviceName = parts[0];
                                console.log('Checking device row:', trimmed, 'First part:', deviceName);
                                
                                // Check if it's a physical device name (with or without /dev/ prefix)
                                let devicePath = deviceName;
                                let deviceShortName = deviceName;
                                
                                // If it doesn't start with /dev/, check if it looks like a device name
                                if (!deviceName.startsWith('/dev/')) {
                                    // Check if it matches common device name patterns
                                    if (deviceName.match(/^(nvme\d+n\d+|sd[a-z]+|hd[a-z]+|vd[a-z]+|xvd[a-z]+)/)) {
                                        // It's a device name without /dev/ prefix, add it
                                        devicePath = '/dev/' + deviceName;
                                        deviceShortName = deviceName;
                                    } else {
                                        // Not a device name, skip it
                                        continue;
                                    }
                                } else {
                                    // Already has /dev/ prefix
                                    deviceShortName = deviceName.replace('/dev/', '');
                                }
                                
                                // Only process if it looks like a physical device
                                if (devicePath.startsWith('/dev/') && !deviceSet.has(devicePath)) {
                                    deviceSet.add(devicePath);
                                    
                                    devices.push({
                                        path: devicePath,
                                        name: deviceShortName,
                                        type: DisksApi.getDeviceType(devicePath)
                                    });
                                    console.log('Added device:', devicePath, '(from:', deviceName, ')');
                                }
                            }
                        }
                        
                        // Also check for /dev/ paths anywhere in the output (fallback)
                        // This catches cases where devices might be listed differently
                        if (trimmed.includes('/dev/')) {
                            const devMatch = trimmed.match(/(\/dev\/[^\s\)]+)/g);
                            if (devMatch) {
                                for (const devPath of devMatch) {
                                    // Clean up any trailing punctuation
                                    const cleanPath = devPath.replace(/[,\)]+$/, '');
                                    if (!deviceSet.has(cleanPath) && cleanPath.startsWith('/dev/')) {
                                        deviceSet.add(cleanPath);
                                        const deviceShortName = cleanPath.replace('/dev/', '');
                                        devices.push({
                                            path: cleanPath,
                                            name: deviceShortName,
                                            type: DisksApi.getDeviceType(cleanPath)
                                        });
                                        console.log('Added device from fallback search:', cleanPath);
                                    }
                                }
                            }
                        }
                    }
                    
                    console.log(`Found ${devices.length} devices for pool ${poolName}:`, devices);
                    resolve(devices);
                } else {
                    reject(new Error(`Failed to get pool devices: exit code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static getDeviceType(devicePath) {
        if (devicePath.includes('nvme')) {
            return 'NVMe';
        } else if (devicePath.match(/sd[a-z]+/)) {
            return 'SATA/SAS';
        } else if (devicePath.match(/hd[a-z]+/)) {
            return 'IDE';
        } else if (devicePath.match(/vd[a-z]+/)) {
            return 'VirtIO';
        }
        return 'Unknown';
    }

    static async getSmartInfo(devicePath) {
        return new Promise((resolve, reject) => {
            console.log(`Getting SMART info for ${devicePath}`);
            // Check if smartctl is available
            const checkProc = cockpit.spawn(['which', 'smartctl'], { err: 'message' });
            
            checkProc.done(async (exitCode) => {
                if (exitCode !== 0) {
                    console.log(`smartctl not found (exit code: ${exitCode})`);
                    resolve(null); // smartctl not available
                    return;
                }
                
                console.log(`smartctl found, checking device: ${devicePath}`);
                const isNVMe = devicePath.includes('nvme');
                const smartInfo = {
                    available: true,
                    health: 'UNKNOWN',
                    attributes: [],
                    model: '',
                    serial: '',
                    capacity: '',
                    temperature: null,
                    powerOnHours: null,
                    powerCycleCount: null,
                    reallocatedSectors: null,
                    pendingSectors: null,
                    uncorrectableSectors: null
                };
                
                // For NVMe devices, use different approach
                if (isNVMe) {
                    console.log(`Getting NVMe SMART info for ${devicePath}`);
                    // Get NVMe SMART info
                    const nvmeProc = cockpit.spawn(['smartctl', '-a', devicePath], { err: 'message' });
                    let nvmeOutput = '';
                    
                    nvmeProc.stream((data) => {
                        nvmeOutput += data;
                    });
                    
                    nvmeProc.done((nvmeExitCode) => {
                        console.log(`smartctl -a ${devicePath} exit code: ${nvmeExitCode}`);
                        console.log(`smartctl output length: ${nvmeOutput.length}`);
                        if (nvmeExitCode === 0 || nvmeExitCode == null || nvmeExitCode === '' || nvmeExitCode === undefined) {
                            // Parse NVMe model
                            const modelMatch = nvmeOutput.match(/Model Number:\s*(.+)/i) ||
                                             nvmeOutput.match(/Device Model:\s*(.+)/i);
                            if (modelMatch) {
                                smartInfo.model = modelMatch[1].trim();
                            }
                            
                            // Parse NVMe serial
                            const serialMatch = nvmeOutput.match(/Serial Number:\s*(.+)/i);
                            if (serialMatch) {
                                smartInfo.serial = serialMatch[1].trim();
                            }
                            
                            // Parse NVMe capacity
                            const capacityMatch = nvmeOutput.match(/Total NVM Capacity:\s*([\d,]+)\s*bytes/i) ||
                                                nvmeOutput.match(/Namespace 1 Size\/Capacity:\s*([\d,]+)\s*bytes/i) ||
                                                nvmeOutput.match(/User Capacity:\s*\[?([\d,]+)\s*bytes\]?/i);
                            if (capacityMatch) {
                                const bytes = parseInt(capacityMatch[1].replace(/,/g, ''));
                                smartInfo.capacity = DisksApi.formatBytes(bytes);
                            }
                            
                            // Parse NVMe health status
                            if (nvmeOutput.match(/SMART overall-health self-assessment test result:\s*PASSED/i) ||
                                nvmeOutput.match(/Health Status:\s*OK/i)) {
                                smartInfo.health = 'PASSED';
                            } else if (nvmeOutput.match(/SMART overall-health self-assessment test result:\s*FAILED/i) ||
                                      nvmeOutput.match(/Health Status:\s*FAILED/i)) {
                                smartInfo.health = 'FAILED';
                            }
                            
                            // Parse NVMe temperature (usually in Celsius)
                            const tempMatch = nvmeOutput.match(/Temperature:\s*(\d+)\s*Celsius/i) ||
                                            nvmeOutput.match(/Temperature Sensor \d+:\s*(\d+)\s*C/i);
                            if (tempMatch) {
                                smartInfo.temperature = parseInt(tempMatch[1]);
                            }
                            
                            // Parse Power On Hours for NVMe
                            const pohMatch = nvmeOutput.match(/Power On Hours:\s*(\d+)/i);
                            if (pohMatch) {
                                smartInfo.powerOnHours = parseInt(pohMatch[1]);
                            }
                            
                            // Parse Power Cycles for NVMe
                            const pcMatch = nvmeOutput.match(/Power Cycles:\s*(\d+)/i);
                            if (pcMatch) {
                                smartInfo.powerCycleCount = parseInt(pcMatch[1]);
                            }
                            
                            // Parse Media and Data Integrity Errors (NVMe equivalent of reallocated sectors)
                            const mediaErrorMatch = nvmeOutput.match(/Media and Data Integrity Errors:\s*(\d+)/i);
                            if (mediaErrorMatch) {
                                smartInfo.reallocatedSectors = parseInt(mediaErrorMatch[1]);
                            }
                            
                            console.log(`Parsed SMART info for ${devicePath}:`, smartInfo);
                            resolve(smartInfo);
                        } else {
                            console.log(`smartctl failed for ${devicePath} with exit code: ${nvmeExitCode}`);
                            console.log(`Output: ${nvmeOutput.substring(0, 500)}`);
                            resolve(null);
                        }
                    });
                    
                    nvmeProc.fail((error) => {
                        console.error(`smartctl failed for ${devicePath}:`, error);
                        resolve(null);
                    });
                } else {
                    // Traditional SATA/SAS device handling
                    // Get SMART health status
                    const healthProc = cockpit.spawn(['smartctl', '-H', devicePath], { err: 'message' });
                    let healthOutput = '';
                    
                    healthProc.stream((data) => {
                        healthOutput += data;
                    });
                    
                    healthProc.done(async (healthExitCode) => {
                        // Parse health status
                        if (healthOutput.includes('PASSED') || healthOutput.includes('OK')) {
                            smartInfo.health = 'PASSED';
                        } else if (healthOutput.includes('FAILED')) {
                            smartInfo.health = 'FAILED';
                        }
                        
                        // Get detailed SMART attributes
                        const attrsProc = cockpit.spawn(['smartctl', '-A', devicePath], { err: 'message' });
                        let attrsOutput = '';
                        
                        attrsProc.stream((data) => {
                            attrsOutput += data;
                        });
                        
                        attrsProc.done(async (attrsExitCode) => {
                            // Parse model and serial from info section
                            const infoProc = cockpit.spawn(['smartctl', '-i', devicePath], { err: 'message' });
                            let infoOutput = '';
                            
                            infoProc.stream((data) => {
                                infoOutput += data;
                            });
                            
                            infoProc.done((infoExitCode) => {
                                // Parse model
                                const modelMatch = infoOutput.match(/Device Model:\s*(.+)/i) || 
                                                 infoOutput.match(/Model Number:\s*(.+)/i) ||
                                                 infoOutput.match(/Model Family:\s*(.+)/i);
                                if (modelMatch) {
                                    smartInfo.model = modelMatch[1].trim();
                                }
                                
                                // Parse serial
                                const serialMatch = infoOutput.match(/Serial Number:\s*(.+)/i) ||
                                                  infoOutput.match(/Serial number:\s*(.+)/i);
                                if (serialMatch) {
                                    smartInfo.serial = serialMatch[1].trim();
                                }
                                
                                // Parse capacity
                                const capacityMatch = infoOutput.match(/User Capacity:\s*\[?(\d+)\s*bytes\]?/i) ||
                                                    infoOutput.match(/Capacity:\s*(\d+)\s*bytes/i);
                                if (capacityMatch) {
                                    const bytes = parseInt(capacityMatch[1]);
                                    smartInfo.capacity = DisksApi.formatBytes(bytes);
                                }
                                
                                // Parse SMART attributes
                                const lines = attrsOutput.split('\n');
                                for (const line of lines) {
                                    // Parse attribute lines (ID# ATTRIBUTE_NAME FLAG VALUE WORST THRESH TYPE UPDATED WHEN_FAILED RAW_VALUE)
                                    const attrMatch = line.match(/^\s*(\d+)\s+(\w+(?:\s+\w+)*)\s+\w+\s+(\d+)\s+(\d+)\s+(\d+)/);
                                    if (attrMatch) {
                                        const id = parseInt(attrMatch[1]);
                                        const name = attrMatch[2].trim();
                                        const value = parseInt(attrMatch[3]);
                                        const worst = parseInt(attrMatch[4]);
                                        const threshold = parseInt(attrMatch[5]);
                                        
                                        // Extract RAW_VALUE (last field)
                                        const rawMatch = line.match(/\s+(\d+)\s*$/);
                                        const rawValue = rawMatch ? parseInt(rawMatch[1]) : null;
                                        
                                        smartInfo.attributes.push({
                                            id,
                                            name,
                                            value,
                                            worst,
                                            threshold,
                                            rawValue
                                        });
                                        
                                        // Extract specific important attributes
                                        if (name.includes('Temperature') || name.includes('Temp')) {
                                            smartInfo.temperature = rawValue || value;
                                        }
                                        if (name.includes('Power_On_Hours') || name.includes('Power-On Hours')) {
                                            smartInfo.powerOnHours = rawValue;
                                        }
                                        if (name.includes('Power_Cycle_Count') || name.includes('Power Cycles')) {
                                            smartInfo.powerCycleCount = rawValue;
                                        }
                                        if (name.includes('Reallocated_Sector_Ct') || name.includes('Reallocated Sectors')) {
                                            smartInfo.reallocatedSectors = rawValue;
                                        }
                                        if (name.includes('Current_Pending_Sector') || name.includes('Pending Sectors')) {
                                            smartInfo.pendingSectors = rawValue;
                                        }
                                        if (name.includes('Offline_Uncorrectable') || name.includes('Uncorrectable Sectors')) {
                                            smartInfo.uncorrectableSectors = rawValue;
                                        }
                                    }
                                }
                                
                                resolve(smartInfo);
                            });
                            
                            infoProc.fail(() => {
                                resolve(smartInfo); // Return what we have
                            });
                        });
                        
                        attrsProc.fail(() => {
                            resolve(smartInfo); // Return what we have
                        });
                    });
                    
                    healthProc.fail(() => {
                        resolve(null); // SMART not available for this device
                    });
                }
            });
            
            checkProc.fail(() => {
                resolve(null); // smartctl not available
            });
        });
    }

    static formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
}

