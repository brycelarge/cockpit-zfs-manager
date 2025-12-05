const cockpit = window.cockpit;

export class SchedulerApi {
    static MARKER = '# COCKPIT-ZFS-MANAGER-REPLICATION';

    static async listTasks() {
        return new Promise((resolve, reject) => {
            // Read root crontab
            const proc = cockpit.spawn(['crontab', '-l'], { err: 'message' });
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                // Crontab -l returns exit code 1 if no crontab exists for user, which is fine (empty)
                if (exitCode === 0 || exitCode === 1) {
                    const tasks = [];
                    const lines = output.trim().split('\n');

                    lines.forEach((line, index) => {
                        if (line.includes(SchedulerApi.MARKER)) {
                            // Format: schedule command # MARKER id=...
                            // Example: 0 * * * * syncoid rpool/data user@host:pool/backup # COCKPIT-ZFS-MANAGER-REPLICATION id=12345

                            // Simple parse: split by marker
                            const [jobPart, commentPart] = line.split(SchedulerApi.MARKER);
                            if (!jobPart || !commentPart) return;

                            const idMatch = commentPart.match(/id=([a-zA-Z0-9-]+)/);
                            const id = idMatch ? idMatch[1] : `legacy-${index}`;

                            // Parse schedule and command
                            // Cron has 5 time fields
                            const parts = jobPart.trim().split(/\s+/);
                            if (parts.length >= 6) {
                                const schedule = parts.slice(0, 5).join(' ');
                                const command = parts.slice(5).join(' ');

                                tasks.push({
                                    id,
                                    schedule,
                                    command,
                                    raw: line
                                });
                            }
                        }
                    });
                    resolve(tasks);
                } else {
                    // If unknown error
                    resolve([]);
                }
            });

            proc.fail(() => {
                // If crontab command fails entirely
                resolve([]);
            });
        });
    }

    static async addTask(schedule, command) {
        const tasks = await this.listTasks();
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

        const newTaskLine = `${schedule} ${command} ${SchedulerApi.MARKER} id=${id}`;

        return this.writeCrontab([...tasks.map(t => t.raw), newTaskLine]);
    }

    static async deleteTask(id) {
        const tasks = await this.listTasks();
        const filteredRaw = tasks.filter(t => t.id !== id).map(t => t.raw);

        // We also need to preserve non-managed lines
        // This requires reading the full crontab again properly to keep other lines
        return this.updateCrontab((lines) => {
            return lines.filter(line => {
                if (line.includes(SchedulerApi.MARKER)) {
                    const match = line.match(/id=([a-zA-Z0-9-]+)/);
                    const lineId = match ? match[1] : null;
                    return lineId !== id;
                }
                return true; // Keep other lines
            });
        });
    }

    static async updateCrontab(filterFn) {
        return new Promise((resolve, reject) => {
            // Read existing
            const readProc = cockpit.spawn(['crontab', '-l'], { err: 'message' });
            let output = '';

            readProc.stream(data => output += data);

            readProc.done((exitCode) => {
                let lines = [];
                if (exitCode === 0 && output) {
                    lines = output.trim().split('\n');
                }

                const newLines = filterFn(lines);
                const newContent = newLines.join('\n') + '\n';

                // Write back
                const writeProc = cockpit.spawn(['crontab', '-'], { err: 'message' });
                let writeError = '';

                writeProc.stream((data) => {
                    // crontab might output warnings to stdout/stderr
                    writeError += data;
                });

                writeProc.input(newContent);

                writeProc.done((writeExitCode) => {
                    if (writeExitCode === 0 || writeExitCode == null || writeExitCode === '') {
                        resolve();
                    } else {
                        reject(new Error(`Failed to write crontab (code ${writeExitCode}): ${writeError}`));
                    }
                });

                writeProc.fail(err => reject(err));
            });

            readProc.fail(() => {
                // Assume empty if read fails (e.g. no crontab)
                const newLines = filterFn([]);
                const newContent = newLines.join('\n') + '\n';

                const writeProc = cockpit.spawn(['crontab', '-'], { err: 'message' });
                let writeError = '';

                writeProc.stream((data) => {
                    writeError += data;
                });

                writeProc.input(newContent);
                writeProc.done(code => {
                    if (code === 0 || code == null || code === '') resolve();
                    else reject(new Error(`Failed to write crontab (code ${code}): ${writeError}`));
                });
                writeProc.fail(err => reject(err));
            });
        });
    }

    static async writeCrontab(taskLines) {
        // Helper to just append our tasks to existing non-managed lines
        return this.updateCrontab(lines => {
            const otherLines = lines.filter(l => !l.includes(SchedulerApi.MARKER));
            return [...otherLines, ...taskLines];
        });
    }
}
