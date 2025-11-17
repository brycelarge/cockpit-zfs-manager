import React, { useState, useEffect } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";

import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';

function ReplaceDiskDialog({ pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [poolDevices, setPoolDevices] = useState([]);
    const [availableDisks, setAvailableDisks] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState('');
    const [replacementDevice, setReplacementDevice] = useState('');
    const [force, setForce] = useState(false);
    const [loading, setLoading] = useState(true);
    const [replacing, setReplacing] = useState(false);
    const [validationFailed, setValidationFailed] = useState({});
    const [error, setError] = useState({});

    useEffect(() => {
        loadData();
    }, [pool.name]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [devices, disks] = await Promise.all([
                ZfsApi.getPoolDevices(pool.name),
                ZfsApi.listAvailableDisks()
            ]);
            setPoolDevices(devices);
            setAvailableDisks(disks);
        } catch (exc) {
            setError({
                dialogError: 'Failed to load devices',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setLoading(false);
        }
    };

    const handleReplace = async () => {
        const validation = {};
        if (!selectedDevice) {
            validation.device = 'Please select a device to replace';
        }
        if (!replacementDevice) {
            validation.replacement = 'Please select a replacement device';
        }
        if (selectedDevice === replacementDevice) {
            validation.replacement = 'Replacement device must be different from the device being replaced';
        }

        if (Object.keys(validation).length > 0) {
            setValidationFailed(validation);
            return;
        }

        setReplacing(true);
        setError({});
        try {
            await ZfsApi.replaceDisk(pool.name, selectedDevice, replacementDevice, force);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to replace disk',
                dialogErrorDetail: exc.message || String(exc)
            });
            setReplacing(false);
        }
    };

    if (loading) {
        return (
            <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
                <ModalHeader title={`Replace Disk: ${pool.name}`} />
                <ModalBody>
                    <Spinner size="lg" aria-label="Loading devices" />
                </ModalBody>
            </Modal>
        );
    }

    return (
        <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Replace Disk: ${pool.name}`} />
            <ModalBody>
                <Form isHorizontal>
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                        />
                    )}

                    {poolDevices.length === 0 ? (
                        <Alert variant="warning" title="No devices found">
                            Unable to retrieve device list from pool status.
                        </Alert>
                    ) : (
                        <>
                            <FormGroup
                                label="Device to Replace"
                                fieldId="device"
                                validated={validationFailed.device ? 'error' : 'default'}
                            >
                                <FormSelect
                                    id="device"
                                    value={selectedDevice}
                                    onChange={(_, value) => {
                                        setSelectedDevice(value);
                                        if (validationFailed.device) {
                                            setValidationFailed({ ...validationFailed, device: undefined });
                                        }
                                    }}
                                    validated={validationFailed.device ? 'error' : 'default'}
                                >
                                    <FormSelectOption value="" label="Select a device..." isDisabled />
                                    {poolDevices.map(device => (
                                        <FormSelectOption
                                            key={device.name}
                                            value={device.name}
                                            label={`${device.name} (${device.state})`}
                                        />
                                    ))}
                                </FormSelect>
                                <FormHelper
                                    fieldId="device"
                                    helperTextInvalid={validationFailed.device}
                                />
                            </FormGroup>

                            <FormGroup
                                label="Replacement Device"
                                fieldId="replacement"
                                validated={validationFailed.replacement ? 'error' : 'default'}
                            >
                                <FormSelect
                                    id="replacement"
                                    value={replacementDevice}
                                    onChange={(_, value) => {
                                        setReplacementDevice(value);
                                        if (validationFailed.replacement) {
                                            setValidationFailed({ ...validationFailed, replacement: undefined });
                                        }
                                    }}
                                    validated={validationFailed.replacement ? 'error' : 'default'}
                                >
                                    <FormSelectOption value="" label="Select a replacement device..." isDisabled />
                                    {availableDisks.map(disk => (
                                        <FormSelectOption
                                            key={disk.path}
                                            value={disk.path}
                                            label={`${disk.path} (${disk.size})`}
                                        />
                                    ))}
                                </FormSelect>
                                <FormHelper
                                    fieldId="replacement"
                                    helperTextInvalid={validationFailed.replacement}
                                />
                            </FormGroup>

                            {selectedDevice && (
                                <Alert variant="info" title="Replacement Process">
                                    The selected device will be replaced with the new device. This operation may take some time depending on pool size. The pool will remain accessible during replacement.
                                </Alert>
                            )}

                            <Checkbox
                                id="force-replace-disk"
                                label="Force replacement (replace even if device is in use)"
                                isChecked={force}
                                onChange={(_, checked) => setForce(checked)}
                                style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}
                            />
                            <p style={{ marginTop: 'var(--pf-t--global--spacer--sm)', fontSize: 'var(--pf-t--global--font--size--sm)', color: 'var(--pf-t--global--text--color--muted)' }}>
                                Use this if the replacement device is in use or contains a filesystem.
                            </p>
                        </>
                    )}
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    onClick={handleReplace}
                    isDisabled={!selectedDevice || !replacementDevice || replacing || poolDevices.length === 0}
                    isLoading={replacing}
                >
                    Replace Disk
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={replacing}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default ReplaceDiskDialog;

