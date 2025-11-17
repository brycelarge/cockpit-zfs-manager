const cockpit = window.cockpit;

export class ZfsApi {
    static async listPools() {
        return new Promise((resolve, reject) => {
            const pools = [];
            const proc = cockpit.spawn(['zpool', 'list', '-H', '-o', 'name,size,allocated,free,fragmentation,health']);

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

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve(pools);
                } else {
                    reject(new Error(`zpool list exited with code ${exitCode}`));
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
}

