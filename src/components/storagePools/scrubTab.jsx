import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription } from "@patternfly/react-core/dist/esm/components/DescriptionList";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';
import { ScrubApi } from '../../zfsApi/scrub.js';

function ScrubTab({ pool }) {
    const Dialogs = useDialogs();
    const [scrubStatus, setScrubStatus] = useState(null);
    const [scheduledScrub, setScheduledScrub] = useState(null);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [stopping, setStopping] = useState(false);
    const [scheduling, setScheduling] = useState(false);
    const [scheduleType, setScheduleType] = useState('weekly');
    const [customSchedule, setCustomSchedule] = useState('0 2 * * 0');
    const [error, setError] = useState({});

    useEffect(() => {
        loadScrubInfo();
    }, [pool.name]);

    const loadScrubInfo = async () => {
        setLoading(true);
        try {
            const [status, scheduled] = await Promise.all([
                ScrubApi.getScrubStatus(pool.name),
                ScrubApi.getScheduledScrubs()
            ]);
            setScrubStatus(status);
            
            // Find scheduled scrub for this pool
            const poolScrub = scheduled.find(s => 
                s.unit?.includes(pool.name) || s.command?.includes(pool.name)
            );
            setScheduledScrub(poolScrub || null);
        } catch (exc) {
            setError({
                dialogError: 'Failed to load scrub information',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setLoading(false);
        }
    };

    const handleStartScrub = async () => {
        setStarting(true);
        setError({});
        try {
            await ScrubApi.startScrub(pool.name);
            await loadScrubInfo();
        } catch (exc) {
            setError({
                dialogError: 'Failed to start scrub',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setStarting(false);
        }
    };

    const handleStopScrub = async () => {
        setStopping(true);
        setError({});
        try {
            await ScrubApi.stopScrub(pool.name);
            await loadScrubInfo();
        } catch (exc) {
            setError({
                dialogError: 'Failed to stop scrub',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setStopping(false);
        }
    };

    const handleScheduleScrub = async () => {
        setScheduling(true);
        setError({});
        try {
            let schedule = scheduleType;
            if (scheduleType === 'custom') {
                schedule = customSchedule;
            }

            // Try systemd first, fallback to cron
            try {
                await ScrubApi.createSystemdTimer(pool.name, schedule);
            } catch {
                await ScrubApi.createCronJob(pool.name, schedule);
            }

            await loadScrubInfo();
        } catch (exc) {
            setError({
                dialogError: 'Failed to schedule scrub',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setScheduling(false);
        }
    };

    const handleRemoveSchedule = async () => {
        setScheduling(true);
        setError({});
        try {
            // Try removing systemd timer first, then cron
            try {
                await ScrubApi.removeSystemdTimer(pool.name);
            } catch {
                await ScrubApi.removeCronJob(pool.name);
            }
            await loadScrubInfo();
        } catch (exc) {
            setError({
                dialogError: 'Failed to remove schedule',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setScheduling(false);
        }
    };

    if (loading) {
        return <Spinner size="lg" aria-label="Loading scrub information" />;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                <h3>Scrub Status</h3>
                <Button variant="secondary" onClick={loadScrubInfo} isDisabled={loading || starting || stopping}>
                    Refresh
                </Button>
            </div>

            {error.dialogError && (
                <ModalError
                    dialogError={error.dialogError}
                    {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                    style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}
                />
            )}

            {scrubStatus && (
                <DescriptionList isHorizontal style={{ marginBottom: 'var(--pf-t--global--spacer--lg)' }}>
                    <DescriptionListGroup>
                        <DescriptionListTerm>Status</DescriptionListTerm>
                        <DescriptionListDescription>
                            {scrubStatus.inProgress ? (
                                <span style={{ color: 'var(--pf-t--global--info--color--100)' }}>
                                    In Progress
                                </span>
                            ) : (
                                <span style={{ color: 'var(--pf-t--global--success--color--100)' }}>
                                    Idle
                                </span>
                            )}
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    {scrubStatus.lastScrub && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>Last Scrub</DescriptionListTerm>
                            <DescriptionListDescription>{scrubStatus.lastScrub}</DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    {scrubStatus.scan && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>Scan Details</DescriptionListTerm>
                            <DescriptionListDescription>{scrubStatus.scan}</DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    {scrubStatus.errors && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>Errors</DescriptionListTerm>
                            <DescriptionListDescription>
                                <span style={{ color: scrubStatus.errors.includes('No') ? 'var(--pf-t--global--success--color--100)' : 'var(--pf-t--global--danger--color--100)' }}>
                                    {scrubStatus.errors}
                                </span>
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                </DescriptionList>
            )}

            <div style={{ marginTop: error.dialogError ? 'var(--pf-t--global--spacer--md)' : '0', marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                {scrubStatus?.inProgress ? (
                    <Button
                        variant="danger"
                        onClick={handleStopScrub}
                        isDisabled={stopping}
                        isLoading={stopping}
                    >
                        Stop Scrub
                    </Button>
                ) : (
                    <Button
                        variant="primary"
                        onClick={handleStartScrub}
                        isDisabled={starting}
                        isLoading={starting}
                    >
                        Start Scrub Now
                    </Button>
                )}
            </div>

            <div style={{ marginTop: 'var(--pf-t--global--spacer--xl)', marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                <h3>Schedule</h3>
            </div>

            {scheduledScrub ? (
                <Alert variant="info" title="Scrub is scheduled" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>
                        {scheduledScrub.schedule ? `Cron schedule: ${scheduledScrub.schedule}` : 'Systemd timer is active'}
                    </p>
                    <Button
                        variant="secondary"
                        onClick={handleRemoveSchedule}
                        isDisabled={scheduling}
                        isLoading={scheduling}
                        style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}
                    >
                        Remove Schedule
                    </Button>
                </Alert>
            ) : (
                <Form>
                    <FormGroup
                        label="Schedule Type"
                        fieldId="schedule-type"
                    >
                        <FormSelect
                            id="schedule-type"
                            value={scheduleType}
                            onChange={(_, value) => setScheduleType(value)}
                        >
                            <FormSelectOption value="weekly" label="Weekly (Sunday 2 AM)" />
                            <FormSelectOption value="monthly" label="Monthly (1st of month, 2 AM)" />
                            <FormSelectOption value="custom" label="Custom (Cron format)" />
                        </FormSelect>
                    </FormGroup>

                    {scheduleType === 'custom' && (
                        <FormGroup
                            label="Cron Schedule"
                            fieldId="custom-schedule"
                            helperText="Format: minute hour day month dayofweek (e.g., '0 2 * * 0' for Sunday 2 AM)"
                        >
                            <TextInput
                                id="custom-schedule"
                                value={customSchedule}
                                onChange={(_, value) => setCustomSchedule(value)}
                                placeholder="0 2 * * 0"
                            />
                        </FormGroup>
                    )}

                    <Button
                        variant="primary"
                        onClick={handleScheduleScrub}
                        isDisabled={scheduling}
                        isLoading={scheduling}
                        style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}
                    >
                        Schedule Scrub
                    </Button>
                </Form>
            )}
        </div>
    );
}

export default ScrubTab;

