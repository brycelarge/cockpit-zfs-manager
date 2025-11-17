const cockpit = window.cockpit;

export class ZfsApi {
    static async listPools() {
        return new Promise((resolve, reject) => {
            const pools = [];
            const proc = cockpit.spawn(['zpool', 'list', '-H', '-o', 'name,size,allocated,free,fragmentation,health'], {
                err: 'message'
            });

            proc.stream((data) => {
                const lines = data.trim().split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        const [name, size, allocated, free, fragmentation, health] = line.split('\t');
                        pools.push({
                            name,
                            size,
                            allocated,
                            free,
                            fragmentation,
                            health
                        });
                    }
                });
            });

            proc.done((exitCode, data) => {
                // Exit code 0 means success
                // Exit code 1 typically means no pools found, which is fine - return empty array
                // null/undefined/empty exit code means process completed (treat as success)
                // If we have pool data, always resolve successfully regardless of exit code
                if (pools.length > 0 || exitCode === 0 || exitCode === 1 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    resolve(pools);
                } else {
                    // For other exit codes, check if there's an error message
                    const errorMsg = data || `zpool list exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async listAvailableDisks() {
        return new Promise((resolve, reject) => {
            const disks = [];
            
            // Use the same approach that worked in the old code
            // Use lsblk with awk to parse and format output properly
            const proc = cockpit.spawn(['sh', '-c', 'lsblk -nd -o NAME,TYPE,SIZE,MODEL -e 7,11 2>/dev/null | awk \'$2=="disk" && $1!~/^loop/ && $1!~/^ram/ {path="/dev/"$1; size=$3; model=""; for(i=4;i<=NF;i++) model=model" "$i; gsub(/^ /,"",model); if(model=="") model=$1; print path"|"model"|"size}\''], {
                err: 'message'
            });
            
            proc.stream((data) => {
                const lines = data.split('\n');
                lines.forEach(line => {
                    const parts = line.trim().split('|');
                    if (parts.length >= 3 && parts[0].startsWith('/dev/')) {
                        disks.push({
                            name: parts[1] || parts[0].replace('/dev/', ''),
                            path: parts[0],
                            type: 'disk',
                            size: parts[2] || 'Unknown',
                            model: parts[1] || parts[0].replace('/dev/', '')
                        });
                    }
                });
            });
            
            proc.done((exitCode) => {
                disks.sort((a, b) => a.path.localeCompare(b.path));
                if (exitCode === 0) {
                    resolve(disks);
                } else {
                    // Even if exit code is non-zero, return what we got
                    resolve(disks);
                }
            });
            
            proc.fail((error) => {
                // If lsblk fails completely, return empty array instead of rejecting
                console.warn('lsblk failed:', error);
                resolve([]);
            });
        });
    }

    static async renamePool(oldName, newName) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zpool', 'rename', oldName, newName]);

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zpool rename exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async destroyPool(poolName, force = false) {
        return new Promise((resolve, reject) => {
            const args = ['zpool', 'destroy'];
            if (force) {
                args.push('-f');
            }
            args.push(poolName);

            const proc = cockpit.spawn(args);

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zpool destroy exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async importPool(poolName = null, force = false) {
        return new Promise((resolve, reject) => {
            const args = ['zpool', 'import'];
            if (force) {
                args.push('-f');
            }
            if (poolName) {
                args.push(poolName);
            }

            const proc = cockpit.spawn(args);

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zpool import exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async exportPool(poolName, force = false) {
        return new Promise((resolve, reject) => {
            const args = ['zpool', 'export'];
            if (force) {
                args.push('-f');
            }
            args.push(poolName);
            const proc = cockpit.spawn(args);

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zpool export exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async createPool(name, devices, vdevType, force = false) {
        return new Promise((resolve, reject) => {
            const args = ['zpool', 'create'];
            
            // Add force flag if requested
            if (force) {
                args.push('-f');
            }
            
            args.push(name);
            
            // Add vdev type if not stripe
            if (vdevType !== 'stripe') {
                args.push(vdevType);
            }
            
            // Add devices
            args.push(...devices);

            const proc = cockpit.spawn(args, {
                err: 'message'
            });
            
            let errorOutput = '';
            proc.stream((data) => {
                errorOutput += data;
            });

            proc.done((exitCode, data) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    // Prefer errorOutput (stderr) over data (stdout)
                    const errorMsg = errorOutput.trim() || data || `zpool create exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                // Cockpit error objects have a message property
                // Handle both Error objects and plain cockpit error objects
                let errorMsg = 'Failed to create pool';
                if (error instanceof Error) {
                    errorMsg = error.message;
                } else if (error && typeof error === 'object') {
                    errorMsg = error.message || error.toString() || String(error);
                } else {
                    errorMsg = String(error);
                }
                reject(new Error(errorMsg));
            });
        });
    }

    static async listFileSystems(poolName) {
        return new Promise((resolve, reject) => {
            const filesystems = [];
            const proc = cockpit.spawn(['zfs', 'list', '-H', '-o', 'name,used,available,referenced,mountpoint,encryption,quota,reservation', '-t', 'filesystem', '-r', poolName]);

            proc.stream((data) => {
                const lines = data.trim().split('\n');
                lines.forEach(line => {
                    if (line.trim() && !line.startsWith(poolName + '\t')) {
                        const [name, used, available, referenced, mountpoint, encryption, quota, reservation] = line.split('\t');
                        filesystems.push({
                            name,
                            used,
                            available,
                            referenced,
                            mountpoint,
                            encrypted: encryption && encryption !== '-',
                            quota: quota && quota !== '-' ? quota : null,
                            reservation: reservation && reservation !== '-' ? reservation : null
                        });
                    }
                });
            });

            proc.done((exitCode) => {
                // Exit code 0 means success
                // Exit code 1 typically means no filesystems found, which is fine - return empty array
                // null/undefined/empty exit code means process completed (treat as success)
                // If we have filesystem data, always resolve successfully regardless of exit code
                if (filesystems.length > 0 || exitCode === 0 || exitCode === 1 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    resolve(filesystems);
                } else {
                    reject(new Error(`zfs list exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async createFileSystem(name, encrypted = false, passphrase = null) {
        return new Promise((resolve, reject) => {
            const args = ['zfs', 'create'];
            if (encrypted) {
                args.push('-o', 'encryption=aes-256-gcm', '-o', 'keyformat=passphrase', '-o', 'keylocation=prompt');
            }
            args.push(name);

            const proc = cockpit.spawn(args);
            
            // If encrypted, send passphrase via stdin
            if (encrypted && passphrase) {
                proc.input(passphrase + '\n');
            }

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zfs create exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async destroyFileSystem(fsName, force = false) {
        return new Promise((resolve, reject) => {
            const args = ['zfs', 'destroy'];
            if (force) {
                args.push('-r');
            }
            args.push(fsName);

            const proc = cockpit.spawn(args);

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zfs destroy exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async cloneFileSystem(source, target) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zfs', 'clone', source, target]);

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zfs clone exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async listSnapshots(poolName) {
        return new Promise((resolve, reject) => {
            const snapshots = [];
            const proc = cockpit.spawn(['zfs', 'list', '-H', '-o', 'name,used,referenced,creation', '-t', 'snapshot', '-r', poolName]);

            proc.stream((data) => {
                const lines = data.trim().split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        const [name, used, referenced, creation] = line.split('\t');
                        snapshots.push({
                            name,
                            used,
                            referenced,
                            creation
                        });
                    }
                });
            });

            proc.done((exitCode) => {
                // Exit code 0 means success
                // Exit code 1 typically means no snapshots found, which is fine - return empty array
                // null/undefined/empty exit code means process completed (treat as success)
                // If we have snapshot data, always resolve successfully regardless of exit code
                if (snapshots.length > 0 || exitCode === 0 || exitCode === 1 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    resolve(snapshots);
                } else {
                    reject(new Error(`zfs list snapshots exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async createSnapshot(name) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zfs', 'snapshot', name]);

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zfs snapshot exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async destroySnapshot(snapName, force = false) {
        return new Promise((resolve, reject) => {
            const args = ['zfs', 'destroy'];
            if (force) {
                args.push('-f');
            }
            args.push(snapName);
            const proc = cockpit.spawn(args);

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zfs destroy snapshot exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async cloneSnapshot(source, target) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zfs', 'clone', source, target]);

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zfs clone snapshot exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async rollbackSnapshot(snapName, recursive = false, force = false) {
        return new Promise((resolve, reject) => {
            const args = ['zfs', 'rollback'];
            if (recursive) {
                args.push('-r');
            }
            if (force) {
                args.push('-f');
            }
            args.push(snapName);

            const proc = cockpit.spawn(args);

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zfs rollback exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async unlockFileSystems(poolName, passphrase) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zfs', 'load-key', '-a'], {
                err: 'message'
            });

            proc.input(passphrase + '\n');

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zfs load-key exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    // Dataset Properties Management
    static async getDatasetProperties(datasetName) {
        return new Promise((resolve, reject) => {
            const properties = {};
            const proc = cockpit.spawn(['zfs', 'get', '-H', '-p', 'all', datasetName], {
                err: 'message'
            });

            proc.stream((data) => {
                const lines = data.trim().split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        const [name, property, value, source] = line.split('\t');
                        if (name === datasetName) {
                            properties[property] = {
                                value: value,
                                source: source
                            };
                        }
                    }
                });
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve(properties);
                } else {
                    reject(new Error(`zfs get exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async setDatasetProperty(datasetName, property, value) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zfs', 'set', `${property}=${value}`, datasetName], {
                err: 'message'
            });

            proc.done((exitCode, data) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    const errorMsg = data || `zfs set exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    // Pool Properties Management
    static async getPoolProperties(poolName) {
        return new Promise((resolve, reject) => {
            const properties = {};
            const proc = cockpit.spawn(['zpool', 'get', '-H', 'all', poolName], {
                err: 'message'
            });

            proc.stream((data) => {
                const lines = data.trim().split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        const [name, property, value, source] = line.split('\t');
                        if (name === poolName) {
                            properties[property] = {
                                value: value,
                                source: source
                            };
                        }
                    }
                });
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve(properties);
                } else {
                    reject(new Error(`zpool get exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async setPoolProperty(poolName, property, value) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zpool', 'set', `${property}=${value}`, poolName], {
                err: 'message'
            });

            proc.done((exitCode, data) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    const errorMsg = data || `zpool set exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    // Pool Expansion
    static async addVdevToPool(poolName, vdevType, devices, force = false) {
        return new Promise((resolve, reject) => {
            const args = ['zpool', 'add'];
            
            // Add force flag if requested
            if (force) {
                args.push('-f');
            }
            
            args.push(poolName);
            
            // Add vdev type if not stripe
            if (vdevType !== 'stripe') {
                args.push(vdevType);
            }
            
            // Add devices
            args.push(...devices);

            const proc = cockpit.spawn(args, {
                err: 'message'
            });

            proc.done((exitCode, data) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    const errorMsg = data || `zpool add exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    // Disk Replacement
    static async getPoolDevices(poolName) {
        return new Promise((resolve, reject) => {
            const devices = [];
            const proc = cockpit.spawn(['zpool', 'status', poolName], {
                err: 'message'
            });
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                // If we have output data, always resolve successfully regardless of exit code
                if (output.trim().length > 0 || exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    const lines = output.split('\n');
                    let inDeviceTable = false;

                    for (const line of lines) {
                        const trimmed = line.trim();
                        
                        // Device table starts with "NAME" header
                        if (trimmed.startsWith('NAME') || trimmed.match(/^\s+NAME\s+STATE\s+READ\s+WRITE\s+CHECKSUM/)) {
                            inDeviceTable = true;
                            continue;
                        }
                        
                        // Parse device rows
                        if (inDeviceTable && trimmed && !trimmed.startsWith('pool:') && !trimmed.startsWith('state:')) {
                            // Skip separator lines
                            if (trimmed.match(/^-+$/)) continue;
                            
                            const parts = trimmed.split(/\s+/);
                            if (parts.length >= 2) {
                                const deviceName = parts[0];
                                const state = parts[1];
                                
                                // Skip the pool name itself (first row)
                                if (deviceName !== poolName && deviceName.startsWith('/dev/')) {
                                    devices.push({
                                        name: deviceName,
                                        state: state,
                                        read: parts[2] || '0',
                                        write: parts[3] || '0',
                                        checksum: parts[4] || '0',
                                        message: parts.slice(5, -1).join(' ') || '',
                                        product: parts[parts.length - 1] || ''
                                    });
                                }
                            }
                        }
                    }

                    resolve(devices);
                } else {
                    reject(new Error(`zpool status exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async replaceDisk(poolName, oldDevice, newDevice, force = false) {
        return new Promise((resolve, reject) => {
            const args = ['zpool', 'replace'];
            if (force) {
                args.push('-f');
            }
            args.push(poolName, oldDevice, newDevice);
            const proc = cockpit.spawn(args, {
                err: 'message'
            });

            proc.done((exitCode, data) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    const errorMsg = data || `zpool replace exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    // Replication (ZFS Send/Receive)
    static async sendSnapshot(snapshotName, destination, options = {}) {
        return new Promise((resolve, reject) => {
            const args = ['zfs', 'send'];
            
            if (options.recursive) {
                args.push('-R');
            }
            if (options.incremental && options.fromSnapshot) {
                args.push('-i', options.fromSnapshot);
            }
            if (options.properties) {
                args.push('-p');
            }
            if (options.replication) {
                args.push('-R');
            }
            
            args.push(snapshotName);
            
            // If destination is a file path, redirect output
            // If it's a remote system, use ssh
            let proc;
            if (destination.startsWith('ssh://') || destination.includes('@')) {
                // Remote destination via SSH
                const [userHost, remotePath] = destination.replace('ssh://', '').split(':');
                const [user, host] = userHost.split('@');
                const sshArgs = ['ssh', user ? `${user}@${host}` : host, `zfs receive ${remotePath}`];
                proc = cockpit.spawn(['sh', '-c', `${args.join(' ')} | ${sshArgs.join(' ')}`], {
                    err: 'message'
                });
            } else {
                // Local file destination
                proc = cockpit.spawn(['sh', '-c', `${args.join(' ')} > ${destination}`], {
                    err: 'message'
                });
            }

            proc.done((exitCode, data) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    const errorMsg = data || `zfs send exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async receiveSnapshot(poolName, source, options = {}) {
        return new Promise((resolve, reject) => {
            const args = ['zfs', 'receive'];
            
            if (options.force) {
                args.push('-F');
            }
            if (options.dryRun) {
                args.push('-n');
            }
            if (options.verbose) {
                args.push('-v');
            }
            
            args.push(poolName);
            
            let proc;
            if (source.startsWith('ssh://') || source.includes('@')) {
                // Remote source via SSH
                const [userHost, remoteSnapshot] = source.replace('ssh://', '').split(':');
                const [user, host] = userHost.split('@');
                const sshCmd = `ssh ${user ? `${user}@${host}` : host} "zfs send ${remoteSnapshot}"`;
                proc = cockpit.spawn(['sh', '-c', `${sshCmd} | ${args.join(' ')}`], {
                    err: 'message'
                });
            } else {
                // Local file source
                proc = cockpit.spawn(['sh', '-c', `cat ${source} | ${args.join(' ')}`], {
                    err: 'message'
                });
            }

            proc.done((exitCode, data) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    const errorMsg = data || `zfs receive exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    // Mount Point Management
    static async mountDataset(datasetName, options = {}) {
        return new Promise((resolve, reject) => {
            const args = ['zfs', 'mount'];
            
            if (options.overlay) {
                args.push('-O');
            }
            if (options.options) {
                args.push('-o', options.options);
            }
            
            args.push(datasetName);

            const proc = cockpit.spawn(args, {
                err: 'message'
            });

            proc.done((exitCode, data) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    const errorMsg = data || `zfs mount exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async unmountDataset(datasetName, options = {}) {
        return new Promise((resolve, reject) => {
            const args = ['zfs', 'unmount'];
            
            if (options.force) {
                args.push('-f');
            }
            
            args.push(datasetName);

            const proc = cockpit.spawn(args, {
                err: 'message'
            });

            proc.done((exitCode, data) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    const errorMsg = data || `zfs unmount exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async getMountStatus(datasetName) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zfs', 'get', '-H', '-o', 'value', 'mounted', datasetName], {
                err: 'message'
            });
            let output = '';

            proc.stream((data) => {
                output += data.trim();
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve(output === 'yes');
                } else {
                    reject(new Error(`zfs get mounted exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    // Performance Statistics
    static async getIOStats(poolName, interval = 1) {
        return new Promise((resolve, reject) => {
            const stats = {
                read: { ops: 0, bytes: 0 },
                write: { ops: 0, bytes: 0 },
                total: { ops: 0, bytes: 0 }
            };
            
            const proc = cockpit.spawn(['zpool', 'iostat', '-v', poolName, '1', '2'], {
                err: 'message'
            });
            let output = '';
            let lineCount = 0;

            proc.stream((data) => {
                output += data;
                const lines = output.split('\n');
                // Parse second set of stats (skip header)
                if (lines.length > 10) {
                    // Parse pool stats line
                    const poolLine = lines.find(line => line.trim().startsWith(poolName));
                    if (poolLine) {
                        const parts = poolLine.trim().split(/\s+/);
                        if (parts.length >= 5) {
                            stats.read.ops = parseInt(parts[1]) || 0;
                            stats.read.bytes = parts[2] || '0';
                            stats.write.ops = parseInt(parts[3]) || 0;
                            stats.write.bytes = parts[4] || '0';
                            stats.total.ops = stats.read.ops + stats.write.ops;
                        }
                    }
                }
            });

            proc.done((exitCode) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                // If we have stats data, always resolve successfully regardless of exit code
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined || stats.total.ops > 0 || stats.read.ops > 0 || stats.write.ops > 0) {
                    resolve(stats);
                } else {
                    reject(new Error(`zpool iostat exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async getPoolStats(poolName) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zpool', 'iostat', '-v', poolName], {
                err: 'message'
            });
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve(output);
                } else {
                    reject(new Error(`zpool iostat exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    // Share Management
    static async configureNFSShare(datasetName, options = {}) {
        return new Promise((resolve, reject) => {
            // ZFS uses sharenfs property for NFS
            let sharenfsValue = 'on';
            if (options.ro) {
                sharenfsValue = 'ro';
            }
            if (options.rw) {
                sharenfsValue = 'rw';
            }
            if (options.network) {
                sharenfsValue = `${sharenfsValue}=${options.network}`;
            }
            if (options.options) {
                sharenfsValue = options.options;
            }

            const proc = cockpit.spawn(['zfs', 'set', `sharenfs=${sharenfsValue}`, datasetName], {
                err: 'message'
            });

            proc.done((exitCode, data) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    const errorMsg = data || `zfs set sharenfs exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async configureSMBShare(datasetName, options = {}) {
        return new Promise((resolve, reject) => {
            // ZFS uses sharesmb property for SMB
            let sharesmbValue = 'on';
            if (options.name) {
                sharesmbValue = `name=${options.name}`;
            }
            if (options.options) {
                sharesmbValue = options.options;
            }

            const proc = cockpit.spawn(['zfs', 'set', `sharesmb=${sharesmbValue}`, datasetName], {
                err: 'message'
            });

            proc.done((exitCode, data) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    const errorMsg = data || `zfs set sharesmb exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async listShares(datasetName) {
        return new Promise((resolve, reject) => {
            const shares = {
                nfs: null,
                smb: null
            };

            // Get sharenfs property
            const nfsProc = cockpit.spawn(['zfs', 'get', '-H', '-o', 'value', 'sharenfs', datasetName], {
                err: 'message'
            });
            let nfsOutput = '';

            nfsProc.stream((data) => {
                nfsOutput += data.trim();
            });

            nfsProc.done((exitCode) => {
                if (exitCode === 0 && nfsOutput && nfsOutput !== 'off') {
                    shares.nfs = nfsOutput;
                }

                // Get sharesmb property
                const smbProc = cockpit.spawn(['zfs', 'get', '-H', '-o', 'value', 'sharesmb', datasetName], {
                    err: 'message'
                });
                let smbOutput = '';

                smbProc.stream((data) => {
                    smbOutput += data.trim();
                });

                smbProc.done((smbExitCode) => {
                    if (smbExitCode === 0 && smbOutput && smbOutput !== 'off') {
                        shares.smb = smbOutput;
                    }
                    resolve(shares);
                });

                smbProc.fail((error) => {
                    resolve(shares); // Return what we have
                });
            });

            nfsProc.fail((error) => {
                // Try to get SMB anyway
                const smbProc = cockpit.spawn(['zfs', 'get', '-H', '-o', 'value', 'sharesmb', datasetName], {
                    err: 'message'
                });
                let smbOutput = '';

                smbProc.stream((data) => {
                    smbOutput += data.trim();
                });

                smbProc.done(() => {
                    if (smbOutput && smbOutput !== 'off') {
                        shares.smb = smbOutput;
                    }
                    resolve(shares);
                });

                smbProc.fail(() => {
                    resolve(shares);
                });
            });
        });
    }
}

