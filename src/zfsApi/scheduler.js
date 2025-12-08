const cockpit = window.cockpit;

export class SchedulerApi {
    static MARKER_PREFIX = '# COCKPIT-ZFS-MANAGER-TASK';

    static async listTasks() {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['crontab', '-l'], { err: 'message' });
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                // Accept 0, 1, null, or empty string as valid completion if we got this far
                if (exitCode === 0 || exitCode === 1 || exitCode == null || exitCode === '') {
                    const tasks = [];
                    const lines = output.trim().split('\n');

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();

                        // NEW FORMAT: Marker line followed by task line
                        if (line.startsWith(SchedulerApi.MARKER_PREFIX)) {
                            const idMatch = line.match(/id=([a-zA-Z0-9-]+)/);
                            const id = idMatch ? idMatch[1] : `legacy-${i}`;

                            if (i + 1 < lines.length) {
                                const taskLine = lines[i+1].trim();
                                if (taskLine && !taskLine.startsWith('#')) {
                                    const parts = taskLine.split(/\s+/);
                                    if (parts.length >= 6) {
                                        const schedule = parts.slice(0, 5).join(' ');
                                        const command = parts.slice(5).join(' ');
                                        tasks.push({
                                            id, schedule, command,
                                            rawMarker: line,
                                            rawTask: lines[i+1]
                                        });
                                        i++; // Skip the task line in the loop
                                    }
                                }
                            }
                        }
                    }
                    resolve(tasks);
                } else {
                    resolve([]);
                }
            });

            proc.fail((err) => {
                console.error("Failed to list cron tasks:", err);
                resolve([]);
            });
        });
    }

    static async addTask(schedule, command) {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const markerLine = `${SchedulerApi.MARKER_PREFIX} id=${id}`;
        const taskLine = `${schedule} ${command}`;

        // We append to the existing file
        return this.updateCrontab(lines => {
            return [...lines, markerLine, taskLine];
        });
    }

    static async deleteTask(id) {
        return this.updateCrontab(lines => {
            const newLines = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                if (line.startsWith(SchedulerApi.MARKER_PREFIX)) {
                    const idMatch = line.match(/id=([a-zA-Z0-9-]+)/);
                    if (idMatch && idMatch[1] === id) {
                        // Found the task to delete. Skip this line AND the next one (the command)
                        i++;
                        continue;
                    }
                }

                newLines.push(lines[i]);
            }
            return newLines;
        });
    }

    static async updateCrontab(filterFn) {
        return new Promise((resolve, reject) => {
            // Read existing
            const readProc = cockpit.spawn(['crontab', '-l'], { err: 'out' });
            let output = '';

            readProc.stream(data => output += data);

            readProc.done((exitCode) => {
                let lines = [];
                // Accept 0, 1, null, or empty string as valid completion
                if ((exitCode === 0 || exitCode === 1 || exitCode == null || exitCode === '') && output) {
                    lines = output.trim().split('\n');
                }

                const newLines = filterFn(lines);
                const newContent = newLines.join('\n') + '\n';

                // Use a temp file approach which is more robust than stdin pipe
                const tempFile = "/tmp/cockpit-zfs-manager-cron.tmp";

                cockpit.file(tempFile).replace(newContent)
                    .then(() => {
                        // File written, now load it
                        const loadProc = cockpit.spawn(['crontab', tempFile], { err: 'message' });
                        let loadError = '';

                        loadProc.stream(data => loadError += data);

                        loadProc.done((loadCode) => {
                            // Cleanup temp file (fire and forget)
                            cockpit.file(tempFile).replace(null).catch(() => {});

                            if (loadCode === 0 || loadCode == null || loadCode === '') {
                                resolve();
                            } else {
                                reject(new Error(`Failed to load crontab file (code ${loadCode}): ${loadError}`));
                            }
                        });

                        loadProc.fail(err => {
                            cockpit.file(tempFile).replace(null).catch(() => {});
                            reject(err);
                        });
                    })
                    .catch(err => {
                        reject(new Error(`Failed to write temp cron file: ${err}`));
                    });
            });

            readProc.fail((err) => {
                // If read fails (e.g. no crontab), proceed with empty list
                const newLines = filterFn([]);
                const newContent = newLines.join('\n') + '\n';

                const tempFile = "/tmp/cockpit-zfs-manager-cron.tmp";

                cockpit.file(tempFile).replace(newContent)
                    .then(() => {
                        const loadProc = cockpit.spawn(['crontab', tempFile], { err: 'message' });
                        let loadError = '';
                        loadProc.stream(data => loadError += data);

                        loadProc.done((loadCode) => {
                            cockpit.file(tempFile).replace(null).catch(() => {});
                            if (loadCode === 0 || loadCode == null || loadCode === '') resolve();
                            else reject(new Error(`Failed to load crontab file (code ${loadCode}): ${loadError}`));
                        });

                        loadProc.fail(err => {
                            cockpit.file(tempFile).replace(null).catch(() => {});
                            reject(err);
                        });
                    })
                    .catch(writeErr => {
                        reject(new Error(`Failed to write temp cron file: ${writeErr}`));
                    });
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
