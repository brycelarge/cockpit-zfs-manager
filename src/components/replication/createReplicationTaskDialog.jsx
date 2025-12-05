import React, { useState } from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';
import { SchedulerApi } from '../../zfsApi/scheduler.js';

function CreateReplicationTaskDialog({ pools, onRefresh }) {
    const Dialogs = useDialogs();

    const [sourcePool, setSourcePool] = useState('');
    const [sourceDataset, setSourceDataset] = useState('');
    const [destinationType, setDestinationType] = useState('local');
    const [destinationPool, setDestinationPool] = useState('');
    const [destinationPath, setDestinationPath] = useState('');
    const [recursive, setRecursive] = useState(true);

    const [scheduleType, setScheduleType] = useState('daily');
    const [customSchedule, setCustomSchedule] = useState('0 0 * * *');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState({});

    const scheduleOptions = [
        { value: 'hourly', label: 'Hourly (@hourly)', cron: '0 * * * *' },
        { value: 'daily', label: 'Daily (@daily)', cron: '0 0 * * *' },
        { value: 'weekly', label: 'Weekly (@weekly)', cron: '0 0 * * 0' },
        { value: 'monthly', label: 'Monthly (@monthly)', cron: '0 0 1 * *' },
        { value: 'custom', label: 'Custom Cron Expression', cron: '' }
    ];

    const handleCreate = async () => {
        setLoading(true);
        setError({});

        try {
            let source = sourceDataset ? `${sourcePool}/${sourceDataset}` : sourcePool;
            if (!source) throw new Error("Source is required");

            let destination = '';
            if (destinationType === 'local') {
                if (!destinationPool) throw new Error("Destination pool is required");
                destination = destinationPool;
            } else {
                if (!destinationPath) throw new Error("SSH Destination is required (user@host:pool/dataset)");
                destination = destinationPath;
            }

            let schedule = scheduleType === 'custom' ? customSchedule : scheduleOptions.find(o => o.value === scheduleType)?.cron;
            if (!schedule) throw new Error("Invalid schedule");

            // Build syncoid command
            // syncoid --no-privilege-elevation if running as non-root? usually running as root here.
            // -r for recursive is default in syncoid usually but let's be explicit if flag exists, actually syncoid is recursive by default for datasets
            // usually command is: syncoid source target

            let cmd = `syncoid ${recursive ? '--recursive' : ''} ${source} ${destination}`;
            // Basic syncoid command construction

            await SchedulerApi.addTask(schedule, cmd);
            onRefresh();
            Dialogs.close();
        } catch (exc) {
            setError({
                dialogError: 'Failed to create task',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal variant="medium" isOpen onClose={Dialogs.close}>
            <ModalHeader title="Create Replication Task" />
            <ModalBody>
                <Form isHorizontal>
                    {error.dialogError && (
                        <ModalError dialogError={error.dialogError} dialogErrorDetail={error.dialogErrorDetail} />
                    )}

                    <FormGroup label="Source Pool" fieldId="source-pool" isRequired>
                        <FormSelect value={sourcePool} onChange={(_, val) => setSourcePool(val)} id="source-pool">
                            <FormSelectOption value="" label="Select Pool" isDisabled />
                            {pools.map(p => <FormSelectOption key={p.name} value={p.name} label={p.name} />)}
                        </FormSelect>
                    </FormGroup>

                    <FormGroup label="Source Dataset (Optional)" fieldId="source-dataset">
                        <TextInput value={sourceDataset} onChange={(_, val) => setSourceDataset(val)} id="source-dataset" placeholder="dataset/child" />
                    </FormGroup>

                    <FormGroup label="Recursive" fieldId="recursive">
                        <Checkbox id="recursive" isChecked={recursive} onChange={(_, val) => setRecursive(val)} label="Replicate recursively" />
                    </FormGroup>

                    <FormGroup label="Destination Type" fieldId="dest-type">
                        <FormSelect value={destinationType} onChange={(_, val) => setDestinationType(val)} id="dest-type">
                            <FormSelectOption value="local" label="Local Pool" />
                            <FormSelectOption value="ssh" label="Remote (SSH)" />
                        </FormSelect>
                    </FormGroup>

                    {destinationType === 'local' ? (
                        <FormGroup label="Destination Pool" fieldId="dest-pool" isRequired>
                            <FormSelect value={destinationPool} onChange={(_, val) => setDestinationPool(val)} id="dest-pool">
                                <FormSelectOption value="" label="Select Pool" isDisabled />
                                {pools.filter(p => p.name !== sourcePool).map(p => <FormSelectOption key={p.name} value={p.name} label={p.name} />)}
                            </FormSelect>
                        </FormGroup>
                    ) : (
                        <FormGroup label="SSH Destination" fieldId="dest-path" isRequired helperText="user@host:pool/dataset">
                            <TextInput value={destinationPath} onChange={(_, val) => setDestinationPath(val)} id="dest-path" placeholder="root@192.168.1.50:backup/pool" />
                        </FormGroup>
                    )}

                    <FormGroup label="Schedule" fieldId="schedule">
                        <FormSelect value={scheduleType} onChange={(_, val) => setScheduleType(val)} id="schedule">
                            {scheduleOptions.map(opt => <FormSelectOption key={opt.value} value={opt.value} label={opt.label} />)}
                        </FormSelect>
                    </FormGroup>

                    {scheduleType === 'custom' && (
                        <FormGroup label="Cron Expression" fieldId="custom-schedule" isRequired>
                            <TextInput value={customSchedule} onChange={(_, val) => setCustomSchedule(val)} id="custom-schedule" placeholder="0 0 * * *" />
                        </FormGroup>
                    )}
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" onClick={handleCreate} isLoading={loading} isDisabled={loading}>Create Task</Button>
                <Button variant="link" onClick={Dialogs.close}>Cancel</Button>
            </ModalFooter>
        </Modal>
    );
}

export default CreateReplicationTaskDialog;
