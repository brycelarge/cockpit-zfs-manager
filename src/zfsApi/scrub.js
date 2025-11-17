const cockpit = window.cockpit;

export class ScrubApi {
    static async getScrubStatus(poolName) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zpool', 'status', poolName]);
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    const status = this.parseScrubStatus(output);
                    resolve(status);
                } else {
                    reject(new Error(`Failed to get scrub status: exit code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static parseScrubStatus(output) {
        const lines = output.split('\n');
        const status = {
            inProgress: false,
            lastScrub: null,
            scan: null,
            errors: null
        };

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Check if scrub is in progress
            if (trimmed.includes('scan:') && (trimmed.includes('scrub') || trimmed.includes('resilver'))) {
                status.inProgress = true;
                status.scan = trimmed.replace('scan:', '').trim();
            }
            
            // Parse last scrub date
            if (trimmed.includes('scrub repaired') || trimmed.includes('scrub finished')) {
                const dateMatch = trimmed.match(/(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})/);
                if (dateMatch) {
                    status.lastScrub = dateMatch[1];
                }
                status.scan = trimmed.replace(/^scan:\s*/, '').trim();
            }
            
            // Parse errors
            if (trimmed.startsWith('errors:')) {
                status.errors = trimmed.replace('errors:', '').trim();
            }
        }

        return status;
    }

    static async startScrub(poolName) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zpool', 'scrub', poolName]);

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zpool scrub exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async stopScrub(poolName) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['zpool', 'scrub', '-s', poolName]);

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`zpool scrub -s exited with code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async getScheduledScrubs() {
        return new Promise((resolve) => {
            // Check for systemd timers
            const proc = cockpit.spawn(['systemctl', 'list-timers', '--all', '--no-pager', '--output=json']);
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    try {
                        const timers = output.trim().split('\n')
                            .filter(line => line.trim())
                            .map(line => {
                                try {
                                    return JSON.parse(line);
                                } catch {
                                    return null;
                                }
                            })
                            .filter(t => t && t.unit && t.unit.includes('zfs-scrub'));
                        
                        resolve(timers);
                    } catch {
                        resolve([]);
                    }
                } else {
                    // Fallback to checking cron
                    this.getCronScrubs().then(resolve);
                }
            });

            proc.fail(() => {
                // Fallback to checking cron
                this.getCronScrubs().then(resolve);
            });
        });
    }

    static async getCronScrubs() {
        return new Promise((resolve) => {
            const proc = cockpit.spawn(['crontab', '-l'], { err: 'message' });
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    const lines = output.split('\n');
                    const scrubJobs = lines
                        .filter(line => line.includes('zpool') && line.includes('scrub'))
                        .map(line => ({
                            schedule: line.split(/\s+/).slice(0, 5).join(' '),
                            command: line.split(/\s+/).slice(5).join(' '),
                            type: 'cron'
                        }));
                    resolve(scrubJobs);
                } else {
                    resolve([]);
                }
            });

            proc.fail(() => {
                resolve([]);
            });
        });
    }

    static async createSystemdTimer(poolName, schedule) {
        // schedule format: "weekly", "monthly", or cron-like "0 2 * * 0" (Sunday 2 AM)
        return new Promise((resolve, reject) => {
            const timerName = `zfs-scrub-${poolName}.timer`;
            const serviceName = `zfs-scrub-${poolName}.service`;
            const timerPath = `/etc/systemd/system/${timerName}`;
            const servicePath = `/etc/systemd/system/${serviceName}`;

            // Parse schedule
            let onCalendar = '';
            if (schedule === 'weekly') {
                onCalendar = 'weekly';
            } else if (schedule === 'monthly') {
                onCalendar = 'monthly';
            } else if (schedule.match(/^\d+\s+\d+\s+\*\s+\*\s+\d+$/)) {
                // Cron format: convert to systemd OnCalendar
                const parts = schedule.split(/\s+/);
                const minute = parts[0];
                const hour = parts[1];
                const dayOfWeek = parts[4];
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                onCalendar = `${days[parseInt(dayOfWeek)]} ${hour}:${minute}`;
            } else {
                reject(new Error('Invalid schedule format'));
                return;
            }

            // Create service file
            const serviceContent = `[Unit]
Description=ZFS Scrub for ${poolName}
After=zfs.target

[Service]
Type=oneshot
ExecStart=/usr/sbin/zpool scrub ${poolName}
`;

            // Create timer file
            const timerContent = `[Unit]
Description=ZFS Scrub Timer for ${poolName}
Requires=${serviceName}

[Timer]
OnCalendar=${onCalendar}
Persistent=true

[Install]
WantedBy=timers.target
`;

            // Write files and enable timer
            const commands = [
                `echo ${cockpit.escape(serviceContent)} > ${servicePath}`,
                `echo ${cockpit.escape(timerContent)} > ${timerPath}`,
                'systemctl daemon-reload',
                `systemctl enable ${timerName}`,
                `systemctl start ${timerName}`
            ].join(' && ');

            const proc = cockpit.spawn(['sh', '-c', commands], { err: 'message' });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`Failed to create systemd timer: exit code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async createCronJob(poolName, schedule) {
        // schedule format: cron-like "0 2 * * 0" (minute hour day month dayofweek)
        return new Promise((resolve, reject) => {
            const cronLine = `${schedule} /usr/sbin/zpool scrub ${poolName} > /dev/null 2>&1`;
            
            // Get current crontab, append new line, write back
            const proc = cockpit.spawn(['crontab', '-l'], { err: 'message' });
            let currentCrontab = '';

            proc.stream((data) => {
                currentCrontab += data;
            });

            proc.done((exitCode) => {
                const newCrontab = (currentCrontab || '') + '\n' + cronLine + '\n';
                const writeProc = cockpit.spawn(['sh', '-c', `echo ${cockpit.escape(newCrontab)} | crontab -`], { err: 'message' });

                writeProc.done((writeExitCode) => {
                    if (writeExitCode === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Failed to create cron job: exit code ${writeExitCode}`));
                    }
                });

                writeProc.fail((error) => {
                    reject(error);
                });
            });

            proc.fail(() => {
                // No existing crontab, create new one
                const writeProc = cockpit.spawn(['sh', '-c', `echo ${cockpit.escape(cronLine + '\n')} | crontab -`], { err: 'message' });

                writeProc.done((writeExitCode) => {
                    if (writeExitCode === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Failed to create cron job: exit code ${writeExitCode}`));
                    }
                });

                writeProc.fail((error) => {
                    reject(error);
                });
            });
        });
    }

    static async removeSystemdTimer(poolName) {
        return new Promise((resolve, reject) => {
            const timerName = `zfs-scrub-${poolName}.timer`;
            const serviceName = `zfs-scrub-${poolName}.service`;

            const commands = [
                `systemctl stop ${timerName}`,
                `systemctl disable ${timerName}`,
                `rm -f /etc/systemd/system/${timerName}`,
                `rm -f /etc/systemd/system/${serviceName}`,
                'systemctl daemon-reload'
            ].join(' && ');

            const proc = cockpit.spawn(['sh', '-c', commands], { err: 'message' });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`Failed to remove systemd timer: exit code ${exitCode}`));
                }
            });

            proc.fail((error) => {
                reject(error);
            });
        });
    }

    static async removeCronJob(poolName) {
        return new Promise((resolve, reject) => {
            const proc = cockpit.spawn(['crontab', '-l'], { err: 'message' });
            let currentCrontab = '';

            proc.stream((data) => {
                currentCrontab += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    const lines = currentCrontab.split('\n');
                    const filtered = lines.filter(line => 
                        !(line.includes('zpool') && line.includes('scrub') && line.includes(poolName))
                    ).join('\n') + '\n';

                    const writeProc = cockpit.spawn(['sh', '-c', `echo ${cockpit.escape(filtered)} | crontab -`], { err: 'message' });

                    writeProc.done((writeExitCode) => {
                        if (writeExitCode === 0) {
                            resolve();
                        } else {
                            reject(new Error(`Failed to remove cron job: exit code ${writeExitCode}`));
                        }
                    });

                    writeProc.fail((error) => {
                        reject(error);
                    });
                } else {
                    resolve(); // No crontab exists
                }
            });

            proc.fail(() => {
                resolve(); // No crontab exists
            });
        });
    }
}

