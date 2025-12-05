const cockpit = window.cockpit;

export class DisksApi {
    static async getSmartctlPath() {
        return new Promise((resolve) => {
            // Check common locations for smartctl (prioritize direct path checks since PATH might be restricted)
            // Order: /usr/sbin (most common), /sbin, /usr/bin, then try command -v/which
            // Use a function to stop after first match
            const checkProc = cockpit.spawn(['sh', '-c', 'for path in /usr/sbin/smartctl /sbin/smartctl /usr/bin/smartctl; do if test -x "$path"; then echo "$path"; exit 0; fi; done; command -v smartctl 2>/dev/null || which smartctl 2>/dev/null || exit 1'], { err: 'message' });
            let checkOutput = '';

            checkProc.stream((data) => {
                checkOutput += data;
            });

            checkProc.done((exitCode) => {
                const path = checkOutput.trim().split('\n')[0]; // Take first line only
                const found = path.length > 0 && path !== 'exit';
                resolve(found ? path : null);
            });

            checkProc.fail(() => {
                resolve(null);
            });
        });
    }

    static async getPoolDisks(poolName) {
        return new Promise(async (resolve, reject) => {
            try {
                // Get devices used by the pool
                const devices = await DisksApi.getPoolDevices(poolName);

                // Check if smartctl is available once and get its path
                const smartctlPath = await DisksApi.getSmartctlPath();
                const smartctlAvailable = smartctlPath !== null;

                // Get SMART info for each device sequentially to avoid overwhelming the system
                const disksWithSmart = [];
                for (const device of devices) {
                    try {
                        const smartInfo = smartctlAvailable ? await DisksApi.getSmartInfo(device.path, smartctlPath) : null;
                        disksWithSmart.push({
                            ...device,
                            smart: smartInfo,
                            smartctlAvailable
                        });
                    } catch (error) {
                        disksWithSmart.push({
                            ...device,
                            smart: null,
                            smartctlAvailable
                        });
                    }
                }

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

                                // Device table starts with "NAME" header (can be indented)
                                if (trimmed.startsWith('NAME') || trimmed.match(/^\s*NAME\s+STATE\s+READ\s+WRITE\s+CHECKSUM/)) {
                                    inDeviceTable = true;
                                    continue;
                                }

                                // Stop parsing if we hit a new section (pool:, state:, etc.)
                                if (trimmed.startsWith('pool:') || trimmed.startsWith('state:') || trimmed.startsWith('status:') || trimmed.startsWith('action:') || trimmed.startsWith('scan:') || trimmed.startsWith('errors:')) {
                                    inDeviceTable = false;
                                    continue;
                                }

                    // Parse device rows (can be indented)
                    if (inDeviceTable && trimmed) {
                        // Skip separator lines
                        if (trimmed.match(/^-+$/)) continue;

                        // Skip empty lines
                        if (!trimmed) continue;

                        // Skip VDEV container names (mirror, raidz, spare, replacing, etc.)
                        // Also skip "logs", "cache", "special", "dedup" headers
                        if (trimmed.match(/^(mirror|raidz|draid|spare|replacing|logs|cache|special|dedup)/)) continue;

                        // Skip the pool name row itself (exact match or starts with pool name)
                        if (trimmed === poolName || trimmed.startsWith(poolName + ' ') || trimmed.startsWith(poolName + '\t')) {
                            continue;
                        }

                        // Split by whitespace (handles both spaces and tabs)
                        const parts = trimmed.split(/\s+/);
                        if (parts.length >= 1) {
                            const deviceName = parts[0];

                            // Check if it's a physical device name (with or without /dev/ prefix)
                            let devicePath = deviceName;
                            let deviceShortName = deviceName;

                            // Normalize device path to include /dev/ if it's a simple name
                            // and doesn't already have a path separator
                            if (!deviceName.includes('/') && !deviceName.startsWith('/')) {
                                devicePath = `/dev/${deviceName}`;
                                deviceShortName = deviceName;
                            } else if (deviceName.startsWith('/dev/')) {
                                deviceShortName = deviceName.replace('/dev/', '');
                            }

                            if (!deviceSet.has(devicePath)) {
                                deviceSet.add(devicePath);

                                devices.push({
                                    path: devicePath,
                                    name: deviceShortName,
                                    type: DisksApi.getDeviceType(devicePath)
                                });
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

    static async getSmartInfo(devicePath, smartctlPath = null) {
        return new Promise((resolve, reject) => {
            // Resolve symlinks first (e.g. /dev/disk/by-id/... -> /dev/nvme0n1)
            const resolveProc = cockpit.spawn(['readlink', '-f', devicePath], { err: 'message' });
            let resolvedPath = devicePath;

            resolveProc.stream((data) => {
                const trimmed = data.trim();
                if (trimmed && trimmed.startsWith('/')) {
                    resolvedPath = trimmed;
                }
            });

            resolveProc.done(() => {
                runSmartctl();
            });

            resolveProc.fail(() => {
                runSmartctl();
            });

            function runSmartctl() {
                // If no path provided, try to find it
                if (!smartctlPath) {
                    // Fallback: try common locations (prioritize direct path checks)
                    const checkProc = cockpit.spawn(['sh', '-c', 'for path in /usr/sbin/smartctl /sbin/smartctl /usr/bin/smartctl; do if test -x "$path"; then echo "$path"; exit 0; fi; done; command -v smartctl 2>/dev/null || which smartctl 2>/dev/null || exit 1'], { err: 'message' });
                    let checkOutput = '';

                    checkProc.stream((data) => {
                        checkOutput += data;
                    });

                    checkProc.done((checkExitCode) => {
                        const path = checkOutput.trim().split('\n')[0]; // Take first line only
                        if (!path || path === 'exit') {
                            resolve(null);
                            return;
                        }
                        smartctlPath = path;
                        proceedWithSmartInfo();
                    });

                    checkProc.fail(() => {
                        resolve(null);
                    });
                    return;
                }

                proceedWithSmartInfo();
            }

            function proceedWithSmartInfo() {
                // Try to run smartctl directly - if it fails, we'll catch it
                // Check both original and resolved path for 'nvme' to be safe
                const isNVMe = devicePath.includes('nvme') || resolvedPath.includes('nvme');

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
                    uncorrectableSectors: null,
                    // Additional fields for detailed view
                    firmware: '',
                    interface: '',
                    transferMode: '',
                    rotationRate: null,
                    physicalBlockSize: '',
                    wwn: '',
                    hostReads: null,
                    hostWrites: null,
                    type: ''
                };

                // For NVMe devices, use different approach
                if (isNVMe) {
                    // Get NVMe SMART info directly - use full path if we found it, otherwise try smartctl
                    // Ensure we only use the first path if multiple were returned
                    const smartctlCmd = (smartctlPath || 'smartctl').split('\n')[0].trim();
                    // For NVMe, smartctl might output to stderr, so merge stderr into stdout
                    // Use superuser: 'try' to gain necessary permissions
                    const nvmeProc = cockpit.spawn([smartctlCmd, '-a', resolvedPath], {
                        err: 'out',
                        superuser: 'try'
                    });
                    let nvmeOutput = '';

                    nvmeProc.stream((data) => {
                        nvmeOutput += data;
                    });

                    nvmeProc.done((nvmeExitCode) => {
                        // For NVMe devices, smartctl may return non-zero exit codes but still produce useful output
                        // Exit code 4 is common for NVMe devices but output is still valid
                        // Check if we have output first, regardless of exit code
                        if (nvmeOutput && nvmeOutput.trim().length > 0) {
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

                            // Parse NVMe capacity - try multiple patterns as NVMe output can vary
                            const capacityMatch = nvmeOutput.match(/Total NVM Capacity:\s*([\d,]+)\s*bytes/i) ||
                                                nvmeOutput.match(/Namespace 1 Size\/Capacity:\s*([\d,]+)\s*\[/i) ||
                                                nvmeOutput.match(/Namespace 1 Size\/Capacity:\s*([\d,]+)/i) ||
                                                nvmeOutput.match(/User Capacity:\s*\[?([\d,]+)\s*bytes\]?/i) ||
                                                nvmeOutput.match(/User Capacity:\s*\[?([\d,]+)\s*\[/i);
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
                                        nvmeOutput.match(/Temperature Sensor \d+:\s*(\d+)\s*C/i) ||
                                        nvmeOutput.match(/Temperature:\s*(\d+)\s*C/i);
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

                        // Parse firmware version
                        const firmwareMatch = nvmeOutput.match(/Firmware Version:\s*(.+)/i);
                        if (firmwareMatch) {
                            smartInfo.firmware = firmwareMatch[1].trim();
                        }

                        // Set type for NVMe
                        smartInfo.type = 'NVMe';

                        // Parse NVMe SMART attributes/log pages from the entire output
                        // NVMe devices don't have traditional SMART attributes, but we can parse log pages
                        const logLines = nvmeOutput.split('\n');
                        let attrId = 200; // Start from 200 to avoid conflicts with standard SMART IDs
                        const seenAttributes = new Set(); // Track which attributes we've already added

                        for (const line of logLines) {
                            // Skip empty lines, headers, and separators
                            if (!line.trim() || line.match(/^[=\-]+$/) || line.match(/^[A-Z\s]+$/) ||
                                line.match(/^===/) || line.match(/^---/) || line.match(/^SMART/)) {
                                continue;
                            }

                            // Parse various NVMe log entries - try multiple patterns
                            const tempMatch = line.match(/Temperature[:\s]+(\d+)/i);
                            const warningMatch = line.match(/Critical Warning[:\s]+(0x[\da-fA-F]+|\d+)/i);
                            const availableMatch = line.match(/Available Spare[:\s]+(\d+)/i);
                            const spareThresholdMatch = line.match(/Available Spare Threshold[:\s]+(\d+)/i);
                            const percentageMatch = line.match(/Percentage Used[:\s]+(\d+)/i);
                            const dataUnitsReadMatch = line.match(/Data Units Read[:\s]+([\d,]+)/i);
                            const dataUnitsWrittenMatch = line.match(/Data Units Written[:\s]+([\d,]+)/i);
                            const hostReadsMatch = line.match(/Host Read Commands[:\s]+([\d,]+)/i);
                            const hostWritesMatch = line.match(/Host Write Commands[:\s]+([\d,]+)/i);
                            const controllerBusyMatch = line.match(/Controller Busy Time[:\s]+([\d,]+)/i);
                            const powerCyclesMatch = line.match(/Power Cycles[:\s]+([\d,]+)/i);
                            const powerOnHoursMatch = line.match(/Power On Hours[:\s]+([\d,]+)/i);
                            const unsafeShutdownsMatch = line.match(/Unsafe Shutdowns[:\s]+([\d,]+)/i);
                            const mediaErrorsMatch = line.match(/Media and Data Integrity Errors[:\s]+([\d,]+)/i);
                            const errorInfoMatch = line.match(/Error Information Log Entries[:\s]+([\d,]+)/i);

                            if (tempMatch && !seenAttributes.has('Temperature')) {
                                seenAttributes.add('Temperature');
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Temperature',
                                    value: parseInt(tempMatch[1]),
                                    worst: parseInt(tempMatch[1]),
                                    threshold: 0,
                                    rawValue: parseInt(tempMatch[1])
                                });
                            }

                            if (warningMatch && !seenAttributes.has('Critical Warning')) {
                                seenAttributes.add('Critical Warning');
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Critical Warning',
                                    value: 0,
                                    worst: 0,
                                    threshold: 0,
                                    rawValue: warningMatch[1]
                                });
                            }

                            if (availableMatch && !seenAttributes.has('Available Spare')) {
                                seenAttributes.add('Available Spare');
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Available Spare',
                                    value: parseInt(availableMatch[1]),
                                    worst: parseInt(availableMatch[1]),
                                    threshold: 0,
                                    rawValue: parseInt(availableMatch[1])
                                });
                            }

                            if (spareThresholdMatch && !seenAttributes.has('Available Spare Threshold')) {
                                seenAttributes.add('Available Spare Threshold');
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Available Spare Threshold',
                                    value: parseInt(spareThresholdMatch[1]),
                                    worst: parseInt(spareThresholdMatch[1]),
                                    threshold: 0,
                                    rawValue: parseInt(spareThresholdMatch[1])
                                });
                            }

                            if (percentageMatch && !seenAttributes.has('Percentage Used')) {
                                seenAttributes.add('Percentage Used');
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Percentage Used',
                                    value: parseInt(percentageMatch[1]),
                                    worst: parseInt(percentageMatch[1]),
                                    threshold: 100,
                                    rawValue: parseInt(percentageMatch[1])
                                });
                            }

                            if (dataUnitsReadMatch && !seenAttributes.has('Data Units Read')) {
                                seenAttributes.add('Data Units Read');
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Data Units Read',
                                    value: 0,
                                    worst: 0,
                                    threshold: 0,
                                    rawValue: parseInt(dataUnitsReadMatch[1].replace(/,/g, ''))
                                });
                            }

                            if (dataUnitsWrittenMatch && !seenAttributes.has('Data Units Written')) {
                                seenAttributes.add('Data Units Written');
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Data Units Written',
                                    value: 0,
                                    worst: 0,
                                    threshold: 0,
                                    rawValue: parseInt(dataUnitsWrittenMatch[1].replace(/,/g, ''))
                                });
                            }

                            if (hostReadsMatch && !seenAttributes.has('Host Read Commands')) {
                                seenAttributes.add('Host Read Commands');
                                smartInfo.hostReads = parseInt(hostReadsMatch[1].replace(/,/g, ''));
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Host Read Commands',
                                    value: 0,
                                    worst: 0,
                                    threshold: 0,
                                    rawValue: parseInt(hostReadsMatch[1].replace(/,/g, ''))
                                });
                            }

                            if (hostWritesMatch && !seenAttributes.has('Host Write Commands')) {
                                seenAttributes.add('Host Write Commands');
                                smartInfo.hostWrites = parseInt(hostWritesMatch[1].replace(/,/g, ''));
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Host Write Commands',
                                    value: 0,
                                    worst: 0,
                                    threshold: 0,
                                    rawValue: parseInt(hostWritesMatch[1].replace(/,/g, ''))
                                });
                            }

                            if (controllerBusyMatch && !seenAttributes.has('Controller Busy Time')) {
                                seenAttributes.add('Controller Busy Time');
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Controller Busy Time',
                                    value: 0,
                                    worst: 0,
                                    threshold: 0,
                                    rawValue: parseInt(controllerBusyMatch[1].replace(/,/g, ''))
                                });
                            }

                            if (powerCyclesMatch && !seenAttributes.has('Power Cycles')) {
                                seenAttributes.add('Power Cycles');
                                if (!smartInfo.powerCycleCount) {
                                    smartInfo.powerCycleCount = parseInt(powerCyclesMatch[1].replace(/,/g, ''));
                                }
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Power Cycles',
                                    value: 0,
                                    worst: 0,
                                    threshold: 0,
                                    rawValue: parseInt(powerCyclesMatch[1].replace(/,/g, ''))
                                });
                            }

                            if (powerOnHoursMatch && !seenAttributes.has('Power On Hours')) {
                                seenAttributes.add('Power On Hours');
                                if (!smartInfo.powerOnHours) {
                                    smartInfo.powerOnHours = parseInt(powerOnHoursMatch[1].replace(/,/g, ''));
                                }
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Power On Hours',
                                    value: 0,
                                    worst: 0,
                                    threshold: 0,
                                    rawValue: parseInt(powerOnHoursMatch[1].replace(/,/g, ''))
                                });
                            }

                            if (unsafeShutdownsMatch && !seenAttributes.has('Unsafe Shutdowns')) {
                                seenAttributes.add('Unsafe Shutdowns');
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Unsafe Shutdowns',
                                    value: 0,
                                    worst: 0,
                                    threshold: 0,
                                    rawValue: parseInt(unsafeShutdownsMatch[1].replace(/,/g, ''))
                                });
                            }

                            if (mediaErrorsMatch && !seenAttributes.has('Media and Data Integrity Errors')) {
                                seenAttributes.add('Media and Data Integrity Errors');
                                if (!smartInfo.reallocatedSectors) {
                                    smartInfo.reallocatedSectors = parseInt(mediaErrorsMatch[1].replace(/,/g, ''));
                                }
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Media and Data Integrity Errors',
                                    value: 0,
                                    worst: 0,
                                    threshold: 0,
                                    rawValue: parseInt(mediaErrorsMatch[1].replace(/,/g, ''))
                                });
                            }

                            if (errorInfoMatch && !seenAttributes.has('Error Information Log Entries')) {
                                seenAttributes.add('Error Information Log Entries');
                                smartInfo.attributes.push({
                                    id: attrId++,
                                    name: 'Error Information Log Entries',
                                    value: 0,
                                    worst: 0,
                                    threshold: 0,
                                    rawValue: parseInt(errorInfoMatch[1].replace(/,/g, ''))
                                });
                            }
                        }

                        resolve(smartInfo);
                        } else {
                            resolve(null);
                        }
                });

                nvmeProc.fail((error) => {
                    // Even if smartctl returns a non-zero exit code, check if we got any output
                    // Exit code 4 is common for NVMe devices but output may still be valid
                    if (nvmeOutput && nvmeOutput.trim().length > 0) {
                        // Try to parse the output we got
                        const modelMatch = nvmeOutput.match(/Model Number:\s*(.+)/i) ||
                                         nvmeOutput.match(/Device Model:\s*(.+)/i);
                        if (modelMatch) {
                            smartInfo.model = modelMatch[1].trim();
                        }

                        const serialMatch = nvmeOutput.match(/Serial Number:\s*(.+)/i);
                        if (serialMatch) {
                            smartInfo.serial = serialMatch[1].trim();
                        }

                        // Parse NVMe capacity - try multiple patterns as NVMe output can vary
                        const capacityMatch = nvmeOutput.match(/Total NVM Capacity:\s*([\d,]+)\s*bytes/i) ||
                                            nvmeOutput.match(/Namespace 1 Size\/Capacity:\s*([\d,]+)\s*\[/i) ||
                                            nvmeOutput.match(/Namespace 1 Size\/Capacity:\s*([\d,]+)/i) ||
                                            nvmeOutput.match(/User Capacity:\s*\[?([\d,]+)\s*bytes\]?/i) ||
                                            nvmeOutput.match(/User Capacity:\s*\[?([\d,]+)\s*\[/i);
                        if (capacityMatch) {
                            const bytes = parseInt(capacityMatch[1].replace(/,/g, ''));
                            smartInfo.capacity = DisksApi.formatBytes(bytes);
                        }

                        if (nvmeOutput.match(/SMART overall-health self-assessment test result:\s*PASSED/i) ||
                            nvmeOutput.match(/Health Status:\s*OK/i)) {
                            smartInfo.health = 'PASSED';
                        } else if (nvmeOutput.match(/SMART overall-health self-assessment test result:\s*FAILED/i) ||
                                  nvmeOutput.match(/Health Status:\s*FAILED/i)) {
                            smartInfo.health = 'FAILED';
                        }

                        const tempMatch = nvmeOutput.match(/Temperature:\s*(\d+)\s*Celsius/i) ||
                                        nvmeOutput.match(/Temperature Sensor \d+:\s*(\d+)\s*C/i) ||
                                        nvmeOutput.match(/Temperature:\s*(\d+)\s*C/i);
                        if (tempMatch) {
                            smartInfo.temperature = parseInt(tempMatch[1]);
                        }

                        const pohMatch = nvmeOutput.match(/Power On Hours:\s*(\d+)/i);
                        if (pohMatch) {
                            smartInfo.powerOnHours = parseInt(pohMatch[1]);
                        }

                        const pcMatch = nvmeOutput.match(/Power Cycles:\s*(\d+)/i);
                        if (pcMatch) {
                            smartInfo.powerCycleCount = parseInt(pcMatch[1]);
                        }

                        const mediaErrorMatch = nvmeOutput.match(/Media and Data Integrity Errors:\s*(\d+)/i);
                        if (mediaErrorMatch) {
                            smartInfo.reallocatedSectors = parseInt(mediaErrorMatch[1]);
                        }

                        // Parse firmware version
                        const firmwareMatch = nvmeOutput.match(/Firmware Version:\s*(.+)/i);
                        if (firmwareMatch) {
                            smartInfo.firmware = firmwareMatch[1].trim();
                        }

                        // Set type for NVMe
                        smartInfo.type = 'NVMe';

                        // Parse NVMe SMART attributes/log pages from the entire output (same as in done callback)
                        const logLines = nvmeOutput.split('\n');
                        let attrId = 200;
                        const seenAttributes = new Set();

                        for (const line of logLines) {
                            if (!line.trim() || line.match(/^[=\-]+$/) || line.match(/^[A-Z\s]+$/) ||
                                line.match(/^===/) || line.match(/^---/) || line.match(/^SMART/)) {
                                continue;
                            }

                            const tempMatch = line.match(/Temperature[:\s]+(\d+)/i);
                            const warningMatch = line.match(/Critical Warning[:\s]+(0x[\da-fA-F]+|\d+)/i);
                            const availableMatch = line.match(/Available Spare[:\s]+(\d+)/i);
                            const spareThresholdMatch = line.match(/Available Spare Threshold[:\s]+(\d+)/i);
                            const percentageMatch = line.match(/Percentage Used[:\s]+(\d+)/i);
                            const dataUnitsReadMatch = line.match(/Data Units Read[:\s]+([\d,]+)/i);
                            const dataUnitsWrittenMatch = line.match(/Data Units Written[:\s]+([\d,]+)/i);
                            const hostReadsMatch = line.match(/Host Read Commands[:\s]+([\d,]+)/i);
                            const hostWritesMatch = line.match(/Host Write Commands[:\s]+([\d,]+)/i);
                            const controllerBusyMatch = line.match(/Controller Busy Time[:\s]+([\d,]+)/i);
                            const powerCyclesMatch = line.match(/Power Cycles[:\s]+([\d,]+)/i);
                            const powerOnHoursMatch = line.match(/Power On Hours[:\s]+([\d,]+)/i);
                            const unsafeShutdownsMatch = line.match(/Unsafe Shutdowns[:\s]+([\d,]+)/i);
                            const mediaErrorsMatch = line.match(/Media and Data Integrity Errors[:\s]+([\d,]+)/i);
                            const errorInfoMatch = line.match(/Error Information Log Entries[:\s]+([\d,]+)/i);

                            if (tempMatch && !seenAttributes.has('Temperature')) {
                                seenAttributes.add('Temperature');
                                smartInfo.attributes.push({ id: attrId++, name: 'Temperature', value: parseInt(tempMatch[1]), worst: parseInt(tempMatch[1]), threshold: 0, rawValue: parseInt(tempMatch[1]) });
                            }
                            if (warningMatch && !seenAttributes.has('Critical Warning')) {
                                seenAttributes.add('Critical Warning');
                                smartInfo.attributes.push({ id: attrId++, name: 'Critical Warning', value: 0, worst: 0, threshold: 0, rawValue: warningMatch[1] });
                            }
                            if (availableMatch && !seenAttributes.has('Available Spare')) {
                                seenAttributes.add('Available Spare');
                                smartInfo.attributes.push({ id: attrId++, name: 'Available Spare', value: parseInt(availableMatch[1]), worst: parseInt(availableMatch[1]), threshold: 0, rawValue: parseInt(availableMatch[1]) });
                            }
                            if (spareThresholdMatch && !seenAttributes.has('Available Spare Threshold')) {
                                seenAttributes.add('Available Spare Threshold');
                                smartInfo.attributes.push({ id: attrId++, name: 'Available Spare Threshold', value: parseInt(spareThresholdMatch[1]), worst: parseInt(spareThresholdMatch[1]), threshold: 0, rawValue: parseInt(spareThresholdMatch[1]) });
                            }
                            if (percentageMatch && !seenAttributes.has('Percentage Used')) {
                                seenAttributes.add('Percentage Used');
                                smartInfo.attributes.push({ id: attrId++, name: 'Percentage Used', value: parseInt(percentageMatch[1]), worst: parseInt(percentageMatch[1]), threshold: 100, rawValue: parseInt(percentageMatch[1]) });
                            }
                            if (dataUnitsReadMatch && !seenAttributes.has('Data Units Read')) {
                                seenAttributes.add('Data Units Read');
                                smartInfo.attributes.push({ id: attrId++, name: 'Data Units Read', value: 0, worst: 0, threshold: 0, rawValue: parseInt(dataUnitsReadMatch[1].replace(/,/g, '')) });
                            }
                            if (dataUnitsWrittenMatch && !seenAttributes.has('Data Units Written')) {
                                seenAttributes.add('Data Units Written');
                                smartInfo.attributes.push({ id: attrId++, name: 'Data Units Written', value: 0, worst: 0, threshold: 0, rawValue: parseInt(dataUnitsWrittenMatch[1].replace(/,/g, '')) });
                            }
                            if (hostReadsMatch && !seenAttributes.has('Host Read Commands')) {
                                seenAttributes.add('Host Read Commands');
                                smartInfo.hostReads = parseInt(hostReadsMatch[1].replace(/,/g, ''));
                                smartInfo.attributes.push({ id: attrId++, name: 'Host Read Commands', value: 0, worst: 0, threshold: 0, rawValue: parseInt(hostReadsMatch[1].replace(/,/g, '')) });
                            }
                            if (hostWritesMatch && !seenAttributes.has('Host Write Commands')) {
                                seenAttributes.add('Host Write Commands');
                                smartInfo.hostWrites = parseInt(hostWritesMatch[1].replace(/,/g, ''));
                                smartInfo.attributes.push({ id: attrId++, name: 'Host Write Commands', value: 0, worst: 0, threshold: 0, rawValue: parseInt(hostWritesMatch[1].replace(/,/g, '')) });
                            }
                            if (controllerBusyMatch && !seenAttributes.has('Controller Busy Time')) {
                                seenAttributes.add('Controller Busy Time');
                                smartInfo.attributes.push({ id: attrId++, name: 'Controller Busy Time', value: 0, worst: 0, threshold: 0, rawValue: parseInt(controllerBusyMatch[1].replace(/,/g, '')) });
                            }
                            if (powerCyclesMatch && !seenAttributes.has('Power Cycles')) {
                                seenAttributes.add('Power Cycles');
                                if (!smartInfo.powerCycleCount) smartInfo.powerCycleCount = parseInt(powerCyclesMatch[1].replace(/,/g, ''));
                                smartInfo.attributes.push({ id: attrId++, name: 'Power Cycles', value: 0, worst: 0, threshold: 0, rawValue: parseInt(powerCyclesMatch[1].replace(/,/g, '')) });
                            }
                            if (powerOnHoursMatch && !seenAttributes.has('Power On Hours')) {
                                seenAttributes.add('Power On Hours');
                                if (!smartInfo.powerOnHours) smartInfo.powerOnHours = parseInt(powerOnHoursMatch[1].replace(/,/g, ''));
                                smartInfo.attributes.push({ id: attrId++, name: 'Power On Hours', value: 0, worst: 0, threshold: 0, rawValue: parseInt(powerOnHoursMatch[1].replace(/,/g, '')) });
                            }
                            if (unsafeShutdownsMatch && !seenAttributes.has('Unsafe Shutdowns')) {
                                seenAttributes.add('Unsafe Shutdowns');
                                smartInfo.attributes.push({ id: attrId++, name: 'Unsafe Shutdowns', value: 0, worst: 0, threshold: 0, rawValue: parseInt(unsafeShutdownsMatch[1].replace(/,/g, '')) });
                            }
                            if (mediaErrorsMatch && !seenAttributes.has('Media and Data Integrity Errors')) {
                                seenAttributes.add('Media and Data Integrity Errors');
                                if (!smartInfo.reallocatedSectors) smartInfo.reallocatedSectors = parseInt(mediaErrorsMatch[1].replace(/,/g, ''));
                                smartInfo.attributes.push({ id: attrId++, name: 'Media and Data Integrity Errors', value: 0, worst: 0, threshold: 0, rawValue: parseInt(mediaErrorsMatch[1].replace(/,/g, '')) });
                            }
                            if (errorInfoMatch && !seenAttributes.has('Error Information Log Entries')) {
                                seenAttributes.add('Error Information Log Entries');
                                smartInfo.attributes.push({ id: attrId++, name: 'Error Information Log Entries', value: 0, worst: 0, threshold: 0, rawValue: parseInt(errorInfoMatch[1].replace(/,/g, '')) });
                            }
                        }

                        // If we parsed at least the model, consider it successful
                        if (smartInfo.model || smartInfo.serial || smartInfo.capacity) {
                            resolve(smartInfo);
                            return;
                        }
                    }
                    resolve(null);
                });
            } else {
                // Traditional SATA/SAS device handling
                // Get SMART health status - use full path if we found it
                // Ensure we only use the first path if multiple were returned
                const smartctlCmd = (smartctlPath || 'smartctl').split('\n')[0].trim();
                const healthProc = cockpit.spawn([smartctlCmd, '-H', devicePath], { err: 'message' });
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
                    const attrsProc = cockpit.spawn([smartctlCmd, '-A', devicePath], { err: 'message' });
                    let attrsOutput = '';

                    attrsProc.stream((data) => {
                        attrsOutput += data;
                    });

                    attrsProc.done(async (attrsExitCode) => {
                        // Parse model and serial from info section
                        const infoProc = cockpit.spawn([smartctlCmd, '-i', devicePath], { err: 'message' });
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

                            // Parse firmware
                            const firmwareMatch = infoOutput.match(/Firmware Version:\s*(.+)/i);
                            if (firmwareMatch) {
                                smartInfo.firmware = firmwareMatch[1].trim();
                            }

                            // Parse interface (SATA, SAS, etc.)
                            const interfaceMatch = infoOutput.match(/SATA Version is:\s*(.+)/i) ||
                                                  infoOutput.match(/Transport protocol:\s*(.+)/i);
                            if (interfaceMatch) {
                                smartInfo.interface = interfaceMatch[1].trim();
                            } else if (infoOutput.match(/SATA/i)) {
                                smartInfo.interface = 'SATA';
                            } else if (infoOutput.match(/SAS/i)) {
                                smartInfo.interface = 'SAS';
                            }

                            // Parse transfer mode
                            const transferMatch = infoOutput.match(/SATA Version is:\s*.*?(\d+\.\d+\s*Gb\/s)/i) ||
                                                   infoOutput.match(/SATA Version is:\s*.*?(\d+\.\d+\s*Gbps)/i);
                            if (transferMatch) {
                                smartInfo.transferMode = transferMatch[1].trim();
                            }

                            // Parse rotation rate
                            const rotationMatch = infoOutput.match(/Rotation Rate:\s*(\d+)\s*rpm/i) ||
                                                 infoOutput.match(/Rotation Rate:\s*Solid State Device/i);
                            if (rotationMatch) {
                                if (rotationMatch[1]) {
                                    smartInfo.rotationRate = parseInt(rotationMatch[1]);
                                } else {
                                    smartInfo.rotationRate = 0; // SSD
                                    smartInfo.type = 'SSD';
                                }
                            }

                            // Parse physical block size
                            const blockSizeMatch = infoOutput.match(/Sector Sizes?:\s*(\d+)\s*bytes/i) ||
                                                  infoOutput.match(/Logical block size:\s*(\d+)\s*bytes/i);
                            if (blockSizeMatch) {
                                smartInfo.physicalBlockSize = blockSizeMatch[1] + ' bytes';
                            }

                            // Parse WWN
                            const wwnMatch = infoOutput.match(/WWN:\s*(.+)/i) ||
                                           infoOutput.match(/World Wide Name:\s*(.+)/i);
                            if (wwnMatch) {
                                smartInfo.wwn = wwnMatch[1].trim();
                            }

                            // Set type if not already set
                            if (!smartInfo.type) {
                                smartInfo.type = smartInfo.rotationRate === 0 ? 'SSD' : 'HDD';
                            }

                            // Parse SMART attributes
                            const lines = attrsOutput.split('\n');
                            for (const line of lines) {
                                // Parse attribute lines (ID# ATTRIBUTE_NAME FLAG VALUE WORST THRESH TYPE UPDATED WHEN_FAILED RAW_VALUE)
                                // Format: ID# ATTRIBUTE_NAME FLAG VALUE WORST THRESH TYPE UPDATED WHEN_FAILED RAW_VALUE
                                // Example: "  5 Reallocated_Sector_Ct   0x0033   100   100   010    Pre-fail  Always       -       0"
                                // Try multiple patterns to match different smartctl output formats
                                const attrMatch = line.match(/^\s*(\d+)\s+([A-Za-z0-9_][A-Za-z0-9_\s]+?)\s+\w+\s+(\d+)\s+(\d+)\s+(\d+)/) ||
                                                line.match(/^\s*(\d+)\s+([A-Za-z0-9_][A-Za-z0-9_\s]+?)\s+0x[\da-fA-F]+\s+(\d+)\s+(\d+)\s+(\d+)/);
                                if (attrMatch) {
                                    const id = parseInt(attrMatch[1]);
                                    const name = attrMatch[2].trim();
                                    const value = parseInt(attrMatch[3]);
                                    const worst = parseInt(attrMatch[4]);
                                    const threshold = parseInt(attrMatch[5]);

                                    // Extract RAW_VALUE (last numeric field, can be very large)
                                    // Try to match the last number in the line, handling large numbers
                                    const rawMatch = line.match(/\s+(\d+)\s*$/);
                                    // If that doesn't work, try matching any large number at the end
                                    const rawMatchAlt = line.match(/\s+(\d{1,20})\s*$/);
                                    let rawValue = null;
                                    if (rawMatch) {
                                        rawValue = parseInt(rawMatch[1]);
                                    } else if (rawMatchAlt) {
                                        rawValue = parseInt(rawMatchAlt[1]);
                                    }

                                    // If still no match, try to extract from the last field after splitting
                                    if (rawValue === null) {
                                        const parts = line.trim().split(/\s+/);
                                        if (parts.length >= 10) {
                                            // RAW_VALUE is typically the last field
                                            const lastPart = parts[parts.length - 1];
                                            if (lastPart && lastPart.match(/^\d+$/)) {
                                                rawValue = parseInt(lastPart);
                                            }
                                        }
                                    }

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
        }
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
