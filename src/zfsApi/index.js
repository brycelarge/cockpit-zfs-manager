import { formatBytes } from '../utils/size.js';

const cockpit = window.cockpit;

export class ZfsApi {
    static async listPools() {
        return new Promise(async (resolve, reject) => {
            const pools = [];
            const proc = cockpit.spawn(['zpool', 'list', '-Hp', '-o', 'name,size,allocated,free,frag,cap,health'], {
                err: 'message'
            });

            proc.stream((data) => {
                const lines = data.trim().split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        const [name, sizeRaw, allocatedRaw, freeRaw, fragmentationRaw, capacityRaw, health] = line.split('\t');

                        const sizeBytes = Number(sizeRaw) || 0;
                        const allocatedBytes = Number(allocatedRaw) || 0;
                        const freeBytes = Number(freeRaw) || 0;
                        const fragmentationPercent = fragmentationRaw !== undefined && fragmentationRaw !== '' ? Number(fragmentationRaw) : null;
                        const capacityPercent = capacityRaw !== undefined && capacityRaw !== '' ? Number(capacityRaw) : null;

                        pools.push({
                            name,
                            size: formatBytes(sizeBytes),
                            sizeBytes,
                            allocated: formatBytes(allocatedBytes),
                            allocatedBytes,
                            free: formatBytes(freeBytes),
                            freeBytes,
                            fragmentation: fragmentationPercent !== null && !Number.isNaN(fragmentationPercent) ? `${fragmentationPercent}%` : '-',
                            fragmentationPercent,
                            capacity: capacityPercent !== null && !Number.isNaN(capacityPercent) ? `${capacityPercent}%` : '-',
                            capacityPercent,
                            health: health || 'UNKNOWN'
                        });
                    }
                });
            });

            proc.done(async (exitCode, data) => {
                // Exit code 0 means success
                // Exit code 1 typically means no pools found, which is fine - return empty array
                // null/undefined/empty exit code means process completed (treat as success)
                // If we have pool data, always resolve successfully regardless of exit code
                if (pools.length > 0 || exitCode === 0 || exitCode === 1 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    // Get vdev type for each pool
                    let ashiftMap = {};
                    try {
                        ashiftMap = await this.getAllPoolsAshift();
                    } catch (e) {
                        console.warn("Failed to fetch ashift map", e);
                    }

                    for (const pool of pools) {
                        try {
                            pool.vdevType = await this.getPoolVdevType(pool.name);
                        } catch {
                            pool.vdevType = 'stripe'; // Default to stripe if detection fails
                        }

                        pool.ashift = ashiftMap[pool.name] || '-';
                    }
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

    static async getAllPoolsAshift() {
        return new Promise((resolve, reject) => {
            const ashiftMap = {};
            const proc = cockpit.spawn(['zpool', 'get', '-Hp', '-o', 'name,value', 'ashift'], {
                err: 'message'
            });

            proc.stream((data) => {
                const lines = data.trim().split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        const parts = line.split('\t');
                        if (parts.length >= 2) {
                            const name = parts[0];
                            const value = parts[1];
                            ashiftMap[name] = value;
                        }
                    }
                });
            });

            proc.done((exitCode) => {
                 resolve(ashiftMap);
            });

            proc.fail(() => resolve({})); // resolve empty on fail
        });
    }

    static async listAvailableDisks() {
        return new Promise((resolve, reject) => {
            const disks = [];

            // Use the same approach that worked in the old code
            // Use lsblk with awk to parse and format output properly
            // Added PHY-SEC to get physical sector size for ashift calculation
            const proc = cockpit.spawn(['sh', '-c', 'lsblk -nd -o NAME,TYPE,SIZE,PHY-SEC,MODEL -e 7,11 2>/dev/null | awk \'$2=="disk" && $1!~/^loop/ && $1!~/^ram/ {path="/dev/"$1; size=$3; phy_sec=$4; model=""; for(i=5;i<=NF;i++) model=model" "$i; gsub(/^ /,"",model); if(model=="") model=$1; print path"|"model"|"size"|"phy_sec}\''], {
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
                            phySec: parseInt(parts[3], 10) || 512,
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
            const proc = cockpit.spawn(['zpool', 'rename', oldName, newName], {
                err: 'message'
            });

            let errorOutput = '';
            proc.stream((data) => {
                errorOutput += data;
            });

            proc.done((exitCode, data) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    resolve();
                } else {
                    const errorMsg = errorOutput.trim() || data || `zpool rename exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async renameDataset(oldName, newName) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zfs', 'rename', oldName, newName], {
                err: 'message'
            });

            let errorOutput = '';
            proc.stream((data) => {
                errorOutput += data;
            });

            proc.done((exitCode, data) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    resolve();
                } else {
                    const errorMsg = errorOutput.trim() || data || `zfs rename exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async getPoolVersion(poolName) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zpool', 'get', '-H', '-o', 'value', 'version', poolName], {
                err: 'message'
            });

            let output = '';
            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode, data) => {
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    const version = output.trim();
                    resolve(version ? parseInt(version, 10) : null);
                } else {
                    const errorMsg = output.trim() || data || `zpool get version exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async getAvailableUpgradeVersions() {
        return new Promise((resolve, reject) => {
            const versions = [];
            const proc = cockpit.spawn(['zpool', 'upgrade', '-v'], {
                err: 'message'
            });

            let output = '';
            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode, data) => {
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    // Parse output to extract version numbers and descriptions
                    const lines = output.trim().split('\n');
                    let currentVersion = null;

                    lines.forEach(line => {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith('This system')) {
                            return;
                        }

                        // Match version lines like "28	zpool version 28"
                        const versionMatch = trimmed.match(/^(\d+)\s+(.+)$/);
                        if (versionMatch) {
                            versions.push({
                                version: parseInt(versionMatch[1], 10),
                                description: versionMatch[2].trim()
                            });
                        }
                    });

                    resolve(versions);
                } else {
                    const errorMsg = output.trim() || data || `zpool upgrade -v exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async upgradePool(poolName) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zpool', 'upgrade', poolName], {
                err: 'message'
            });

            let errorOutput = '';
            proc.stream((data) => {
                errorOutput += data;
            });

            proc.done((exitCode, data) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    resolve();
                } else {
                    const errorMsg = errorOutput.trim() || data || `zpool upgrade exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async upgradeAllPools() {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zpool', 'upgrade', '-a'], {
                err: 'message'
            });

            let errorOutput = '';
            proc.stream((data) => {
                errorOutput += data;
            });

            proc.done((exitCode, data) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    resolve();
                } else {
                    const errorMsg = errorOutput.trim() || data || `zpool upgrade -a exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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

    static async createPool(name, devices, vdevType, force = false, ashift = null) {
        return new Promise((resolve, reject) => {
            const args = ['zpool', 'create'];

            // Add force flag if requested
            if (force) {
                args.push('-f');
            }

            // Add ashift if provided
            if (ashift) {
                args.push('-o', `ashift=${ashift}`);
            }

            args.push(name);

            // Handle RAID 10 (Stripe of Mirrors)
            if (vdevType === 'raid10') {
                // Create mirror pairs
                for (let i = 0; i < devices.length; i += 2) {
                    if (i + 1 < devices.length) {
                        args.push('mirror', devices[i], devices[i+1]);
                    }
                }
            }
            // Handle standard types (mirror, raidz, etc.)
            else if (vdevType !== 'stripe') {
                args.push(vdevType);
                args.push(...devices);
            }
            // Handle stripe
            else {
                args.push(...devices);
            }

            const proc = cockpit.spawn(args, {
                err: 'message'
            });

            let errorOutput = '';
            proc.stream((data) => {
                errorOutput += data;
            });

            proc.done((exitCode, data) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
        return new Promise(async (resolve, reject) => {
            const filesystems = [];
            const proc = cockpit.spawn(['zfs', 'list', '-H', '-o', 'name,used,available,referenced,mountpoint,encryption,quota,reservation,compressratio', '-t', 'filesystem', '-r', poolName], {
                err: 'message'
            });

            proc.stream((data) => {
                const lines = data.trim().split('\n');
                lines.forEach(line => {
                    if (line.trim() && !line.startsWith(poolName + '\t')) {
                        const parts = line.split('\t');
                        const [name, used, available, referenced, mountpoint, encryption, quota, reservation, compressratio] = parts;
                        filesystems.push({
                            name,
                            used,
                            available,
                            referenced,
                            mountpoint,
                            encrypted: encryption && encryption !== '-',
                            quota: quota && quota !== '-' ? quota : null,
                            reservation: reservation && reservation !== '-' ? reservation : null,
                            compressratio: compressratio && compressratio !== '-' ? compressratio : null,
                            dedupratio: null // Will be fetched separately if needed
                        });
                    }
                });
            });

            proc.done(async (exitCode) => {
                // Exit code 0 means success
                // Exit code 1 typically means no filesystems found, which is fine - return empty array
                // null/undefined/empty exit code means process completed (treat as success)
                // If we have filesystem data, always resolve successfully regardless of exit code
                if (filesystems.length > 0 || exitCode === 0 || exitCode === 1 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    // Get compression and dedup stats for filesystems that don't have them
                    for (const fs of filesystems) {
                        if (!fs.compressratio) {
                            try {
                                const props = await this.getDatasetProperties(fs.name);
                                if (props.compressratio) {
                                    fs.compressratio = props.compressratio.value;
                                }
                                // Try to get dedupratio if dedup is enabled
                                if (props.dedup && props.dedup.value !== 'off') {
                                    // dedupratio might not be available, but we can try
                                    if (props.dedupratio) {
                                        fs.dedupratio = props.dedupratio.value;
                                    }
                                }
                            } catch {
                                // Ignore errors getting properties
                            }
                        }
                    }
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

    static async createFileSystem(name, encrypted = false, passphrase = null, properties = {}) {
        return new Promise((resolve, reject) => {
            const args = ['zfs', 'create'];
            if (encrypted) {
                args.push('-o', 'encryption=aes-256-gcm', '-o', 'keyformat=passphrase', '-o', 'keylocation=prompt');
            }

            // Add properties
            if (properties.compression) {
                args.push('-o', `compression=${properties.compression}`);
            }
            if (properties.deduplication) {
                args.push('-o', `dedup=${properties.deduplication}`);
            }
            if (properties.quota) {
                args.push('-o', `quota=${properties.quota}`);
            }
            if (properties.reservation) {
                args.push('-o', `reservation=${properties.reservation}`);
            }

            args.push(name);

            const proc = cockpit.spawn(args, { err: 'message' });

            // If encrypted, send passphrase via stdin
            if (encrypted && passphrase) {
                proc.input(passphrase + '\n');
            }

            proc.done((exitCode, data) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    resolve();
                } else {
                    const errorMsg = data || `zfs create exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                            creation,
                            holds: [] // Will be populated by getSnapshotHolds
                        });
                    }
                });
            });

            proc.done(async (exitCode) => {
                // Exit code 0 means success
                // Exit code 1 typically means no snapshots found, which is fine - return empty array
                // null/undefined/empty exit code means process completed (treat as success)
                // If we have snapshot data, always resolve successfully regardless of exit code
                if (snapshots.length > 0 || exitCode === 0 || exitCode === 1 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    // Fetch holds for each snapshot
                    for (const snapshot of snapshots) {
                        try {
                            const holds = await ZfsApi.getSnapshotHolds(snapshot.name);
                            snapshot.holds = holds;
                        } catch {
                            // If holds can't be fetched, leave empty array
                            snapshot.holds = [];
                        }
                    }
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
            const proc = cockpit.spawn(args, {
                err: 'message'
            });

            let errorOutput = '';
            proc.stream((data) => {
                errorOutput += data;
            });

            proc.done((exitCode, data) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    resolve();
                } else {
                    const errorMsg = errorOutput.trim() || data || `zfs destroy snapshot exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async holdSnapshot(snapName, tag) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zfs', 'hold', tag, snapName], {
                err: 'message'
            });

            let errorOutput = '';
            proc.stream((data) => {
                errorOutput += data;
            });

            proc.done((exitCode, data) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    resolve();
                } else {
                    const errorMsg = errorOutput.trim() || data || `zfs hold exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async releaseSnapshot(snapName, tag) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zfs', 'release', tag, snapName], {
                err: 'message'
            });

            let errorOutput = '';
            proc.stream((data) => {
                errorOutput += data;
            });

            proc.done((exitCode, data) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    resolve();
                } else {
                    const errorMsg = errorOutput.trim() || data || `zfs release exited with code ${exitCode}`;
                    reject(new Error(errorMsg));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async getSnapshotHolds(snapName) {
        return new Promise((resolve, reject) => {
            const holds = [];
            const proc = cockpit.spawn(['zfs', 'holds', '-H', snapName], {
                err: 'message'
            });

            proc.stream((data) => {
                const lines = data.trim().split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        const parts = line.split('\t');
                        if (parts.length >= 2) {
                            holds.push({
                                tag: parts[0],
                                timestamp: parts[1] || null
                            });
                        }
                    }
                });
            });

            proc.done((exitCode) => {
                // Exit code 0 means success
                // Exit code 1 typically means no holds found, which is fine - return empty array
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode === 1 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    resolve(holds);
                } else {
                    // If snapshot doesn't exist or other error, return empty array
                    resolve([]);
                }
            });

            proc.fail((error) => {
                // On failure, return empty array rather than rejecting
                resolve([]);
            });
        });
    }

    static async cloneSnapshot(source, target) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zfs', 'clone', source, target]);

            proc.done((exitCode) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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

    // Get pool VDEV type (RAID configuration)
    static async getPoolVdevType(poolName) {
        return new Promise((resolve, reject) => {
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
                if (output.trim().length > 0 || exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    const lines = output.split('\n');
                    let vdevType = 'stripe'; // Default to stripe

                    // Look for vdev type in the status output
                    // Format: "pool: poolname" followed by vdev configuration
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();

                        // Look for the pool name line, then check the next lines for vdev info
                        if (line.startsWith('pool:') || line.startsWith('NAME')) {
                            // Check subsequent lines for vdev type indicators
                            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                                const nextLine = lines[j].trim();

                                // Check for mirror
                                if (nextLine.includes('mirror') || nextLine.match(/^\s+mirror-/)) {
                                    vdevType = 'mirror';
                                    break;
                                }
                                // Check for raidz3 (must be before raidz2 and raidz1)
                                if (nextLine.includes('raidz3') || nextLine.match(/^\s+raidz3-/)) {
                                    vdevType = 'raidz3';
                                    break;
                                }
                                // Check for raidz2 (must be before raidz1)
                                if (nextLine.includes('raidz2') || nextLine.match(/^\s+raidz2-/)) {
                                    vdevType = 'raidz2';
                                    break;
                                }
                                // Check for raidz1 (single parity, same as raidz)
                                // Must check after raidz2 and raidz3 to avoid false matches
                                if (nextLine.includes('raidz1') || nextLine.match(/^\s+raidz1-/)) {
                                    vdevType = 'raidz';
                                    break;
                                }
                                // Check for raidz (generic, must be last)
                                if (nextLine.includes('raidz') || nextLine.match(/^\s+raidz-/)) {
                                    vdevType = 'raidz';
                                    break;
                                }
                                // If we see device paths directly after pool name, it's likely stripe
                                if (nextLine.startsWith('/dev/') && !nextLine.includes('mirror') && !nextLine.includes('raidz')) {
                                    vdevType = 'stripe';
                                }
                            }
                            break;
                        }
                    }

                    resolve(vdevType);
                } else {
                    reject(new Error(`zpool status exited with code ${exitCode}`));
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
                            // Stop parsing if we hit errors or other sections
                            if (trimmed.startsWith('errors:')) {
                                inDeviceTable = false;
                                continue;
                            }

                            // Skip separator lines and empty lines
                            if (trimmed.match(/^-+$/) || !trimmed) continue;

                            // Skip VDEV container names (mirror, raidz, spare, replacing, etc.)
                            // Also skip "logs", "cache", "special", "dedup" headers
                            if (trimmed.match(/^(mirror|raidz|draid|spare|replacing|logs|cache|special|dedup)/)) continue;

                            const parts = trimmed.split(/\s+/);
                            if (parts.length >= 2) {
                                let deviceName = parts[0];
                                const state = parts[1];

                                // Skip the pool name itself (first row usually matches poolName)
                                if (deviceName === poolName) continue;

                                // If we are here, it should be a disk or partition
                                // Some systems list full paths /dev/sda, others just sda, others wwn-...
                                // We assume if it's not a VDEV type, it's a device.

                                // Normalize device path to include /dev/ if it's a simple name
                                // and doesn't already have a path separator
                                if (!deviceName.includes('/') && !deviceName.startsWith('/')) {
                                    deviceName = `/dev/${deviceName}`;
                                }

                                devices.push({
                                    name: parts[0], // Display name (as shown in zpool status)
                                    path: deviceName, // Full path for operations
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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

    static async sendSnapshotWithProgress(snapshotName, destination, options = {}, progressCallback) {
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

            // Check if pv (pipe viewer) is available for progress
            const checkPv = cockpit.spawn(['which', 'pv'], { err: 'message' });
            let pvAvailable = false;
            let pvPath = 'pv';

            checkPv.done((exitCode) => {
                pvAvailable = (exitCode === 0);

                // Build command with or without pv
                let cmd;
                if (options.toPool) {
                    // Pool-to-pool replication: pipe zfs send directly to zfs receive
                    if (pvAvailable && progressCallback) {
                        cmd = `${args.join(' ')} | ${pvPath} -n -f -i 1 | zfs receive ${options.targetPool}`;
                    } else {
                        cmd = `${args.join(' ')} | zfs receive ${options.targetPool}`;
                    }
                } else if (pvAvailable && progressCallback) {
                    // Use pv for progress tracking
                    if (destination.startsWith('ssh://') || destination.includes('@')) {
                        const [userHost, remotePath] = destination.replace('ssh://', '').split(':');
                        const [user, host] = userHost.split('@');
                        const sshArgs = `ssh ${user ? `${user}@${host}` : host} "zfs receive ${remotePath}"`;
                        cmd = `${args.join(' ')} | ${pvPath} -n -f -i 1 | ${sshArgs}`;
                    } else {
                        cmd = `${args.join(' ')} | ${pvPath} -n -f -i 1 > ${destination}`;
                    }
                } else {
                    // No progress tracking
                    if (destination.startsWith('ssh://') || destination.includes('@')) {
                        const [userHost, remotePath] = destination.replace('ssh://', '').split(':');
                        const [user, host] = userHost.split('@');
                        const sshArgs = ['ssh', user ? `${user}@${host}` : host, `zfs receive ${remotePath}`];
                        cmd = `${args.join(' ')} | ${sshArgs.join(' ')}`;
                    } else {
                        cmd = `${args.join(' ')} > ${destination}`;
                    }
                }

                const proc = cockpit.spawn(['sh', '-c', cmd], {
                    err: 'message'
                });

                let lastProgress = { bytes: 0, speed: 0, time: 0 };
                const startTime = Date.now();

                if (pvAvailable && progressCallback) {
                    // Parse pv output for progress
                    proc.stream((data) => {
                        const lines = data.toString().split('\n');
                        lines.forEach(line => {
                            // pv outputs progress in format: bytes
                            const match = line.match(/^(\d+)$/);
                            if (match) {
                                const bytes = parseInt(match[1], 10);
                                const elapsed = (Date.now() - startTime) / 1000; // seconds
                                const speed = elapsed > 0 ? bytes / elapsed : 0;
                                const remaining = speed > 0 ? (options.estimatedSize ? (options.estimatedSize - bytes) / speed : null) : null;

                                lastProgress = {
                                    bytes,
                                    speed,
                                    elapsed,
                                    remaining,
                                    percent: options.estimatedSize ? (bytes / options.estimatedSize * 100) : null
                                };

                                if (progressCallback) {
                                    progressCallback(lastProgress);
                                }
                            }
                        });
                    });
                }

                proc.done((exitCode, data) => {
                    if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                        if (progressCallback) {
                            progressCallback({ ...lastProgress, complete: true });
                        }
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

            checkPv.fail(() => {
                // pv not available, proceed without progress
                pvAvailable = false;
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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

    static async receiveSnapshotWithProgress(poolName, source, options = {}, progressCallback) {
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

            // Check if pv (pipe viewer) is available for progress
            const checkPv = cockpit.spawn(['which', 'pv'], { err: 'message' });
            let pvAvailable = false;
            let pvPath = 'pv';

            checkPv.done((exitCode) => {
                pvAvailable = (exitCode === 0);

                // Build command with or without pv
                let cmd;
                if (options.fromPool) {
                    // Pool-to-pool replication: pipe zfs send directly to zfs receive
                    const sourceSnapshot = options.sourceSnapshot || source;
                    if (pvAvailable && progressCallback) {
                        cmd = `zfs send ${sourceSnapshot} | ${pvPath} -n -f -i 1 | ${args.join(' ')}`;
                    } else {
                        cmd = `zfs send ${sourceSnapshot} | ${args.join(' ')}`;
                    }
                } else if (pvAvailable && progressCallback) {
                    // Use pv for progress tracking
                    if (source.startsWith('ssh://') || source.includes('@')) {
                        const [userHost, remoteSnapshot] = source.replace('ssh://', '').split(':');
                        const [user, host] = userHost.split('@');
                        const sshCmd = `ssh ${user ? `${user}@${host}` : host} "zfs send ${remoteSnapshot}"`;
                        cmd = `${sshCmd} | ${pvPath} -n -f -i 1 | ${args.join(' ')}`;
                    } else {
                        cmd = `cat ${source} | ${pvPath} -n -f -i 1 | ${args.join(' ')}`;
                    }
                } else {
                    // No progress tracking
                    if (source.startsWith('ssh://') || source.includes('@')) {
                        const [userHost, remoteSnapshot] = source.replace('ssh://', '').split(':');
                        const [user, host] = userHost.split('@');
                        const sshCmd = `ssh ${user ? `${user}@${host}` : host} "zfs send ${remoteSnapshot}"`;
                        cmd = `${sshCmd} | ${args.join(' ')}`;
                    } else {
                        cmd = `cat ${source} | ${args.join(' ')}`;
                    }
                }

                const proc = cockpit.spawn(['sh', '-c', cmd], {
                    err: 'message'
                });

                let lastProgress = { bytes: 0, speed: 0, time: 0 };
                const startTime = Date.now();

                if (pvAvailable && progressCallback) {
                    // Parse pv output for progress
                    proc.stream((data) => {
                        const lines = data.toString().split('\n');
                        lines.forEach(line => {
                            // pv outputs progress in format: bytes
                            const match = line.match(/^(\d+)$/);
                            if (match) {
                                const bytes = parseInt(match[1], 10);
                                const elapsed = (Date.now() - startTime) / 1000; // seconds
                                const speed = elapsed > 0 ? bytes / elapsed : 0;
                                const remaining = speed > 0 ? (options.estimatedSize ? (options.estimatedSize - bytes) / speed : null) : null;

                                lastProgress = {
                                    bytes,
                                    speed,
                                    elapsed,
                                    remaining,
                                    percent: options.estimatedSize ? (bytes / options.estimatedSize * 100) : null
                                };

                                if (progressCallback) {
                                    progressCallback(lastProgress);
                                }
                            }
                        });
                    });
                }

                proc.done((exitCode, data) => {
                    if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                        if (progressCallback) {
                            progressCallback({ ...lastProgress, complete: true });
                        }
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

            checkPv.fail(() => {
                // pv not available, proceed without progress
                pvAvailable = false;
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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

    // ZFS ARC Memory Statistics
    static async getArcStats() {
        return new Promise((resolve, reject) => {
            // Try reading from /proc/spl/kstat/zfs/arcstats (Linux)
            const proc = cockpit.spawn(['cat', '/proc/spl/kstat/zfs/arcstats'], {
                err: 'message'
            });
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    const stats = {
                        size: 0,
                        max: 0,
                        min: 0,
                        metadata: 0,
                        dnode: 0,
                        dbuf: 0,
                        hits: 0,
                        misses: 0,
                        l2_size: 0,
                        l2_hits: 0,
                        l2_misses: 0,
                        available: false
                    };

                    // Parse arcstats file
                    // Format: name type data
                    // Example: size 4 1234567890
                    const lines = output.split('\n');
                    for (const line of lines) {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 3) {
                            const name = parts[0];
                            const value = parseInt(parts[2], 10);

                            switch (name) {
                                case 'size': stats.size = value; break;
                                case 'c_max': stats.max = value; break;
                                case 'c_min': stats.min = value; break;
                                case 'metadata_size': stats.metadata = value; break;
                                case 'dnode_size': stats.dnode = value; break;
                                case 'dbuf_size': stats.dbuf = value; break;
                                case 'hits': stats.hits = value; break;
                                case 'misses': stats.misses = value; break;
                                case 'l2_size': stats.l2_size = value; break;
                                case 'l2_hits': stats.l2_hits = value; break;
                                case 'l2_misses': stats.l2_misses = value; break;
                            }
                        }
                    }

                    // If we got any stats, mark as available
                    if (stats.size > 0 || stats.max > 0) {
                        stats.available = true;
                    }

                    resolve(stats);
                } else {
                    // If /proc/spl/kstat/zfs/arcstats doesn't exist, try arc_summary command
                    const arcSummaryProc = cockpit.spawn(['arc_summary'], {
                        err: 'message'
                    });
                    let arcOutput = '';

                    arcSummaryProc.stream((data) => {
                        arcOutput += data;
                    });

                    arcSummaryProc.done((arcExitCode) => {
                        if (arcExitCode === 0 || arcExitCode == null || arcExitCode === '' || arcExitCode === undefined) {
                            const stats = {
                                size: 0,
                                max: 0,
                                min: 0,
                                metadata: 0,
                                dnode: 0,
                                dbuf: 0,
                                available: false
                            };

                            // Parse arc_summary output
                            // Look for lines like "ARC size (current): 123.4 MiB"
                            const sizeMatch = arcOutput.match(/ARC size \(current\):\s*([\d.]+)\s*(\w+)/i);
                            if (sizeMatch) {
                                stats.size = parseFloat(sizeMatch[1]) * parseSizeMultiplier(sizeMatch[2]);
                                stats.available = true;
                            }

                            const maxMatch = arcOutput.match(/ARC size \(max\):\s*([\d.]+)\s*(\w+)/i);
                            if (maxMatch) {
                                stats.max = parseFloat(maxMatch[1]) * parseSizeMultiplier(maxMatch[2]);
                            }

                            resolve(stats);
                        } else {
                            // No ARC stats available
                            resolve({
                                size: 0,
                                max: 0,
                                min: 0,
                                metadata: 0,
                                dnode: 0,
                                dbuf: 0,
                                available: false
                            });
                        }
                    });

                    arcSummaryProc.fail(() => {
                        resolve({
                            size: 0,
                            max: 0,
                            min: 0,
                            metadata: 0,
                            dnode: 0,
                            dbuf: 0,
                            available: false
                        });
                    });
                }
            });

            proc.fail(() => {
                // Try arc_summary as fallback
                const arcSummaryProc = cockpit.spawn(['arc_summary'], {
                    err: 'message'
                });
                let arcOutput = '';

                arcSummaryProc.stream((data) => {
                    arcOutput += data;
                });

                arcSummaryProc.done((arcExitCode) => {
                    if (arcExitCode === 0 || arcExitCode == null || arcExitCode === '' || arcExitCode === undefined) {
                        const stats = {
                            size: 0,
                            max: 0,
                            min: 0,
                            metadata: 0,
                            dnode: 0,
                            dbuf: 0,
                            available: false
                        };

                        const sizeMatch = arcOutput.match(/ARC size \(current\):\s*([\d.]+)\s*(\w+)/i);
                        if (sizeMatch) {
                            stats.size = parseFloat(sizeMatch[1]) * parseSizeMultiplier(sizeMatch[2]);
                            stats.available = true;
                        }

                        const maxMatch = arcOutput.match(/ARC size \(max\):\s*([\d.]+)\s*(\w+)/i);
                        if (maxMatch) {
                            stats.max = parseFloat(maxMatch[1]) * parseSizeMultiplier(maxMatch[2]);
                        }

                        resolve(stats);
                    } else {
                        resolve({
                            size: 0,
                            max: 0,
                            min: 0,
                            metadata: 0,
                            dnode: 0,
                            dbuf: 0,
                            available: false
                        });
                    }
                });

                arcSummaryProc.fail(() => {
                    resolve({
                        size: 0,
                        max: 0,
                        min: 0,
                        metadata: 0,
                        dnode: 0,
                        dbuf: 0,
                        available: false
                    });
                });
            });
        });

        function parseSizeMultiplier(unit) {
            const multipliers = {
                'B': 1,
                'KB': 1024,
                'MB': 1024 ** 2,
                'GB': 1024 ** 3,
                'TB': 1024 ** 4,
                'KiB': 1024,
                'MiB': 1024 ** 2,
                'GiB': 1024 ** 3,
                'TiB': 1024 ** 4
            };
            return multipliers[unit] || 1;
        }
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

