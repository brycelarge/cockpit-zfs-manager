const cockpit = window.cockpit;

export class SystemApi {
    static async getStats() {
        return new Promise((resolve, reject) => {
            // Read both files in one go to minimize spawn overhead
            const proc = cockpit.spawn(['sh', '-c', 'cat /proc/stat; echo "---SPLIT---"; cat /proc/meminfo']);
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    const [statRaw, memRaw] = output.split('---SPLIT---');
                    const stats = {
                        cpu: parseCpuStat(statRaw),
                        memory: parseMemInfo(memRaw)
                    };
                    resolve(stats);
                } else {
                    reject(new Error('Failed to read system stats'));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
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
    const user = parseInt(parts[1]);
    const nice = parseInt(parts[2]);
    const system = parseInt(parts[3]);
    const idle = parseInt(parts[4]);
    const iowait = parseInt(parts[5]);
    const irq = parseInt(parts[6]);
    const softirq = parseInt(parts[7]);
    const steal = parseInt(parts[8]);

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
            const value = parseInt(parts[1].trim().split(' ')[0]); // KB
            mem[key] = value * 1024; // Bytes
        }
    });

    // Calculate used/available
    // MemAvailable is present in newer kernels (standard now)
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
