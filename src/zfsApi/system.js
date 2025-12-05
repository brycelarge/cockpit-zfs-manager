const cockpit = window.cockpit;

export class SystemApi {
    static async getStats() {
        try {
            // Use cockpit.file to read files directly (more robust than spawn sh)
            const [statData, memData] = await Promise.all([
                cockpit.file('/proc/stat').read(),
                cockpit.file('/proc/meminfo').read()
            ]);

            return {
                cpu: parseCpuStat(statData),
                memory: parseMemInfo(memData)
            };
        } catch (error) {
            console.error('SystemApi.getStats failed:', error);
            throw error;
        }
    }

    static async getZfsStats() {
        try {
            const [memInfo, arcStats, ioStats] = await Promise.all([
                cockpit.file('/proc/meminfo').read(),
                cockpit.file('/proc/spl/kstat/zfs/arcstats').read(),
                getPoolIoStats()
            ]);

            // Parse Memory (ARC)
            const memTotal = parseMemTotal(memInfo);
            const arcSize = parseArcSize(arcStats);
            const arcPercent = (memTotal > 0) ? (arcSize / memTotal) * 100 : 0;

            // Parse I/O (Total Bandwidth)
            // ioStats returns { read: bytes, write: bytes }
            const totalIo = ioStats.read + ioStats.write;

            return {
                memory: {
                    usedBytes: arcSize,
                    totalBytes: memTotal,
                    percent: arcPercent
                },
                io: {
                    read: ioStats.read,
                    write: ioStats.write,
                    total: totalIo
                }
            };
        } catch (error) {
            console.error('SystemApi.getZfsStats failed:', error);
            throw error;
        }
    }
}

function parseCpuStat(data) {
    if (!data) return null;
    const lines = data.trim().split('\n');
    const cpuLine = lines.find(l => l.startsWith('cpu '));
    if (!cpuLine) return null;

    const parts = cpuLine.split(/\s+/);
    // cpu  user nice system idle iowait irq softirq steal guest guest_nice
    // parts[0] is "cpu"
    const user = parseInt(parts[1], 10) || 0;
    const nice = parseInt(parts[2], 10) || 0;
    const system = parseInt(parts[3], 10) || 0;
    const idle = parseInt(parts[4], 10) || 0;
    const iowait = parseInt(parts[5], 10) || 0;
    const irq = parseInt(parts[6], 10) || 0;
    const softirq = parseInt(parts[7], 10) || 0;
    const steal = parseInt(parts[8], 10) || 0;

    const total = user + nice + system + idle + iowait + irq + softirq + steal;
    const active = total - idle - iowait;

    return { total, active, idle };
}

function parseMemInfo(data) {
    if (!data) return null;
    const lines = data.trim().split('\n');
    const mem = {};

    lines.forEach(line => {
        const parts = line.split(':');
        if (parts.length === 2) {
            const key = parts[0].trim();
            // Parse value, ignoring unit (usually kB)
            const valueStr = parts[1].trim().split(/\s+/)[0];
            const value = parseInt(valueStr, 10);
            if (!isNaN(value)) {
                mem[key] = value * 1024; // Convert kB to Bytes
            }
        }
    });

    // Calculate used/available
    const total = mem.MemTotal || 0;
    const available = mem.MemAvailable || (mem.MemFree + mem.Buffers + mem.Cached) || 0;
    const used = total - available;

    return {
        total,
        used,
        available,
        percent: total > 0 ? (used / total) * 100 : 0
    };
}

function parseMemTotal(data) {
    if (!data) return 0;
    const match = data.match(/MemTotal:\s+(\d+)\s+kB/);
    return match ? parseInt(match[1], 10) * 1024 : 0;
}

function parseArcSize(data) {
    if (!data) return 0;
    // size 4 123456
    const match = data.match(/^size\s+\d+\s+(\d+)/m);
    return match ? parseInt(match[1], 10) : 0;
}

async function getPoolIoStats() {
    return new Promise((resolve) => {
        // Run iostat twice to get current usage (first output is avg since boot)
        // Use -p for parsable (exact bytes) output, -H for script mode (no headers)
        // -y (if available) would omit the first report, but 1 2 is safer for compatibility
        const proc = cockpit.spawn(['zpool', 'iostat', '-H', '-p', '1', '2'], { err: 'message' });
        let output = '';

        proc.stream((data) => {
            output += data;
        });

        proc.done((exitCode) => {
            if (exitCode === 0) {
                const lines = output.trim().split('\n').filter(l => l.trim().length > 0);

                // We requested 2 iterations. We expect P lines for the first iteration (avg)
                // and P lines for the second iteration (current).
                // Total lines should be 2 * P.
                // We want to sum stats from the second iteration (the last P lines).

                if (lines.length === 0) {
                    resolve({ read: 0, write: 0 });
                    return;
                }

                // Assuming even number of lines since we asked for 2 intervals
                // If odd (unexpected), floor ensures we might miss one but safer than taking from first set
                const half = Math.floor(lines.length / 2);
                const currentLines = lines.slice(half);

                let readBytes = 0;
                let writeBytes = 0;

                currentLines.forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    // Expected: pool_name alloc free read_ops write_ops read_bytes write_bytes
                    // We take the last two columns for bandwidth to be robust
                    if (parts.length >= 7) {
                        const rbStr = parts[parts.length - 2];
                        const wbStr = parts[parts.length - 1];

                        const rb = parseBandwidth(rbStr);
                        const wb = parseBandwidth(wbStr);

                        if (!isNaN(rb)) readBytes += rb;
                        if (!isNaN(wb)) writeBytes += wb;
                    }
                });

                // console.log('ZFS IO Stats:', { raw: output, parsed: { read: readBytes, write: writeBytes } });
                resolve({ read: readBytes, write: writeBytes });
            } else {
                resolve({ read: 0, write: 0 });
            }
        });

        proc.fail(() => {
            resolve({ read: 0, write: 0 });
        });
    });
}

function parseBandwidth(str) {
    if (!str) return 0;
    const units = {
        'K': 1024, 'M': 1024**2, 'G': 1024**3, 'T': 1024**4,
        'k': 1024, 'm': 1024**2, 'g': 1024**3, 't': 1024**4
    };
    const lastChar = str.slice(-1);
    const multiplier = units[lastChar];

    if (multiplier) {
        return parseFloat(str.slice(0, -1)) * multiplier;
    } else {
        return parseFloat(str);
    }
}
