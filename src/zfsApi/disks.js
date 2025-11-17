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
                    const lines = output.split('\n');
                    const deviceSet = new Set();
                    let inDeviceTable = false;
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        
                        // Device table starts with "NAME" header
                        if (trimmed.startsWith('NAME') || trimmed.match(/^\s*NAME\s+STATE\s+READ\s+WRITE\s+CHECKSUM/)) {
                            inDeviceTable = true;
                            continue;
                        }
                        
                        // Parse device rows
                        if (inDeviceTable && trimmed && !trimmed.startsWith('pool:') && !trimmed.startsWith('state:')) {
                            // Skip separator lines
                            if (trimmed.match(/^-+$/)) continue;
                            
                            // Skip the pool name row itself
                            if (trimmed.startsWith(poolName + ' ')) continue;
                            
                            const parts = trimmed.split(/\s+/);
                            if (parts.length >= 2) {
                                const deviceName = parts[0];
                                
                                // Only process /dev/ paths (physical devices)
                                if (deviceName.startsWith('/dev/')) {
                                    if (!deviceSet.has(deviceName)) {
                                        deviceSet.add(deviceName);
                                        
                                        // Extract device name from path
                                        const deviceShortName = deviceName.replace('/dev/', '');
                                        
                                        devices.push({
                                            path: deviceName,
                                            name: deviceShortName,
                                            type: DisksApi.getDeviceType(deviceName)
                                        });
                                    }
                                }
                            }
                        }
                    }
                    
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
            // Check if smartctl is available
            const checkProc = cockpit.spawn(['which', 'smartctl'], { err: 'message' });
            
            checkProc.done(async (exitCode) => {
                if (exitCode !== 0) {
                    resolve(null); // smartctl not available
                    return;
                }
                
                // Get SMART health status
                const healthProc = cockpit.spawn(['smartctl', '-H', devicePath], { err: 'message' });
                let healthOutput = '';
                
                healthProc.stream((data) => {
                    healthOutput += data;
                });
                
                healthProc.done(async (healthExitCode) => {
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
                                smartInfo.capacity = this.formatBytes(bytes);
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

