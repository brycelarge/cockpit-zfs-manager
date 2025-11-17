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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
            const results = [];
            
            // Check for systemd timers
            const proc = cockpit.spawn(['systemctl', 'list-timers', '--all', '--no-pager', '--output=json'], { err: 'message' });
            let output = '';

            proc.stream((data) => {
                output += data;
            });

            proc.done(async (exitCode) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    try {
                        if (output.trim()) {
                            const timers = output.trim().split('\n')
                                .filter(line => line.trim())
                                .map(line => {
                                    try {
                                        return JSON.parse(line);
                                    } catch {
                                        return null;
                                    }
                                })
                                .filter(t => t !== null)
                                .filter(t => {
                                    // Check various possible field names for unit name
                                    const unitName = t.unit || t.UNIT || t.name || '';
                                    return unitName.includes('zfs-scrub');
                                })
                                .map(t => {
                                    // Normalize unit name field
                                    const unitName = t.unit || t.UNIT || t.name || '';
                                    return {
                                        ...t,
                                        unit: unitName,
                                        type: 'systemd'
                                    };
                                });
                            
                            console.log('Found systemd timers:', timers);
                            results.push(...timers);
                        }
                    } catch (e) {
                        console.error('Error parsing systemd timers:', e);
                        // Continue to check cron
                    }
                }
                
                // Always check cron as well (in case both exist)
                try {
                    const cronScrubs = await this.getCronScrubs();
                    console.log('Found cron scrubs:', cronScrubs);
                    results.push(...cronScrubs);
                } catch (e) {
                    console.error('Error getting cron scrubs:', e);
                }
                
                console.log('All scheduled scrubs:', results);
                resolve(results);
            });

            proc.fail(async (error) => {
                console.warn('systemctl list-timers failed, checking cron only:', error);
                // If systemd check fails (e.g., DBus errors), still check cron
                try {
                    const cronScrubs = await this.getCronScrubs();
                    resolve(cronScrubs);
                } catch (e) {
                    console.error('Error getting cron scrubs:', e);
                    resolve([]);
                }
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
                // Exit code 0 means success
                // Exit code 1 typically means no crontab exists, which is fine - return empty array
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode === 1 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
            // Note: Persistent=false means it won't trigger immediately if scheduled time has passed
            const timerContent = `[Unit]
Description=ZFS Scrub Timer for ${poolName}
Requires=${serviceName}

[Timer]
OnCalendar=${onCalendar}
Persistent=false

[Install]
WantedBy=timers.target
`;

            // Write files and enable timer using temp files
            const serviceTemp = `/tmp/${serviceName}.$$`;
            const timerTemp = `/tmp/${timerName}.$$`;
            const commands = [
                `cat > ${serviceTemp} && mv ${serviceTemp} ${servicePath}`,
                `cat > ${timerTemp} && mv ${timerTemp} ${timerPath}`,
                'systemctl daemon-reload',
                `systemctl enable ${timerName}`,
                `systemctl start ${timerName}`
            ].join(' && ');

            // Write service file
            const serviceProc = cockpit.spawn(['sh', '-c', `cat > ${servicePath}`], { err: 'message' });
            serviceProc.input(serviceContent);
            
            serviceProc.done(async (exitCode) => {
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode !== 0 && exitCode != null && exitCode !== '' && exitCode !== undefined) {
                    reject(new Error(`Failed to write service file: exit code ${exitCode}`));
                    return;
                }
                
                // Write timer file
                const timerProc = cockpit.spawn(['sh', '-c', `cat > ${timerPath}`], { err: 'message' });
                timerProc.input(timerContent);
                
                timerProc.done(async (timerExitCode) => {
                    // Exit code 0 means success
                    // null/undefined/empty exit code means process completed (treat as success)
                    if (timerExitCode !== 0 && timerExitCode != null && timerExitCode !== '' && timerExitCode !== undefined) {
                        reject(new Error(`Failed to write timer file: exit code ${timerExitCode}`));
                        return;
                    }
                    
                    // Reload, enable, and start the timer
                    // With Persistent=false, it won't trigger immediately even if scheduled time has passed
                    const enableProc = cockpit.spawn(['sh', '-c', `systemctl daemon-reload && systemctl enable --now ${timerName}`], { err: 'message' });
                    
                    enableProc.done((enableExitCode) => {
                        // Exit code 0 means success
                        // null/undefined/empty exit code means process completed (treat as success)
                        if (enableExitCode === 0 || enableExitCode == null || enableExitCode === '' || enableExitCode === undefined) {
                            resolve();
                        } else {
                            reject(new Error(`Failed to enable timer: exit code ${enableExitCode}`));
                        }
                    });
                    
                    enableProc.fail((error) => {
                        reject(error);
                    });
                });
                
                timerProc.fail((error) => {
                    reject(error);
                });
            });
            
            serviceProc.fail((error) => {
                reject(error);
            });
        });
    }

    static async createCronJob(poolName, schedule) {
        // schedule format: cron-like "0 2 * * 0" (minute hour day month dayofweek)
        return new Promise((resolve, reject) => {
            const cronLine = `${schedule} /usr/sbin/zpool scrub ${poolName} > /dev/null 2>&1`;
            console.log(`Creating cron job: ${cronLine}`);
            
            // Get current crontab, append new line, write back
            const proc = cockpit.spawn(['crontab', '-l'], { err: 'message' });
            let currentCrontab = '';

            proc.stream((data) => {
                currentCrontab += data;
            });

            proc.done((exitCode) => {
                console.log(`crontab -l exit code: ${exitCode}, current crontab length: ${currentCrontab.length}`);
                const newCrontab = (currentCrontab.trim() || '') + '\n' + cronLine + '\n';
                console.log(`New crontab content:\n${newCrontab}`);
                
                // Write crontab via temp file - ensure we have valid content
                if (!cronLine.trim()) {
                    reject(new Error('Invalid cron schedule format'));
                    return;
                }
                
                // Use temp file approach like sanoid config writing
                const tempFile = `/tmp/crontab.${Date.now()}`;
                const pythonCmd = `import sys; f=open('${tempFile}', 'w'); f.write(sys.stdin.read()); f.close()`;
                const writeProc = cockpit.spawn(['python3', '-c', pythonCmd], { err: 'message' });
                writeProc.input(newCrontab);

                writeProc.done((writeExitCode) => {
                    console.log(`Python write temp file exit code: ${writeExitCode}`);
                    // Exit code 0 means success
                    // null/undefined/empty exit code means process completed (treat as success)
                    if (writeExitCode !== 0 && writeExitCode != null && writeExitCode !== '' && writeExitCode !== undefined) {
                        reject(new Error(`Failed to write temp crontab: exit code ${writeExitCode}`));
                        return;
                    }
                    
                    // Install crontab from temp file
                    const installProc = cockpit.spawn(['crontab', tempFile], { err: 'message' });
                    installProc.done((installExitCode) => {
                        console.log(`crontab install exit code: ${installExitCode}`);
                        // Clean up temp file
                        cockpit.spawn(['rm', '-f', tempFile]);
                        
                        // Exit code 0 means success
                        // null/undefined/empty exit code means process completed (treat as success)
                        if (installExitCode === 0 || installExitCode == null || installExitCode === '' || installExitCode === undefined) {
                            console.log('Cron job created successfully');
                            resolve();
                        } else {
                            reject(new Error(`Failed to install cron job: exit code ${installExitCode}`));
                        }
                    });
                    
                    installProc.fail((error) => {
                        console.error('Failed to install crontab:', error);
                        cockpit.spawn(['rm', '-f', tempFile]);
                        reject(error);
                    });
                });

                writeProc.fail((error) => {
                    console.error('Failed to write temp crontab:', error);
                    reject(error);
                });
            });

            proc.fail((error) => {
                // No existing crontab, create new one
                console.log('No existing crontab, creating new one');
                if (!cronLine.trim()) {
                    reject(new Error('Invalid cron schedule format'));
                    return;
                }
                
                const cronContent = cronLine + '\n';
                console.log(`New crontab content:\n${cronContent}`);
                // Use temp file approach
                const tempFile = `/tmp/crontab.${Date.now()}`;
                const pythonCmd = `import sys; f=open('${tempFile}', 'w'); f.write(sys.stdin.read()); f.close()`;
                const writeProc = cockpit.spawn(['python3', '-c', pythonCmd], { err: 'message' });
                writeProc.input(cronContent);

                writeProc.done((writeExitCode) => {
                    console.log(`Python write temp file exit code: ${writeExitCode}`);
                    // Exit code 0 means success
                    // null/undefined/empty exit code means process completed (treat as success)
                    if (writeExitCode !== 0 && writeExitCode != null && writeExitCode !== '' && writeExitCode !== undefined) {
                        reject(new Error(`Failed to write temp crontab: exit code ${writeExitCode}`));
                        return;
                    }
                    
                    // Install crontab from temp file
                    const installProc = cockpit.spawn(['crontab', tempFile], { err: 'message' });
                    installProc.done((installExitCode) => {
                        console.log(`crontab install exit code: ${installExitCode}`);
                        // Clean up temp file
                        cockpit.spawn(['rm', '-f', tempFile]);
                        
                        // Exit code 0 means success
                        // null/undefined/empty exit code means process completed (treat as success)
                        if (installExitCode === 0 || installExitCode == null || installExitCode === '' || installExitCode === undefined) {
                            console.log('Cron job created successfully');
                            resolve();
                        } else {
                            reject(new Error(`Failed to install cron job: exit code ${installExitCode}`));
                        }
                    });
                    
                    installProc.fail((error) => {
                        console.error('Failed to install crontab:', error);
                        cockpit.spawn(['rm', '-f', tempFile]);
                        reject(error);
                    });
                });

                writeProc.fail((error) => {
                    console.error('Failed to write temp crontab:', error);
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
                // Exit code 0 means success
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode == null || exitCode === '' || exitCode === undefined) {
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
                // Exit code 0 means success
                // Exit code 1 typically means no crontab exists, which is fine - resolve successfully
                // null/undefined/empty exit code means process completed (treat as success)
                if (exitCode === 0 || exitCode === 1 || exitCode == null || exitCode === '' || exitCode === undefined) {
                    const lines = currentCrontab.split('\n');
                    const filtered = lines.filter(line => 
                        !(line.includes('zpool') && line.includes('scrub') && line.includes(poolName))
                    ).join('\n') + '\n';

                    // Use temp file approach
                    const tempFile = `/tmp/crontab.${Date.now()}`;
                    const pythonCmd = `import sys; f=open('${tempFile}', 'w'); f.write(sys.stdin.read()); f.close()`;
                    const writeProc = cockpit.spawn(['python3', '-c', pythonCmd], { err: 'message' });
                    writeProc.input(filtered);

                    writeProc.done((writeExitCode) => {
                        if (writeExitCode !== 0) {
                            reject(new Error(`Failed to write temp crontab: exit code ${writeExitCode}`));
                            return;
                        }
                        
                        // Install crontab from temp file
                        const installProc = cockpit.spawn(['crontab', tempFile], { err: 'message' });
                        installProc.done((installExitCode) => {
                            // Clean up temp file
                            cockpit.spawn(['rm', '-f', tempFile]);
                            
                            if (installExitCode === 0) {
                                resolve();
                            } else {
                                reject(new Error(`Failed to install cron job: exit code ${installExitCode}`));
                            }
                        });
                        
                        installProc.fail((error) => {
                            cockpit.spawn(['rm', '-f', tempFile]);
                            reject(error);
                        });
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

