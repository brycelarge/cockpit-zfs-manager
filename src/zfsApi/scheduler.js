const cockpit = window.cockpit;

console.error("ZFS MANAGER SCHEDULER LOADED - DEBUG MODE ACTIVE - V3");

export class SchedulerApi {
    static MARKER_PREFIX = '# COCKPIT-ZFS-MANAGER-TASK';
    static LEGACY_MARKER = '# COCKPIT-ZFS-MANAGER-REPLICATION';

    static async listTasks() {
        console.warn("[ZFS-DEBUG] SchedulerApi.listTasks called");
        return new Promise((resolve, reject) => {
            console.warn("[ZFS-DEBUG] Spawning crontab -l");
            const proc = cockpit.spawn(['crontab', '-l'], { err: 'message' });
            let output = '';

            proc.stream((data) => {
                console.warn("[ZFS-DEBUG] Received stream data length:", data.length);
                output += data;
            });

            proc.done((exitCode) => {
                console.warn("[ZFS-DEBUG] Process done. Exit code:", exitCode);
                // Accept 0, 1, null, or empty string as valid completion if we got this far
                if (exitCode === 0 || exitCode === 1 || exitCode == null || exitCode === '') {
                    const tasks = [];
                    const lines = output.trim().split('\n');
                    console.warn('[ZFS-DEBUG] Raw crontab output:', JSON.stringify(output));

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        console.warn(`[ZFS-DEBUG] Processing line ${i}: "${line}"`);

                        // NEW FORMAT: Marker line followed by task line
                        if (line.startsWith(SchedulerApi.MARKER_PREFIX)) {
                            console.warn('[ZFS-DEBUG] Found NEW marker');
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
                        // OLD FORMAT regex check
                        else {
                            const legacyRegex = /(.*)# COCKPIT-ZFS-MANAGER-REPLICATION\s+id=([a-zA-Z0-9-]+)/;
                            const legacyMatch = line.match(legacyRegex);
                            if (legacyMatch) {
                                console.warn('[ZFS-DEBUG] Found LEGACY match:', legacyMatch);
                                const jobPart = legacyMatch[1].trim();
                                const id = legacyMatch[2];

                                const parts = jobPart.split(/\s+/);
                                if (parts.length >= 6) {
                                    const schedule = parts.slice(0, 5).join(' ');
                                    const command = parts.slice(5).join(' ');
                                    tasks.push({
                                        id, schedule, command,
                                        raw: line
                                    });
                                } else {
                                    console.warn('[ZFS-DEBUG] Legacy match failed field check:', parts.length);
                                }
                            } else {
                                console.warn('[ZFS-DEBUG] No match for line');
                            }
                        }
                    }
                    console.warn('[ZFS-DEBUG] Final tasks list:', tasks);
                    resolve(tasks);
                } else {
                    resolve([]);
                }
            });

            proc.fail((err) => {
                console.error("[ZFS-DEBUG] Spawn FAILED:", err);
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
                writeProc.close();

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
                writeProc.close();
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
