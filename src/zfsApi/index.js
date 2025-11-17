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
                // Exit code 1 typically means no pools found, which is fine - return empty array
                // Exit code 0 means success
                if (exitCode === 0 || exitCode === 1) {
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
            const proc = cockpit.spawn(['lsblk', '-o', 'NAME,TYPE,SIZE,MODEL', '-n', '-d']);

            proc.stream((data) => {
                const lines = data.trim().split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 3 && parts[1] === 'disk') {
                            disks.push({
                                name: parts[0],
                                path: `/dev/${parts[0]}`,
                                type: parts[1],
                                size: parts[2],
                                model: parts.slice(3).join(' ') || parts[0]
                            });
                        }
                    }
                });
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve(disks);
                } else {
                    reject(new Error(`lsblk exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
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

    static async importPool(poolName = null) {
        return new Promise((resolve, reject) => {
            const args = ['zpool', 'import'];
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

    static async exportPool(poolName) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zpool', 'export', poolName]);

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

    static async createPool(name, devices, vdevType) {
        return new Promise((resolve, reject) => {
            const args = ['zpool', 'create', name];
            
            // Add vdev type if not stripe
            if (vdevType !== 'stripe') {
                args.push(vdevType);
            }
            
            // Add devices
            args.push(...devices);

            const proc = cockpit.spawn(args);

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zpool create exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async listFileSystems(poolName) {
        return new Promise((resolve, reject) => {
            const filesystems = [];
            const proc = cockpit.spawn(['zfs', 'list', '-H', '-o', 'name,used,available,referenced,mountpoint,encryption', '-t', 'filesystem', '-r', poolName]);

            proc.stream((data) => {
                const lines = data.trim().split('\n');
                lines.forEach(line => {
                    if (line.trim() && !line.startsWith(poolName + '\t')) {
                        const [name, used, available, referenced, mountpoint, encryption] = line.split('\t');
                        filesystems.push({
                            name,
                            used,
                            available,
                            referenced,
                            mountpoint,
                            encrypted: encryption && encryption !== '-'
                        });
                    }
                });
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
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
                if (exitCode === 0) {
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

    static async destroySnapshot(snapName) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zfs', 'destroy', snapName]);

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

    static async rollbackSnapshot(snapName, recursive = false) {
        return new Promise((resolve, reject) => {
            const args = ['zfs', 'rollback'];
            if (recursive) {
                args.push('-r');
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
}

